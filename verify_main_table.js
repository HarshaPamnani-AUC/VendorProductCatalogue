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

async function verifyMainTable() {
  try {
    console.log('=== Verifying Main Table Data ===');
    
    const pool = await sql.connect(sqlConfig);
    
    // Check both tables
    const uploadCount = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Upload_Tbl_Products]');
    const mainCount = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Tbl_Products]');
    
    console.log('📊 Table Status:');
    console.log('   Upload_Tbl_Products:', uploadCount.recordset[0].Count, 'records');
    console.log('   Tbl_Products:', mainCount.recordset[0].Count, 'records');
    
    if (mainCount.recordset[0].Count > 0) {
      console.log('\n✅ DATA FOUND IN MAIN TABLE!');
      
      // Show sample data
      const sampleData = await pool.request().query(`
        SELECT TOP 5 [Name], [Vendor], [UploadDatetime]
        FROM [dbo].[Tbl_Products]
        ORDER BY [UploadDatetime] DESC
      `);
      
      console.log('\n📋 Sample Records in Tbl_Products:');
      sampleData.recordset.forEach((record, index) => {
        console.log(`   ${index + 1}: ${record.Name}`);
        console.log(`      Vendor: ${record.Vendor}`);
        console.log(`      Uploaded: ${record.UploadDatetime}`);
        console.log('');
      });
      
    } else {
      console.log('\n❌ No data found in Tbl_Products');
      console.log('💡 Check if you are looking at the correct database and table');
    }
    
    await sql.close();
    
  } catch (error) {
    console.error('❌ Verification error:', error);
  }
}

verifyMainTable();
