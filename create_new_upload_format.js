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

async function createNewUploadFormat() {
  try {
    const pool = await sql.connect(sqlConfig);
    console.log('Connected to database');

    // Step 1: Drop existing tables and recreate with new format
    console.log('Recreating tables with new format...');
    
    // Drop and recreate Upload_Tbl_Products
    await pool.request().query(`
      IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Upload_Tbl_Products')
      BEGIN
        DROP TABLE [dbo].[Upload_Tbl_Products];
        PRINT 'Upload_Tbl_Products table dropped';
      END
    `);

    const createUploadTableQuery = `
      CREATE TABLE [dbo].[Upload_Tbl_Products](
          [Date] [nvarchar](50) NULL,
          [EAN/UPC] [nvarchar](500) NULL,
          [Name] [nvarchar](300) NULL,
          [Item_Code] [nvarchar](100) NOT NULL,
          [Qty] [nvarchar](100) NULL,
          [Price] [nvarchar](50) NULL
        );
        
        -- Add indexes
        CREATE INDEX IX_Upload_Tbl_Products_Item_Code ON [dbo].[Upload_Tbl_Products] ([Item_Code]);
        CREATE INDEX IX_Upload_Tbl_Products_EAN_UPC ON [dbo].[Upload_Tbl_Products] ([EAN/UPC]);
        
        PRINT 'Upload_Tbl_Products table created with new format';
    `;

    await pool.request().query(createUploadTableQuery);

    // Step 2: Drop and recreate Tbl_Products
    await pool.request().query(`
      IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Tbl_Products')
      BEGIN
        DROP TABLE [dbo].[Tbl_Products];
        PRINT 'Tbl_Products table dropped';
      END
    `);

    const createMainTableQuery = `
      CREATE TABLE [dbo].[Tbl_Products](
          [Date] [nvarchar](50) NULL,
          [EAN/UPC] [nvarchar](500) NULL,
          [Name] [nvarchar](300) NULL,
          [Item_Code] [nvarchar](100) NOT NULL,
          [Qty] [nvarchar](100) NULL,
          [Price] [nvarchar](50) NULL,
          [Vendor] [nvarchar](50) NULL,
          [UploadDatetime] datetime NULL
        );
        
        -- Add indexes
        CREATE INDEX IX_Tbl_Products_Item_Code ON [dbo].[Tbl_Products] ([Item_Code]);
        CREATE INDEX IX_Tbl_Products_EAN_UPC ON [dbo].[Tbl_Products] ([EAN/UPC]);
        CREATE INDEX IX_Tbl_Products_Vendor ON [dbo].[Tbl_Products] ([Vendor]);
        
        PRINT 'Tbl_Products table created with new format';
    `;

    await pool.request().query(createMainTableQuery);

    // Step 3: Create the procedure as specified
    console.log('Creating procedure with new format...');
    
    // Drop existing procedure
    await pool.request().query(`
      IF EXISTS (SELECT * FROM sys.objects WHERE type = 'P' AND name = 'Proc_Upload_Tbl_Products')
      BEGIN
        DROP PROCEDURE [dbo].[Proc_Upload_Tbl_Products];
        PRINT 'Existing procedure dropped';
      END
    `);

    // Create the exact procedure as specified
    const createProcedureQuery = `
      CREATE PROCEDURE [dbo].[Proc_Upload_Tbl_Products]
        @Vendor NVARCHAR(50)
      AS
      BEGIN
          SET NOCOUNT ON;
          
          INSERT INTO [dbo].[Tbl_Products] 
          ([Date],[EAN/UPC],[Name],[Item_Code], 
          [Qty],[Price],[Vendor],[UploadDatetime])

          SELECT 
            [Date],[EAN/UPC],[Name],[Item_Code], 
          [Qty],[Price], @Vendor,getdate()
          FROM [dbo].[Upload_Tbl_Products];
      END
    `;

    await pool.request().query(createProcedureQuery);
    console.log('Proc_Upload_Tbl_Products procedure created successfully');

    // Step 4: Insert sample data matching new format
    console.log('Inserting sample data...');
    const sampleDataQuery = `
      INSERT INTO [dbo].[Upload_Tbl_Products] 
      ([Date], [EAN/UPC], [Name], [Item_Code], [Qty], [Price])
      VALUES 
      ('2024-01-01', '1234567890123', 'Sample Product 1', 'ITEM001', '100', '29.99'),
      ('2024-01-02', '9876543210987', 'Sample Product 2', 'ITEM002', '50', '15.99'),
      ('2024-01-03', '5556667778889', 'Sample Product 3', 'ITEM003', '75', '45.50');
    `;

    await pool.request().query(sampleDataQuery);
    console.log('Sample data inserted successfully');

    // Step 5: Verify table structures
    console.log('\n=== NEW FORMAT TABLE STRUCTURES ===');
    
    const uploadTableInfo = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Upload_Tbl_Products'
      ORDER BY ORDINAL_POSITION
    `);

    console.log('\nUpload_Tbl_Products table structure (new format):');
    uploadTableInfo.recordset.forEach(col => {
      console.log(`- ${col.COLUMN_NAME}: ${col.DATA_TYPE} - ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    const mainTableInfo = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Tbl_Products'
      ORDER BY ORDINAL_POSITION
    `);

    console.log('\nTbl_Products table structure (new format):');
    mainTableInfo.recordset.forEach(col => {
      console.log(`- ${col.COLUMN_NAME}: ${col.DATA_TYPE} - ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    // Step 6: Test the procedure
    console.log('\n=== Testing Procedure ===');
    const testResult = await pool.request()
      .input('Vendor', sql.NVarChar, 'DEMO_VENDOR')
      .execute('Proc_Upload_Tbl_Products');
    
    console.log(`Procedure executed successfully. Rows affected: ${testResult.rowsAffected[0]}`);

    // Verify data in main table
    const mainTableData = await pool.request().query('SELECT * FROM [dbo].[Tbl_Products]');
    console.log('\nData in Tbl_Products after procedure execution:');
    mainTableData.recordset.forEach(record => {
      console.log(`- ${record.Item_Code}: ${record.Name} - $${record.Price} [Vendor: ${record.Vendor}]`);
    });

    console.log('\n=== NEW FORMAT CREATION COMPLETE ===');
    console.log('✅ Upload_Tbl_Products created with new format');
    console.log('✅ Tbl_Products created with new format');
    console.log('✅ Proc_Upload_Tbl_Products created as specified');
    console.log('✅ Sample data inserted');
    console.log('✅ Procedure tested successfully');

  } catch (err) {
    console.error('Database error:', err);
  } finally {
    await sql.close();
  }
}

createNewUploadFormat();
