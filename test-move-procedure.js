const sql = require('mssql');

async function testMoveDataProcedure() {
  try {
    console.log('=== Testing Move Data Procedure ===');
    
    // Connect to database
    const pool = await sql.connect({
      server: 'localhost',
      database: 'VendorPriceList',
      user: 'sa',
      password: 'admin123',
      options: {
        encrypt: false,
        trustServerCertificate: true
      }
    });
    
    console.log('✅ Connected to database');
    
    // First, let's check what's in Upload_Tbl_Products
    const uploadCheck = await pool.request().query(`
      SELECT COUNT(*) as UploadCount, 
             COUNT(DISTINCT VendorId) as VendorCount
      FROM [dbo].[Upload_Tbl_Products]
    `);
    
    console.log('📊 Upload_Tbl_Products data:', uploadCheck.recordset[0]);
    
    // Check what's in Products
    const productCheck = await pool.request().query(`
      SELECT COUNT(*) as ProductCount,
             COUNT(DISTINCT VendorId) as VendorCount
      FROM [dbo].[Products]
    `);
    
    console.log('📊 Products data:', productCheck.recordset[0]);
    
    // Get vendor names
    const vendorCheck = await pool.request().query(`
      SELECT DISTINCT v.VendorId, v.VendorName
      FROM [dbo].[Vendors] v
      INNER JOIN [dbo].[Upload_Tbl_Products] u ON v.VendorId = u.VendorId
    `);
    
    console.log('📋 Vendors with upload data:', vendorCheck.recordset);
    
    if (vendorCheck.recordset.length > 0) {
      // Test the procedure with the first vendor
      const vendorName = vendorCheck.recordset[0].VendorName;
      console.log(`🔄 Moving data for vendor: ${vendorName}`);
      
      const result = await pool.request()
        .input('VendorName', sql.NVarChar, vendorName)
        .execute('MoveUploadDataToProducts');
      
      console.log('✅ Procedure executed successfully');
      console.log('📊 Result:', result.recordset[0]);
      
      // Check final counts
      const finalProductCheck = await pool.request().query(`
        SELECT COUNT(*) as ProductCount,
               COUNT(DISTINCT VendorId) as VendorCount
        FROM [dbo].[Products]
      `);
      
      console.log('📊 Final Products data:', finalProductCheck.recordset[0]);
      
    } else {
      console.log('❌ No vendors found with upload data');
    }
    
    await pool.close();
    console.log('✅ Connection closed');
    
  } catch (error) {
    console.error('💥 Error:', error);
  }
}

testMoveDataProcedure();
