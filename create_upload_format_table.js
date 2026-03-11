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

async function createProductUploadFormatTable() {
  try {
    const pool = await sql.connect(sqlConfig);
    console.log('Connected to database');

    // Create the standardized product upload format table
    const createTableQuery = `
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ProductUploadFormat')
      BEGIN
        CREATE TABLE [dbo].[ProductUploadFormat] (
          [FormatId] INT IDENTITY(1,1) PRIMARY KEY,
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
        
        -- Add indexes for better performance
        CREATE INDEX IX_ProductUploadFormat_VendorCode ON [dbo].[ProductUploadFormat] (VendorCode);
        CREATE INDEX IX_ProductUploadFormat_ProductCode ON [dbo].[ProductUploadFormat] (ProductCode);
        CREATE INDEX IX_ProductUploadFormat_UPC ON [dbo].[ProductUploadFormat] (UPC);
        
        PRINT 'ProductUploadFormat table created successfully';
      END
      ELSE
      BEGIN
        PRINT 'ProductUploadFormat table already exists';
      END
    `;

    await pool.request().query(createTableQuery);
    console.log('ProductUploadFormat table created/verified successfully');

    // Insert sample data to demonstrate the format
    const sampleDataQuery = `
      INSERT INTO [dbo].[ProductUploadFormat] 
      (VendorCode, ProductCode, ProductName, Description, Brand, Category, Price, StockQuantity, UPC, SKU, Weight, Dimensions, Color, Size, Material, Warranty, Manufacturer, Origin)
      VALUES 
      ('DEMO001', 'PROD001', 'Sample Product 1', 'This is a sample product description for demonstration', 'Sample Brand', 'Electronics', 29.99, 100, '123456789012', 'SKU001', 0.500, '10x5x2 inches', 'Black', 'Medium', 'Plastic', '1 Year Warranty', 'Sample Manufacturer', 'USA'),
      ('DEMO001', 'PROD002', 'Sample Product 2', 'Another sample product with different specifications', 'Another Brand', 'Home & Kitchen', 15.99, 50, '987654321098', 'SKU002', 1.200, '15x10x8 inches', 'White', 'Large', 'Metal', '2 Year Warranty', 'Another Manufacturer', 'China'),
      ('DEMO001', 'PROD003', 'Sample Product 3', 'Third sample product for testing upload format', 'Third Brand', 'Fashion', 45.50, 75, '555666777888', 'SKU003', 0.300, '12x8x1 inches', 'Blue', 'Small', 'Cotton', '6 Month Warranty', 'Third Manufacturer', 'India');
    `;

    await pool.request().query(sampleDataQuery);
    console.log('Sample data inserted successfully');

    // Verify the table structure
    const tableInfo = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'ProductUploadFormat'
      ORDER BY ORDINAL_POSITION
    `);

    console.log('\nProductUploadFormat table structure:');
    tableInfo.recordset.forEach(col => {
      console.log(`- ${col.COLUMN_NAME}: ${col.DATA_TYPE}${col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : ''} - ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    console.log('\nSample records in ProductUploadFormat:');
    const sampleRecords = await pool.request().query('SELECT TOP 3 * FROM [dbo].[ProductUploadFormat]');
    sampleRecords.recordset.forEach(record => {
      console.log(`- ${record.ProductCode}: ${record.ProductName} - $${record.Price}`);
    });

  } catch (err) {
    console.error('Database error:', err);
  } finally {
    await sql.close();
  }
}

createProductUploadFormatTable();
