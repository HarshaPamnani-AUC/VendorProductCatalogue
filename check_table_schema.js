const sql = require('mssql');

// Read database config from .env.local
require('dotenv').config({ path: '.env.local' });

const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

async function checkTableSchema() {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Upload_Tbl_Products' 
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('Upload_Tbl_Products columns:');
    result.recordset.forEach(col => {
      console.log(`- ${col.COLUMN_NAME} (${col.DATA_TYPE}, ${col.IS_NULLABLE})`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await sql.close();
    process.exit(0);
  }
}

checkTableSchema();
