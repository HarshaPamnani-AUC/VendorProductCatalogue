const sql = require('mssql');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const sqlConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  server: process.env.DB_SERVER,
  port: 1433,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
  }
};

async function testQuery() {
  try {
    let pool = new sql.ConnectionPool(sqlConfig);
    await pool.connect();
    
    console.log('=== EXAMINING RAW DATA ===');
    
    // Get sample data to understand structure
    const sampleQuery = await pool.request().query(`
      SELECT TOP 10 
        [Item_Code],
        [Name],
        [Date],
        [Price],
        [Vendor],
        [EAN/UPC],
        [Qty]
      FROM [dbo].[Tbl_Products]
      WHERE [Name] LIKE '%test%'
      ORDER BY [Date] DESC
    `);
    
    console.log('Sample data:');
    console.log(JSON.stringify(sampleQuery.recordset, null, 2));
    
    // Get unique vendors for a specific product
    const vendorQuery = await pool.request().query(`
      SELECT DISTINCT [Vendor], COUNT(*) as Count
      FROM [dbo].[Tbl_Products]
      WHERE [Name] LIKE '%test%'
      GROUP BY [Vendor]
      ORDER BY [Vendor]
    `);
    
    console.log('\nUnique vendors:');
    console.log(JSON.stringify(vendorQuery.recordset, null, 2));
    
    await pool.close();
  } catch (err) {
    console.error('Error:', err);
  }
}

testQuery();
