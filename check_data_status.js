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

async function checkDataStatus() {
  try {
    const pool = await sql.connect(sqlConfig);
    console.log('✅ Connected to database');

    // Get all tables
    console.log('\n=== AVAILABLE TABLES ===');
    const tables = await pool.request().query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE' 
      ORDER BY TABLE_NAME
    `);
    console.log('Tables:', tables.recordset.map(r => r.TABLE_NAME).join(', '));

    // Check Upload_Tbl_Products
    console.log('\n=== UPLOAD_TBL_PRODUCTS TABLE ===');
    try {
      const uploadCount = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Upload_Tbl_Products]');
      console.log('Record count:', uploadCount.recordset[0].Count);
      
      if (uploadCount.recordset[0].Count > 0) {
        const uploadSample = await pool.request().query('SELECT TOP 3 [Date], [EAN/UPC], [Name], [Item_Code], [Qty], [Price] FROM [dbo].[Upload_Tbl_Products] ORDER BY Date DESC');
        console.log('Sample records (last 3):');
        uploadSample.recordset.forEach(r => console.log(`  - ${r.Item_Code}: ${r.Name} (${r.Date})`));
      }
    } catch (e) {
      console.log('Error:', e.message);
    }

    // Check Tbl_Products
    console.log('\n=== TBL_PRODUCTS TABLE ===');
    try {
      const mainCount = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Tbl_Products]');
      console.log('Record count:', mainCount.recordset[0].Count);
      
      if (mainCount.recordset[0].Count > 0) {
        const mainSample = await pool.request().query('SELECT TOP 3 [Name], [Vendor], [UploadDatetime] FROM [dbo].[Tbl_Products] ORDER BY UploadDatetime DESC');
        console.log('Last updated records (last 3):');
        mainSample.recordset.forEach(r => console.log(`  - ${r.Name} | Vendor: ${r.Vendor} | Date: ${r.UploadDatetime}`));
      }
    } catch (e) {
      console.log('Error:', e.message);
    }

    // Check Products table
    console.log('\n=== PRODUCTS TABLE ===');
    try {
      const prodCount = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Products]');
      console.log('Record count:', prodCount.recordset[0].Count);
      
      if (prodCount.recordset[0].Count > 0) {
        const prodSample = await pool.request().query('SELECT TOP 3 [ProductName], [Vendor], [UpdatedAt] FROM [dbo].[Products] ORDER BY UpdatedAt DESC');
        console.log('Last updated records (last 3):');
        prodSample.recordset.forEach(r => console.log(`  - ${r.ProductName} | Vendor: ${r.Vendor} | Date: ${r.UpdatedAt}`));
      }
    } catch (e) {
      console.log('Error:', e.message);
    }

    // Check if product_storage table exists
    console.log('\n=== PRODUCT_STORAGE TABLE ===');
    try {
      const storageCount = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[product_storage]');
      console.log('Record count:', storageCount.recordset[0].Count);
      
      if (storageCount.recordset[0].Count > 0) {
        const storageSample = await pool.request().query('SELECT TOP 3 * FROM [dbo].[product_storage] ORDER BY UpdatedAt DESC');
        console.log('Last updated records (last 3):');
        storageSample.recordset.forEach(r => console.log(`  - ${JSON.stringify(r).substring(0, 100)}...`));
      }
    } catch (e) {
      console.log('Table not found or error:', e.message);
    }

    // Check stored procedure
    console.log('\n=== STORED PROCEDURES ===');
    try {
      const procs = await pool.request().query(`
        SELECT ROUTINE_NAME FROM INFORMATION_SCHEMA.ROUTINES 
        WHERE ROUTINE_TYPE = 'PROCEDURE'
        ORDER BY ROUTINE_NAME
      `);
      console.log('Procedures:', procs.recordset.map(r => r.ROUTINE_NAME).join(', '));
    } catch (e) {
      console.log('Error:', e.message);
    }

    await pool.close();
    console.log('\n✅ Diagnostic complete');

  } catch (error) {
    console.error('Connection error:', error.message);
  }
}

checkDataStatus();
