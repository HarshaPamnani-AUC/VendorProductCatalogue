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

async function checkVendorsTable() {
  try {
    console.log('=== Checking Vendors Table ===');
    
    const pool = await sql.connect(sqlConfig);
    
    // Check if Vendors table exists and get data
    try {
      const vendorCheck = await pool.request().query(`
        SELECT COUNT(*) as Count FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_NAME = 'Vendors' AND TABLE_SCHEMA = 'dbo'
      `);
      
      console.log('Vendors table exists:', vendorCheck.recordset[0].Count > 0 ? 'YES' : 'NO');
      
      if (vendorCheck.recordset[0].Count > 0) {
        const vendorData = await pool.request().query(`
          SELECT TOP 10 VendorId, VendorName, VendorCode, IsActive
          FROM [dbo].[Vendors]
          ORDER BY VendorName
        `);
        
        console.log('Vendor data:');
        vendorData.recordset.forEach((vendor, index) => {
          console.log(`   ${index + 1}: ID=${vendor.VendorId}, Name="${vendor.VendorName}", Code="${vendor.VendorCode}", Active=${vendor.IsActive}`);
        });
        
        console.log(`Total vendors: ${vendorData.recordset.length}`);
      }
      
    } catch (err) {
      console.log('Error checking vendors:', err.message);
      
      // Check what tables exist
      const tables = await pool.request().query(`
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_TYPE = 'BASE TABLE'
        ORDER BY TABLE_NAME
      `);
      
      console.log('Available tables:');
      tables.recordset.forEach((table, index) => {
        console.log(`   ${index + 1}: ${table.TABLE_NAME}`);
      });
    }
    
    await pool.close();
    
  } catch (error) {
    console.error('Database error:', error.message);
  }
}

checkVendorsTable();
