const sql = require('mssql');
require('dotenv').config({ path: '.env.local' });

const config = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'Admin@123',
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME || 'ProductCatalogDB',
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

async function checkUsersTable() {
  try {
    await sql.connect(config);
    console.log('Connected to database\n');

    // Check if Users table exists
    const tableCheck = await sql.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'Users'
    `);

    if (tableCheck.recordset.length === 0) {
      console.log('❌ Users table does not exist');
      return;
    }

    console.log('✅ Users table exists');

    // Check table structure
    const columns = await sql.query(`
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        CHARACTER_MAXIMUM_LENGTH,
        IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'Users'
      ORDER BY ORDINAL_POSITION
    `);

    console.log('\nUsers table structure:');
    columns.recordset.forEach(col => {
      console.log(`- ${col.COLUMN_NAME}: ${col.DATA_TYPE}${col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : ''} ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    // Check if there are any users
    const usersCount = await sql.query('SELECT COUNT(*) as Count FROM [dbo].[Users]');
    console.log(`\nTotal users in table: ${usersCount.recordset[0].Count}`);

    // Show all users (without passwords)
    if (usersCount.recordset[0].Count > 0) {
      const users = await sql.query('SELECT UserId, Email, FirstName, LastName FROM [dbo].[Users]');
      console.log('\nUsers in table:');
      users.recordset.forEach(user => {
        console.log(`- ID: ${user.UserId}, Email: ${user.Email}, Name: ${user.FirstName} ${user.LastName}`);
      });
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await sql.close();
  }
}

checkUsersTable();
