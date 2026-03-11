const sql = require('mssql');
require('dotenv').config({ path: '.env.local' });

async function checkCorrectProductsTable() {
  try {
    console.log('=== Checking Tbl_Products Table ===');
    
    const sqlConfig = {
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      server: process.env.DB_SERVER,
      port: 1433,
      options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
        enableKeepAlive: true
      }
    };

    // Parse instance name from server if provided (e.g., "SERVER\INSTANCE")
    if (sqlConfig.server && sqlConfig.server.includes('\\')) {
      const parts = sqlConfig.server.split('\\');
      sqlConfig.server = parts[0];
      sqlConfig.options.instanceName = parts[1];
    }

    console.log('🔧 Database Config:', {
      server: sqlConfig.server,
      database: sqlConfig.database,
      instanceName: sqlConfig.options.instanceName,
      encrypt: sqlConfig.options.encrypt
    });

    const pool = await sql.connect(sqlConfig);
    console.log('✅ Connected to database');

    // Check Tbl_Products structure
    console.log('\n📋 Checking Tbl_Products table structure...');
    const structureResult = await pool.request().query(`
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        IS_NULLABLE,
        CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Tbl_Products' 
        AND TABLE_SCHEMA = 'dbo'
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('Table Structure:');
    structureResult.recordset.forEach((col, index) => {
      console.log(`   ${index + 1}. ${col.COLUMN_NAME} (${col.DATA_TYPE}${col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : ''})`);
    });

    // Check total products in Tbl_Products
    const totalResult = await pool.request().query('SELECT COUNT(*) as Total FROM [dbo].[Tbl_Products]');
    console.log(`\n📊 Total products in Tbl_Products: ${totalResult.recordset[0].Total}`);

    // Check products by vendor in Tbl_Products
    const vendorCheck = await pool.request().query(`
      SELECT 
        Vendor,
        COUNT(*) as ProductCount
      FROM [dbo].[Tbl_Products]
      WHERE Vendor IS NOT NULL
      GROUP BY Vendor
      ORDER BY ProductCount DESC
    `);
    
    console.log('\n📊 Products by Vendor in Tbl_Products:');
    vendorCheck.recordset.forEach((vendor, index) => {
      console.log(`   ${index + 1}. ${vendor.Vendor}: ${vendor.ProductCount} products`);
    });

    // Check for products that exist across multiple vendors
    const multiVendorCheck = await pool.request().query(`
      SELECT 
        [Item_Code] as ProductCode,
        [Name] as ProductName,
        COUNT(DISTINCT [Vendor]) as VendorCount,
        STRING_AGG([Vendor], ', ') as Vendors
      FROM [dbo].[Tbl_Products]
      WHERE [Vendor] IS NOT NULL
      GROUP BY [Item_Code], [Name]
      HAVING COUNT(DISTINCT [Vendor]) > 1
      ORDER BY VendorCount DESC
    `);

    if (multiVendorCheck.recordset.length > 0) {
      console.log(`\n✅ Found ${multiVendorCheck.recordset.length} products from multiple vendors:`);
      multiVendorCheck.recordset.forEach((product, index) => {
        console.log(`   ${index + 1}. ${product.ProductCode}: ${product.ProductName}`);
        console.log(`      Vendors (${product.VendorCount}): ${product.Vendors}`);
      });
    } else {
      console.log('\n❌ No products found from multiple vendors in Tbl_Products');
    }

    // Sample products to see the data
    const sampleResult = await pool.request().query('SELECT TOP 5 * FROM [dbo].[Tbl_Products]');
    console.log('\n📋 Sample products from Tbl_Products:');
    sampleResult.recordset.forEach((product, index) => {
      console.log(`   ${index + 1}. ${product.Item_Code} - ${product.Name} - ${product.Vendor}`);
    });

    await pool.close();
    
  } catch (err) {
    console.error('💥 Database Error:', err);
  }
}

checkCorrectProductsTable();
