const sql = require('mssql');
const express = require('express');
const router = express.Router();

// Search product history
router.get('/', async (req, res) => {
  try {
    console.log('=== PRODUCT HISTORY SEARCH ===');
    console.log('Request query:', req.query);

    const { navCode, upcCode, productName } = req.query;

    // Check if at least one search parameter is provided
    if (!navCode && !upcCode && !productName) {
      return res.status(400).json({ error: 'At least one search parameter is required' });
    }

    const pool = req.pool;
    console.log('Database pool available:', !!pool);

    // First, let's test if the table exists and has data
    try {
      const testQuery = await pool.request().query(`
        SELECT COUNT(*) as TotalCount 
        FROM [dbo].[Tbl_Products_Storage]
      `);
      console.log('Tbl_Products_Storage total rows:', testQuery.recordset[0].TotalCount);
    } catch (tableError) {
      console.error('Table access error:', tableError.message);
      return res.status(500).json({ error: 'Table Tbl_Products_Storage not accessible: ' + tableError.message });
    }

    let sqlQuery = `
      SELECT DISTINCT
        [Item_Code] as ProductCode,
        [Name] as ProductName,
        FORMAT([Date], 'dd-MM-yyyy') as ProductDate,
        '' as Description,
        '' as Brand,
        '' as Category,
        CASE 
          WHEN ISNUMERIC(REPLACE(REPLACE(REPLACE([Price], '$', ''), ',', ''), ' ', '')) = 1 
          THEN CAST(REPLACE(REPLACE(REPLACE([Price], '$', ''), ',', ''), ' ', '') as DECIMAL(18,2))
          ELSE 0.00
        END as Price,
        CASE 
          WHEN ISNUMERIC(REPLACE(REPLACE([Qty], ',', ''), ' ', '')) = 1 
          THEN CAST(REPLACE(REPLACE([Qty], ',', ''), ' ', '') as INT)
          ELSE 0
        END as StockQuantity,
        [EAN/UPC] as UPC,
        [Vendor] as VendorName,
        '' as VendorId,
        '' as VendorCode
      FROM [dbo].[Tbl_Products_Storage]
      WHERE 1=1
    `;

    const request = pool.request();

    // Add search conditions based on provided parameters
    if (navCode && navCode.trim()) {
      sqlQuery += ' AND [Item_Code] LIKE @navCode';
      request.input('navCode', sql.NVarChar, `%${navCode.trim()}%`);
      console.log('Added navCode filter:', navCode.trim());
    }

    if (upcCode && upcCode.trim()) {
      sqlQuery += ' AND [EAN/UPC] LIKE @upcCode';
      request.input('upcCode', sql.NVarChar, `%${upcCode.trim()}%`);
      console.log('Added upcCode filter:', upcCode.trim());
    }

    if (productName && productName.trim()) {
      sqlQuery += ' AND [Name] LIKE @productName';
      request.input('productName', sql.NVarChar, `%${productName.trim()}%`);
      console.log('Added productName filter:', productName.trim());
    }

    // Add sorting with support for flexible sort options
    if (req.query.sortBy === 'price') {
      sqlQuery += ' ORDER BY [Price] ASC';
    } else if (req.query.sortBy === 'name') {
      sqlQuery += ' ORDER BY [Name] ASC';
    } else if (req.query.sortBy === 'vendor') {
      sqlQuery += ' ORDER BY [Vendor] ASC';
    } else {
      sqlQuery += ' ORDER BY [Price] ASC';
    }

    console.log('Final SQL Query:', sqlQuery);

    const result = await request.query(sqlQuery);
    console.log('Query result rows:', result.recordset.length);
    
    // Log first 5 results to check data
    console.log('First 5 results (history check):');
    result.recordset.slice(0, 5).forEach((row, index) => {
      console.log(`${index + 1}. ${row.VendorName}: $${row.Price} - ${row.ProductName}`);
    });

    // Return flat array of products from Tbl_Products_Storage
    const products = result.recordset.map(row => ({
      productId: row.ProductCode,
      productCode: row.ProductCode,
      productName: row.ProductName,
      productDate: row.ProductDate,
      description: row.Description,
      brand: row.Brand,
      category: row.Category,
      upc: String(row.UPC) || '',
      price: row.Price,
      stockQuantity: row.StockQuantity,
      vendorName: row.VendorName,
      vendors: []
    }));

    console.log(`Found ${products.length} products in history`);
    if (products.length > 0) {
      console.log('Sample product:', products[0]);
    }
    res.json(products);
  } catch (err) {
    console.error('Search product history error:', err);
    console.error('Error details:', err.message);
    res.status(500).json({ error: 'Failed to search product history: ' + err.message });
  }
});

module.exports = router;
