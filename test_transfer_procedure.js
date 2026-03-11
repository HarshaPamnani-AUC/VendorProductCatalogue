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

async function testTransferProcedure() {
  try {
    const pool = await sql.connect(sqlConfig);
    console.log('Connected to database');

    // Check current data counts
    console.log('\n=== Before Transfer ===');
    const beforeUpload = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Upload_Tbl_Products]');
    const beforeMain = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Tbl_Products]');
    console.log('Upload_Tbl_Products:', beforeUpload.recordset[0].Count, 'records');
    console.log('Tbl_Products:', beforeMain.recordset[0].Count, 'records');

    // Test procedure with ET Perfumes inc.(ET_PERF)
    console.log('\n=== Testing Transfer Procedure ===');
    try {
      const testResult = await pool.request()
        .input('Vendor', sql.NVarChar, 'ET Perfumes inc.(ET_PERF)')
        .execute('Proc_Upload_Tbl_Products');
      
      console.log('Procedure executed successfully');
      console.log('Rows affected:', testResult.rowsAffected[0]);
      
    } catch (procErr) {
      console.log('Procedure execution error:', procErr.message);
      console.log('Procedure error details:', procErr);
    }

    // Check data counts after procedure
    console.log('\n=== After Transfer ===');
    const afterUpload = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Upload_Tbl_Products]');
    const afterMain = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Tbl_Products]');
    console.log('Upload_Tbl_Products:', afterUpload.recordset[0].Count, 'records');
    console.log('Tbl_Products:', afterMain.recordset[0].Count, 'records');

    // Check sample data in main table
    console.log('\n=== Sample Data in Tbl_Products ===');
    try {
      const sampleData = await pool.request().query(`
        SELECT TOP 3 [Date], [EAN/UPC], [Name], [Item_Code], [Qty], [Price], [Vendor], [UploadDatetime]
        FROM [dbo].[Tbl_Products]
        ORDER BY [UploadDatetime] DESC
      `);
      
      console.log('Sample records:');
      sampleData.recordset.forEach((record, index) => {
        console.log(`${index + 1}: ${record.Name} - Vendor: ${record.Vendor}`);
      });
      
    } catch (sampleErr) {
      console.log('Error getting sample data:', sampleErr.message);
    }

    // Test the transfer API call format
    console.log('\n=== Testing API Format ===');
    try {
      // Simulate the API call
      const vendorName = 'ET Perfumes inc.(ET_PERF)';
      console.log('Using vendor:', vendorName);
      
      const apiResult = await pool.request()
        .input('Vendor', sql.NVarChar, vendorName)
        .execute('Proc_Upload_Tbl_Products');
      
      console.log('API format test successful');
      console.log('API rows affected:', apiResult.rowsAffected[0]);
      
    } catch (apiErr) {
      console.log('API format error:', apiErr.message);
    }

  } catch (err) {
    console.error('Database error:', err);
  } finally {
    await sql.close();
  }
}

testTransferProcedure();
