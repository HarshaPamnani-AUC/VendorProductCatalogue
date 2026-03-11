const sql = require('mssql');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  server: process.env.DB_SERVER,
  options: { encrypt: false, trustServerCertificate: true }
};

async function createTestUser() {
  try {
    const pool = await sql.connect(config);
    console.log('Connected to database');
    
    // Check if user already exists
    const existingUser = await pool.request()
      .input('email', sql.NVarChar, 'test@example.com')
      .query('SELECT UserId FROM Users WHERE Email = @email');
    
    if (existingUser.recordset.length > 0) {
      console.log('Test user already exists');
      await pool.close();
      return;
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    // Create test user
    await pool.request()
      .input('email', sql.NVarChar, 'test@example.com')
      .input('password', sql.NVarChar, hashedPassword)
      .input('firstName', sql.NVarChar, 'Test')
      .input('lastName', sql.NVarChar, 'User')
      .query(`
        INSERT INTO Users (Email, PasswordHash, FirstName, LastName, IsActive, CreatedAt, UpdatedAt)
        VALUES (@email, @password, @firstName, @lastName, 1, GETDATE(), GETDATE())
      `);
    
    console.log('✅ Test user created successfully');
    console.log('Email: test@example.com');
    console.log('Password: password123');
    
    await pool.close();
  } catch (err) {
    console.error('Error creating test user:', err.message);
  }
}

createTestUser();
