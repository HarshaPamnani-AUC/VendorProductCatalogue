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

async function testUpdate() {
  try {
    await sql.connect(config);
    console.log('Connected to database\n');

    // First, check current data
    console.log('=== CURRENT DATA ===');
    const current = await sql.query(`
      SELECT TOP 2 
        [Item_Code],
        [Vendor],
        [Name],
        [Qty],
        [Price],
        [EAN/UPC]
      FROM [dbo].[Tbl_Products]
      WHERE [Item_Code] = 'CAR HBB00'
      ORDER BY [UploadDatetime] DESC
    `);
    
    current.recordset.forEach((row, i) => {
      console.log(`Row ${i + 1}:`);
      console.log(`  Item_Code: "${row['Item_Code']}"`);
      console.log(`  Vendor: "${row['Vendor']}" (length: ${row['Vendor'].length})`);
      console.log(`  Name: "${row['Name']}"`);
      console.log(`  Qty: "${row['Qty']}"`);
      console.log(`  Price: "${row['Price']}"`);
      console.log(`  EAN/UPC: "${row['EAN/UPC']}"`);
      console.log('---');
    });

    // Test the exact update query
    console.log('\n=== TESTING UPDATE QUERY ===');
    const updateResult = await sql.query(`
      UPDATE [dbo].[Tbl_Products] 
      SET [Name] = @name,
          [Price] = @price,
          [Qty] = @qty,
          [EAN/UPC] = @eanUpc,
          [UpdatedBy] = @updatedBy
      WHERE [Item_Code] = @productCode AND RTRIM([Vendor]) = @vendorName
    `, [
      { name: 'productCode', type: sql.NVarChar, value: 'CAR HBB00' },
      { name: 'vendorName', type: sql.NVarChar, value: 'Global Beauty Supplies' },
      { name: 'name', type: sql.NVarChar, value: 'C.HERRERA BAD BOY 3.4 EDT SP   ' },
      { name: 'price', type: sql.NVarChar, value: '$65.00' },
      { name: 'qty', type: sql.NVarChar, value: '200' },
      { name: 'eanUpc', type: sql.NVarChar, value: '8411061099728' },
      { name: 'updatedBy', type: sql.NVarChar, value: 'Test User' }
    ]);

    console.log('Rows affected:', updateResult.rowsAffected[0]);

    // Check data after update
    console.log('\n=== DATA AFTER UPDATE ===');
    const after = await sql.query(`
      SELECT TOP 2 
        [Item_Code],
        [Vendor],
        [Name],
        [Qty],
        [Price],
        [EAN/UPC],
        [UpdatedBy]
      FROM [dbo].[Tbl_Products]
      WHERE [Item_Code] = 'CAR HBB00'
      ORDER BY [UploadDatetime] DESC
    `);
    
    after.recordset.forEach((row, i) => {
      console.log(`Row ${i + 1}:`);
      console.log(`  Item_Code: "${row['Item_Code']}"`);
      console.log(`  Vendor: "${row['Vendor']}"`);
      console.log(`  Name: "${row['Name']}"`);
      console.log(`  Qty: "${row['Qty']}"`);
      console.log(`  Price: "${row['Price']}"`);
      console.log(`  EAN/UPC: "${row['EAN/UPC']}"`);
      console.log(`  UpdatedBy: "${row['UpdatedBy']}"`);
      console.log('---');
    });

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await sql.close();
  }
}

testUpdate();
