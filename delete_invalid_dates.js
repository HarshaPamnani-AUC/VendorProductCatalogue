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

async function deleteInvalidDates() {
  try {
    const pool = await sql.connect(sqlConfig);
    console.log('🗑️  DELETING INVALID FUTURE-DATED RECORDS\n');

    // Get count before
    const before = await pool.request().query(`
      SELECT COUNT(*) as Count FROM [dbo].[Tbl_Products]
      WHERE YEAR(CAST([Date] AS DATE)) > 2026
    `);
    console.log('Before deletion:');
    console.log('  Records with dates > 2026: ' + before.recordset[0].Count);

    // Delete records
    const deleteResult = await pool.request().query(`
      DELETE FROM [dbo].[Tbl_Products]
      WHERE YEAR(CAST([Date] AS DATE)) > 2026
    `);
    
    console.log('\n✅ Deleted: ' + deleteResult.rowsAffected[0] + ' records');

    // Verify
    const after = await pool.request().query(`
      SELECT COUNT(*) as Count FROM [dbo].[Tbl_Products]
      WHERE YEAR(CAST([Date] AS DATE)) > 2026
    `);
    console.log('\nAfter deletion:');
    console.log('  Records with dates > 2026: ' + after.recordset[0].Count);

    // Show remaining data
    console.log('\n✅ Current valid data:');
    const current = await pool.request().query(`
      SELECT 
        YEAR(CAST([Date] AS DATE)) as Year,
        COUNT(*) as Count
      FROM [dbo].[Tbl_Products]
      WHERE [Date] IS NOT NULL AND [Date] != ''
      GROUP BY YEAR(CAST([Date] AS DATE))
      ORDER BY Year DESC
    `);
    current.recordset.forEach(r => {
      if (r.Year > 1900) {
        console.log('  Year ' + r.Year + ': ' + r.Count + ' records');
      }
    });

    await pool.close();

  } catch (error) {
    console.error('Error:', error.message);
  }
}

deleteInvalidDates();
