const sql = require('mssql');

const config = {
  user: 'sa',
  password: 'sa@123',
  server: 'localhost',
  database: 'VendorPriceList',
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

async function checkTableStructure() {
  try {
    await sql.connect(config);
    console.log('Connected to database');
    
    // Get table columns
    const columnsQuery = `
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Tbl_Products'
      ORDER BY ORDINAL_POSITION
    `;
    
    const result = await sql.query(columnsQuery);
    console.log('Table Columns:');
    result.recordset.forEach(col => {
      console.log(`- ${col.COLUMN_NAME} (${col.DATA_TYPE})`);
    });
    
    // Get sample data
    const sampleQuery = 'SELECT TOP 5 * FROM [dbo].[Tbl_Products]';
    const sampleResult = await sql.query(sampleQuery);
    console.log('\nSample Data:');
    console.log(sampleResult.recordset);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await sql.close();
  }
}

checkTableStructure();
