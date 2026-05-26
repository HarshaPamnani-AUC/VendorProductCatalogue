require('dotenv').config({ path: '.env.local' });
const sql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
  },
};

(async () => {
  try {
    const pool = await sql.connect(config);
    const tables = await pool.request().query(`
      SELECT TABLE_SCHEMA, TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME LIKE '%Upload%' OR TABLE_NAME LIKE '%Product%'
      ORDER BY TABLE_NAME
    `);
    console.log('Tables:', JSON.stringify(tables.recordset, null, 2));

    const exists = await pool.request().query(`
      SELECT OBJECT_ID('[dbo].[Upload_Tbl_Products]') AS objectId
    `);
    console.log('Upload_Tbl_Products objectId:', exists.recordset[0]?.objectId);

    const procs = await pool.request().query(`
      SELECT SCHEMA_NAME(schema_id) AS schema_name, name
      FROM sys.procedures
      WHERE name LIKE '%Upload%' OR name LIKE '%Product%'
    `);
    console.log('Procedures:', procs.recordset);

    const permissionTests = [
      ['SELECT', 'SELECT COUNT(*) AS c FROM [dbo].[Upload_Tbl_Products]'],
      ['DELETE', 'DELETE FROM [dbo].[Upload_Tbl_Products]'],
      ['INSERT', `INSERT INTO [dbo].[Upload_Tbl_Products] ([Date],[EAN/UPC],[Name],[Item_Code],[Qty],[Price]) VALUES ('1','2','3','4','5','6')`],
      ['TRUNCATE', 'TRUNCATE TABLE [dbo].[Upload_Tbl_Products]'],
      ['EXEC proc', `EXEC [dbo].[Proc_Upload_Tbl_Products] @Vendor = N'TEST'`],
    ];
    for (const [label, query] of permissionTests) {
      try {
        const r = await pool.request().query(query);
        console.log(`${label}: OK`, r.recordset?.[0] ?? '');
      } catch (e) {
        console.log(`${label}: FAIL -`, e.message);
      }
    }

    const cols = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'Upload_Tbl_Products'
      ORDER BY ORDINAL_POSITION
    `);
    console.log('Columns:', cols.recordset.map((c) => c.COLUMN_NAME).join(', '));

    const dateCols = await pool.request().query(`
      SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME IN ('Upload_Tbl_Products', 'Tbl_Products') AND COLUMN_NAME = 'Date'
    `);
    console.log('Date column types:', dateCols.recordset);

    const samples = await pool.request().query(`
      SELECT TOP 5 [Date] FROM [dbo].[Upload_Tbl_Products]
    `);
    console.log('Sample upload dates:', samples.recordset);

    await pool.close();
  } catch (e) {
    console.error('ERR:', e.message);
    process.exit(1);
  }
})();
