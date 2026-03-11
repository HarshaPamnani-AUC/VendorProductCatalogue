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

async function checkUploadData() {
  try {
    const pool = await sql.connect(sqlConfig);
    console.log('Connected to database');

    // Check current data in Upload_Tbl_Products
    console.log('\n=== Current Upload_Tbl_Products Data ===');
    const uploadData = await pool.request().query('SELECT TOP 5 * FROM [dbo].[Upload_Tbl_Products]');
    console.log(`Upload_Tbl_Products has ${uploadData.recordset.length} records`);
    uploadData.recordset.forEach(record => {
      console.log(`- ${record.Item_Code}: ${record.Name} - ${record.Price} [${record.Date}]`);
    });

    // Check current data in Tbl_Products
    console.log('\n=== Current Tbl_Products Data ===');
    const mainData = await pool.request().query('SELECT TOP 5 * FROM [dbo].[Tbl_Products]');
    console.log(`Tbl_Products has ${mainData.recordset.length} records`);
    mainData.recordset.forEach(record => {
      console.log(`- ${record.Item_Code}: ${record.Name} - ${record.Price} [Vendor: ${record.Vendor}]`);
    });

    // Check if procedure exists and works
    console.log('\n=== Testing Procedure ===');
    try {
      const testResult = await pool.request()
        .input('Vendor', sql.NVarChar, 'TEST_VENDOR')
        .execute('Proc_Upload_Tbl_Products');
      
      console.log('Procedure executed successfully');
      const result = testResult.recordset[0];
      console.log(`- Result: ${result.ResultMessage || 'No message'}`);
    } catch (procErr) {
      console.log('Procedure error:', procErr.message);
    }

    // Check table structures
    console.log('\n=== Table Structures ===');
    
    const uploadCols = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Upload_Tbl_Products'
      ORDER BY ORDINAL_POSITION
    `);

    const mainCols = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Tbl_Products'
      ORDER BY ORDINAL_POSITION
    `);

    console.log('Upload_Tbl_Products columns:');
    uploadCols.recordset.forEach(col => {
      console.log(`- ${col.COLUMN_NAME}: ${col.DATA_TYPE}`);
    });

    console.log('Tbl_Products columns:');
    mainCols.recordset.forEach(col => {
      console.log(`- ${col.COLUMN_NAME}: ${col.DATA_TYPE}`);
    });

  } catch (err) {
    console.error('Database error:', err);
  } finally {
    await sql.close();
  }
}

checkUploadData();
