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

async function checkUser() {
  try {
    const pool = await sql.connect(sqlConfig);
    console.log('Connected to database');
    
    const email = 'aniruddh.toke@acornuniversalconsultancy.com';
    
    // Check if user exists
    const result = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT * FROM [dbo].[Users] WHERE Email = @email AND IsActive = 1');
    
    console.log('User query result:');
    console.log('Found users:', result.recordset.length);
    
    if (result.recordset.length > 0) {
      console.log('User details:', {
        UserId: result.recordset[0].UserId,
        Email: result.recordset[0].Email,
        FirstName: result.recordset[0].FirstName,
        LastName: result.recordset[0].LastName,
        Role: result.recordset[0].Role,
        IsActive: result.recordset[0].IsActive
      });
    } else {
      console.log('User not found with email:', email);
      
      // Check all users
      const allUsers = await pool.request()
        .query('SELECT TOP 5 UserId, Email, FirstName, LastName, Role, IsActive FROM [dbo].[Users] WHERE IsActive = 1');
      
      console.log('Available users:');
      allUsers.recordset.forEach(user => {
        console.log(`- ${user.Email} (${user.FirstName} ${user.LastName}) - Role: ${user.Role}`);
      });
    }
    
  } catch (err) {
    console.error('Database error:', err);
  } finally {
    await sql.close();
  }
}

checkUser();
