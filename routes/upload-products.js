const express = require('express');
const sql = require('mssql');
const XLSX = require('xlsx');
const multer = require('multer');
const router = express.Router();
const { verifyToken } = require('./auth');
const fs = require('fs');
const path = require('path');
const { formatUploadDate } = require('../utils/formatUploadDate');
const {
  dedupeWithinFile,
  loadExistingCatalogFingerprints,
  filterExistingInCatalog,
} = require('../utils/filterDuplicateUploadRows');
const {
  resolveColumnMapping,
  parseRowFromSheet,
  isDataRow,
  SUPPORTED_FORMAT_HELP,
} = require('../utils/uploadColumnMap');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB limit
});

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Logging function
function logUpload(message, data = null) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}\n`;
  console.log(logMessage);
  fs.appendFileSync(path.join(logsDir, 'uploads.log'), logMessage);
}

// Parse Excel file and insert into Upload_Tbl_Products
async function parseAndInsertToUploadTable(pool, fileId, vendorId, fileContent) {
  try {
    logUpload('Starting Excel parsing for Upload_Tbl_Products', { fileId, vendorId });
    
    const workbook = XLSX.read(fileContent, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json(worksheet, {
      defval: ''
    });

    logUpload(`Excel file loaded. Total rows: ${rawData.length}`);

    // Skip header row (first row contains column names)
    let dataToProcess = rawData.slice(1);
    logUpload(`After skipping header row, processing ${dataToProcess.length} rows`);

    let successCount = 0;
    let failureCount = 0;
    const errors = [];
    let sampleRows = [];

    // Process each row
    for (let i = 0; i < dataToProcess.length; i++) {
      const row = dataToProcess[i];
      
      try {
        const date = row['Date'] || '';
        const eanUpc = row['EAN/UPC'] || '';
        const name = row['Name'] || '';
        const itemCode = row['Item_Code'] || '';
        const qty = row['Qty'] || '';
        const price = row['Price'] || '';
        
        if (!itemCode || itemCode.toString().trim() === '') {
          failureCount++;
          continue;
        }

        await pool.request()
          .input('date', sql.NVarChar, date || null)
          .input('eanUpc', sql.NVarChar, eanUpc || null)
          .input('name', sql.NVarChar, name || null)
          .input('itemCode', sql.NVarChar, itemCode)
          .input('qty', sql.NVarChar, qty || null)
          .input('price', sql.NVarChar, price || null)
          .input('vendorId', sql.Int, vendorId)
          .input('fileId', sql.Int, fileId)
          .query(`
            INSERT INTO [dbo].[Upload_Tbl_Products] 
            (Date, [EAN/UPC], Name, Item_Code, Qty, Price, VendorId, FileUploadId)
            VALUES (@date, @eanUpc, @name, @itemCode, @qty, @price, @vendorId, @fileId)
          `);

        successCount++;
      } catch (rowError) {
        failureCount++;
        errors.push(`Row ${i} error: ${rowError.message}`);
      }
    }

    logUpload('Upload_Tbl_Products parsing completed', { 
      successCount, 
      failureCount, 
      totalRows: dataToProcess.length,
      sampleRows
    });

    return { successCount, failureCount, errors };
  } catch (err) {
    logUpload('Excel parsing error', { error: err.message, stack: err.stack });
    throw new Error(`Excel parsing error: ${err.message}`);
  }
}

// Upload Excel file to Upload_Tbl_Products
router.post('/upload-products', verifyToken, async (req, res) => {
  try {
    const { vendorId, fileName, fileContent } = req.body;
    
    logUpload('Upload request received for Upload_Tbl_Products', { vendorId, fileName, fileContentLength: fileContent?.length });

    if (!vendorId || !fileName || !fileContent) {
      logUpload('Upload validation failed - missing required fields');
      return res.status(400).json({ error: 'Vendor ID, file name, and file content are required' });
    }

    const pool = req.pool;

    // Verify vendor exists
    const vendorResult = await pool.request()
      .input('vendorId', sql.Int, vendorId)
      .query('SELECT VendorId FROM [dbo].[Vendors] WHERE VendorId = @vendorId');

    if (vendorResult.recordset.length === 0) {
      logUpload('Vendor not found', { vendorId });
      return res.status(404).json({ error: 'Vendor not found' });
    }

    // Create file upload record
    const fileBuffer = Buffer.from(fileContent.split(',')[1] || fileContent, 'base64');
    const fileSize = fileBuffer.length;

    logUpload('Creating file upload record', { fileName, fileSize });

    const fileInsertResult = await pool.request()
      .input('vendorId', sql.Int, vendorId)
      .input('fileName', sql.NVarChar, fileName)
      .input('fileSize', sql.BigInt, fileSize)
      .input('uploadedBy', sql.Int, req.user.userId)
      .input('status', sql.NVarChar, 'Processing')
      .query(`
        INSERT INTO [dbo].[FileUploads] (VendorId, FileName, FileSize, UploadedBy, Status)
        VALUES (@vendorId, @fileName, @fileSize, @uploadedBy, @status)
        SELECT @@IDENTITY as FileId
      `);

    const fileId = fileInsertResult.recordset[0].FileId;
    logUpload('File upload record created', { fileId });

    // Parse and insert data
    try {
      const parseResult = await parseAndInsertToUploadTable(pool, fileId, vendorId, fileBuffer);

      // Update file upload record with results
      await pool.request()
        .input('fileId', sql.Int, fileId)
        .input('status', sql.NVarChar, 'Completed')
        .input('recordsProcessed', sql.Int, parseResult.successCount + parseResult.failureCount)
        .input('recordsSuccess', sql.Int, parseResult.successCount)
        .input('recordsFailed', sql.Int, parseResult.failureCount)
        .input('processedAt', sql.DateTime, new Date())
        .query(`
          UPDATE [dbo].[FileUploads]
          SET Status = @status,
              RecordsProcessed = @recordsProcessed,
              RecordsSuccess = @recordsSuccess,
              RecordsFailed = @recordsFailed,
              ProcessedAt = @processedAt
          WHERE FileId = @fileId
        `);

      logUpload('Upload completed successfully', parseResult);

      // Verify products were actually inserted into Upload_Tbl_Products
      const verificationResult = await pool.request()
        .input('fileId', sql.Int, fileId)
        .query(`
          SELECT COUNT(*) as InsertedCount 
          FROM [dbo].[Upload_Tbl_Products] 
          WHERE FileUploadId = @fileId
        `);

      const actualInsertedCount = verificationResult.recordset[0].InsertedCount;
      
      logUpload('Database verification', { 
        reportedSuccessCount: parseResult.successCount,
        actualInsertedCount: actualInsertedCount,
        verificationPassed: actualInsertedCount === parseResult.successCount
      });

      res.status(201).json({
        message: 'File uploaded and processed successfully into Upload_Tbl_Products',
        fileId,
        results: {
          successCount: parseResult.successCount,
          failureCount: parseResult.failureCount,
          actualInsertedCount: actualInsertedCount,
          verificationPassed: actualInsertedCount === parseResult.successCount,
          errors: parseResult.errors
        }
      });
    } catch (parseError) {
      logUpload('Parse error occurred', { error: parseError.message, fileId });
      
      // Update file upload record with error
      await pool.request()
        .input('fileId', sql.Int, fileId)
        .input('status', sql.NVarChar, 'Failed')
        .input('errorMessage', sql.NVarChar, parseError.message)
        .input('processedAt', sql.DateTime, new Date())
        .query(`
          UPDATE [dbo].[FileUploads]
          SET Status = @status,
              ErrorMessage = @errorMessage,
              ProcessedAt = @processedAt
          WHERE FileId = @fileId
        `);

      res.status(400).json({ error: 'Failed to process file: ' + parseError.message });
    }
  } catch (err) {
    logUpload('Upload error', { error: err.message, stack: err.stack });
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed: ' + err.message });
  }
});

// Helper function to get Upload_Tbl_Products schema for validation
async function getUploadTableSchema(pool) {
  try {
    const result = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'Upload_Tbl_Products'
      ORDER BY ORDINAL_POSITION
    `);
    return result.recordset;
  } catch (error) {
    throw new Error(`Failed to get table schema: ${error.message}`);
  }
}

// Helper function to validate Excel format against table schema
function validateExcelFormat(excelHeaders, tableSchema) {
  console.log('=== VALIDATION DEBUG ===');
  console.log('Excel Headers:', excelHeaders);
  const requiredColumns = ['Date', 'EAN/UPC', 'Name', 'Item_Code', 'Qty', 'Price'];
  const errors = [];
  
  // Check if all required columns exist in Excel
  for (const requiredCol of requiredColumns) {
    const found = excelHeaders.includes(requiredCol);
    console.log(`Checking required column '${requiredCol}': ${found ? 'FOUND' : 'MISSING'}`);
    if (!found) {
      errors.push(`Missing required column: '${requiredCol}'`);
    }
  }
  
  // Check if Excel has extra columns that might indicate wrong format
  const allowedColumns = [...requiredColumns, 'Vendor', 'StockQuantity']; // Vendor and StockQuantity are handled during processing
  console.log('Allowed columns:', allowedColumns);
  const extraColumns = excelHeaders.filter(col => !allowedColumns.includes(col));
  console.log('Extra columns found:', extraColumns);
  if (extraColumns.length > 0) {
    errors.push(`Unexpected columns found: ${extraColumns.join(', ')}`);
  }
  
  console.log('Validation errors:', errors);
  console.log('=== END VALIDATION DEBUG ===');
  return { isValid: errors.length === 0, errors };
}

// Upload route for multipart FormData - Minimal validation for debugging
router.post('/', upload.single('file'), async (req, res) => {
  try {
    console.log('=== UPLOAD PRODUCTS - MINIMAL VALIDATION ===');
    console.log('Request headers:', Object.keys(req.headers));
    console.log('Request body keys:', Object.keys(req.body));
    console.log('Request file:', req.file ? 'YES' : 'NO');
    
    const vendorName = req.body.vendorName;
    const file = req.file;

    console.log('Vendor:', vendorName);
    console.log('File:', file?.originalname, file?.size, file?.mimetype);

    // Log to uploads.log file
    const fs = require('fs');
    const logEntry = {
      timestamp: new Date().toISOString(),
      vendorName: vendorName,
      fileName: file?.originalname,
      fileSize: file?.size,
      mimeType: file?.mimetype,
      status: 'REQUEST_RECEIVED'
    };
    fs.appendFileSync('logs/uploads.log', JSON.stringify(logEntry) + '\n');

    // Step 1: Basic validation only
    if (!vendorName || !file) {
      const errorEntry = {
        timestamp: new Date().toISOString(),
        error: 'Missing vendor or file',
        vendorName: vendorName,
        hasFile: !!file,
        status: 'VALIDATION_FAILED'
      };
      fs.appendFileSync('logs/uploads.log', JSON.stringify(errorEntry) + '\n');
      
      return res.status(400).json({
        success: false,
        message: 'Vendor name and file are required'
      });
    }

    // Validate file extension
    const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
    if (fileExtension !== 'xlsx' && fileExtension !== 'xls') {
      const errorEntry = {
        timestamp: new Date().toISOString(),
        error: 'Invalid file extension',
        fileName: file.originalname,
        extension: fileExtension,
        status: 'EXTENSION_FAILED'
      };
      fs.appendFileSync('logs/uploads.log', JSON.stringify(errorEntry) + '\n');
      
      return res.status(400).json({
        success: false,
        message: 'Invalid file format. Only Excel files (.xlsx, .xls) are allowed'
      });
    }

    const pool = req.pool;
    console.log('Database pool available:', !!pool);

    // Step 2: Parse Excel file (minimal validation)
    console.log('Parsing Excel file...');
    let workbook;
    try {
      workbook = XLSX.read(file.buffer, { type: 'buffer' });
      console.log('✅ Excel file parsed successfully');
      console.log('Sheet names:', workbook.SheetNames);
      
      const parseEntry = {
        timestamp: new Date().toISOString(),
        fileName: file.originalname,
        sheets: workbook.SheetNames,
        status: 'EXCEL_PARSED'
      };
      fs.appendFileSync('logs/uploads.log', JSON.stringify(parseEntry) + '\n');
      
    } catch (error) {
      console.error('❌ Excel parse error:', error.message);
      const errorEntry = {
        timestamp: new Date().toISOString(),
        error: 'Excel parse failed',
        fileName: file.originalname,
        errorMessage: error.message,
        status: 'PARSE_FAILED'
      };
      fs.appendFileSync('logs/uploads.log', JSON.stringify(errorEntry) + '\n');
      
      return res.status(400).json({
        success: false,
        message: 'Failed to parse Excel file: ' + error.message
      });
    }

    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

    console.log('Total rows in Excel:', data.length);
    console.log('First row (headers):', data[0]);

    if (data.length < 2) {
      const errorEntry = {
        timestamp: new Date().toISOString(),
        error: 'Insufficient data',
        fileName: file.originalname,
        rows: data.length,
        status: 'INSUFFICIENT_DATA'
      };
      fs.appendFileSync('logs/uploads.log', JSON.stringify(errorEntry) + '\n');
      
      return res.status(400).json({
        success: false,
        message: 'Excel file must contain at least a header row and one data row'
      });
    }

    const { mapping, displayHeaders, missing, priceColumnIndexes } = resolveColumnMapping(data[0]);
    console.log('Excel headers found:', displayHeaders);
    console.log('Column mapping:', mapping, 'price columns:', priceColumnIndexes);

    if (missing.length > 0) {
      const errorEntry = {
        timestamp: new Date().toISOString(),
        error: 'Missing required columns',
        fileName: file.originalname,
        foundHeaders: displayHeaders,
        missingColumns: missing,
        status: 'COLUMNS_MISSING',
      };
      fs.appendFileSync('logs/uploads.log', JSON.stringify(errorEntry) + '\n');

      return res.status(400).json({
        success: false,
        message: `Missing required column(s): ${missing.join(', ')}. ${SUPPORTED_FORMAT_HELP}`,
        found: displayHeaders,
        validationErrors: {
          required: ['date', 'eanUpc', 'name', 'itemCode', 'qty', 'price'],
          actual: displayHeaders,
        },
      });
    }

    // Step 3: Truncate Upload_Tbl_Products table
    console.log('Truncating Upload_Tbl_Products table...');
    try {
      await pool.request().query('TRUNCATE TABLE Upload_Tbl_Products');
      console.log('✅ Table truncated successfully');
      
      const truncateEntry = {
        timestamp: new Date().toISOString(),
        action: 'Table truncated',
        table: 'Upload_Tbl_Products',
        status: 'TRUNCATE_SUCCESS'
      };
      fs.appendFileSync('logs/uploads.log', JSON.stringify(truncateEntry) + '\n');
      
    } catch (truncateError) {
      console.error('❌ Truncate error:', truncateError.message);
      const errorEntry = {
        timestamp: new Date().toISOString(),
        error: 'Truncate failed',
        errorMessage: truncateError.message,
        status: 'TRUNCATE_FAILED'
      };
      fs.appendFileSync('logs/uploads.log', JSON.stringify(errorEntry) + '\n');
      
      return res.status(500).json({
        success: false,
        message: `Failed to truncate table: ${truncateError.message}`
      });
    }

    // Step 4: Import data - BULK INSERT using table variable
    console.log('Importing data (bulk)...');
    let insertedCount = 0;
    let errorCount = 0;
    const importErrors = [];

    // Build rows array, skip header
    const rows = [];
    const invalidDateRows = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0 || !isDataRow(row, mapping)) continue;

      const parsed = parseRowFromSheet(row, mapping, priceColumnIndexes);
      const date = formatUploadDate(parsed.date);
      if (!date) {
        invalidDateRows.push(i + 1);
        continue;
      }

      rows.push({
        date,
        eanUpc: parsed.eanUpc,
        name: parsed.name,
        itemCode: parsed.itemCode,
        qty: parsed.qty,
        price: parsed.price,
      });
    }

    if (invalidDateRows.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid Date in row(s): ${invalidDateRows.join(', ')}. Use a valid Excel date or MM-DD-YY format (e.g. 01-18-26).`,
        invalidRows: invalidDateRows,
      });
    }

    const totalRowsInFile = rows.length;
    const { unique: rowsInFile, skippedInFile } = dedupeWithinFile(rows);
    const existingFingerprints = await loadExistingCatalogFingerprints(pool, vendorName);
    const { newRows, skippedExisting } = filterExistingInCatalog(rowsInFile, existingFingerprints);
    const rowsSkippedDuplicates = skippedInFile + skippedExisting;

    console.log(
      `Duplicate filter (all fields): ${totalRowsInFile} in file → ${rowsInFile.length} unique in file → ${newRows.length} new (${rowsSkippedDuplicates} identical rows skipped)`,
    );

    if (newRows.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          'No new products to import. Every row is identical to one already in the catalog for this vendor or repeated in the file.',
        results: {
          rowsInFile: totalRowsInFile,
          rowsSkippedDuplicates,
          rowsInserted: 0,
          vendor: vendorName,
        },
      });
    }

    // Insert in batches of 250 to avoid parameter limits (SQL Server allows max 2100 parameters)
    const BATCH_SIZE = 250;
    for (let b = 0; b < newRows.length; b += BATCH_SIZE) {
      const batch = newRows.slice(b, b + BATCH_SIZE);
      const valuePlaceholders = batch.map((_, idx) =>
        `(@d${idx},@e${idx},@n${idx},@i${idx},@q${idx},@p${idx})`
      ).join(',');

      const req = pool.request();
      batch.forEach((r, idx) => {
        req.input(`d${idx}`, sql.NVarChar, r.date);
        req.input(`e${idx}`, sql.NVarChar, r.eanUpc);
        req.input(`n${idx}`, sql.NVarChar, r.name);
        req.input(`i${idx}`, sql.NVarChar, r.itemCode);
        req.input(`q${idx}`, sql.NVarChar, r.qty);
        req.input(`p${idx}`, sql.NVarChar, r.price);
      });

      try {
        await req.query(`
          INSERT INTO Upload_Tbl_Products (Date, [EAN/UPC], Name, Item_Code, Qty, Price)
          VALUES ${valuePlaceholders}
        `);
        insertedCount += batch.length;
      } catch (batchError) {
        errorCount += batch.length;
        importErrors.push(`Batch ${b}-${b + batch.length}: ${batchError.message}`);
        console.error(`Batch insert error:`, batchError.message);
      }
    }

    console.log(`✅ Bulk import completed: ${insertedCount} rows inserted, ${errorCount} rows failed`);

    const importEntry = {
      timestamp: new Date().toISOString(),
      fileName: file.originalname,
      rowsInserted: insertedCount,
      rowsFailed: errorCount,
      status: 'IMPORT_COMPLETED'
    };
    fs.appendFileSync('logs/uploads.log', JSON.stringify(importEntry) + '\n');

    if (insertedCount === 0) {
      return res.status(400).json({
        success: false,
        message: 'No data was imported. Please check your Excel file format.',
        errors: importErrors,
        results: { rowsSkippedDuplicates },
      });
    }

    // Step 5: Execute stored procedure
    console.log('Executing stored procedure Proc_Upload_Tbl_Products with vendor:', vendorName);
    try {
      await pool.request()
        .input('Vendor', sql.NVarChar, vendorName)
        .execute('Proc_Upload_Tbl_Products');
      console.log('✅ Stored procedure executed successfully');
      
      const procedureEntry = {
        timestamp: new Date().toISOString(),
        vendor: vendorName,
        procedure: 'Proc_Upload_Tbl_Products',
        status: 'PROCEDURE_SUCCESS'
      };
      fs.appendFileSync('logs/uploads.log', JSON.stringify(procedureEntry) + '\n');
      
    } catch (procedureError) {
      console.error('❌ Procedure error:', procedureError.message);
      const errorEntry = {
        timestamp: new Date().toISOString(),
        error: 'Procedure failed',
        vendor: vendorName,
        errorMessage: procedureError.message,
        status: 'PROCEDURE_FAILED'
      };
      fs.appendFileSync('logs/uploads.log', JSON.stringify(errorEntry) + '\n');
      
      return res.status(500).json({
        success: false,
        message: `Stored procedure execution failed: ${procedureError.message}`
      });
    }

    // Step 6: Return success
    const successEntry = {
      timestamp: new Date().toISOString(),
      vendor: vendorName,
      fileName: file.originalname,
      rowsInserted: insertedCount,
      rowsFailed: errorCount,
      status: 'UPLOAD_SUCCESS'
    };
    fs.appendFileSync('logs/uploads.log', JSON.stringify(successEntry) + '\n');

    const successMessage =
      rowsSkippedDuplicates > 0
        ? `Uploaded ${insertedCount} new product(s). Skipped ${rowsSkippedDuplicates} row(s) with identical data already in the catalog or repeated in the file.`
        : 'Product data uploaded and processed successfully';

    return res.json({
      success: true,
      message: successMessage,
      results: {
        rowsInFile: totalRowsInFile,
        rowsInserted: insertedCount,
        rowsSkippedDuplicates,
        rowsFailed: errorCount,
        vendor: vendorName,
        errors: importErrors,
      },
    });

  } catch (error) {
    console.error('❌ Upload process error:', error.message);
    console.error('Stack:', error.stack);
    
    const errorEntry = {
      timestamp: new Date().toISOString(),
      error: 'Upload process failed',
      errorMessage: error.message,
      stack: error.stack,
      status: 'PROCESS_FAILED'
    };
    fs.appendFileSync('logs/uploads.log', JSON.stringify(errorEntry) + '\n');
    
    return res.status(500).json({
      success: false,
      message: `Upload process failed: ${error.message}`
    });
  }
});

module.exports = router;
