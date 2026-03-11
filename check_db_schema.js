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

async function checkUserTableSchema() {
  try {
    const pool = await sql.connect(sqlConfig);
    console.log('Connected to database');
    
    // Check the actual column names in the Users table
    const result = await pool.request()
      .query(`
        SELECT COLUMN_NAME, DATA_TYPE 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'Users' 
        ORDER BY ORDINAL_POSITION
      `);
    
    console.log('Users table columns:');
    result.recordset.forEach(col => {
      console.log(`- ${col.COLUMN_NAME}: ${col.DATA_TYPE}`);
    });
    
    // Check the actual user data
    const userData = await pool.request()
      .query('SELECT TOP 1 UserId, Email, PasswordHash, Password FROM [dbo].[Users] WHERE IsActive = 1');
    
    if (userData.recordset.length > 0) {
      const user = userData.recordset[0];
      console.log('\nUser data:');
      console.log(`- UserId: ${user.UserId}`);
      console.log(`- Email: ${user.Email}`);
      console.log(`- PasswordHash: ${user.PasswordHash ? 'Exists' : 'NULL'}`);
      console.log(`- Password: ${user.Password ? 'Exists' : 'NULL'}`);
    }
    
  } catch (err) {
    console.error('Database error:', err);
  } finally {
    await sql.close();
  }
}

checkUserTableSchema();
