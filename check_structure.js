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

async function checkStructure() {
  try {
    const pool = await sql.connect(sqlConfig);

    console.log('=== UPLOAD_TBL_PRODUCTS COLUMNS ===');
    const uploadCols = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Upload_Tbl_Products'
      ORDER BY ORDINAL_POSITION
    `);
    uploadCols.recordset.forEach(col => {
      console.log(`${col.COLUMN_NAME.padEnd(20)} | ${col.DATA_TYPE.padEnd(15)} | Nullable: ${col.IS_NULLABLE}`);
    });

    console.log('\n=== TBL_PRODUCTS COLUMNS ===');
    const prodCols = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Tbl_Products'
      ORDER BY ORDINAL_POSITION
    `);
    prodCols.recordset.forEach(col => {
      console.log(`${col.COLUMN_NAME.padEnd(20)} | ${col.DATA_TYPE.padEnd(15)} | Nullable: ${col.IS_NULLABLE}`);
    });

    console.log('\n=== CHECKING EAN/UPC NULL VALUES IN UPLOAD ===');
    const nullCheck = await pool.request().query(`
      SELECT 
        COUNT(*) as TotalRecords,
        COUNT(CASE WHEN [EAN/UPC] IS NULL OR [EAN/UPC] = '' THEN 1 END) as NullEANUPCCount,
        COUNT(CASE WHEN Item_Code IS NULL OR Item_Code = '' THEN 1 END) as NullItemCodeCount
      FROM [dbo].[Upload_Tbl_Products]
    `);
    const nc = nullCheck.recordset[0];
    console.log(`Total records: ${nc.TotalRecords}`);
    console.log(`Null/Empty EAN/UPC: ${nc.NullEANUPCCount} (${(nc.NullEANUPCCount/nc.TotalRecords*100).toFixed(2)}%)`);
    console.log(`Null/Empty Item_Code: ${nc.NullItemCodeCount} (${(nc.NullItemCodeCount/nc.TotalRecords*100).toFixed(2)}%)`);

    await pool.close();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkStructure();
