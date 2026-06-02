const sql = require('mssql');
require('dotenv').config({ path: '.env.local' });

const sqlConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  server: process.env.DB_SERVER,
  authentication: {
    type: 'default',
    options: {
      userName: process.env.DB_USER,
      password: process.env.DB_PASSWORD
    }
  },
  pool: {
    max: parseInt(process.env.DB_POOL_MAX) || 10,
    min: parseInt(process.env.DB_POOL_MIN) || 0,
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000
  },
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true' || true,
    enableKeepAlive: true,
    connectionTimeout: 30000,
    requestTimeout: 30000,
  }
};

async function testConnection() {
  let pool;
  try {
    console.log('Attempting to connect to MSSQL Server...');
    console.log(`Server: ${process.env.DB_SERVER}`);
    console.log(`Database: ${process.env.DB_NAME}`);
    console.log(`User: ${process.env.DB_USER}`);

    pool = new sql.ConnectionPool(sqlConfig);
    await pool.connect();

    console.log('\n✓ Database connection successful!');

    // Test query
    const result = await pool.request().query('SELECT 1 as test');
    console.log('✓ Test query executed successfully');
    console.log('Result:', result.recordset);

    // Get database info
    const dbInfo = await pool.request().query(`
      SELECT 
        DB_NAME() as [Database],
        @@VERSION as [SQL Server Version]
    `);
    console.log('\nDatabase Info:', dbInfo.recordset);

    // Check if tables exist
    const tables = await pool.request().query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
    `);
    console.log('\nExisting Tables:', tables.recordset);

    await pool.close();
    process.exit(0);
  } catch (err) {
    console.error('\n✗ Connection failed:', err.message);
    console.error('Error Code:', err.code);
    console.error('Severity:', err.severity);
    
    if (pool) {
      await pool.close();
    }
    process.exit(1);
  }
}

testConnection();
