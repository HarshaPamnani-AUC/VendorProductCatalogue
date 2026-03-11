const express = require('express');
const sql = require('mssql');
const router = express.Router();

// Simple Excel upload process
router.post('/move-upload-data', async (req, res) => {
  try {
    const { vendorName, fileName, fileContent } = req.body;
    
    if (!vendorName || !fileContent) {
      return res.status(400).json({ error: 'Vendor name and file content are required' });
    }

    console.log('Processing Excel for vendor:', vendorName);

    const pool = req.pool || req.app.locals.pool;
    
    // Validate file content format
    if (!fileContent.startsWith('data:')) {
      return res.status(400).json({ error: 'File format not good' });
    }

    try {
      const XLSX = require('xlsx');
      const fileBuffer = Buffer.from(fileContent.split(',')[1], 'base64');
      
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      console.log(`Excel loaded: ${data.length} rows`);

      // Step 1: Validate Excel format - check required columns
      if (data.length === 0) {
        return res.status(400).json({ error: 'File format not good' });
      }

      const firstRow = data[0] || {};
      const actualColumns = Object.keys(firstRow);
      const requiredColumns = ['Date', 'EAN/UPC', 'Name', 'Item_Code', 'Qty', 'Price'];
      
      const hasAllColumns = requiredColumns.every(col => 
        actualColumns.some(actualCol => actualCol.toLowerCase() === col.toLowerCase())
      );

      if (!hasAllColumns) {
        return res.status(400).json({ error: 'File format not good' });
      }

      console.log('✅ Excel format validation passed');

      // Step 2: Truncate Upload_Tbl_Products table
      console.log('Truncating Upload_Tbl_Products table...');
      await pool.request().query('TRUNCATE TABLE [dbo].[Upload_Tbl_Products]');
      console.log('✅ Table truncated');

      // Step 3: Transfer whole Excel data to Upload_Tbl_Products
      console.log('Inserting Excel data...');
      let insertedCount = 0;
      
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        
        // Skip header row if it contains column names
        if (row['Item_Code'] === 'Item_Code' || row['Name'] === 'Name') {
          continue;
        }
        
        try {
          await pool.request()
            .input('date', sql.NVarChar, row['Date'] || '')
            .input('eanUpc', sql.NVarChar, row['EAN/UPC'] || '')
            .input('name', sql.NVarChar, row['Name'] || '')
            .input('itemCode', sql.NVarChar, row['Item_Code'] || '')
            .input('qty', sql.NVarChar, row['Qty'] || '')
            .input('price', sql.NVarChar, row['Price'] || '')
            .query(`
              INSERT INTO [dbo].[Upload_Tbl_Products] 
              (Date, [EAN/UPC], Name, Item_Code, Qty, Price)
              VALUES (@date, @eanUpc, @name, @itemCode, @qty, @price)
            `);
          
          insertedCount++;
        } catch (insertError) {
          console.error('Error inserting row:', i, insertError.message);
        }
      }

      console.log(`✅ Inserted ${insertedCount} rows to Upload_Tbl_Products`);

      // Step 4: Execute stored procedure with vendor name
      console.log('Executing stored procedure with vendor:', vendorName);
      try {
        await pool.request()
          .input('Vendor', sql.NVarChar, vendorName)
          .execute('Proc_Upload_Tbl_Products');
        
        console.log('✅ Procedure executed successfully');
      } catch (procedureError) {
        console.error('Procedure error:', procedureError.message);
        return res.status(500).json({ 
          error: 'Procedure execution failed: ' + procedureError.message 
        });
      }

      // Step 5: Send success message
      res.status(200).json({ message: 'data uploaded succesfully' });

    } catch (excelError) {
      console.error('Excel processing error:', excelError);
      return res.status(400).json({ error: 'File format not good' });
    }

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

module.exports = router;
