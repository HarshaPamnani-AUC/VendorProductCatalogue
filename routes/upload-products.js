const express = require('express');
const sql = require('mssql');
const XLSX = require('xlsx');
const multer = require('multer');
const router = express.Router();
const { verifyToken } = require('./auth');
const fs = require('fs');
const path = require('path');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
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
        // Map columns according to our template structure
        const date = row['Date'] || '';
        const eanUpc = row['EAN/UPC'] || '';
        const name = row['Name'] || '';
        const itemCode = row['Item_Code'] || '';
        const qty = row['Qty'] || '';
        const price = row['Price'] || '';
        
        // Debug: Log the raw values and validation
        if (i < 5) {
          console.log(`Row ${i} - Raw values:`, {
            date: row['Date'],
            eanUpc: row['EAN/UPC'],
            name: row['Name'],
            itemCode: row['Item_Code'],
            qty: row['Qty'],
            price: row['Price'],
            allColumns: Object.keys(row),
            allValues: Object.values(row)
          });
        }
        
        // Log first few rows for debugging
        if (i < 5) {
          sampleRows.push({
            rowIndex: i,
            rawRow: row,
            mappedData: {
              date,
              eanUpc,
              name,
              itemCode,
              qty,
              price,
              availableColumns: Object.keys(row)
            }
          });
        }
        
        // Skip rows with empty Item_Code (required field)
        if (!itemCode || itemCode.toString().trim() === '') {
          failureCount++;
          if (failureCount <= 10) { // Log first 10 failures
            logUpload(`Row ${i} skipped - Empty Item_Code`, {
              rowIndex: i,
              itemCode,
              hasValidData: !!(itemCode && itemCode.toString().trim() !== '')
            });
          }
          continue;
        }

        // Insert into Upload_Tbl_Products table
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
        logUpload(`Row ${i} inserted successfully`, { itemCode, name });
        
      } catch (rowError) {
        failureCount++;
        errors.push(`Row ${i} error: ${rowError.message}`);
        logUpload(`Row ${i} processing error`, { error: rowError.message, row });
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

    const excelHeaders = data[0].map(header => String(header).trim()).filter(header => header);
    console.log('Excel headers found:', excelHeaders);

    // Skip ALL validation for now - just check if we have the right columns
    const hasRequiredColumns = excelHeaders.includes('Date') && 
                              excelHeaders.includes('EAN/UPC') && 
                              excelHeaders.includes('Name') && 
                              excelHeaders.includes('Item_Code') && 
                              excelHeaders.includes('Qty') && 
                              excelHeaders.includes('Price');

    console.log('Required columns check:', hasRequiredColumns);

    if (!hasRequiredColumns) {
      const errorEntry = {
        timestamp: new Date().toISOString(),
        error: 'Missing required columns',
        fileName: file.originalname,
        foundHeaders: excelHeaders,
        requiredColumns: ['Date', 'EAN/UPC', 'Name', 'Item_Code', 'Qty', 'Price'],
        status: 'COLUMNS_MISSING'
      };
      fs.appendFileSync('logs/uploads.log', JSON.stringify(errorEntry) + '\n');
      
      return res.status(400).json({
        success: false,
        message: 'Missing required columns. Need: Date, EAN/UPC, Name, Item_Code, Qty, Price',
        found: excelHeaders
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

    // Step 4: Import data
    console.log('Importing data...');
    let insertedCount = 0;
    let errorCount = 0;
    const importErrors = [];

    // Create column mapping
    const headers = data[0];
    const colMapping = {};
    headers.forEach((header, index) => {
      colMapping[header] = index;
    });

    console.log('Column mapping:', colMapping);

    // Skip header row, start from index 1
    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      // Skip empty rows
      if (!row || row.length === 0 || !row[0]) continue;

      try {
        await pool.request()
          .input('date', sql.NVarChar, String(row[colMapping['Date']] || ''))
          .input('eanUpc', sql.NVarChar, String(row[colMapping['EAN/UPC']] || ''))
          .input('name', sql.NVarChar, String(row[colMapping['Name']] || ''))
          .input('itemCode', sql.NVarChar, String(row[colMapping['Item_Code']] || ''))
          .input('qty', sql.NVarChar, String(row[colMapping['Qty']] || ''))
          .input('price', sql.NVarChar, String(row[colMapping['Price']] || ''))
          .query(`
            INSERT INTO Upload_Tbl_Products
            (Date, [EAN/UPC], Name, Item_Code, Qty, Price)
            VALUES (@date, @eanUpc, @name, @itemCode, @qty, @price)
          `);
        insertedCount++;
        console.log(`✅ Row ${i} inserted: ${row[colMapping['Item_Code']]}`);
      } catch (insertError) {
        errorCount++;
        importErrors.push(`Row ${i + 1}: ${insertError.message}`);
        console.error(`❌ Error inserting row ${i + 1}:`, insertError.message);
      }
    }

    console.log(`✅ Import completed: ${insertedCount} rows inserted, ${errorCount} rows failed`);

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
        errors: importErrors
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

    return res.json({
      success: true,
      message: 'Product data uploaded and processed successfully',
      results: {
        rowsInserted: insertedCount,
        rowsFailed: errorCount,
        vendor: vendorName,
        errors: importErrors
      }
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
