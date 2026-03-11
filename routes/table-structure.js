const express = require('express');
const sql = require('mssql');
const router = express.Router();

// Get Upload_Tbl_Products structure
router.get('/upload-table-structure', async (req, res) => {
  try {
    const pool = req.pool;
    
    const query = `
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        IS_NULLABLE,
        CHARACTER_MAXIMUM_LENGTH,
        NUMERIC_PRECISION,
        NUMERIC_SCALE,
        ORDINAL_POSITION
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Upload_Tbl_Products'
      ORDER BY ORDINAL_POSITION
    `;

    const result = await pool.request().query(query);
    
    // Also get sample data
    const sampleQuery = `
      SELECT TOP 3 * FROM [dbo].[Upload_Tbl_Products]
    `;
    
    const sampleResult = await pool.request().query(sampleQuery);
    
    res.json({
      success: true,
      structure: result.recordset,
      sampleData: sampleResult.recordset,
      totalColumns: result.recordset.length
    });
    
  } catch (err) {
    console.error('Get upload table structure error:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch table structure' 
    });
  }
});

module.exports = router;
