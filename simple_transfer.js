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

async function transferData(vendorName) {
  try {
    console.log('=== Simple Transfer ===');
    console.log('Vendor:', vendorName);
    
    const pool = await sql.connect(sqlConfig);
    
    // Check upload data
    const uploadCheck = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Upload_Tbl_Products]');
    console.log('Upload records:', uploadCheck.recordset[0].Count);
    
    if (uploadCheck.recordset[0].Count === 0) {
      console.log('No data to transfer');
      return { success: false, error: 'No data in upload table' };
    }

    // Get count before
    const beforeCount = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Tbl_Products]');
    console.log('Main table before:', beforeCount.recordset[0].Count);

    // Execute procedure
    console.log('Executing procedure...');
    const result = await pool.request()
      .input('Vendor', sql.NVarChar, vendorName)
      .execute('Proc_Upload_Tbl_Products');

    // Get count after
    const afterCount = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Tbl_Products]');
    const transferred = afterCount.recordset[0].Count - beforeCount.recordset[0].Count;
    
    console.log('Main table after:', afterCount.recordset[0].Count);
    console.log('Records transferred:', transferred);
    
    await pool.close();
    
    return { 
      success: true, 
      transferredRecords: transferred,
      message: `Successfully transferred ${transferred} records`
    };

  } catch (error) {
    console.error('Transfer error:', error);
    return { success: false, error: error.message };
  }
}

// Test with vendor name
transferData('ET Perfumes inc.(ET_PERF)').then(result => {
  console.log('Result:', result);
});
