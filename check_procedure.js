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

async function checkStoredProcedure() {
  try {
    const pool = await sql.connect(config);
    
    // Check stored procedure parameters
    const result = await pool.request().query(`
      SELECT 
        p.name AS ParameterName,
        TYPE_NAME(p.user_type_id) AS DataType,
        p.has_default_value AS HasDefaultValue,
        p.default_value AS DefaultValue
      FROM sys.parameters p
      WHERE p.object_id = OBJECT_ID('Proc_Upload_Tbl_Products')
      ORDER BY p.parameter_id
    `);
    
    console.log('=== Proc_Upload_Tbl_Products Parameters ===');
    if (result.recordset.length === 0) {
      console.log('Stored procedure not found or has no parameters');
    } else {
      result.recordset.forEach(param => {
        console.log(`- @${param.ParameterName} (${param.DataType})`);
      });
    }
    
    // Also check the procedure definition if possible
    try {
      const defResult = await pool.request().query(`
        SELECT OBJECT_DEFINITION(OBJECT_ID('Proc_Upload_Tbl_Products')) AS Definition
      `);
      
      if (defResult.recordset[0]?.Definition) {
        console.log('\n=== Stored Procedure Definition (first 500 chars) ===');
        console.log(defResult.recordset[0].Definition.substring(0, 500) + '...');
      }
    } catch (defError) {
      console.log('Could not retrieve procedure definition:', defError.message);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await sql.close();
    process.exit(0);
  }
}

checkStoredProcedure();
