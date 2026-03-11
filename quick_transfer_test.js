const sql = require('mssql');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const sqlConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
    enableArithAbort: true
  }
};

async function quickTransferTest() {
  try {
    console.log('=== Quick Transfer Test ===');
    
    const pool = await sql.connect(sqlConfig);
    console.log('✅ Connected to database');

    // Check current status
    const uploadCount = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Upload_Tbl_Products]');
    const mainCount = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Tbl_Products]');
    
    console.log('📊 Current status:');
    console.log('   Upload_Tbl_Products:', uploadCount.recordset[0].Count, 'records');
    console.log('   Tbl_Products:', mainCount.recordset[0].Count, 'records');

    if (uploadCount.recordset[0].Count === 0) {
      console.log('❌ No data in Upload_Tbl_Products to transfer');
      return;
    }

    // Clear main table for clean test
    console.log('\n🔄 Clearing main table...');
    await pool.request().query('DELETE FROM [dbo].[Tbl_Products]');
    
    const afterClear = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Tbl_Products]');
    console.log('   Main table after clear:', afterClear.recordset[0].Count, 'records');

    // Execute the exact same INSERT as the API
    console.log('\n🔄 Executing transfer INSERT...');
    const vendor = 'ET Perfumes inc.(ET_PERF)';
    console.log('   Using vendor:', vendor);
    
    const result = await pool.request()
      .input('Vendor', sql.NVarChar, vendor)
      .query(`
        INSERT INTO [dbo].[Tbl_Products] 
        ([Date], [EAN/UPC], [Name], [Item_Code], [Qty], [Price], [Vendor], [UploadDatetime])
        SELECT 
          [Date], [EAN/UPC], [Name], [Item_Code], [Qty], [Price], 
          @Vendor, GETDATE()
        FROM [dbo].[Upload_Tbl_Products]
      `);

    console.log('✅ INSERT executed');
    console.log('   Rows affected:', result.rowsAffected[0]);

    // Check final status
    const finalMain = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Tbl_Products]');
    console.log('\n📊 Final status:');
    console.log('   Tbl_Products:', finalMain.recordset[0].Count, 'records');
    console.log('   Records transferred:', finalMain.recordset[0].Count);

    // Show sample data
    if (finalMain.recordset[0].Count > 0) {
      const sample = await pool.request().query(`
        SELECT TOP 3 [Name], [Vendor], [UploadDatetime]
        FROM [dbo].[Tbl_Products]
        ORDER BY [UploadDatetime] DESC
      `);
      
      console.log('\n📋 Sample data in main table:');
      sample.recordset.forEach((record, index) => {
        console.log(`   ${index + 1}: ${record.Name} - ${record.Vendor} - ${record.UploadDatetime}`);
      });
      
      console.log('\n✅ Transfer test SUCCESSFUL!');
    } else {
      console.log('\n❌ Transfer test FAILED - No data in main table');
    }

  } catch (error) {
    console.error('💥 Transfer test error:', error);
    console.error('Error details:', error.message);
  } finally {
    await sql.close();
  }
}

quickTransferTest();
