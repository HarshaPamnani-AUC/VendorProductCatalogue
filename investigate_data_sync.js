const sql = require('mssql');
require('dotenv').config({ path: '.env.local' });

const sqlConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: true,
    enableArithAbort: true
  }
};

async function investigateIssue() {
  try {
    const pool = await sql.connect(sqlConfig);
    console.log('✅ Connected to database\n');

    // Check Tbl_Products_Storage table
    console.log('=== TBL_PRODUCTS_STORAGE TABLE ===');
    try {
      const storageCount = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Tbl_Products_Storage]');
      console.log('Record count:', storageCount.recordset[0].Count);
      
      if (storageCount.recordset[0].Count > 0) {
        const storageSample = await pool.request().query('SELECT TOP 5 [Name], [Vendor], [UploadDatetime] FROM [dbo].[Tbl_Products_Storage] ORDER BY UploadDatetime DESC');
        console.log('Last updated records:');
        storageSample.recordset.forEach(r => console.log(`  - ${r.Name} | Vendor: ${r.Vendor} | Date: ${r.UploadDatetime}`));
      }
    } catch (e) {
      console.log('Error:', e.message);
    }

    // Check Tbl_Products last updates by vendor
    console.log('\n=== TBL_PRODUCTS LAST UPDATE BY VENDOR ===');
    try {
      const byVendor = await pool.request().query(`
        SELECT Vendor, COUNT(*) as Count, MAX(UploadDatetime) as LastUpdate
        FROM [dbo].[Tbl_Products]
        GROUP BY Vendor
        ORDER BY LastUpdate DESC
      `);
      console.log('Vendor updates:');
      byVendor.recordset.forEach(r => console.log(`  - ${r.Vendor.padEnd(25)} | Count: ${r.Count.toString().padEnd(7)} | Last: ${r.LastUpdate}`));
    } catch (e) {
      console.log('Error:', e.message);
    }

    // Check if there's a mismatch - what's in Upload but not transferred
    console.log('\n=== UPLOAD_TBL_PRODUCTS - MISSING IN TBL_PRODUCTS ===');
    try {
      const query = `
        SELECT COUNT(DISTINCT Item_Code) as MissingCount
        FROM [dbo].[Upload_Tbl_Products]
        WHERE Item_Code NOT IN (SELECT Item_Code FROM [dbo].[Tbl_Products])
      `;
      const result = await pool.request().query(query);
      console.log('Items in Upload but NOT in Tbl_Products:', result.recordset[0].MissingCount);
    } catch (e) {
      console.log('Error:', e.message);
    }

    // Check stored procedure status
    console.log('\n=== STORED PROCEDURE: Proc_Upload_Tbl_Products ===');
    try {
      const procDef = await pool.request().query(`
        SELECT OBJECT_DEFINITION(OBJECT_ID('Proc_Upload_Tbl_Products')) as ProcDefinition
      `);
      console.log('Procedure exists: YES');
      console.log('Definition (first 500 chars):');
      console.log(procDef.recordset[0].ProcDefinition.substring(0, 500));
    } catch (e) {
      console.log('Error checking procedure:', e.message);
    }

    await pool.close();
    console.log('\n✅ Investigation complete');

  } catch (error) {
    console.error('Connection error:', error.message);
  }
}

investigateIssue();
