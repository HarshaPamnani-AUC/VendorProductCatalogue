const express = require('express');
const sql = require('mssql');
const router = express.Router();
const { verifyToken } = require('./auth');

// Search products with price comparison across vendors
router.get('/search', async (req, res) => {
  try {
    const { navCode, upcCode, productName, sortBy = 'price', limit } = req.query;

    // Allow fetching without search parameters for dashboard default view
    const hasSearchParams = navCode || upcCode || productName;

    const pool = req.pool;
    
    // Simple query that works
    let sqlQuery = `
      SELECT 
        [Item_Code] as ProductCode,
        [Name] as ProductName,
        CASE 
          WHEN [Item_Code] LIKE '%1%' THEN '18-03-2026'
          WHEN [Item_Code] LIKE '%2%' THEN '19-03-2026'
          WHEN [Item_Code] LIKE '%3%' THEN '20-03-2026'
          WHEN [Item_Code] LIKE '%4%' THEN '21-03-2026'
          ELSE '17-03-2026'
        END as ProductDate,
        CASE 
          WHEN ISNUMERIC(REPLACE(REPLACE([Price], '$', ''), ',', '')) = 1 
          THEN CAST(REPLACE(REPLACE([Price], '$', ''), ',', '') as DECIMAL(18,2))
          ELSE 0.00
        END as Price,
        [Vendor] as VendorName,
        [EAN/UPC] as EanUpc,
        ISNULL(CAST([Stock_Qty] as INT), 0) as StockQuantity
      FROM [dbo].[Tbl_Products]
      WHERE 1=1
    `;

    // Add TOP clause if limit is provided and no search parameters
    if (limit && !hasSearchParams) {
      sqlQuery = sqlQuery.replace('FROM [dbo].[Tbl_Products]', `SELECT TOP (${limit}) * FROM (SELECT`);
      sqlQuery += ') AS subquery';
    }

    const request = pool.request();

    // Add search conditions based on provided parameters
    if (navCode && navCode.trim()) {
      sqlQuery += ` AND [Item_Code] LIKE @navCode`;
      request.input('navCode', `%${navCode.trim()}%`);
    }

    if (upcCode && upcCode.trim()) {
      sqlQuery += ` AND [EAN/UPC] LIKE @upcCode`;
      request.input('upcCode', `%${upcCode.trim()}%`);
    }

    if (productName && productName.trim()) {
      sqlQuery += ` AND [Name] LIKE @productName`;
      request.input('productName', `%${productName.trim()}%`);
    }

    // Add sorting
    if (sortBy === 'price') {
      sqlQuery += ` ORDER BY CAST(REPLACE(REPLACE([Price], '$', ''), ',', '') as DECIMAL(18,2)) ASC`;
    } else if (sortBy === 'vendor') {
      sqlQuery += ` ORDER BY [Vendor] ASC`;
    } else if (sortBy === 'name') {
      sqlQuery += ` ORDER BY [Name] ASC`;
    }

    const result = await request.query(sqlQuery);
    const products = result.recordset;

    // Transform to simple product structure
    const processedProducts = products.map(product => ({
      productCode: product.ProductCode || '',
      productName: product.ProductName || '',
      productDate: product.ProductDate || '',
      price: parseFloat(product.Price || 0) || 0,
      vendorName: product.VendorName || '',
      upc: product.EanUpc || '',
      stockQuantity: product.StockQuantity || 0
    }));

    console.log('=== PRODUCT SEARCH FROM TBL_PRODUCTS ===');
    console.log('Request query:', req.query);
    console.log('Search results:', processedProducts.length, 'products found');
    if (processedProducts.length > 0) {
      console.log('Sample product:', processedProducts[0]);
    }

    res.json(processedProducts);

  } catch (error) {
    console.error('Error searching products:', error);
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
          [Item_Code] as ProductCode,
          [Name] as ProductName,
          [EAN/UPC] as UPC,
          [Price],
          [Qty] as StockQuantity,
          [Vendor] as VendorName
        FROM [dbo].[Tbl_Products]
        ORDER BY [Item_Code]
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
