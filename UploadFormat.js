const sql = require('mssql');

async function checkUploadTableStructure() {
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

    // Parse instance name from server if provided
    if (sqlConfig.server && sqlConfig.server.includes('\\')) {
      const parts = sqlConfig.server.split('\\');
      sqlConfig.server = parts[0];
      sqlConfig.options.instanceName = parts[1];
    }

    console.log('🔍 Connecting to database...');
    console.log('Server:', sqlConfig.server);
    console.log('Database:', sqlConfig.database);
    
    const pool = new sql.ConnectionPool(sqlConfig);
    await pool.connect();
    console.log('✅ Connected to database');

    // Get table structure
    const query = `
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        IS_NULLABLE,
        CHARACTER_MAXIMUM_LENGTH,
        NUMERIC_PRECISION,
        NUMERIC_SCALE,
        ORDINAL_POSITION
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Upload_Tbl_Products'
      ORDER BY ORDINAL_POSITION
    `;

    console.log('📊 Fetching Upload_Tbl_Products table structure...');
    const result = await pool.request().query(query);
    
    console.log('\n=== Upload_Tbl_Products Table Structure ===');
    console.log('Total Columns:', result.recordset.length);
    console.log('Column Details:');
    
    result.recordset.forEach((column, index) => {
      console.log(`${index + 1}. ${column.COLUMN_NAME} (Position: ${column.ORDINAL_POSITION})`);
      console.log(`   Type: ${column.DATA_TYPE}`);
      console.log(`   Nullable: ${column.IS_NULLABLE}`);
      if (column.CHARACTER_MAXIMUM_LENGTH) {
        console.log(`   Max Length: ${column.CHARACTER_MAXIMUM_LENGTH}`);
      }
      if (column.NUMERIC_PRECISION) {
        console.log(`   Precision: ${column.NUMERIC_PRECISION}, Scale: ${column.NUMERIC_SCALE}`);
      }
      console.log('');
    });

    // Also get sample data to see actual format
    const sampleQuery = `
      SELECT TOP 3 * FROM [dbo].[Upload_Tbl_Products]
    `;
    
    console.log('📄 Fetching sample data...');
    const sampleResult = await pool.request().query(sampleQuery);
    
    if (sampleResult.recordset.length > 0) {
      console.log('\n=== Sample Data ===');
      console.log('Columns:', Object.keys(sampleResult.recordset[0]));
      
      sampleResult.recordset.forEach((row, index) => {
        console.log(`\nRow ${index + 1}:`);
        Object.entries(row).forEach(([key, value]) => {
          console.log(`  ${key}: ${value}`);
        });
      });
    } else {
      console.log('No sample data found in Upload_Tbl_Products');
    }

    await pool.close();
    console.log('\n✅ Analysis completed successfully');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkUploadTableStructure();
