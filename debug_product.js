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

async function checkProduct() {
  try {
    await sql.connect(config);
    console.log('Connected to database\n');

    // Check for the specific product
    const result = await sql.query(`
      SELECT 
        [Item_Code],
        [Name],
        [EAN/UPC],
        [Qty],
        [Price],
        [Vendor],
        [UploadDatetime],
        [UpdatedBy]
      FROM [dbo].[Tbl_Products]
      WHERE [Item_Code] = 'CAR HBB00'
    `);

    console.log('Product data in database:');
    console.log(result.recordset);
    
    console.log('\n\nColumn details:');
    if (result.recordset.length > 0) {
      const row = result.recordset[0];
      console.log(`Item_Code: "${row['Item_Code']}"`);
      console.log(`Name: "${row['Name']}"`);
      console.log(`EAN/UPC: "${row['EAN/UPC']}"`);
      console.log(`Qty: "${row['Qty']}" (type: ${typeof row['Qty']})`);
      console.log(`Price: "${row['Price']}" (type: ${typeof row['Price']})`);
      console.log(`Vendor: "${row['Vendor']}"`);
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await sql.close();
  }
}

checkProduct();
