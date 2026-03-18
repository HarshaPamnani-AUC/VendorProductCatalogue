const express = require('express');
const sql = require('mssql');
const router = express.Router();
const { verifyToken } = require('./auth');

// Search products with price comparison across vendors
router.get('/search', async (req, res) => {
  try {
    const { navCode, upcCode, productName, sortBy = 'price' } = req.query;

    // Check if at least one search parameter is provided
    if (!navCode && !upcCode && !productName) {
      return res.status(400).json({ error: 'At least one search parameter is required' });
    }

    const pool = req.pool;
    let sqlQuery = `
      SELECT DISTINCT
        [Item_Code] as ProductCode,
        [Name] as ProductName,
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
      FROM [dbo].[Tbl_Products]
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
      // More flexible search - remove dots and handle multiple search terms
      const cleanSearchTerm = productName.trim().replace(/\./g, '');
      sqlQuery += ' AND (REPLACE([Name], \'.\', \'\') LIKE @productName OR [Name] LIKE @originalProductName)';
      request.input('productName', sql.NVarChar, `%${cleanSearchTerm}%`);
      request.input('originalProductName', sql.NVarChar, `%${productName.trim()}%`);
    }

    // Filter out products with invalid prices
    sqlQuery += ' AND CASE WHEN ISNUMERIC(REPLACE(REPLACE([Price], \'$\', \'\'), \',\', \'\')) = 1 THEN CAST(REPLACE(REPLACE([Price], \'$\', \'\'), \',\', \'\') as DECIMAL(18,2)) ELSE 0.00 END > 0';

    if (sortBy === 'price') {
      sqlQuery += ' ORDER BY CASE WHEN ISNUMERIC(REPLACE(REPLACE([Price], \'$\', \'\'), \',\', \'\')) = 1 THEN CAST(REPLACE(REPLACE([Price], \'$\', \'\'), \',\', \'\') as DECIMAL(18,2)) ELSE 0.00 END ASC';
    } else if (sortBy === 'vendor') {
      sqlQuery += ' ORDER BY [Vendor], CASE WHEN ISNUMERIC(REPLACE(REPLACE([Price], \'$\', \'\'), \',\', \'\')) = 1 THEN CAST(REPLACE(REPLACE([Price], \'$\', \'\'), \',\', \'\') as DECIMAL(18,2)) ELSE 0.00 END';
    } else {
      sqlQuery += ' ORDER BY [Name]';
    }

    const result = await request.query(sqlQuery);

    // Return flat array of products from Tbl_Products
    const products = result.recordset.map(row => ({
      productId: row.ProductCode,
      productCode: row.ProductCode,
      productName: row.ProductName,
      description: row.Description,
      brand: row.Brand,
      category: row.Category,
      upc: row.UPC,
      price: row.Price,
      stockQuantity: row.StockQuantity,
      vendorName: row.VendorName,
      vendors: []
    }));

    res.json(products);
  } catch (err) {
    console.error('Search products error:', err);
    res.status(500).json({ error: 'Failed to search products' });
  }
});

// Get latest products
router.get('/latest/items', verifyToken, async (req, res) => {
  try {
    const pool = req.pool;
    const limit = req.query.limit || 20;

    const result = await pool.request()
      .input('limit', sql.Int, limit)
      .query(`
        SELECT TOP (@limit)
<<<<<<< HEAD
          p.ProductId,
          p.ProductCode,
          p.ProductName,
          p.Description,
          p.Brand,
          p.Category,
          p.Price,
          p.StockQuantity,
          v.VendorName
        FROM [dbo].[Products] p
        INNER JOIN [dbo].[Vendors] v ON p.VendorId = v.VendorId
        WHERE p.IsActive = 1 AND v.IsActive = 1
        ORDER BY p.CreatedAt DESC
=======
          [Item_Code] as ProductCode,
          [Name] as ProductName,
          [EAN/UPC] as UPC,
          [Price],
          [Qty] as StockQuantity,
          [Vendor] as VendorName
        FROM [dbo].[Tbl_Products]
        ORDER BY [Item_Code]
>>>>>>> 305e4902f2f139151812c52961c6b4aaec7a289a
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error('Get latest products error:', err);
    res.status(500).json({ error: 'Failed to fetch latest products' });
  }
});

// Get product details by Product Code
router.get('/:productCode', async (req, res) => {
  try {
    const pool = req.pool;
    const productCode = req.params.productCode;

    const result = await pool.request()
      .input('productCode', sql.NVarChar, productCode)
      .query(`
        SELECT 
          p.ProductId,
          p.ProductCode,
          p.ProductName,
          p.Description,
          p.Brand,
          p.Category,
          p.Price,
          p.StockQuantity,
          p.UPC,
          v.VendorId,
          v.VendorName
        FROM [dbo].[Products] p
        INNER JOIN [dbo].[Vendors] v ON p.VendorId = v.VendorId
        WHERE p.ProductCode = @productCode AND p.IsActive = 1
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Get product error:', err);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// Update product in Tbl_Products
router.put('/:productCode', verifyToken, async (req, res) => {
  try {
    const productCode = req.params.productCode;
    const { productName, price, stockQuantity, upc, vendorName } = req.body;

    console.log('Product Update Request:', {
      productCode,
      vendorName,
      requestBody: req.body,
      user: req.user ? req.user.userId : 'unknown'
    });

    if (!productName || price === undefined) {
      console.log('Validation failed: missing required fields');
      return res.status(400).json({ error: 'Product name and price are required' });
    }

    const pool = req.pool;

    // Get user info for UpdatedBy - use login name
    const loginName = req.user ? (req.user.name || req.user.email || 'System') : 'System';

    console.log('=== UPDATE DEBUG ===');
    console.log('productCode:', `"${productCode}"`);
    console.log('vendorName:', `"${vendorName}"`);
    console.log('vendorName trimmed:', `"${(vendorName || '').trim()}"`);
    console.log('productName:', `"${productName}"`);
    console.log('price:', price);
    console.log('stockQuantity:', stockQuantity);
    console.log('upc:', `"${upc}"`);
    console.log('==================');

    // Update Tbl_Products with correct column names - filter by Item_Code AND Vendor
    const updateResult = await pool.request()
      .input('productCode', sql.NVarChar, productCode)
      .input('vendorName', sql.NVarChar, (vendorName || '').trim())
      .input('name', sql.NVarChar, productName)
      .input('price', sql.NVarChar, price.toString())
      .input('qty', sql.NVarChar, stockQuantity ? stockQuantity.toString() : '0')
      .input('eanUpc', sql.NVarChar, upc || null)
      .input('updatedBy', sql.NVarChar, loginName)
      .query(`
        UPDATE [dbo].[Tbl_Products] 
        SET [Name] = @name,
            [Price] = @price,
            [Qty] = @qty,
            [EAN/UPC] = @eanUpc,
            [UpdatedBy] = @updatedBy
        WHERE [Item_Code] = @productCode AND RTRIM([Vendor]) = @vendorName
      `);

    console.log('Update result:', updateResult);
    console.log('Rows affected:', updateResult.rowsAffected[0]);
    console.log('=== END UPDATE DEBUG ===');

    res.json({ 
      message: 'Product updated successfully',
      rowsAffected: updateResult.rowsAffected[0]
    });
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ error: 'Failed to update product: ' + err.message });
  }
});

module.exports = router;
