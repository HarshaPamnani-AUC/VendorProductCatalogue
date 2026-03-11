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

async function testLogin() {
  try {
    const pool = await sql.connect(sqlConfig);
    console.log('Connected to database');
    
    const email = 'aniruddh.toke@acornuniversalconsultancy.com';
    const password = 'password123';
    
    // Check if user exists
    const result = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT * FROM [dbo].[Users] WHERE Email = @email AND IsActive = 1');
    
    console.log('User query result:');
    console.log('Found users:', result.recordset.length);
    
    if (result.recordset.length > 0) {
      const user = result.recordset[0];
      console.log('User details:', {
        UserId: user.UserId,
        Email: user.Email,
        FirstName: user.FirstName,
        LastName: user.LastName,
        PasswordHash: user.PasswordHash || 'Missing',
        Password: user.Password || 'Missing',
        IsActive: user.IsActive
      });
      
      // Test password comparison (plain text as per the code)
      if (user.PasswordHash) {
        const passwordMatch = password === user.PasswordHash;
        console.log('Password match (plain text):', passwordMatch);
        console.log('Expected password:', password);
        console.log('Stored password:', user.PasswordHash);
      } else {
        console.log('No PasswordHash field found');
      }
    } else {
      console.log('User not found with email:', email);
    }
    
  } catch (err) {
    console.error('Database error:', err);
  } finally {
    await sql.close();
  }
}

testLogin();
