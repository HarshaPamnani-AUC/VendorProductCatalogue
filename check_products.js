const sql = require('mssql');
require('dotenv').config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  server: process.env.DB_SERVER,
  options: { encrypt: false, trustServerCertificate: true }
};

async function checkProducts() {
  try {
    const pool = await sql.connect(config);
    
    // Check total products
    const countResult = await pool.request().query('SELECT COUNT(*) as Total FROM Tbl_Products');
    console.log('Total products in database:', countResult.recordset[0].Total);
    
    // Search for LAT YMOO specifically
    const searchResult = await pool.request()
      .input('query', sql.NVarChar, '%LAT YMOO%')
      .query('SELECT TOP 5 Item_Code, Name, Vendor FROM Tbl_Products WHERE Item_Code LIKE @query OR Name LIKE @query');
    
    console.log('Products matching "LAT YMOO":');
    if (searchResult.recordset.length === 0) {
      console.log('No products found');
    } else {
      searchResult.recordset.forEach(row => {
        console.log(`- ${row.Item_Code}: ${row.Name} (Vendor: ${row.Vendor})`);
      });
    }
    
    // Show sample products
    const sampleResult = await pool.request().query('SELECT TOP 5 Item_Code, Name, Vendor FROM Tbl_Products ORDER BY NEWID()');
    console.log('\nSample products:');
    sampleResult.recordset.forEach(row => {
      console.log(`- ${row.Item_Code}: ${row.Name} (Vendor: ${row.Vendor})`);
    });
    
    await pool.close();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkProducts();
