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
    let sqlQuery = `
      SELECT DISTINCT
        [Item_Code] as ProductCode,
        [Name] as ProductName,
        FORMAT([Date], 'dd-MM-yyyy') as ProductDate,
        '' as Description,
        '' as Brand,
        '' as Category,
        CASE 
          WHEN ISNUMERIC(REPLACE(REPLACE([Price], '$', ''), ',', '')) = 1 
          THEN CAST(REPLACE(REPLACE([Price], '$', ''), ',', '') as DECIMAL(18,2))
          ELSE 0.00
        END as Price,
        CASE 
          WHEN ISNUMERIC([Qty]) = 1 THEN CAST([Qty] as INT)
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
    }

    if (upcCode && upcCode.trim()) {
      sqlQuery += ' AND [EAN/UPC] LIKE @upcCode';
      request.input('upcCode', sql.NVarChar, `%${upcCode.trim()}%`);
    }

    if (productName && productName.trim()) {
      sqlQuery += ' AND [Name] LIKE @productName';
      request.input('productName', sql.NVarChar, `%${productName.trim()}%`);
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

    const result = await request.query(sqlQuery);

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
    res.json(products);
  } catch (err) {
    console.error('Search product history error:', err);
    res.status(500).json({ error: 'Failed to search product history: ' + err.message });
  }
});

module.exports = router;
