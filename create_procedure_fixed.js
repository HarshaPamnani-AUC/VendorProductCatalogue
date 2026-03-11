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

async function createUploadProcedureSeparate() {
  try {
    const pool = await sql.connect(sqlConfig);
    console.log('Connected to database');

    // Step 1: Drop existing procedure
    console.log('Dropping existing procedure...');
    await pool.request().query(`
      IF EXISTS (SELECT * FROM sys.objects WHERE type = 'P' AND name = 'Proc_Upload_Tbl_Products')
      BEGIN
        DROP PROCEDURE [dbo].[Proc_Upload_Tbl_Products];
        PRINT 'Existing procedure dropped';
      END
    `);

    // Step 2: Create new procedure
    console.log('Creating new procedure...');
    const createProcedureQuery = `
      CREATE PROCEDURE [dbo].[Proc_Upload_Tbl_Products]
        @VendorCode NVARCHAR(50),
        @ProcessedBy NVARCHAR(100) = NULL
      AS
      BEGIN
        SET NOCOUNT ON;
        
        DECLARE @ProcessedCount INT = 0;
        DECLARE @ErrorCount INT = 0;
        DECLARE @ErrorMessage NVARCHAR(1000) = '';
        
        BEGIN TRY
          BEGIN TRANSACTION;
          
          -- Move valid records from Upload_Tbl_Products to Tbl_Products
          INSERT INTO [dbo].[Tbl_Products] 
            (VendorCode, ProductCode, ProductName, Description, Brand, Category, Price, StockQuantity, 
             UPC, SKU, Weight, Dimensions, Color, Size, Material, Warranty, Manufacturer, Origin, 
             CreatedBy, UpdatedBy)
          SELECT 
            VendorCode, ProductCode, ProductName, Description, Brand, Category, Price, StockQuantity,
            UPC, SKU, Weight, Dimensions, Color, Size, Material, Warranty, Manufacturer, Origin,
            @ProcessedBy, @ProcessedBy
          FROM [dbo].[Upload_Tbl_Products]
          WHERE VendorCode = @VendorCode 
            AND UploadStatus = 'Pending'
            AND ProductCode NOT IN (
              SELECT ProductCode 
              FROM [dbo].[Tbl_Products] 
              WHERE VendorCode = @VendorCode AND IsActive = 1
            );
          
          SET @ProcessedCount = @@ROWCOUNT;
          
          -- Update processed records status
          UPDATE [dbo].[Upload_Tbl_Products]
          SET UploadStatus = 'Processed',
              ProcessedDate = GETUTCDATE(),
              ErrorMessage = NULL
          WHERE VendorCode = @VendorCode 
            AND UploadStatus = 'Pending'
            AND ProductCode NOT IN (
              SELECT ProductCode 
              FROM [dbo].[Tbl_Products] 
              WHERE VendorCode = @VendorCode AND IsActive = 1
            );
          
          -- Mark duplicate records as error
          UPDATE [dbo].[Upload_Tbl_Products]
          SET UploadStatus = 'Error',
              ProcessedDate = GETUTCDATE(),
              ErrorMessage = 'Duplicate product code for vendor'
          WHERE VendorCode = @VendorCode 
            AND UploadStatus = 'Pending'
            AND ProductCode IN (
              SELECT ProductCode 
              FROM [dbo].[Tbl_Products] 
              WHERE VendorCode = @VendorCode AND IsActive = 1
            );
          
          SET @ErrorCount = @@ROWCOUNT;
          
          COMMIT TRANSACTION;
          
          -- Return results
          SELECT 
            @ProcessedCount AS ProcessedCount,
            @ErrorCount AS ErrorCount,
            'Upload completed successfully' AS ResultMessage;
            
        END TRY
        BEGIN CATCH
          IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
            
          SET @ErrorMessage = ERROR_MESSAGE();
          
          -- Update error records
          UPDATE [dbo].[Upload_Tbl_Products]
          SET UploadStatus = 'Error',
              ProcessedDate = GETUTCDATE(),
              ErrorMessage = @ErrorMessage
          WHERE VendorCode = @VendorCode AND UploadStatus = 'Pending';
          
          -- Return error information
          SELECT 
            0 AS ProcessedCount,
            1 AS ErrorCount,
            @ErrorMessage AS ResultMessage;
        END CATCH
      END
    `;

    await pool.request().query(createProcedureQuery);
    console.log('Proc_Upload_Tbl_Products procedure created successfully');

    // Step 3: Test the procedure
    console.log('\nTesting the procedure...');
    const testResult = await pool.request()
      .input('VendorCode', sql.NVarChar, 'DEMO001')
      .input('ProcessedBy', sql.NVarChar, 'TestUser')
      .execute('Proc_Upload_Tbl_Products');
    
    console.log('Procedure test result:');
    const result = testResult.recordset[0];
    console.log(`- Processed Count: ${result.ProcessedCount}`);
    console.log(`- Error Count: ${result.ErrorCount}`);
    console.log(`- Result Message: ${result.ResultMessage}`);

    // Step 4: Verify final state
    console.log('\nFinal verification:');
    
    // Check main table
    const mainTableCount = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Tbl_Products]');
    console.log(`- Records in Tbl_Products: ${mainTableCount.recordset[0].Count}`);
    
    // Check upload table status
    const uploadStatusCheck = await pool.request().query(`
      SELECT UploadStatus, COUNT(*) as Count 
      FROM [dbo].[Upload_Tbl_Products] 
      GROUP BY UploadStatus
    `);
    console.log('- Upload table status:');
    uploadStatusCheck.recordset.forEach(status => {
      console.log(`  ${status.UploadStatus}: ${status.Count} records`);
    });

    console.log('\n=== PROCEDURE CREATION COMPLETE ===');
    console.log('✅ Proc_Upload_Tbl_Products procedure created and tested successfully');

  } catch (err) {
    console.error('Database error:', err);
  } finally {
    await sql.close();
  }
}

createUploadProcedureSeparate();
