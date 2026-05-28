const sql = require('mssql');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

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

async function applyFix() {
  try {
    const pool = await sql.connect(sqlConfig);
    console.log('✅ Connected to database\n');

    // Read the fixed procedure
    const fixedProc = fs.readFileSync('./fix_upload_procedure.sql', 'utf8');

    console.log('Applying fixed procedure...');
    await pool.request().query(fixedProc);
    console.log('✅ Procedure updated successfully\n');

    // Test the procedure with pending uploads
    console.log('Testing procedure with available vendors...');
    
    // Get unique vendors from Upload_Tbl_Products or use a test vendor
    const testVendor = 'SAP'; // Start with SAP since it was recently updated
    
    console.log(`\n=== TESTING WITH VENDOR: ${testVendor} ===`);
    
    // Get counts before
    const beforeUpload = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Upload_Tbl_Products]');
    const beforeProducts = await pool.request().query(`SELECT COUNT(*) as Count FROM [dbo].[Tbl_Products] WHERE Vendor = '${testVendor}'`);
    
    console.log(`Before execution:`);
    console.log(`  - Upload_Tbl_Products: ${beforeUpload.recordset[0].Count} records`);
    console.log(`  - Tbl_Products (${testVendor}): ${beforeProducts.recordset[0].Count} records`);
    
    // Execute the procedure
    console.log('\nExecuting procedure...');
    const result = await pool.request()
      .input('Vendor', sql.NVarChar, testVendor)
      .execute('Proc_Upload_Tbl_Products');
    
    console.log('✅ Procedure executed successfully');
    if (result.recordset && result.recordset.length > 0) {
      console.log('Result:', result.recordset[0]);
    }
    
    // Get counts after
    const afterUpload = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Upload_Tbl_Products]');
    const afterProducts = await pool.request().query(`SELECT COUNT(*) as Count FROM [dbo].[Tbl_Products] WHERE Vendor = '${testVendor}'`);
    const storageProducts = await pool.request().query(`SELECT COUNT(*) as Count FROM [dbo].[Tbl_Products_Storage] WHERE Vendor = '${testVendor}'`);
    
    console.log(`\nAfter execution:`);
    console.log(`  - Upload_Tbl_Products: ${afterUpload.recordset[0].Count} records (cleared: ${beforeUpload.recordset[0].Count - afterUpload.recordset[0].Count})`);
    console.log(`  - Tbl_Products (${testVendor}): ${afterProducts.recordset[0].Count} records`);
    console.log(`  - Tbl_Products_Storage (${testVendor}): ${storageProducts.recordset[0].Count} records`);
    
    // Show sample of updated data
    if (afterProducts.recordset[0].Count > 0) {
      console.log('\n✅ SUCCESS! Sample updated records:');
      const sample = await pool.request().query(`
        SELECT TOP 3 [Name], [Item_Code], [Price], [UploadDatetime]
        FROM [dbo].[Tbl_Products]
        WHERE Vendor = '${testVendor}'
        ORDER BY [UploadDatetime] DESC
      `);
      sample.recordset.forEach(row => {
        console.log(`  - ${row.Item_Code}: ${row.Name} | Price: ${row.Price} | Updated: ${row.UploadDatetime}`);
      });
    }

    await pool.close();
    console.log('\n✅ Fix applied and tested successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

applyFix();
