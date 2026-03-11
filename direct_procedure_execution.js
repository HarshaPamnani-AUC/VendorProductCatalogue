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

async function executeTransferProcedure() {
  try {
    console.log('=== Direct Procedure Execution ===');
    
    const pool = await sql.connect(sqlConfig);
    console.log('✅ Connected to database');

    // Check upload data
    const uploadCheck = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Upload_Tbl_Products]');
    console.log('📊 Upload table has:', uploadCheck.recordset[0].Count, 'records');

    if (uploadCheck.recordset[0].Count === 0) {
      console.log('❌ No data in upload table');
      return;
    }

    // Get count before
    const beforeCount = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Tbl_Products]');
    console.log('📊 Main table before:', beforeCount.recordset[0].Count, 'records');

    // Execute procedure with vendor
    const vendor = 'ET Perfumes inc.(ET_PERF)';
    console.log('🔄 Executing procedure with vendor:', vendor);
    
    const result = await pool.request()
      .input('Vendor', sql.NVarChar, vendor)
      .execute('Proc_Upload_Tbl_Products');

    console.log('✅ Procedure executed');

    // Get count after
    const afterCount = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Tbl_Products]');
    const transferred = afterCount.recordset[0].Count - beforeCount.recordset[0].Count;
    
    console.log('📊 Main table after:', afterCount.recordset[0].Count, 'records');
    console.log('📈 Records transferred:', transferred);

    if (transferred > 0) {
      console.log('✅ SUCCESS: Data transferred to main table!');
      
      // Show sample data
      const sample = await pool.request().query(`
        SELECT TOP 3 [Name], [Vendor], [UploadDatetime]
        FROM [dbo].[Tbl_Products]
        ORDER BY [UploadDatetime] DESC
      `);
      
      console.log('\n📋 Sample data in main table:');
      sample.recordset.forEach((record, index) => {
        console.log(`   ${index + 1}: ${record.Name} - ${record.Vendor}`);
      });
    } else {
      console.log('❌ No records transferred');
    }

    await pool.close();

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

executeTransferProcedure();
