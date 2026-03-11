const sql = require('mssql');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

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

async function initializeDatabase() {
  let pool;
  try {
    console.log('Starting database initialization...\n');

    pool = new sql.ConnectionPool(sqlConfig);
    await pool.connect();
    console.log('✓ Connected to MSSQL Server\n');

    // Read the schema file
    const schemaPath = path.join(__dirname, '01-create-database-schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf-8');

    // Split by GO statements (MSSQL batch separator)
    const statements = schemaSQL.split(/\nGO\n/).filter(stmt => stmt.trim());

    console.log(`Executing ${statements.length} SQL statements...\n`);

    let successCount = 0;
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i].trim();
      if (stmt) {
        try {
          await pool.request().query(stmt);
          successCount++;
          console.log(`✓ Statement ${i + 1}/${statements.length} executed`);
        } catch (err) {
          console.warn(`⚠ Statement ${i + 1} warning: ${err.message}`);
          // Continue even if some statements fail (e.g., if tables already exist)
          if (err.message.includes('already exists') || err.message.includes('already defined')) {
            successCount++;
          }
        }
      }
    }

    console.log(`\n✓ Database initialization complete! (${successCount}/${statements.length} statements executed)\n`);

    // Verify tables were created
    const tables = await pool.request().query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `);

    console.log('Created Tables:');
    tables.recordset.forEach(row => {
      console.log(`  - ${row.TABLE_NAME}`);
    });

    await pool.close();
    process.exit(0);
  } catch (err) {
    console.error('\n✗ Database initialization failed:', err.message);
    if (pool) {
      await pool.close();
    }
    process.exit(1);
  }
}

initializeDatabase();
