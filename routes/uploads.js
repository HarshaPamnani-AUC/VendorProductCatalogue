const express = require('express');
const sql = require('mssql');
const XLSX = require('xlsx');
const router = express.Router();
const { verifyToken } = require('./auth');
const fs = require('fs');
const path = require('path');

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

// Parse Excel file and process vendor data
async function parseAndInsertExcelData(pool, fileId, vendorId, fileContent, columnMapping) {
  try {
    logUpload('Starting Excel parsing', { fileId, vendorId, columnMapping });
    
    const workbook = XLSX.read(fileContent, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json(worksheet, {
      defval: ''
    });

    logUpload(`Excel file loaded. Total rows: ${rawData.length}`);

    // Check if this is our new standardized template format
    const firstRow = rawData[0] || {};
    const isStandardTemplate = (firstRow.hasOwnProperty('Date') || firstRow.hasOwnProperty('DATE')) && 
                              (firstRow.hasOwnProperty('EAN/UPC') || firstRow.hasOwnProperty('EAN/UPC')) && 
                              (firstRow.hasOwnProperty('Name') || firstRow.hasOwnProperty('NAME')) && 
                              (firstRow.hasOwnProperty('Item_Code') || firstRow.hasOwnProperty('ITEM CODE')) && 
                              (firstRow.hasOwnProperty('Qty') || firstRow.hasOwnProperty('QTY')) && 
                              (firstRow.hasOwnProperty('Price') || firstRow.hasOwnProperty('PRICE'));

    logUpload(`Template format detected: ${isStandardTemplate ? 'Standardized' : 'Vendor-specific'}`);
    logUpload(`First row columns: ${Object.keys(firstRow)}`);
    logUpload(`Template detection check: Date=${firstRow.hasOwnProperty('Date') || firstRow.hasOwnProperty('DATE')}, EAN/UPC=${firstRow.hasOwnProperty('EAN/UPC')}, Name=${firstRow.hasOwnProperty('Name') || firstRow.hasOwnProperty('NAME')}, Item_Code=${firstRow.hasOwnProperty('Item_Code') || firstRow.hasOwnProperty('ITEM CODE')}, Qty=${firstRow.hasOwnProperty('Qty') || firstRow.hasOwnProperty('QTY')}, Price=${firstRow.hasOwnProperty('Price') || firstRow.hasOwnProperty('PRICE')}`);

    let dataToProcess = rawData;
    
    if (isStandardTemplate) {
      // Skip header row for standardized template
      dataToProcess = rawData.slice(1);
      logUpload(`Using standardized template, processing ${dataToProcess.length} rows`);
    } else {
      // Use vendor-specific logic only if columnMapping exists
      if (!columnMapping) {
        throw new Error('Vendor column mapping not configured for vendor-specific template');
      }
      
      const startIndex = columnMapping.SkipHeaderRows || 0;
      dataToProcess = rawData.slice(startIndex);
      logUpload(`Using vendor-specific format, after skipping ${startIndex} header rows, processing ${dataToProcess.length} rows`);

      // Dynamic header detection for ET Perfumes
      if (vendorId === 1) {
        // Find the first row that contains actual product data
        let firstProductRow = 0;
        for (let i = 0; i < dataToProcess.length; i++) {
          const row = dataToProcess[i];
          
          // Check if this row contains product data (8+ digit product code)
          const hasProductCode = Object.values(row).some(value => 
            value && /^\d{8,}$/.test(value.toString().trim())
          );
          
          // Check if this row contains price data (contains $)
          const hasPrice = Object.values(row).some(value => 
            value && value.toString().includes('$')
          );
          
          // Check if this row contains fragrance name (contains EDT/EDP/etc.)
          const hasFragranceName = Object.values(row).some(value => 
            value && (
              value.toString().toLowerCase().includes('edt') || 
              value.toString().toLowerCase().includes('edp') ||
              value.toString().toLowerCase().includes('eau') ||
              value.toString().toLowerCase().includes('parfum')
            )
          );
          
          if (hasProductCode && hasPrice && hasFragranceName) {
            firstProductRow = i;
            break;
          }
        }
        
        if (firstProductRow > 0) {
          dataToProcess = dataToProcess.slice(firstProductRow);
          logUpload(`Dynamic header detection: Skipped additional ${firstProductRow} rows, now processing ${dataToProcess.length} rows`);
        }
      }
    }

    let successCount = 0;
    let failureCount = 0;
    const errors = [];
    let sampleRows = [];

    // Process each row
    for (let i = 0; i < dataToProcess.length; i++) {
      const row = dataToProcess[i];
      
      try {
        let productCode, productName, priceValue, stockQuantity, date, eanUpc;
        
        if (isStandardTemplate) {
          // Use standardized template mapping (handle both cases)
          date = row['Date'] || row['DATE'] || '';
          eanUpc = row['EAN/UPC'] || row['EAN/UPC'] || '';
          productName = row['Name'] || row['NAME'] || '';
          productCode = row['Item_Code'] || row['ITEM CODE'] || '';
          stockQuantity = row['Qty'] || row['QTY'] || '';
          priceValue = row['Price'] || row['PRICE'] || '';
          
          // Debug: Log the raw values and validation
          if (i < 5) {
            console.log(`Row ${i} - Standard template values:`, {
              date: row['Date'] || row['DATE'],
              eanUpc: row['EAN/UPC'] || row['EAN/UPC'],
              name: row['Name'] || row['NAME'],
              itemCode: row['Item_Code'] || row['ITEM CODE'],
              qty: row['Qty'] || row['QTY'],
              price: row['Price'] || row['PRICE'],
              allColumns: Object.keys(row),
              allValues: Object.values(row)
            });
          }
        } else {
          // Use vendor-specific mapping
          productCode = row[columnMapping.ProductCodeColumn] || '';
          productName = row[columnMapping.ProductNameColumn] || '';
          priceValue = row[columnMapping.PriceColumn] || '';
          stockQuantity = parseInt(row[columnMapping.StockQuantityColumn]) || 0;
          
          // Debug: Log the raw values and validation
          if (i < 5) {
            console.log(`Row ${i} - Vendor-specific values:`, {
              productCodeColumn: columnMapping.ProductCodeColumn,
              productCodeValue: row[columnMapping.ProductCodeColumn],
              productNameColumn: columnMapping.ProductNameColumn,
              productNameValue: row[columnMapping.ProductNameColumn],
              priceColumn: columnMapping.PriceColumn,
              priceValue: row[columnMapping.PriceColumn],
              stockColumn: columnMapping.StockQuantityColumn,
              stockValue: row[columnMapping.StockQuantityColumn],
              allColumns: Object.keys(row),
              allValues: Object.values(row)
            });
          }
        }
        
        // Clean and parse price (remove $ and other currency symbols)
        const cleanPrice = priceValue.toString().replace(/[$,]/g, '').trim();
        const price = parseFloat(cleanPrice) || 0;
        
        // Log first few rows for debugging
        if (i < 5) {
          sampleRows.push({
            rowIndex: i,
            rawRow: row,
            mappedData: {
              productCode,
              productName,
              price,
              originalPrice: priceValue,
              cleanPrice,
              stockQuantity,
              availableColumns: Object.keys(row)
            }
          });
        }
        
        // Skip contact info and headers (only for vendor-specific)
        let isContactInfo = false;
        if (!isStandardTemplate) {
          isContactInfo = productName && (
            productName.toLowerCase().includes('email:') ||
            productName.toLowerCase().includes('phone:') ||
            productName.toLowerCase().includes('fax:') ||
            productName.toLowerCase().includes('et perfume') ||
            productName.toLowerCase().includes('marcela@') ||
            productName.toLowerCase().includes('wholesale') ||
            productName.toLowerCase().includes('distributor') ||
            productName.toLowerCase().includes('price list')
          );
        }
        
        // Skip rows with empty or invalid data
        if (!productCode || !productName || price === 0 || isContactInfo) {
          failureCount++;
          if (failureCount <= 10) { // Log first 10 failures
            logUpload(`Row ${i} skipped - Invalid data`, {
              rowIndex: i,
              productCode,
              productName,
              price,
              originalPrice: priceValue,
              cleanPrice,
              isContactInfo,
              hasValidData: !!(productCode && productName && price > 0)
            });
          }
          continue;
        }

        if (isStandardTemplate) {
          // Insert into Upload_Tbl_Products table
          await pool.request()
            .input('date', sql.NVarChar, date || null)
            .input('eanUpc', sql.NVarChar, eanUpc || null)
            .input('name', sql.NVarChar, productName || null)
            .input('itemCode', sql.NVarChar, productCode)
            .input('qty', sql.NVarChar, stockQuantity || null)
            .input('price', sql.NVarChar, priceValue || null)
            .input('vendorId', sql.Int, vendorId)
            .input('fileId', sql.Int, fileId)
            .query(`
              INSERT INTO [dbo].[Upload_Tbl_Products] 
              (Date, [EAN/UPC], Name, Item_Code, Qty, Price, VendorId, FileUploadId)
              VALUES (@date, @eanUpc, @name, @itemCode, @qty, @price, @vendorId, @fileId)
            `);
        } else {
          // Original vendor-specific logic for Products table
          const description = productName; // Use product name as description
          const brand = 'ET Perfumes'; // Default brand
          const category = 'Fragrance'; // Default category
          const upc = '';

          // Check if product already exists for this vendor
          const existingProduct = await pool.request()
            .input('vendorId', sql.Int, vendorId)
            .input('productCode', sql.NVarChar, productCode)
            .query(`SELECT ProductId FROM [dbo].[Products] 
                    WHERE VendorId = @vendorId AND ProductCode = @productCode`);

          if (existingProduct.recordset.length > 0) {
            // Update existing product
            await pool.request()
              .input('productCode', sql.NVarChar, productCode)
              .input('vendorId', sql.Int, vendorId)
              .input('productName', sql.NVarChar, productName)
              .input('description', sql.NVarChar, description || null)
              .input('brand', sql.NVarChar, brand || null)
              .input('category', sql.NVarChar, category || null)
              .input('price', sql.Decimal(18, 2), price)
              .input('stockQuantity', sql.Int, stockQuantity)
              .input('upc', sql.NVarChar, upc || null)
              .input('fileId', sql.Int, fileId)
              .query(`
                UPDATE [dbo].[Products]
                SET ProductName = @productName,
                    Description = @description,
                    Brand = @brand,
                    Category = @category,
                    Price = @price,
                    StockQuantity = @stockQuantity,
                    UPC = @upc,
                    FileUploadId = @fileId,
                    UpdatedAt = GETUTCDATE()
                WHERE VendorId = @vendorId AND ProductCode = @productCode
              `);
          } else {
            // Insert new product
            await pool.request()
              .input('vendorId', sql.Int, vendorId)
              .input('productCode', sql.NVarChar, productCode)
              .input('productName', sql.NVarChar, productName)
              .input('description', sql.NVarChar, description || null)
              .input('brand', sql.NVarChar, brand || null)
              .input('category', sql.NVarChar, category || null)
              .input('price', sql.Decimal(18, 2), price)
              .input('stockQuantity', sql.Int, stockQuantity)
              .input('upc', sql.NVarChar, upc || null)
              .input('fileId', sql.Int, fileId)
              .query(`
                INSERT INTO [dbo].[Products] 
                (VendorId, ProductCode, ProductName, Description, Brand, Category, Price, StockQuantity, UPC, FileUploadId)
                VALUES (@vendorId, @productCode, @productName, @description, @brand, @category, @price, @stockQuantity, @upc, @fileId)
              `);
          }
        }

        successCount++;
      } catch (rowError) {
        failureCount++;
        errors.push(`Row ${i} error: ${rowError.message}`);
        logUpload(`Row ${i} processing error`, { error: rowError.message, row });
      }
    }

    logUpload('Parsing completed', { 
      successCount, 
      failureCount, 
      totalRows: dataToProcess.length,
      sampleRows,
      columnMapping,
      isStandardTemplate
    });

    return { successCount, failureCount, errors };
  } catch (err) {
    logUpload('Excel parsing error', { error: err.message, stack: err.stack });
    throw new Error(`Excel parsing error: ${err.message}`);
  }
}

// Upload Excel file
router.post('/', verifyToken, async (req, res) => {
  try {
    const { vendorId, fileName, fileContent } = req.body;
    
    logUpload('Upload request received', { vendorId, fileName, fileContentLength: fileContent?.length });

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

    // Get vendor column mapping
    const mappingResult = await pool.request()
      .input('vendorId', sql.Int, vendorId)
      .query('SELECT * FROM [dbo].[VendorColumnMappings] WHERE VendorId = @vendorId AND IsActive = 1');

    let columnMapping = null;
    if (mappingResult.recordset.length > 0) {
      columnMapping = mappingResult.recordset[0];
      logUpload('Column mapping found', columnMapping);
    } else {
      logUpload('Vendor column mapping not configured, will use standardized template logic');
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
      const parseResult = await parseAndInsertExcelData(pool, fileId, vendorId, fileBuffer, columnMapping);
      
      // Check if this was a standardized template
      const firstRow = XLSX.utils.sheet_to_json(XLSX.read(fileBuffer, { type: 'buffer' }).Sheets[XLSX.read(fileBuffer, { type: 'buffer' }).SheetNames[0]], { defval: '' })[0] || {};
      const isStandardTemplate = firstRow.hasOwnProperty('Date') && 
                                firstRow.hasOwnProperty('EAN/UPC') && 
                                firstRow.hasOwnProperty('Name') && 
                                firstRow.hasOwnProperty('Item_Code') && 
                                firstRow.hasOwnProperty('Qty') && 
                                firstRow.hasOwnProperty('Price');

      let verificationResult;
      if (isStandardTemplate) {
        verificationResult = await pool.request()
          .input('fileId', sql.Int, fileId)
          .query(`
            SELECT COUNT(*) as InsertedCount 
            FROM [dbo].[Upload_Tbl_Products] 
            WHERE FileUploadId = @fileId
          `);
      } else {
        verificationResult = await pool.request()
          .input('fileId', sql.Int, fileId)
          .query(`
            SELECT COUNT(*) as InsertedCount 
            FROM [dbo].[Products] 
            WHERE FileUploadId = @fileId
          `);
      }

      const actualInsertedCount = verificationResult.recordset[0].InsertedCount;
      
      logUpload('Database verification', { 
        reportedSuccessCount: parseResult.successCount,
        actualInsertedCount: actualInsertedCount,
        verificationPassed: actualInsertedCount === parseResult.successCount,
        isStandardTemplate,
        verificationTable: isStandardTemplate ? 'Upload_Tbl_Products' : 'Products'
      });

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

      res.status(201).json({
        message: 'File uploaded and processed successfully',
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

// Get upload history
router.get('/history/:vendorId', async (req, res) => {
  try {
    const pool = req.pool;
    const vendorId = req.params.vendorId;

    const result = await pool.request()
      .input('vendorId', sql.Int, vendorId)
      .query(`
        SELECT f.*, u.Email
        FROM [dbo].[FileUploads] f
        LEFT JOIN [dbo].[Users] u ON f.UploadedBy = u.UserId
        WHERE f.VendorId = @vendorId
        ORDER BY f.UploadedAt DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error('Get upload history error:', err);
    res.status(500).json({ error: 'Failed to fetch upload history' });
  }
});

module.exports = router;
