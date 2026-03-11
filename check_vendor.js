const sql = require('mssql');
require('dotenv').config({ path: '.env.local' });

const config = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'Admin@123',
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME || 'ProductCatalogDB',
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

async function checkVendorValues() {
  try {
    await sql.connect(config);
    console.log('Connected to database\n');

    // Check vendor values with exact character representation
    const result = await sql.query(`
      SELECT DISTINCT
        [Item_Code],
        [Vendor],
        '[' + [Vendor] + ']' as VendorWithBrackets,
        LEN([Vendor]) as VendorLength,
        DATALENGTH([Vendor]) as VendorDataLength
      FROM [dbo].[Tbl_Products]
      WHERE [Item_Code] = 'CAR HBB00'
    `);

    console.log('Vendor values for CAR HBB00:');
    result.recordset.forEach(row => {
      console.log(`  Vendor: "${row.Vendor}"`);
      console.log(`  With brackets: ${row.VendorWithBrackets}`);
      console.log(`  Length: ${row.VendorLength}`);
      console.log(`  DataLength: ${row.VendorDataLength}`);
      console.log('---');
    });

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await sql.close();
  }
}

checkVendorValues();
