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

async function checkDatabaseContext() {
  try {
    const pool = await sql.connect(sqlConfig);
    console.log('Connected to database');

    // Check current database context
    console.log('\n=== Database Context Check ===');
    const dbContext = await pool.request().query('SELECT DB_NAME() as CurrentDatabase');
    console.log('Current Database:', dbContext.recordset[0].CurrentDatabase);

    // Check if tables exist in current database
    console.log('\n=== Table Existence Check ===');
    
    // Check Upload_Tbl_Products
    const uploadTableCheck = await pool.request().query(`
      SELECT TABLE_CATALOG, TABLE_SCHEMA, TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'Upload_Tbl_Products'
    `);
    
    if (uploadTableCheck.recordset.length > 0) {
      console.log('Upload_Tbl_Products found in:', uploadTableCheck.recordset[0].TABLE_CATALOG + '.' + uploadTableCheck.recordset[0].TABLE_SCHEMA + '.' + uploadTableCheck.recordset[0].TABLE_NAME);
    } else {
      console.log('Upload_Tbl_Products NOT found in current database');
    }

    // Check Tbl_Products
    const mainTableCheck = await pool.request().query(`
      SELECT TABLE_CATALOG, TABLE_SCHEMA, TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'Tbl_Products'
    `);
    
    if (mainTableCheck.recordset.length > 0) {
      console.log('Tbl_Products found in:', mainTableCheck.recordset[0].TABLE_CATALOG + '.' + mainTableCheck.recordset[0].TABLE_SCHEMA + '.' + mainTableCheck.recordset[0].TABLE_NAME);
    } else {
      console.log('Tbl_Products NOT found in current database');
    }

    // Check data in Upload_Tbl_Products
    console.log('\n=== Upload_Tbl_Products Data ===');
    try {
      const uploadData = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Upload_Tbl_Products]');
      console.log('Upload_Tbl_Products has', uploadData.recordset[0].Count, 'records');
    } catch (err) {
      console.log('Error accessing Upload_Tbl_Products:', err.message);
    }

    // Check data in Tbl_Products
    console.log('\n=== Tbl_Products Data ===');
    try {
      const mainData = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Tbl_Products]');
      console.log('Tbl_Products has', mainData.recordset[0].Count, 'records');
    } catch (err) {
      console.log('Error accessing Tbl_Products:', err.message);
    }

    // Test procedure execution
    console.log('\n=== Procedure Test ===');
    try {
      const testResult = await pool.request()
        .input('Vendor', sql.NVarChar, 'TEST_VENDOR')
        .execute('Proc_Upload_Tbl_Products');
      
      console.log('Procedure executed successfully');
      console.log('Rows affected:', testResult.rowsAffected[0]);
      
      // Check Tbl_Products after procedure
      const afterData = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Tbl_Products]');
      console.log('Tbl_Products has', afterData.recordset[0].Count, 'records after procedure');
      
    } catch (procErr) {
      console.log('Procedure error:', procErr.message);
    }

    // Check if procedure exists and its definition
    console.log('\n=== Procedure Definition ===');
    try {
      const procDef = await pool.request().query(`
        SELECT OBJECT_DEFINITION(OBJECT_ID('Proc_Upload_Tbl_Products')) as ProcedureDefinition
      `);
      
      if (procDef.recordset[0].ProcedureDefinition) {
        console.log('Procedure definition found');
        console.log('Procedure text:', procDef.recordset[0].ProcedureDefinition);
      } else {
        console.log('Procedure definition NOT found');
      }
    } catch (err) {
      console.log('Error getting procedure definition:', err.message);
    }

  } catch (err) {
    console.error('Database error:', err);
  } finally {
    await sql.close();
  }
}

checkDatabaseContext();
