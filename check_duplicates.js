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

async function checkDuplicates() {
  try {
    await sql.connect(config);
    console.log('Connected to database\n');

    // Check all records for CAR HBB00
    const result = await sql.query(`
      SELECT 
        [Item_Code],
        [Vendor],
        [Name],
        [Qty],
        [Price],
        [EAN/UPC],
        [UploadDatetime],
        [UpdatedBy]
      FROM [dbo].[Tbl_Products]
      WHERE [Item_Code] = 'CAR HBB00'
      ORDER BY [UploadDatetime]
    `);

    console.log(`Found ${result.recordset.length} records for CAR HBB00:`);
    result.recordset.forEach((row, i) => {
      console.log(`\nRow ${i + 1}:`);
      console.log(`  Item_Code: "${row['Item_Code']}"`);
      console.log(`  Vendor: "${row['Vendor']}"`);
      console.log(`  Qty: "${row['Qty']}"`);
      console.log(`  Price: "${row['Price']}"`);
      console.log(`  UploadDatetime: ${row['UploadDatetime']}`);
      console.log(`  UpdatedBy: "${row['UpdatedBy']}"`);
    });

    // Check if there are other vendors with same Item_Code
    const otherVendors = await sql.query(`
      SELECT DISTINCT [Vendor], COUNT(*) as Count
      FROM [dbo].[Tbl_Products]
      WHERE [Item_Code] = 'CAR HBB00'
      GROUP BY [Vendor]
    `);

    console.log('\n=== VENDORS FOR CAR HBB00 ===');
    otherVendors.recordset.forEach(v => {
      console.log(`Vendor: "${v.Vendor}" - Count: ${v.Count}`);
    });

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await sql.close();
  }
}

checkDuplicates();
