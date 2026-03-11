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

async function debugUser() {
  try {
    const pool = await sql.connect(config);
    
    // Get user data
    const result = await pool.request()
      .input('email', sql.NVarChar, 'test@example.com')
      .query('SELECT UserId, Email, PasswordHash FROM Users WHERE Email = @email');
    
    if (result.recordset.length > 0) {
      const user = result.recordset[0];
      console.log('User found:', user.UserId, user.Email);
      console.log('Password hash length:', user.PasswordHash.length);
      console.log('Password hash starts with:', user.PasswordHash.substring(0, 20));
      
      // Test password comparison
      const testPassword = 'password123';
      const isValid = await bcrypt.compare(testPassword, user.PasswordHash);
      console.log('Password comparison result:', isValid);
      
      if (!isValid) {
        console.log('Creating new hash...');
        const newHash = await bcrypt.hash(testPassword, 10);
        console.log('New hash:', newHash);
        
        // Update user password
        await pool.request()
          .input('email', sql.NVarChar, 'test@example.com')
          .input('password', sql.NVarChar, newHash)
          .query('UPDATE Users SET PasswordHash = @password WHERE Email = @email');
        
        console.log('Password updated in database');
      }
    } else {
      console.log('User not found');
    }
    
    await pool.close();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

debugUser();
