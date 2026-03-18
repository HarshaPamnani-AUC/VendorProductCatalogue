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

async function updateTablesAndProcedure() {
  try {
    const pool = await sql.connect(sqlConfig);
    console.log('Connected to database');

    // Step 1: Add UploadDateTime column to both tables if not exists
    console.log('Adding UploadDateTime column to tables...');
    
    // Add to Upload_Tbl_Products
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns 
                   WHERE object_id = OBJECT_ID('[dbo].[Upload_Tbl_Products]') 
                   AND name = 'UploadDateTime')
      BEGIN
        ALTER TABLE [dbo].[Upload_Tbl_Products] 
        ADD UploadDateTime DATETIME DEFAULT GETDATE();
        PRINT 'UploadDateTime column added to Upload_Tbl_Products';
      END
    `);

    // Add to Tbl_Products
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns 
                   WHERE object_id = OBJECT_ID('[dbo].[Tbl_Products]') 
                   AND name = 'UploadDateTime')
      BEGIN
        ALTER TABLE [dbo].[Tbl_Products] 
        ADD UploadDateTime DATETIME NULL;
        PRINT 'UploadDateTime column added to Tbl_Products';
      END
    `);

    // Step 2: Drop and recreate procedure with UploadDateTime
    console.log('Updating procedure with UploadDateTime...');
    
    // Drop existing procedure
    await pool.request().query(`
      IF EXISTS (SELECT * FROM sys.objects WHERE type = 'P' AND name = 'Proc_Upload_Tbl_Products')
      BEGIN
        DROP PROCEDURE [dbo].[Proc_Upload_Tbl_Products];
        PRINT 'Existing procedure dropped';
      END
    `);

    // Create updated procedure
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
        DECLARE @UploadDateTime DATETIME = GETDATE();
        
        BEGIN TRY
          BEGIN TRANSACTION;
          
          -- Move valid records from Upload_Tbl_Products to Tbl_Products
          INSERT INTO [dbo].[Tbl_Products] 
            (VendorCode, ProductCode, ProductName, Description, Brand, Category, Price, StockQuantity, 
             UPC, SKU, Weight, Dimensions, Color, Size, Material, Warranty, Manufacturer, Origin, 
             UploadDateTime, CreatedBy, UpdatedBy)
          SELECT 
            VendorCode, ProductCode, ProductName, Description, Brand, Category, Price, StockQuantity,
            UPC, SKU, Weight, Dimensions, Color, Size, Material, Warranty, Manufacturer, Origin,
            @UploadDateTime, @ProcessedBy, @ProcessedBy
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
            'Upload completed successfully' AS ResultMessage,
            @UploadDateTime AS UploadDateTime;
            
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
            @ErrorMessage AS ResultMessage,
            @UploadDateTime AS UploadDateTime;
        END CATCH
      END
    `;

    await pool.request().query(createProcedureQuery);
    console.log('Proc_Upload_Tbl_Products procedure updated successfully');

    // Step 3: Test the updated procedure
    console.log('\nTesting updated procedure...');
    const testResult = await pool.request()
      .input('VendorCode', sql.NVarChar, 'DEMO001')
      .input('ProcessedBy', sql.NVarChar, 'TestUser')
      .execute('Proc_Upload_Tbl_Products');
    
    console.log('Procedure test result:');
    const result = testResult.recordset[0];
    console.log(`- Processed Count: ${result.ProcessedCount}`);
    console.log(`- Error Count: ${result.ErrorCount}`);
    console.log(`- Result Message: ${result.ResultMessage}`);
    console.log(`- Upload DateTime: ${result.UploadDateTime}`);

    // Step 4: Verify table structures
    console.log('\n=== UPDATED TABLE STRUCTURES ===');
    
    const uploadTableInfo = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Upload_Tbl_Products'
      ORDER BY ORDINAL_POSITION
    `);

    console.log('\nUpload_Tbl_Products table structure:');
    uploadTableInfo.recordset.forEach(col => {
      console.log(`- ${col.COLUMN_NAME}: ${col.DATA_TYPE} - ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    const mainTableInfo = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Tbl_Products'
      ORDER BY ORDINAL_POSITION
    `);

    console.log('\nTbl_Products table structure:');
    mainTableInfo.recordset.forEach(col => {
      console.log(`- ${col.COLUMN_NAME}: ${col.DATA_TYPE} - ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    console.log('\n=== UPDATE COMPLETE ===');
    console.log('✅ UploadDateTime column added to both tables');
    console.log('✅ Proc_Upload_Tbl_Products procedure updated with UploadDateTime');
    console.log('✅ Procedure tested successfully');

  } catch (err) {
    console.error('Database error:', err);
  } finally {
    await sql.close();
  }
}

updateTablesAndProcedure();
