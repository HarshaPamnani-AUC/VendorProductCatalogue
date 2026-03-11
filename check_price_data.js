const sql = require('mssql');
require('dotenv').config({ path: '.env.local' });

async function checkPriceData() {
  try {
    console.log('=== Checking Price Data Types ===');
    
    const sqlConfig = {
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      server: process.env.DB_SERVER,
      port: 1433,
      options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
        enableKeepAlive: true
      }
    };

    // Parse instance name from server if provided (e.g., "SERVER\INSTANCE")
    if (sqlConfig.server && sqlConfig.server.includes('\\')) {
      const parts = sqlConfig.server.split('\\');
      sqlConfig.server = parts[0];
      sqlConfig.options.instanceName = parts[1];
    }

    const pool = await sql.connect(sqlConfig);
    console.log('✅ Connected to database');

    // Check sample Price values
    const priceCheck = await pool.request().query(`
      SELECT TOP 10 
        [Item_Code],
        [Name],
        [Price],
        ISNUMERIC([Price]) as IsNumeric
      FROM [dbo].[Tbl_Products]
      WHERE [Name] LIKE '%ACQUA%'
    `);
    
    console.log('\n📋 Sample Price data for ACQUA products:');
    priceCheck.recordset.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.Item_Code}: "${row.Price}" (Numeric: ${row.IsNumeric})`);
    });

    // Check for non-numeric prices
    const nonNumericCheck = await pool.request().query(`
      SELECT TOP 5
        [Item_Code],
        [Name],
        [Price]
      FROM [dbo].[Tbl_Products]
      WHERE ISNUMERIC([Price]) = 0
      AND [Price] IS NOT NULL
      AND [Price] != ''
    `);
    
    console.log('\n📋 Non-numeric Price values:');
    if (nonNumericCheck.recordset.length > 0) {
      nonNumericCheck.recordset.forEach((row, index) => {
        console.log(`   ${index + 1}. ${row.Item_Code}: "${row.Price}"`);
      });
    } else {
      console.log('   No non-numeric price values found');
    }

    await pool.close();
    
  } catch (err) {
    console.error('💥 Database Error:', err);
  }
}

checkPriceData();
