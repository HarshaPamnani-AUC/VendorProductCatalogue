const sql = require('mssql');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

// Exact same configuration as the API
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

async function simulateExactAPIContext() {
  try {
    console.log('=== Simulating Exact API Context ===');
    
    // Simulate the exact API flow
    const pool = await sql.connect(sqlConfig);
    console.log('✅ Database connected (API context)');
    
    try {
      // Step 1: Check data counts before procedure (exact API code)
      console.log('\n--- Step 1: Before counts ---');
      const beforeUpload = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Upload_Tbl_Products]');
      const beforeMain = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Tbl_Products]');
      
      console.log('📊 Before transfer - Upload:', beforeUpload.recordset[0].Count, 'Main:', beforeMain.recordset[0].Count);
      
      // Step 2: Execute the procedure exactly as the API does
      console.log('\n--- Step 2: Executing procedure (API method) ---');
      const vendor = 'ET Perfumes inc.(ET_PERF)';
      console.log('🔄 Executing procedure with vendor:', vendor);
      
      const result = await pool.request()
        .input('Vendor', sql.NVarChar, vendor)
        .execute('Proc_Upload_Tbl_Products');
      
      console.log('✅ Procedure executed successfully');
      console.log('📋 Procedure result:', {
        recordsets: result.recordsets.length,
        recordset: result.recordset ? 'defined' : 'undefined',
        output: Object.keys(result.output).length,
        rowsAffected: result.rowsAffected.length,
        returnValue: result.returnValue
      });
      
      // Step 3: Check data counts after procedure (exact API code)
      console.log('\n--- Step 3: After counts ---');
      const afterUpload = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Upload_Tbl_Products]');
      const afterMain = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Tbl_Products]');
      
      console.log('📊 After transfer - Upload:', afterUpload.recordset[0].Count, 'Main:', afterMain.recordset[0].Count);
      
      // Step 4: Calculate transferred records (exact API logic)
      const transferredRecords = afterMain.recordset[0].Count - beforeMain.recordset[0].Count;
      console.log('📈 Records transferred:', transferredRecords);
      
      // Step 5: Get sample data (exact API code)
      console.log('\n--- Step 5: Sample data ---');
      const sampleData = await pool.request().query(`
        SELECT TOP 5 [Date], [EAN/UPC], [Name], [Item_Code], [Qty], [Price], [Vendor], [UploadDatetime]
        FROM [dbo].[Tbl_Products]
        ORDER BY [UploadDatetime] DESC
      `);

      console.log('📋 Sample records:', sampleData.recordset.length);
      sampleData.recordset.forEach((record, index) => {
        console.log(`   ${index + 1}: ${record.Name} - Vendor: ${record.Vendor}`);
      });

      // Step 6: Simulate the API response structure
      console.log('\n--- Step 6: API Response Simulation ---');
      const apiResponse = {
        success: true,
        message: 'Data transfer completed successfully',
        method: 'Stored Procedure',
        vendor: vendor,
        beforeCounts: {
          uploadTable: beforeUpload.recordset[0].Count,
          mainTable: beforeMain.recordset[0].Count
        },
        afterCounts: {
          uploadTable: afterUpload.recordset[0].Count,
          mainTable: afterMain.recordset[0].Count
        },
        transferredRecords: transferredRecords,
        sampleData: sampleData.recordset
      };

      console.log('🎯 API Response would be:');
      console.log(JSON.stringify(apiResponse, null, 2));

      // Step 7: Test with multiple rapid calls (simulating API usage)
      console.log('\n--- Step 7: Rapid API calls test ---');
      
      for (let i = 1; i <= 3; i++) {
        console.log(`\n🔄 Rapid call ${i}:`);
        
        // Clear main table
        await pool.request().query('DELETE FROM [dbo].[Tbl_Products]');
        
        const rapidBefore = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Tbl_Products]');
        
        try {
          const rapidResult = await pool.request()
            .input('Vendor', sql.NVarChar, `Test Vendor ${i}`)
            .execute('Proc_Upload_Tbl_Products');
          
          const rapidAfter = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Tbl_Products]');
          const rapidTransferred = rapidAfter.recordset[0].Count - rapidBefore.recordset[0].Count;
          
          console.log(`   ✅ Rapid call ${i} success: ${rapidTransferred} records`);
          
        } catch (rapidErr) {
          console.log(`   ❌ Rapid call ${i} failed: ${rapidErr.message}`);
        }
      }

    } finally {
      await pool.close();
    }

  } catch (error) {
    console.error('💥 API Context Simulation Error:', error);
    console.error('Error details:', error.message);
    if (error.code) console.error('Error code:', error.code);
    if (error.number) console.error('Error number:', error.number);
  }
}

simulateExactAPIContext();
