const sql = require('mssql');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const sqlConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
    enableArithAbort: true
  }
};

async function checkTableStructures() {
  try {
    const pool = await sql.connect(sqlConfig);
    console.log('Connected to database');

    // Check Upload_Tbl_Products structure
    console.log('\n=== Upload_Tbl_Products Structure ===');
    const uploadTableInfo = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Upload_Tbl_Products'
      ORDER BY ORDINAL_POSITION
    `);

    console.log('Upload_Tbl_Products columns:');
    uploadTableInfo.recordset.forEach(col => {
      console.log(`- ${col.COLUMN_NAME}: ${col.DATA_TYPE}(${col.CHARACTER_MAXIMUM_LENGTH || 'N/A'}) - ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    // Check Tbl_Products structure
    console.log('\n=== Tbl_Products Structure ===');
    const mainTableInfo = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Tbl_Products'
      ORDER BY ORDINAL_POSITION
    `);

    console.log('Tbl_Products columns:');
    mainTableInfo.recordset.forEach(col => {
      console.log(`- ${col.COLUMN_NAME}: ${col.DATA_TYPE}(${col.CHARACTER_MAXIMUM_LENGTH || 'N/A'}) - ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    // Compare the structures
    console.log('\n=== Structure Comparison ===');
    
    // Get all columns from both tables
    const uploadColumns = uploadTableInfo.recordset.map(col => col.COLUMN_NAME);
    const mainColumns = mainTableInfo.recordset.map(col => col.COLUMN_NAME);
    
    console.log('Upload_Tbl_Products columns:', uploadColumns.length);
    console.log('Tbl_Products columns:', mainColumns.length);
    
    // Find columns in Upload_Tbl_Products that are not in Tbl_Products
    const uploadOnlyColumns = uploadColumns.filter(col => !mainColumns.includes(col));
    if (uploadOnlyColumns.length > 0) {
      console.log('Columns only in Upload_Tbl_Products:', uploadOnlyColumns);
    }
    
    // Find columns in Tbl_Products that are not in Upload_Tbl_Products
    const mainOnlyColumns = mainColumns.filter(col => !uploadColumns.includes(col));
    if (mainOnlyColumns.length > 0) {
      console.log('Columns only in Tbl_Products:', mainOnlyColumns);
    }

    // Check if they have the same core product columns
    const coreProductColumns = ['VendorCode', 'ProductCode', 'ProductName', 'Description', 'Brand', 'Category', 'Price', 'StockQuantity', 'UPC', 'SKU', 'Weight', 'Dimensions', 'Color', 'Size', 'Material', 'Warranty', 'Manufacturer', 'Origin'];
    
    const uploadCoreColumns = uploadColumns.filter(col => coreProductColumns.includes(col));
    const mainCoreColumns = mainColumns.filter(col => coreProductColumns.includes(col));
    
    console.log('\nCore Product Columns Match:');
    console.log(`Upload_Tbl_Products has ${uploadCoreColumns.length}/${coreProductColumns.length} core columns`);
    console.log(`Tbl_Products has ${mainCoreColumns.length}/${coreProductColumns.length} core columns`);
    
    if (uploadCoreColumns.length !== mainCoreColumns.length) {
      console.log('❌ MISMATCH: Core product columns do not match!');
      console.log('Missing in Upload_Tbl_Products:', coreProductColumns.filter(col => !uploadCoreColumns.includes(col)));
      console.log('Missing in Tbl_Products:', coreProductColumns.filter(col => !mainCoreColumns.includes(col)));
    } else {
      console.log('✅ MATCH: Both tables have the same core product columns');
    }

    // Check sample data
    console.log('\n=== Sample Data Check ===');
    const uploadSample = await pool.request().query('SELECT TOP 3 * FROM [dbo].[Upload_Tbl_Products]');
    const mainSample = await pool.request().query('SELECT TOP 3 * FROM [dbo].[Tbl_Products]');
    
    console.log(`Upload_Tbl_Products sample records: ${uploadSample.recordset.length}`);
    console.log(`Tbl_Products sample records: ${mainSample.recordset.length}`);

  } catch (err) {
    console.error('Database error:', err);
  } finally {
    await sql.close();
  }
}

checkTableStructures();
