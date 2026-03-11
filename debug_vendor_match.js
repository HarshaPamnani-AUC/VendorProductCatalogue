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

async function checkVendorMatch() {
  try {
    await sql.connect(config);
    console.log('Connected to database\n');

    const productCode = 'CAR HBB00';
    const vendorName = 'Global Beauty Supplies';

    // Check exact values in database
    const result = await new sql.Request()
      .input('productCode', sql.NVarChar, productCode)
      .query(`
        SELECT 
          [Item_Code],
          [Vendor],
          LEN([Vendor]) as VendorLength,
          DATALENGTH([Vendor]) as VendorDataLength,
          '[' + [Vendor] + ']' as VendorWithBrackets
        FROM [dbo].[Tbl_Products]
        WHERE [Item_Code] = @productCode
      `);

    console.log('=== DATABASE VALUES ===');
    result.recordset.forEach((row, i) => {
      console.log(`Row ${i + 1}:`);
      console.log(`  Item_Code: "${row['Item_Code']}"`);
      console.log(`  Vendor: "${row['Vendor']}"`);
      console.log(`  Vendor Length: ${row['VendorLength']}`);
      console.log(`  Vendor Data Length: ${row['VendorDataLength']}`);
      console.log(`  Vendor with brackets: ${row['VendorWithBrackets']}`);
      console.log('---');
    });

    // Test the WHERE clause
    console.log('\n=== TESTING WHERE CLAUSE ===');
    const testResult = await new sql.Request()
      .input('productCode', sql.NVarChar, productCode)
      .input('vendorName', sql.NVarChar, vendorName)
      .query(`
        SELECT COUNT(*) as Count
        FROM [dbo].[Tbl_Products]
        WHERE [Item_Code] = @productCode AND RTRIM([Vendor]) = @vendorName
      `);

    console.log(`Rows matching WHERE clause: ${testResult.recordset[0].Count}`);

    // Test with different vendor values
    console.log('\n=== TESTING DIFFERENT VENDOR VALUES ===');
    const vendorTests = [
      'Global Beauty Supplies',
      'Global Beauty Supplies ',
      ' Global Beauty Supplies',
      'Global Beauty Supplies  '
    ];

    for (const testVendor of vendorTests) {
      const testResult2 = await new sql.Request()
        .input('productCode', sql.NVarChar, productCode)
        .input('testVendor', sql.NVarChar, testVendor)
        .query(`
          SELECT COUNT(*) as Count
          FROM [dbo].[Tbl_Products]
          WHERE [Item_Code] = @productCode AND RTRIM([Vendor]) = @testVendor
        `);
      
      console.log(`Vendor "${testVendor}" -> Matches: ${testResult2.recordset[0].Count}`);
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await sql.close();
  }
}

checkVendorMatch();
