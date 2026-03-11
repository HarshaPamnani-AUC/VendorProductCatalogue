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

async function debugProcedureFailure() {
  try {
    const pool = await sql.connect(sqlConfig);
    console.log('=== Debugging Procedure Failure ===');

    // Step 1: Get the exact procedure definition
    console.log('\n=== Current Procedure Definition ===');
    const procDef = await pool.request().query(`
      SELECT OBJECT_DEFINITION(OBJECT_ID('Proc_Upload_Tbl_Products')) as ProcedureDefinition
    `);
    
    console.log('Procedure text:');
    console.log(procDef.recordset[0].ProcedureDefinition);

    // Step 2: Test the exact procedure call with different vendor names
    console.log('\n=== Testing Procedure with Different Vendors ===');
    
    const testVendors = [
      'ET Perfumes inc.(ET_PERF)',
      'TEST_VENDOR',
      'Simple Vendor',
      'Vendor\'With\'Quotes',
      'Vendor With Spaces'
    ];

    for (const vendor of testVendors) {
      console.log(`\n--- Testing with vendor: "${vendor}" ---`);
      
      try {
        // Clear main table first
        await pool.request().query('DELETE FROM [dbo].[Tbl_Products]');
        
        // Count before
        const beforeCount = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Tbl_Products]');
        
        // Execute procedure
        const result = await pool.request()
          .input('Vendor', sql.NVarChar, vendor)
          .execute('Proc_Upload_Tbl_Products');
        
        // Count after
        const afterCount = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Tbl_Products]');
        
        const transferred = afterCount.recordset[0].Count - beforeCount.recordset[0].Count;
        
        console.log(`✅ Success: ${transferred} records transferred`);
        console.log(`   Result: ${JSON.stringify(result)}`);
        
        // Check if vendor was saved correctly
        if (transferred > 0) {
          const vendorCheck = await pool.request().query(`
            SELECT TOP 1 [Vendor] FROM [dbo].[Tbl_Products] ORDER BY [UploadDatetime] DESC
          `);
          console.log(`   Vendor saved: "${vendorCheck.recordset[0].Vendor}"`);
        }
        
      } catch (err) {
        console.log(`❌ Failed: ${err.message}`);
        console.log(`   Error code: ${err.code}`);
        console.log(`   Error number: ${err.number}`);
        console.log(`   Error state: ${err.state}`);
        console.log(`   Error class: ${err.class}`);
        console.log(`   Error line: ${err.lineNumber}`);
        console.log(`   Error procedure: ${err.procedureName}`);
      }
    }

    // Step 3: Test the exact SQL that should be in the procedure
    console.log('\n=== Testing Manual SQL (same as procedure) ===');
    
    try {
      // Clear main table
      await pool.request().query('DELETE FROM [dbo].[Tbl_Products]');
      
      const beforeManual = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Tbl_Products]');
      
      // Execute the exact SQL that should be in the procedure
      const manualResult = await pool.request()
        .input('Vendor', sql.NVarChar, 'ET Perfumes inc.(ET_PERF)')
        .query(`
          INSERT INTO [dbo].[Tbl_Products] 
          ([Date], [EAN/UPC], [Name], [Item_Code], [Qty], [Price], [Vendor], [UploadDatetime])
          SELECT
            [Date], [EAN/UPC], [Name], [Item_Code], [Qty], [Price], @Vendor, GETDATE()
          FROM [dbo].[Upload_Tbl_Products]
        `);
      
      const afterManual = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Tbl_Products]');
      const manualTransferred = afterManual.recordset[0].Count - beforeManual.recordset[0].Count;
      
      console.log(`✅ Manual SQL Success: ${manualTransferred} records transferred`);
      console.log(`   Rows affected: ${manualResult.rowsAffected[0]}`);
      
    } catch (manualErr) {
      console.log(`❌ Manual SQL Failed: ${manualErr.message}`);
    }

    // Step 4: Check for any locks or blocking
    console.log('\n=== Checking for Locks ===');
    try {
      const lockCheck = await pool.request().query(`
        SELECT 
          request_session_id,
          resource_type,
          resource_database_id,
          resource_description,
          request_mode,
          request_status
        FROM sys.dm_tran_locks
        WHERE resource_database_id = DB_ID()
      `);
      
      if (lockCheck.recordset.length > 0) {
        console.log('⚠️  Active locks found:');
        lockCheck.recordset.forEach(lock => {
          console.log(`   Session ${lock.request_session_id}: ${lock.resource_type} - ${lock.request_mode}`);
        });
      } else {
        console.log('✅ No active locks');
      }
    } catch (lockErr) {
      console.log(`Could not check locks: ${lockErr.message}`);
    }

    // Step 5: Check table permissions
    console.log('\n=== Checking Table Permissions ===');
    try {
      const permCheck = await pool.request().query(`
        SELECT 
          permission_name,
          state_desc
        FROM sys.database_permissions
        WHERE major_id = OBJECT_ID('Tbl_Products')
        OR major_id = OBJECT_ID('Upload_Tbl_Products')
      `);
      
      if (permCheck.recordset.length > 0) {
        console.log('Table permissions:');
        permCheck.recordset.forEach(perm => {
          console.log(`   ${perm.permission_name}: ${perm.state_desc}`);
        });
      } else {
        console.log('⚠️  No explicit permissions found');
      }
    } catch (permErr) {
      console.log(`Could not check permissions: ${permErr.message}`);
    }

  } catch (err) {
    console.error('Debug error:', err);
  } finally {
    await sql.close();
  }
}

debugProcedureFailure();
