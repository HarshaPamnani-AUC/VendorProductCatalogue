const sql = require('mssql');
require('dotenv').config({ path: '.env.local' });

async function checkVendorsDirectly() {
  try {
    console.log('=== Checking Vendors Directly ===');
    
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

    // Check vendors
    const vendorResult = await pool.request().query('SELECT * FROM [dbo].[Vendors] WHERE IsActive = 1 ORDER BY VendorName');
    
    console.log(`\n📋 Found ${vendorResult.recordset.length} active vendors:`);
    vendorResult.recordset.forEach((vendor, index) => {
      console.log(`   ${index + 1}. ${vendor.VendorName} (${vendor.VendorCode}) - ID: ${vendor.VendorId}`);
    });

    // Check products by vendor
    console.log('\n📊 Products by Vendor:');
    for (const vendor of vendorResult.recordset) {
      const productCount = await pool.request()
        .input('vendorId', sql.Int, vendor.VendorId)
        .query('SELECT COUNT(*) as Count FROM [dbo].[Products] WHERE VendorId = @vendorId AND IsActive = 1');
      
      console.log(`   ${vendor.VendorName}: ${productCount.recordset[0].Count} products`);
    }

    // Check for products that exist across multiple vendors
    const multiVendorCheck = await pool.request().query(`
      SELECT 
        p.ProductCode,
        p.ProductName,
        COUNT(DISTINCT p.VendorId) as VendorCount,
        STRING_AGG(v.VendorName, ', ') as Vendors
      FROM [dbo].[Products] p
      INNER JOIN [dbo].[Vendors] v ON p.VendorId = v.VendorId
      WHERE p.IsActive = 1 AND v.IsActive = 1
      GROUP BY p.ProductCode, p.ProductName
      HAVING COUNT(DISTINCT p.VendorId) > 1
      ORDER BY VendorCount DESC
    `);

    if (multiVendorCheck.recordset.length > 0) {
      console.log(`\n✅ Found ${multiVendorCheck.recordset.length} products from multiple vendors:`);
      multiVendorCheck.recordset.forEach((product, index) => {
        console.log(`   ${index + 1}. ${product.ProductCode}: ${product.ProductName}`);
        console.log(`      Vendors (${product.VendorCount}): ${product.Vendors}`);
      });
    } else {
      console.log('\n❌ No products found from multiple vendors');
      console.log('💡 To see multi-vendor search results:');
      console.log('   1. Upload Excel files from different vendors');
      console.log('   2. Or ensure the same product exists from multiple vendors');
      console.log('   3. Then search for products to see price comparison');
    }

    await pool.close();
    
  } catch (err) {
    console.error('💥 Database Error:', err);
  }
}

checkVendorsDirectly();
