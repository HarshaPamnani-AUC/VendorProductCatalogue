#!/usr/bin/env node

/**
 * FUTURE DATES CLEANUP TOOL
 * 
 * This script helps you clean up invalid future-dated records in the database.
 * 
 * Usage: node cleanup_future_dates.js [action]
 * 
 * Actions:
 *   report    - Show detailed report (default)
 *   delete    - Delete 2028 records from SAP
 *   correct   - Correct 2028 dates to today (2026-05-27)
 */

const sql = require('mssql');
require('dotenv').config({ path: '.env.local' });
const readline = require('readline');

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

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function showReport(pool) {
  console.log('\n=== FUTURE DATES REPORT ===\n');
  
  const report = await pool.request().query(`
    SELECT 
      YEAR(CAST([Date] AS DATE)) as Year,
      Vendor,
      COUNT(*) as Count
    FROM [dbo].[Tbl_Products]
    WHERE YEAR(CAST([Date] AS DATE)) > 2026
    GROUP BY YEAR(CAST([Date] AS DATE)), Vendor
    ORDER BY Year DESC
  `);

  console.log('Invalid future-dated records:');
  let total = 0;
  report.recordset.forEach(row => {
    console.log(`  Year ${row.Year} | ${row.Vendor.padEnd(20)} | ${row.Count} records`);
    total += row.Count;
  });
  console.log(`\nTotal future-dated records: ${total}\n`);
}

async function deleteRecords(pool) {
  console.log('\n⚠️  DELETE OPERATION\n');
  
  const confirm = await question('Delete all records from 2028 and later? (yes/no): ');
  
  if (confirm.toLowerCase() !== 'yes') {
    console.log('❌ Operation cancelled\n');
    return;
  }

  try {
    const result = await pool.request().query(`
      DELETE FROM [dbo].[Tbl_Products]
      WHERE YEAR(CAST([Date] AS DATE)) > 2026
    `);
    
    console.log(`\n✅ Deleted ${result.rowsAffected[0]} records`);
    
    // Verify
    const verify = await pool.request().query(`
      SELECT COUNT(*) as Count FROM [dbo].[Tbl_Products]
      WHERE YEAR(CAST([Date] AS DATE)) > 2026
    `);
    
    console.log(`✅ Verification: ${verify.recordset[0].Count} future-dated records remaining\n`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function correctDates(pool) {
  console.log('\n⚠️  DATE CORRECTION OPERATION\n');
  
  const confirm = await question('Correct all future dates to today (2026-05-27)? (yes/no): ');
  
  if (confirm.toLowerCase() !== 'yes') {
    console.log('❌ Operation cancelled\n');
    return;
  }

  try {
    const result = await pool.request().query(`
      UPDATE [dbo].[Tbl_Products]
      SET [Date] = '2026-05-27'
      WHERE YEAR(CAST([Date] AS DATE)) > 2026
    `);
    
    console.log(`\n✅ Updated ${result.rowsAffected[0]} records to 2026-05-27`);
    
    // Verify
    const verify = await pool.request().query(`
      SELECT COUNT(*) as Count FROM [dbo].[Tbl_Products]
      WHERE YEAR(CAST([Date] AS DATE)) > 2026
    `);
    
    console.log(`✅ Verification: ${verify.recordset[0].Count} future-dated records remaining\n`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function main() {
  try {
    const pool = await sql.connect(sqlConfig);
    console.log('✅ Connected to database\n');

    const action = process.argv[2] || 'report';

    switch (action) {
      case 'report':
        await showReport(pool);
        break;
      case 'delete':
        await deleteRecords(pool);
        break;
      case 'correct':
        await correctDates(pool);
        break;
      default:
        console.log('Usage: node cleanup_future_dates.js [report|delete|correct]');
        break;
    }

    await pool.close();
    rl.close();
  } catch (error) {
    console.error('❌ Connection error:', error.message);
    rl.close();
    process.exit(1);
  }
}

main();
