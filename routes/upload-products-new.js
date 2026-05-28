const express = require('express');
const sql = require('mssql');
const XLSX = require('xlsx');
const multer = require('multer');
const router = express.Router();
const { verifyToken } = require('./auth');

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB limit
  fileFilter: (req, file, cb) => {
    const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
    if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only .xlsx and .xls files are allowed.'));
    }
  }
});

// Upload Excel file - Step by Step Process
// 1. Validate Excel format
// 2. Truncate Upload_Tbl_Products
// 3. Insert Excel data into Upload_Tbl_Products
// 4. Execute stored procedure Proc_Upload_Tbl_Products
// 5. Return success response
router.post('/', upload.single('file'), async (req, res) => {
  try {
    console.log('=== UPLOAD PRODUCTS - MULTIPART ===');
    console.log('Body:', req.body);
    console.log('File:', req.file ? req.file.originalname : 'No file');

    const vendorName = req.body.vendorName;
    const file = req.file;

    // Step 1: Validate Excel format
    if (!vendorName || !file) {
      console.log('❌ Missing vendor or file');
      return res.status(400).json({
        success: false,
        message: 'File format not good'
      });
    }

    // Validate file extension
    const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
    if (fileExtension !== 'xlsx' && fileExtension !== 'xls') {
      console.log('❌ Invalid file extension:', fileExtension);
      return res.status(400).json({
        success: false,
        message: 'File format not good'
      });
    }

    // Parse Excel file
    let workbook;
    try {
      workbook = XLSX.read(file.buffer, { type: 'buffer' });
      console.log('✅ Excel file parsed successfully');
    } catch (error) {
      console.log('❌ Failed to parse Excel:', error.message);
      return res.status(400).json({
        success: false,
        message: 'File format not good'
      });
    }

    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

    console.log('Excel rows found:', data.length);

    if (data.length < 2) {
      console.log('❌ No data rows found');
      return res.status(400).json({
        success: false,
        message: 'File format not good'
      });
    }

    // Step 2: Connect to database and truncate table
    console.log('Connecting to database...');
    const pool = req.pool;
    console.log('✅ Database connected');

    try {
      // Truncate upload table
      await pool.request().query('TRUNCATE TABLE Upload_Tbl_Products');
      console.log('✅ Table truncated');

      // Step 3: Insert Excel data into Upload_Tbl_Products
      console.log('Inserting data rows...');
      let insertedCount = 0;

      // Skip header row, start from index 1
      for (let i = 1; i < data.length; i++) {
        const row = data[i];

        // Skip empty rows
        if (!row || row.length === 0 || !row[0]) continue;

        try {
          await pool.request()
            .input('date', sql.NVarChar, String(row[0] || ''))
            .input('eanUpc', sql.NVarChar, String(row[1] || ''))
            .input('name', sql.NVarChar, String(row[2] || ''))
            .input('itemCode', sql.NVarChar, String(row[3] || ''))
            .input('qty', sql.NVarChar, String(row[4] || ''))
            .input('price', sql.NVarChar, String(row[5] || ''))
            .query(`INSERT INTO Upload_Tbl_Products 
                    (Date, [EAN/UPC], Name, Item_Code, Qty, Price)
                    VALUES (@date, @eanUpc, @name, @itemCode, @qty, @price)`);
          insertedCount++;
        } catch (insertError) {
          console.error('Error inserting row', i, insertError.message);
        }
      }

      console.log(`✅ Inserted ${insertedCount} rows`);

      // Step 4: Execute stored procedure
      console.log('Executing stored procedure with vendor:', vendorName);
      try {
        await pool.request()
          .input('VendorName', sql.NVarChar, vendorName)
          .execute('Proc_Upload_Tbl_Products');
        console.log('✅ Stored procedure executed');
      } catch (procedureError) {
        console.error('❌ Procedure error:', procedureError.message);
        return res.status(500).json({
          success: false,
          message: 'File format not good'
        });
      }

      // Step 5: Return success response
      console.log('✅ Upload completed successfully');
      return res.json({
        success: true,
        message: 'Data uploaded successfully'
      });

    } catch (dbError) {
      console.error('❌ Database error:', dbError.message);
      return res.status(500).json({
        success: false,
        message: 'File format not good'
      });
    }

  } catch (error) {
    console.error('❌ Upload error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'File format not good'
    });
  }
});

module.exports = router;
