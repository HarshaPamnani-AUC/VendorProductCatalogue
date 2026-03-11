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

async function createNewUploadStructure() {
  try {
    const pool = await sql.connect(sqlConfig);
    console.log('Connected to database');

    // Step 1: Drop existing upload format table if it exists
    console.log('Dropping existing upload format tables...');
    await pool.request().query(`
      IF EXISTS (SELECT * FROM sys.tables WHERE name = 'ProductUploadFormat')
      BEGIN
        DROP TABLE [dbo].[ProductUploadFormat];
        PRINT 'ProductUploadFormat table dropped';
      END
    `);

    // Step 2: Create Upload_Tbl_Products table
    console.log('Creating Upload_Tbl_Products table...');
    const createUploadTableQuery = `
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Upload_Tbl_Products')
      BEGIN
        CREATE TABLE [dbo].[Upload_Tbl_Products] (
          [UploadId] INT IDENTITY(1,1) PRIMARY KEY,
          [VendorCode] NVARCHAR(50) NOT NULL,
          [ProductCode] NVARCHAR(100) NOT NULL,
          [ProductName] NVARCHAR(500) NOT NULL,
          [Description] NVARCHAR(2000) NULL,
          [Brand] NVARCHAR(200) NULL,
          [Category] NVARCHAR(200) NULL,
          [Price] DECIMAL(18, 2) NOT NULL,
          [StockQuantity] INT NULL,
          [UPC] NVARCHAR(50) NULL,
          [SKU] NVARCHAR(100) NULL,
          [Weight] DECIMAL(10, 3) NULL,
          [Dimensions] NVARCHAR(200) NULL,
          [Color] NVARCHAR(100) NULL,
          [Size] NVARCHAR(50) NULL,
          [Material] NVARCHAR(200) NULL,
          [Warranty] NVARCHAR(500) NULL,
          [Manufacturer] NVARCHAR(200) NULL,
          [Origin] NVARCHAR(200) NULL,
          [UploadDate] DATETIME DEFAULT GETUTCDATE(),
          [UploadStatus] NVARCHAR(20) DEFAULT 'Pending',
          [ProcessedDate] DATETIME NULL,
          [ErrorMessage] NVARCHAR(1000) NULL,
          [CreatedBy] NVARCHAR(100) NULL
        );
        
        -- Add indexes
        CREATE INDEX IX_Upload_Tbl_Products_VendorCode ON [dbo].[Upload_Tbl_Products] (VendorCode);
        CREATE INDEX IX_Upload_Tbl_Products_ProductCode ON [dbo].[Upload_Tbl_Products] (ProductCode);
        CREATE INDEX IX_Upload_Tbl_Products_UploadStatus ON [dbo].[Upload_Tbl_Products] (UploadStatus);
        
        PRINT 'Upload_Tbl_Products table created successfully';
      END
      ELSE
      BEGIN
        PRINT 'Upload_Tbl_Products table already exists';
      END
    `;

    await pool.request().query(createUploadTableQuery);

    // Step 3: Create Tbl_Products main table
    console.log('Creating Tbl_Products main table...');
    const createMainTableQuery = `
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Tbl_Products')
      BEGIN
        CREATE TABLE [dbo].[Tbl_Products] (
          [ProductId] INT IDENTITY(1,1) PRIMARY KEY,
          [VendorCode] NVARCHAR(50) NOT NULL,
          [ProductCode] NVARCHAR(100) NOT NULL,
          [ProductName] NVARCHAR(500) NOT NULL,
          [Description] NVARCHAR(2000) NULL,
          [Brand] NVARCHAR(200) NULL,
          [Category] NVARCHAR(200) NULL,
          [Price] DECIMAL(18, 2) NOT NULL,
          [StockQuantity] INT NULL,
          [UPC] NVARCHAR(50) NULL,
          [SKU] NVARCHAR(100) NULL,
          [Weight] DECIMAL(10, 3) NULL,
          [Dimensions] NVARCHAR(200) NULL,
          [Color] NVARCHAR(100) NULL,
          [Size] NVARCHAR(50) NULL,
          [Material] NVARCHAR(200) NULL,
          [Warranty] NVARCHAR(500) NULL,
          [Manufacturer] NVARCHAR(200) NULL,
          [Origin] NVARCHAR(200) NULL,
          [IsActive] BIT DEFAULT 1,
          [CreatedAt] DATETIME DEFAULT GETUTCDATE(),
          [UpdatedAt] DATETIME DEFAULT GETUTCDATE(),
          [CreatedBy] NVARCHAR(100) NULL,
          [UpdatedBy] NVARCHAR(100) NULL
        );
        
        -- Add indexes
        CREATE INDEX IX_Tbl_Products_VendorCode ON [dbo].[Tbl_Products] (VendorCode);
        CREATE INDEX IX_Tbl_Products_ProductCode ON [dbo].[Tbl_Products] (ProductCode);
        CREATE INDEX IX_Tbl_Products_UPC ON [dbo].[Tbl_Products] (UPC);
        CREATE UNIQUE INDEX UX_Tbl_Products_Vendor_Product ON [dbo].[Tbl_Products] (VendorCode, ProductCode) WHERE IsActive = 1;
        
        PRINT 'Tbl_Products table created successfully';
      END
      ELSE
      BEGIN
        PRINT 'Tbl_Products table already exists';
      END
    `;

    await pool.request().query(createMainTableQuery);

    // Step 4: Create Proc_Upload_Tbl_Products procedure
    console.log('Creating Proc_Upload_Tbl_Products procedure...');
    const createProcedureQuery = `
      IF EXISTS (SELECT * FROM sys.objects WHERE type = 'P' AND name = 'Proc_Upload_Tbl_Products')
      BEGIN
        DROP PROCEDURE [dbo].[Proc_Upload_Tbl_Products];
        PRINT 'Existing Proc_Upload_Tbl_Products procedure dropped';
      END

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

    // Step 5: Insert sample data into Upload_Tbl_Products
    console.log('Inserting sample data into Upload_Tbl_Products...');
    const sampleDataQuery = `
      INSERT INTO [dbo].[Upload_Tbl_Products] 
      (VendorCode, ProductCode, ProductName, Description, Brand, Category, Price, StockQuantity, UPC, SKU, Weight, Dimensions, Color, Size, Material, Warranty, Manufacturer, Origin, CreatedBy)
      VALUES 
      ('DEMO001', 'PROD001', 'Sample Product 1', 'This is a sample product description for demonstration', 'Sample Brand', 'Electronics', 29.99, 100, '123456789012', 'SKU001', 0.500, '10x5x2 inches', 'Black', 'Medium', 'Plastic', '1 Year Warranty', 'Sample Manufacturer', 'USA', 'System'),
      ('DEMO001', 'PROD002', 'Sample Product 2', 'Another sample product with different specifications', 'Another Brand', 'Home & Kitchen', 15.99, 50, '987654321098', 'SKU002', 1.200, '15x10x8 inches', 'White', 'Large', 'Metal', '2 Year Warranty', 'Another Manufacturer', 'China', 'System'),
      ('DEMO001', 'PROD003', 'Sample Product 3', 'Third sample product for testing upload format', 'Third Brand', 'Fashion', 45.50, 75, '555666777888', 'SKU003', 0.300, '12x8x1 inches', 'Blue', 'Small', 'Cotton', '6 Month Warranty', 'Third Manufacturer', 'India', 'System');
    `;

    await pool.request().query(sampleDataQuery);
    console.log('Sample data inserted into Upload_Tbl_Products');

    // Step 6: Verify table structures
    console.log('\n=== TABLE STRUCTURES ===');
    
    const uploadTableInfo = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Upload_Tbl_Products'
      ORDER BY ORDINAL_POSITION
    `);

    console.log('\nUpload_Tbl_Products table structure:');
    uploadTableInfo.recordset.forEach(col => {
      console.log(`- ${col.COLUMN_NAME}: ${col.DATA_TYPE}`);
    });

    const mainTableInfo = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Tbl_Products'
      ORDER BY ORDINAL_POSITION
    `);

    console.log('\nTbl_Products table structure:');
    mainTableInfo.recordset.forEach(col => {
      console.log(`- ${col.COLUMN_NAME}: ${col.DATA_TYPE}`);
    });

    // Step 7: Show sample records
    console.log('\n=== SAMPLE RECORDS ===');
    
    const uploadRecords = await pool.request().query('SELECT TOP 3 * FROM [dbo].[Upload_Tbl_Products]');
    console.log('\nSample records in Upload_Tbl_Products:');
    uploadRecords.recordset.forEach(record => {
      console.log(`- ${record.ProductCode}: ${record.ProductName} - $${record.Price} [${record.UploadStatus}]`);
    });

    console.log('\n=== CREATION COMPLETE ===');
    console.log('✅ Upload_Tbl_Products table created');
    console.log('✅ Tbl_Products table created'); 
    console.log('✅ Proc_Upload_Tbl_Products procedure created');
    console.log('✅ Sample data inserted');

  } catch (err) {
    console.error('Database error:', err);
  } finally {
    await sql.close();
  }
}

createNewUploadStructure();
