const sql = require('mssql');
require('dotenv').config({ path: '.env.local' });

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  port: 1433,
  options: {
    encrypt: true,
    trustServerCertificate: true,
    enableKeepAlive: true,
    connectionTimeout: 15000,
    requestTimeout: 30000,
  }
};

console.log('Testing database connection with:');
console.log(`- Server: ${config.server}`);
console.log(`- User: ${config.user}`);
console.log(`- Database: ${config.database}`);
console.log('');

async function test() {
  try {
    const pool = new sql.ConnectionPool(config);
    console.log('Attempting to connect...');
    await pool.connect();
    console.log('✅ CONNECTION SUCCESSFUL!');
    
    // Test a simple query
    const result = await pool.request().query('SELECT 1 as test');
    console.log('✅ QUERY SUCCESSFUL!');
    console.log('Result:', result.recordset);
    
    await pool.close();
  } catch (err) {
    console.error('❌ CONNECTION FAILED');
    console.error('Error:', err.message);
    console.error('Code:', err.code);
    if (err.originalError) {
      console.error('Original Error:', err.originalError.message);
    }
  }
}

test();
