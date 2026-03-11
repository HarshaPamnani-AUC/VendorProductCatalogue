const sql = require('mssql');

async function checkUploadTableColumns() {
  try {
    // Use the same configuration as server.js
    const sqlConfig = {
      user: process.env.DB_USER || 'sa',
      password: process.env.DB_PASSWORD || 'admin@123',
      database: process.env.DB_NAME || 'VendorPriceList',
      server: process.env.DB_SERVER || 'localhost',
      port: 1433,
      pool: {
        max: parseInt(process.env.DB_POOL_MAX || '10'),
        min: parseInt(process.env.DB_POOL_MIN || '0'),
        idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000')
      },
      options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
        enableKeepAlive: true,
        instanceName: undefined
      }
    };

    console.log('🔍 Connecting to database...');
    const pool = new sql.ConnectionPool(sqlConfig);
    await pool.connect();
    console.log('✅ Connected to database');

    // Check if FileUploadId column exists in Upload_Tbl_Products
    const checkColumnQuery = `
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Upload_Tbl_Products' AND COLUMN_NAME = 'FileUploadId'
    `;

    console.log('📊 Checking FileUploadId column...');
    const result = await pool.request().query(checkColumnQuery);
    
    if (result.recordset.length > 0) {
      console.log('✅ FileUploadId column exists:', result.recordset[0]);
    } else {
      console.log('❌ FileUploadId column does not exist. Adding it...');
      
      // Add FileUploadId column
      const addColumnQuery = `
        ALTER TABLE [dbo].[Upload_Tbl_Products]
        ADD FileUploadId INT NULL
      `;
      
      await pool.request().query(addColumnQuery);
      console.log('✅ FileUploadId column added successfully');
      
      // Also add VendorId column if it doesn't exist
      const checkVendorColumnQuery = `
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'Upload_Tbl_Products' AND COLUMN_NAME = 'VendorId'
      `;
      
      const vendorResult = await pool.request().query(checkVendorColumnQuery);
      
      if (vendorResult.recordset.length === 0) {
        console.log('❌ VendorId column does not exist. Adding it...');
        
        const addVendorColumnQuery = `
          ALTER TABLE [dbo].[Upload_Tbl_Products]
          ADD VendorId INT NULL
        `;
        
        await pool.request().query(addVendorColumnQuery);
        console.log('✅ VendorId column added successfully');
      } else {
        console.log('✅ VendorId column already exists:', vendorResult.recordset[0]);
      }
    }

    await pool.close();
    console.log('\n✅ Table structure check completed');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkUploadTableColumns();
