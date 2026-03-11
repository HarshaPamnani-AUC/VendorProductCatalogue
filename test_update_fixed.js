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

    // Test the exact update query with correct parameter syntax
    console.log('\n=== TESTING UPDATE QUERY ===');
    const updateResult = await new sql.Request()
      .input('productCode', sql.NVarChar, 'CAR HBB00')
      .input('vendorName', sql.NVarChar, 'Global Beauty Supplies')
      .input('name', sql.NVarChar, 'C.HERRERA BAD BOY 3.4 EDT SP   ')
      .input('price', sql.NVarChar, '$65.00')
      .input('qty', sql.NVarChar, '200')
      .input('eanUpc', sql.NVarChar, '8411061099728')
      .input('updatedBy', sql.NVarChar, 'Test User')
      .query(`
        UPDATE [dbo].[Tbl_Products] 
        SET [Name] = @name,
            [Price] = @price,
            [Qty] = @qty,
            [EAN/UPC] = @eanUpc,
            [UpdatedBy] = @updatedBy
        WHERE [Item_Code] = @productCode AND RTRIM([Vendor]) = @vendorName
      `);

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
