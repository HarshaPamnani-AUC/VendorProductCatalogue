const sql = require('mssql');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

// Simulate the exact API environment
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

async function simulateAPICall() {
  try {
    console.log('=== Simulating API Transfer Call ===');
    console.log('Environment variables:');
    console.log('DB_USER:', process.env.DB_USER ? 'SET' : 'NOT SET');
    console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? 'SET' : 'NOT SET');
    console.log('DB_SERVER:', process.env.DB_SERVER);
    console.log('DB_NAME:', process.env.DB_NAME);
    console.log('DB_ENCRYPT:', process.env.DB_ENCRYPT);
    console.log('DB_TRUST_CERT:', process.env.DB_TRUST_CERT);

    // Connect to database
    const pool = await sql.connect(sqlConfig);
    console.log('Database connected successfully');
    
    try {
      // Check data counts before procedure
      const beforeUpload = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Upload_Tbl_Products]');
      const beforeMain = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Tbl_Products]');
      
      console.log('Before transfer - Upload:', beforeUpload.recordset[0].Count, 'Main:', beforeMain.recordset[0].Count);
      
      // Execute the procedure with vendor name
      const vendor = 'ET Perfumes inc.(ET_PERF)';
      console.log('Executing procedure with vendor:', vendor);
      
      const result = await pool.request()
        .input('Vendor', sql.NVarChar, vendor)
        .execute('Proc_Upload_Tbl_Products');
      
      console.log('Procedure executed successfully');
      console.log('Result:', result);
      
      // Check data counts after procedure
      const afterUpload = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Upload_Tbl_Products]');
      const afterMain = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Tbl_Products]');
      
      console.log('After transfer - Upload:', afterUpload.recordset[0].Count, 'Main:', afterMain.recordset[0].Count);
      
      // Calculate transferred records
      const transferredRecords = afterMain.recordset[0].Count - beforeMain.recordset[0].Count;
      console.log('Records transferred:', transferredRecords);
      
      // Get sample data from main table
      const sampleData = await pool.request().query(`
        SELECT TOP 5 [Date], [EAN/UPC], [Name], [Item_Code], [Qty], [Price], [Vendor], [UploadDatetime]
        FROM [dbo].[Tbl_Products]
        ORDER BY [UploadDatetime] DESC
      `);

      console.log('Sample data from main table:');
      sampleData.recordset.forEach((record, index) => {
        console.log(`${index + 1}: ${record.Name} - Vendor: ${record.Vendor}`);
      });

      // Simulate successful API response
      const apiResponse = {
        message: 'Data transfer completed successfully',
        vendor: vendor,
        beforeCounts: {
          uploadTable: beforeUpload.recordset[0].Count,
          mainTable: beforeMain.recordset[0].Count
        },
        afterCounts: {
          uploadTable: afterUpload.recordset[0].Count,
          mainTable: afterMain.recordset[0].Count
        },
        transferredRecords: transferredRecords,
        sampleData: sampleData.recordset
      };

      console.log('API Response:', JSON.stringify(apiResponse, null, 2));

    } finally {
      await pool.close();
    }

  } catch (error) {
    console.error('API simulation error:', error);
    console.error('Error details:', error.message);
    if (error.code) console.error('Error code:', error.code);
    if (error.number) console.error('Error number:', error.number);
  }
}

simulateAPICall();
