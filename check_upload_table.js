const sql = require('mssql');
require('dotenv').config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  server: process.env.DB_SERVER,
  options: { encrypt: false, trustServerCertificate: true }
};

async function checkTable() {
  try {
    const pool = await sql.connect(config);
    console.log('Connected to database');
    
    const result = await pool.request().query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'Upload_Tbl_Products'
    `);
    
    console.log('Upload_Tbl_Products table exists:', result.recordset.length > 0);
    if (result.recordset.length > 0) {
      console.log('Table found:', result.recordset[0].TABLE_NAME);
    } else {
      console.log('Available tables:');
      const allTables = await pool.request().query(`
        SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME LIKE '%Product%'
      `);
      console.log(allTables.recordset);
    }
    
    await pool.close();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkTable();
