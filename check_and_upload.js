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

async function checkAndUploadData() {
  try {
    console.log('=== Check and Upload Data ===');
    
    const pool = await sql.connect(sqlConfig);
    
    // Check current status
    const uploadCount = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Upload_Tbl_Products]');
    const mainCount = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Tbl_Products]');
    
    console.log('Upload_Tbl_Products:', uploadCount.recordset[0].Count, 'records');
    console.log('Tbl_Products:', mainCount.recordset[0].Count, 'records');
    
    if (uploadCount.recordset[0].Count === 0) {
      console.log('No data in upload table. Adding sample data...');
      
      // Add sample data
      await pool.request()
        .input('Date', sql.NVarChar, '2024-01-01')
        .input('EAN_UPC', sql.NVarChar, '1234567890123')
        .input('Name', sql.NVarChar, 'Test Product 1')
        .input('Item_Code', sql.NVarChar, 'TEST001')
        .input('Qty', sql.NVarChar, '100')
        .input('Price', sql.NVarChar, '29.99')
        .query(`
          INSERT INTO [dbo].[Upload_Tbl_Products] 
          ([Date], [EAN/UPC], [Name], [Item_Code], [Qty], [Price])
          VALUES (@Date, @EAN_UPC, @Name, @Item_Code, @Qty, @Price)
        `);
      
      const newUploadCount = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Upload_Tbl_Products]');
      console.log('Added sample data. Upload table now has:', newUploadCount.recordset[0].Count, 'records');
    }
    
    await pool.close();
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkAndUploadData();
