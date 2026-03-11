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

async function investigateTransferIssue() {
  try {
    const pool = await sql.connect(sqlConfig);
    console.log('=== Investigating Transfer Issue ===');

    // Check current data
    console.log('\n=== Current Data Status ===');
    const uploadCount = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Upload_Tbl_Products]');
    const mainCount = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Tbl_Products]');
    console.log('Upload_Tbl_Products:', uploadCount.recordset[0].Count, 'records');
    console.log('Tbl_Products:', mainCount.recordset[0].Count, 'records');

    // Check sample data in upload table
    console.log('\n=== Sample Upload Data ===');
    const uploadSample = await pool.request().query(`
      SELECT TOP 3 [Date], [EAN/UPC], [Name], [Item_Code], [Qty], [Price]
      FROM [dbo].[Upload_Tbl_Products]
      ORDER BY [Date] DESC
    `);
    uploadSample.recordset.forEach((record, index) => {
      console.log(`${index + 1}: ${record.Name} - ${record['EAN/UPC']} - Qty: ${record.Qty}`);
    });

    // Check if there are any NULL values or data issues
    console.log('\n=== Data Quality Check ===');
    const nullCheck = await pool.request().query(`
      SELECT COUNT(*) as NullCount, 'Date' as ColumnName
      FROM [dbo].[Upload_Tbl_Products] WHERE [Date] IS NULL
      UNION ALL
      SELECT COUNT(*) as NullCount, 'EAN/UPC' as ColumnName
      FROM [dbo].[Upload_Tbl_Products] WHERE [EAN/UPC] IS NULL
      UNION ALL
      SELECT COUNT(*) as NullCount, 'Name' as ColumnName
      FROM [dbo].[Upload_Tbl_Products] WHERE [Name] IS NULL
      UNION ALL
      SELECT COUNT(*) as NullCount, 'Item_Code' as ColumnName
      FROM [dbo].[Upload_Tbl_Products] WHERE [Item_Code] IS NULL
      UNION ALL
      SELECT COUNT(*) as NullCount, 'Qty' as ColumnName
      FROM [dbo].[Upload_Tbl_Products] WHERE [Qty] IS NULL
      UNION ALL
      SELECT COUNT(*) as NullCount, 'Price' as ColumnName
      FROM [dbo].[Upload_Tbl_Products] WHERE [Price] IS NULL
    `);
    
    console.log('NULL values check:');
    nullCheck.recordset.forEach(check => {
      if (check.NullCount > 0) {
        console.log(`⚠️  ${check.ColumnName}: ${check.NullCount} NULL values`);
      }
    });

    // Check for duplicate data in main table
    console.log('\n=== Duplicate Check in Main Table ===');
    const duplicateCheck = await pool.request().query(`
      SELECT [EAN/UPC], COUNT(*) as DuplicateCount
      FROM [dbo].[Tbl_Products]
      GROUP BY [EAN/UPC]
      HAVING COUNT(*) > 1
    `);
    
    if (duplicateCheck.recordset.length > 0) {
      console.log('⚠️  Found duplicates in main table:');
      duplicateCheck.recordset.forEach(dup => {
        console.log(`  ${dup['EAN/UPC']}: ${dup.DuplicateCount} records`);
      });
    } else {
      console.log('✅ No duplicates found in main table');
    }

    // Test procedure execution step by step
    console.log('\n=== Step-by-Step Procedure Test ===');
    
    // Step 1: Check if procedure exists
    const procCheck = await pool.request().query(`
      SELECT OBJECT_ID('Proc_Upload_Tbl_Products') as ProcedureID
    `);
    console.log('Procedure exists:', procCheck.recordset[0].ProcedureID ? 'YES' : 'NO');

    // Step 2: Clear main table (to test fresh transfer)
    console.log('Clearing main table for fresh test...');
    await pool.request().query('DELETE FROM [dbo].[Tbl_Products]');
    console.log('Main table cleared');

    // Step 3: Execute procedure with detailed logging
    console.log('Executing procedure...');
    try {
      const result = await pool.request()
        .input('Vendor', sql.NVarChar, 'ET Perfumes inc.(ET_PERF)')
        .execute('Proc_Upload_Tbl_Products');
      
      console.log('Procedure result:', result);
      console.log('Rows affected:', result.rowsAffected);
      
    } catch (procErr) {
      console.log('❌ Procedure execution failed:', procErr.message);
      console.log('Error details:', procErr);
      
      // Try manual INSERT as fallback
      console.log('\n=== Manual INSERT Test ===');
      try {
        const manualResult = await pool.request()
          .input('Vendor', sql.NVarChar, 'ET Perfumes inc.(ET_PERF)')
          .query(`
            INSERT INTO [dbo].[Tbl_Products] 
            ([Date], [EAN/UPC], [Name], [Item_Code], [Qty], [Price], [Vendor], [UploadDatetime])
            SELECT 
              [Date], [EAN/UPC], [Name], [Item_Code], [Qty], [Price], 
              @Vendor, GETDATE()
            FROM [dbo].[Upload_Tbl_Products]
          `);
        
        console.log('Manual INSERT successful');
        console.log('Manual rows affected:', manualResult.rowsAffected[0]);
        
      } catch (manualErr) {
        console.log('❌ Manual INSERT also failed:', manualErr.message);
      }
    }

    // Step 4: Verify final results
    console.log('\n=== Final Results ===');
    const finalUpload = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Upload_Tbl_Products]');
    const finalMain = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Tbl_Products]');
    console.log('Upload_Tbl_Products:', finalUpload.recordset[0].Count, 'records');
    console.log('Tbl_Products:', finalMain.recordset[0].Count, 'records');

    if (finalMain.recordset[0].Count > 0) {
      console.log('✅ Transfer successful!');
      
      // Show sample data from main table
      const finalSample = await pool.request().query(`
        SELECT TOP 3 [Date], [EAN/UPC], [Name], [Vendor], [UploadDatetime]
        FROM [dbo].[Tbl_Products]
        ORDER BY [UploadDatetime] DESC
      `);
      
      console.log('Sample data in main table:');
      finalSample.recordset.forEach((record, index) => {
        console.log(`${index + 1}: ${record.Name} - Vendor: ${record.Vendor} - Date: ${record.UploadDatetime}`);
      });
    } else {
      console.log('❌ Transfer failed - no data in main table');
    }

  } catch (err) {
    console.error('Investigation error:', err);
  } finally {
    await sql.close();
  }
}

investigateTransferIssue();
