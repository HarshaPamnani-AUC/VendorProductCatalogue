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

async function analyzeInvalidDates() {
  try {
    const pool = await sql.connect(sqlConfig);
    console.log('📊 INVALID DATE ANALYSIS\n');

    // Get breakdown by year and vendor
    console.log('=== RECORDS BY YEAR AND VENDOR ===');
    const byVendor = await pool.request().query(`
      SELECT 
        Vendor,
        YEAR(CAST([Date] AS DATE)) as Year,
        COUNT(*) as Count
      FROM [dbo].[Tbl_Products]
      WHERE [Date] IS NOT NULL AND [Date] != ''
        AND YEAR(CAST([Date] AS DATE)) > 2026
      GROUP BY Vendor, YEAR(CAST([Date] AS DATE))
      ORDER BY Year DESC, Count DESC
    `);
    
    console.log('Vendors with future-dated records:');
    let vendors2027 = {};
    let vendors2028 = {};
    
    byVendor.recordset.forEach(row => {
      if (row.Year === 2028) {
        vendors2028[row.Vendor] = row.Count;
        console.log(`  ${row.Vendor.padEnd(25)} | 2028: ${row.Count.toString().padStart(6)} records`);
      }
    });
    
    console.log('\nBreakdown:');
    console.log(`  Total 2028 records: ${Object.values(vendors2028).reduce((a, b) => a + b, 0)}`);
    console.log(`  Vendors with 2028 data: ${Object.keys(vendors2028).length}`);

    // Sample data
    console.log('\n=== SAMPLE 2028 DATA ===');
    const sample = await pool.request().query(`
      SELECT TOP 10 Vendor, Item_Code, Name, Date, Price
      FROM [dbo].[Tbl_Products]
      WHERE YEAR(CAST([Date] AS DATE)) = 2028
    `);
    sample.recordset.forEach(row => {
      console.log(`  [${row.Vendor}] ${row.Item_Code}: ${row.Name.substring(0, 40)} | ${row.Date}`);
    });

    // Storage backup
    console.log('\n=== BACKUP IN STORAGE TABLE ===');
    const storageDate = await pool.request().query(`
      SELECT 
        YEAR(CAST([Date] AS DATE)) as Year,
        COUNT(*) as Count
      FROM [dbo].[Tbl_Products_Storage]
      WHERE [Date] IS NOT NULL AND [Date] != ''
      GROUP BY YEAR(CAST([Date] AS DATE))
      ORDER BY Year DESC
    `);
    console.log('Storage table dates:');
    storageDate.recordset.forEach(row => {
      if (row.Year && row.Year > 1900) {
        console.log(`  Year ${row.Year}: ${row.Count} records`);
      }
    });

    await pool.close();

  } catch (error) {
    console.error('Error:', error.message);
  }
}

analyzeInvalidDates();
