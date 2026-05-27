#!/usr/bin/env node

/**
 * QUICK VERIFICATION SCRIPT
 * Run this after each upload to verify data is being transferred correctly
 * 
 * Usage: node verify_upload.js [vendor_name]
 */

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

async function verifyUpload(vendorName) {
  try {
    const pool = await sql.connect(sqlConfig);
    console.log('\n🔍 UPLOAD VERIFICATION\n');

    // Get current state
    const uploadCount = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Upload_Tbl_Products]');
    const storageCount = await pool.request().query(`
      SELECT COUNT(*) as Count FROM [dbo].[Tbl_Products_Storage] 
      ${vendorName ? `WHERE Vendor = '${vendorName}'` : ''}
    `);
    const productsCount = await pool.request().query(`
      SELECT COUNT(*) as Count FROM [dbo].[Tbl_Products]
      ${vendorName ? `WHERE Vendor = '${vendorName}'` : ''}
    `);

    console.log('📊 Current Status:');
    console.log(`  Upload_Tbl_Products:    ${uploadCount.recordset[0].Count.toString().padStart(10)} records`);
    console.log(`  Tbl_Products_Storage:   ${storageCount.recordset[0].Count.toString().padStart(10)} records`);
    console.log(`  Tbl_Products:           ${productsCount.recordset[0].Count.toString().padStart(10)} records`);

    // Check if upload table has pending data
    if (uploadCount.recordset[0].Count > 0) {
      console.log('\n⚠️  PENDING UPLOADS DETECTED!');
      console.log(`   ${uploadCount.recordset[0].Count} records waiting to be processed`);
      console.log('\n   To process these uploads, run the upload API endpoint or:');
      console.log(`   node -e "require('./app/api/upload/route.ts').POST(req)"`);
    } else {
      console.log('\n✅ All uploads processed successfully!');
    }

    // Show recent updates
    if (vendorName) {
      console.log(`\n📋 Recent ${vendorName} Updates:`);
      const recent = await pool.request().query(`
        SELECT TOP 5 Name, Item_Code, Price, UploadDatetime
        FROM [dbo].[Tbl_Products]
        WHERE Vendor = '${vendorName}'
        ORDER BY UploadDatetime DESC
      `);
      recent.recordset.forEach(row => {
        console.log(`  - ${row.Item_Code}: ${row.Name.substring(0, 40)} | $${row.Price} | ${row.UploadDatetime}`);
      });
    }

    await pool.close();
    console.log('\n✅ Verification complete\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Get vendor name from command line or use all
const vendor = process.argv[2];
verifyUpload(vendor);
