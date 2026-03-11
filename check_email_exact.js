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

async function checkUserEmail() {
  try {
    const pool = await sql.connect(sqlConfig);
    console.log('Connected to database');
    
    // Check all users to see exact email format
    const result = await pool.request()
      .query('SELECT UserId, Email, FirstName, LastName FROM [dbo].[Users] WHERE IsActive = 1');
    
    console.log('All active users:');
    result.recordset.forEach(user => {
      console.log(`- ID: ${user.UserId}, Email: "${user.Email}", Name: ${user.FirstName} ${user.LastName}`);
    });
    
    // Check specifically for the provided email variations
    const emailVariations = [
      'aniruddh.toke@acornuniversalconsultancy.com',
      'aniruddh.toke@acornuniversalconsultancy.com', // Note: 'sal' vs 'sal'
    ];
    
    console.log('\nChecking specific email variations:');
    for (const email of emailVariations) {
      const checkResult = await pool.request()
        .input('email', sql.NVarChar, email)
        .query('SELECT * FROM [dbo].[Users] WHERE Email = @email AND IsActive = 1');
      
      console.log(`"${email}": Found ${checkResult.recordset.length} users`);
    }
    
  } catch (err) {
    console.error('Database error:', err);
  } finally {
    await sql.close();
  }
}

checkUserEmail();
