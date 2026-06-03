const express = require('express');
const sql = require('mssql');
const router = express.Router();
const { verifyToken } = require('./auth');

// Get all vendors (unauthenticated for upload page)
router.get('/list', async (req, res) => {
  try {
    console.log('=== VENDORS LIST API ===');
    console.log('Pool exists:', !!req.pool);

    const pool = req.pool;
    console.log('Executing vendors query...');

    const result = await pool.request()
      .query('SELECT VendorId, VendorName, Currency FROM [dbo].[Vendors] WHERE IsActive = 1 ORDER BY VendorName');

    console.log('Query result:', result.recordset.length, 'vendors found');
    console.log('Sample vendor:', result.recordset[0]);

    res.json(result.recordset);
  } catch (err) {
    console.error('Get vendors list error:', err.message);
    console.error('Error stack:', err.stack);
    res.status(500).json({ error: 'Failed to fetch vendors', details: err.message });
  }
});

// Get all vendors (authenticated)
router.get('/', verifyToken, async (req, res) => {
  try {
    const pool = req.pool;
    const result = await pool.request()
      .query('SELECT * FROM [dbo].[Vendors] WHERE IsActive = 1 ORDER BY VendorName');

    res.json(result.recordset);
  } catch (err) {
    console.error('Get vendors error:', err);
    res.status(500).json({ error: 'Failed to fetch vendors' });
  }
});

// Get vendor by ID
router.get('/:vendorId', async (req, res) => {
  try {
    const pool = req.pool;
    const vendorId = req.params.vendorId;

    const vendorResult = await pool.request()
      .input('vendorId', sql.Int, vendorId)
      .query('SELECT * FROM [dbo].[Vendors] WHERE VendorId = @vendorId');

    if (vendorResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    const mappingResult = await pool.request()
      .input('vendorId', sql.Int, vendorId)
      .query('SELECT * FROM [dbo].[VendorColumnMappings] WHERE VendorId = @vendorId AND IsActive = 1');

    const vendor = vendorResult.recordset[0];
    vendor.columnMapping = mappingResult.recordset[0] || null;

    res.json(vendor);
  } catch (err) {
    console.error('Get vendor error:', err);
    res.status(500).json({ error: 'Failed to fetch vendor' });
  }
});

// Create vendor
router.post('/', verifyToken, async (req, res) => {
  try {
    const { vendorName, vendorCode, email, phone, address, website, description, currency } = req.body;

    if (!vendorName) {
      return res.status(400).json({ error: 'Vendor name is required' });
    }

    // Validate currency if provided
    const validCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'INR'];
    const vendorCurrency = currency && validCurrencies.includes(currency.toUpperCase()) 
      ? currency.toUpperCase() 
      : 'USD';

    const pool = req.pool;

    // Use stored procedure to add vendor
    const result = await pool.request()
      .input('vendorName', sql.NVarChar, vendorName)
      .input('vendorCode', sql.NVarChar, vendorCode || null)
      .input('contactEmail', sql.NVarChar, email || null)
      .input('contactPhone', sql.NVarChar, phone || null)
      .input('address', sql.NVarChar, address || null)
      .input('city', sql.NVarChar, null)  // Add city parameter
      .input('country', sql.NVarChar, null)  // Add country parameter
      .input('description', sql.NVarChar, description || null)
      .output('newVendorId', sql.Int)
      .execute('[dbo].[Proc_Add_Vendors]');

    const newVendorId = result.output.newVendorId;

    // Check for errors from stored procedure
    if (newVendorId === -1) {
      return res.status(400).json({ error: 'Vendor code already exists' });
    }

    if (newVendorId === -2) {
      return res.status(500).json({ error: 'Database error occurred while creating vendor' });
    }

    if (newVendorId <= 0) {
      return res.status(500).json({ error: 'Failed to create vendor' });
    }

    // Update vendor currency
    await pool.request()
      .input('vendorId', sql.Int, newVendorId)
      .input('currency', sql.NVarChar, vendorCurrency)
      .query('UPDATE [dbo].[Vendors] SET Currency = @currency WHERE VendorId = @vendorId');

    // Fetch the created vendor to return complete data
    const vendorResult = await pool.request()
      .input('vendorId', sql.Int, newVendorId)
      .query(`
        SELECT 
          VendorId,
          VendorName,
          VendorCode,
          ContactEmail as Email,
          ContactPhone as Phone,
          Address,
          City,
          Country,
          Currency,
          Description,
          IsActive,
          CreatedAt,
          UpdatedAt
        FROM [dbo].[Vendors]
        WHERE VendorId = @vendorId
      `);

    const vendor = vendorResult.recordset[0];

    console.log('Vendor created successfully using stored procedure:', {
      vendorId: newVendorId,
      vendorName: vendor.VendorName,
      vendorCode: vendor.VendorCode,
      currency: vendor.Currency
    });

    res.status(201).json({ 
      message: 'Vendor created successfully', 
      vendorId: newVendorId,
      vendor: {
        VendorId: newVendorId,
        VendorName: vendor.VendorName,
        VendorCode: vendor.VendorCode,
        Email: vendor.Email,
        Phone: vendor.Phone,
        Address: vendor.Address,
        Currency: vendor.Currency,
        Description: vendor.Description
      }
    });
  } catch (err) {
    console.error('Create vendor error:', err);
    if (err.message.includes('UNIQUE KEY') || err.message.includes('duplicate')) {
      return res.status(400).json({ error: 'Vendor code already exists' });
    }
    res.status(500).json({ error: 'Failed to create vendor: ' + err.message });
  }
});

// Update vendor column mapping
router.post('/:vendorId/column-mapping', verifyToken, async (req, res) => {
  try {
    const vendorId = req.params.vendorId;
    const {
      productCodeColumn,
      productNameColumn,
      descriptionColumn,
      brandColumn,
      categoryColumn,
      priceColumn,
      stockQuantityColumn,
      upcColumn,
      currencyColumn,
      skipHeaderRows
    } = req.body;

    if (!productCodeColumn || !productNameColumn || !priceColumn) {
      return res.status(400).json({ error: 'Product code, name, and price columns are required' });
    }

    const pool = req.pool;

    // Check if mapping exists
    const existingMapping = await pool.request()
      .input('vendorId', sql.Int, vendorId)
      .query('SELECT MappingId FROM [dbo].[VendorColumnMappings] WHERE VendorId = @vendorId');

    if (existingMapping.recordset.length > 0) {
      // Update
      await pool.request()
        .input('vendorId', sql.Int, vendorId)
        .input('productCodeColumn', sql.NVarChar, productCodeColumn)
        .input('productNameColumn', sql.NVarChar, productNameColumn)
        .input('descriptionColumn', sql.NVarChar, descriptionColumn || null)
        .input('brandColumn', sql.NVarChar, brandColumn || null)
        .input('categoryColumn', sql.NVarChar, categoryColumn || null)
        .input('priceColumn', sql.NVarChar, priceColumn)
        .input('stockQuantityColumn', sql.NVarChar, stockQuantityColumn || null)
        .input('upcColumn', sql.NVarChar, upcColumn || null)
        .input('currencyColumn', sql.NVarChar, currencyColumn || null)
        .input('skipHeaderRows', sql.Int, skipHeaderRows || 0)
        .query(`UPDATE [dbo].[VendorColumnMappings]
                SET ProductCodeColumn = @productCodeColumn,
                    ProductNameColumn = @productNameColumn,
                    DescriptionColumn = @descriptionColumn,
                    BrandColumn = @brandColumn,
                    CategoryColumn = @categoryColumn,
                    PriceColumn = @priceColumn,
                    StockQuantityColumn = @stockQuantityColumn,
                    UPCColumn = @upcColumn,
                    CurrencyColumn = @currencyColumn,
                    SkipHeaderRows = @skipHeaderRows,
                    UpdatedAt = GETUTCDATE()
                WHERE VendorId = @vendorId`);
    } else {
      // Insert
      await pool.request()
        .input('vendorId', sql.Int, vendorId)
        .input('productCodeColumn', sql.NVarChar, productCodeColumn)
        .input('productNameColumn', sql.NVarChar, productNameColumn)
        .input('descriptionColumn', sql.NVarChar, descriptionColumn || null)
        .input('brandColumn', sql.NVarChar, brandColumn || null)
        .input('categoryColumn', sql.NVarChar, categoryColumn || null)
        .input('priceColumn', sql.NVarChar, priceColumn)
        .input('stockQuantityColumn', sql.NVarChar, stockQuantityColumn || null)
        .input('upcColumn', sql.NVarChar, upcColumn || null)
        .input('currencyColumn', sql.NVarChar, currencyColumn || null)
        .input('skipHeaderRows', sql.Int, skipHeaderRows || 0)
        .query(`INSERT INTO [dbo].[VendorColumnMappings]
                (VendorId, ProductCodeColumn, ProductNameColumn, DescriptionColumn, BrandColumn, CategoryColumn, PriceColumn, StockQuantityColumn, UPCColumn, CurrencyColumn, SkipHeaderRows)
                VALUES (@vendorId, @productCodeColumn, @productNameColumn, @descriptionColumn, @brandColumn, @categoryColumn, @priceColumn, @stockQuantityColumn, @upcColumn, @currencyColumn, @skipHeaderRows)`);
    }

    res.json({ message: 'Column mapping updated successfully' });
  } catch (err) {
    console.error('Update column mapping error:', err);
    res.status(500).json({ error: 'Failed to update column mapping' });
  }
});

// Update vendor currency
router.patch('/:vendorId/currency', verifyToken, async (req, res) => {
  try {
    const vendorId = req.params.vendorId;
    const { currency } = req.body;

    if (!currency) {
      return res.status(400).json({ error: 'Currency is required' });
    }

    const validCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'INR'];
    if (!validCurrencies.includes(currency.toUpperCase())) {
      return res.status(400).json({ error: `Invalid currency. Supported: ${validCurrencies.join(', ')}` });
    }

    const pool = req.pool;

    // Verify vendor exists
    const vendorExists = await pool.request()
      .input('vendorId', sql.Int, vendorId)
      .query('SELECT VendorId FROM [dbo].[Vendors] WHERE VendorId = @vendorId');

    if (vendorExists.recordset.length === 0) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    // Update currency
    await pool.request()
      .input('vendorId', sql.Int, vendorId)
      .input('currency', sql.NVarChar, currency.toUpperCase())
      .query('UPDATE [dbo].[Vendors] SET Currency = @currency, UpdatedAt = GETUTCDATE() WHERE VendorId = @vendorId');

    res.json({ message: 'Vendor currency updated successfully', vendorId, currency: currency.toUpperCase() });
  } catch (err) {
    console.error('Update vendor currency error:', err);
    res.status(500).json({ error: 'Failed to update vendor currency' });
  }
});

module.exports = router;
