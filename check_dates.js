const sql = require('mssql');
require('dotenv').config({ path: '.env.local' });

const sqlConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: true,
    enableArithAbort: true
  }
};

async function checkDates() {
  try {
    const pool = await sql.connect(sqlConfig);
    console.log('📅 DATE ANALYSIS\n');

    // Check Upload_Tbl_Products dates
    console.log('=== UPLOAD_TBL_PRODUCTS DATE DISTRIBUTION ===');
    const uploadDates = await pool.request().query(`
      SELECT 
        YEAR([Date]) as Year,
        COUNT(*) as Count,
        MIN([Date]) as EarliestDate,
        MAX([Date]) as LatestDate
      FROM [dbo].[Upload_Tbl_Products]
      GROUP BY YEAR([Date])
      ORDER BY Year DESC
    `);
    console.log('Date distribution (by year):');
    uploadDates.recordset.forEach(row => {
      console.log(`  ${row.Year}: ${row.Count.toString().padStart(8)} records | ${row.EarliestDate} to ${row.LatestDate}`);
    });

    // Check Tbl_Products dates
    console.log('\n=== TBL_PRODUCTS DATE DISTRIBUTION ===');
    const productDates = await pool.request().query(`
      SELECT 
        YEAR(CAST([Date] AS DATE)) as Year,
        COUNT(*) as Count,
        MIN(CAST([Date] AS DATE)) as EarliestDate,
        MAX(CAST([Date] AS DATE)) as LatestDate
      FROM [dbo].[Tbl_Products]
      WHERE [Date] IS NOT NULL AND [Date] != ''
      GROUP BY YEAR(CAST([Date] AS DATE))
      ORDER BY Year DESC
    `);
    console.log('Date distribution (by year):');
    productDates.recordset.forEach(row => {
      if (row.Year && row.Year > 1900) {
        console.log(`  ${row.Year}: ${row.Count.toString().padStart(8)} records | ${row.EarliestDate} to ${row.LatestDate}`);
      }
    });

    // Show sample of 2028 data
    console.log('\n=== SAMPLE 2028 DATA ===');
    const data2028 = await pool.request().query(`
      SELECT TOP 5 Item_Code, Name, Date, Price
      FROM [dbo].[Upload_Tbl_Products]
      WHERE YEAR([Date]) = 2028
      ORDER BY [Date] DESC
    `);
    console.log('Sample records from 2028:');
    data2028.recordset.forEach(row => {
      console.log(`  - ${row.Item_Code}: ${row.Name} | Date: ${row.Date} | Price: ${row.Price}`);
    });

    // Check if there's recent valid data
    console.log('\n=== CURRENT VALID DATA (2026) ===');
    const currentData = await pool.request().query(`
      SELECT 
        COUNT(*) as Count,
        MIN([Date]) as EarliestDate,
        MAX([Date]) as LatestDate
      FROM [dbo].[Upload_Tbl_Products]
      WHERE YEAR([Date]) = 2026
    `);
    const curr = currentData.recordset[0];
    console.log(`Records from 2026: ${curr.Count}`);
    if (curr.Count > 0) {
      console.log(`Date range: ${curr.EarliestDate} to ${curr.LatestDate}`);
    }

    await pool.close();

  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkDates();
