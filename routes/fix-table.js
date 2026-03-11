const express = require('express');
const sql = require('mssql');
const router = express.Router();

// Add missing columns to Upload_Tbl_Products table
router.post('/fix-upload-table', async (req, res) => {
  try {
    const pool = req.pool;
    
    console.log('🔍 Checking Upload_Tbl_Products table structure...');
    
    // Check if FileUploadId column exists
    const checkFileUploadIdQuery = `
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Upload_Tbl_Products' AND COLUMN_NAME = 'FileUploadId'
    `;

    const fileUploadIdResult = await pool.request().query(checkFileUploadIdQuery);
    
    if (fileUploadIdResult.recordset.length === 0) {
      console.log('❌ FileUploadId column does not exist. Adding it...');
      
      // Add FileUploadId column
      const addFileUploadIdQuery = `
        ALTER TABLE [dbo].[Upload_Tbl_Products]
        ADD FileUploadId INT NULL
      `;
      
      await pool.request().query(addFileUploadIdQuery);
      console.log('✅ FileUploadId column added successfully');
    } else {
      console.log('✅ FileUploadId column already exists');
    }
    
    // Check if VendorId column exists
    const checkVendorIdQuery = `
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Upload_Tbl_Products' AND COLUMN_NAME = 'VendorId'
    `;

    const vendorIdResult = await pool.request().query(checkVendorIdQuery);
    
    if (vendorIdResult.recordset.length === 0) {
      console.log('❌ VendorId column does not exist. Adding it...');
      
      // Add VendorId column
      const addVendorIdQuery = `
        ALTER TABLE [dbo].[Upload_Tbl_Products]
        ADD VendorId INT NULL
      `;
      
      await pool.request().query(addVendorIdQuery);
      console.log('✅ VendorId column added successfully');
    } else {
      console.log('✅ VendorId column already exists');
    }
    
    // Get final table structure
    const finalStructureQuery = `
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, ORDINAL_POSITION
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Upload_Tbl_Products'
      ORDER BY ORDINAL_POSITION
    `;

    const finalResult = await pool.request().query(finalStructureQuery);
    
    res.json({
      success: true,
      message: 'Upload_Tbl_Products table structure updated',
      structure: finalResult.recordset
    });
    
  } catch (error) {
    console.error('❌ Error fixing table:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fix table structure: ' + error.message 
    });
  }
});

module.exports = router;
