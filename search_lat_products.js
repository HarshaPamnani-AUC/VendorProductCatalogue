const sql = require('mssql');
require('dotenv').config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  server: process.env.DB_SERVER,
  options: { encrypt: false, trustServerCertificate: true }
};

async function searchLatProducts() {
  try {
    const pool = await sql.connect(config);
    
    // Search for products with LAT and YMOO
    const searchResult = await pool.request()
      .input('query', sql.NVarChar, '%LAT%YMOO%')
      .query('SELECT TOP 10 Item_Code, Name, Vendor FROM Tbl_Products WHERE Item_Code LIKE @query OR Name LIKE @query');
    
    console.log('Products with LAT and YMOO:');
    if (searchResult.recordset.length === 0) {
      console.log('No products found with "LAT" and "YMOO"');
      
      // Search for just LAT
      const latResult = await pool.request()
        .input('query', sql.NVarChar, '%LAT%')
        .query('SELECT TOP 5 Item_Code, Name FROM Tbl_Products WHERE Item_Code LIKE @query OR Name LIKE @query');
      
      console.log('\nSample LAT products:');
      latResult.recordset.forEach(row => {
        console.log(`- ${row.Item_Code}: ${row.Name}`);
      });
    } else {
      searchResult.recordset.forEach(row => {
        console.log(`- ${row.Item_Code}: ${row.Name} (Vendor: ${row.Vendor})`);
      });
    }
    
    await pool.close();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

searchLatProducts();
