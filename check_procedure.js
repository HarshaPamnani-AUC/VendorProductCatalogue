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

async function checkProcedure() {
  try {
    const pool = await sql.connect(sqlConfig);
    console.log('Checking procedure...\n');

    const procDef = await pool.request().query(`
      SELECT OBJECT_DEFINITION(OBJECT_ID('Proc_Upload_Tbl_Products')) as ProcDefinition
    `);
    
    const fullProc = procDef.recordset[0].ProcDefinition;
    console.log(fullProc);

    await pool.close();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkProcedure();
