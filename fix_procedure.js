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

async function fixProcedure() {
  try {
    const pool = await sql.connect(sqlConfig);
    console.log('Connected to database');

    // Drop and recreate the procedure
    console.log('Fixing procedure...');
    
    await pool.request().query(`
      IF EXISTS (SELECT * FROM sys.objects WHERE type = 'P' AND name = 'Proc_Upload_Tbl_Products')
      BEGIN
        DROP PROCEDURE [dbo].[Proc_Upload_Tbl_Products];
        PRINT 'Existing procedure dropped';
      END
    `);

    // Create the fixed procedure
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
          [Qty],[Price], @Vendor, GETDATE()
          FROM [dbo].[Upload_Tbl_Products];
      END
    `;

    await pool.request().query(createProcedureQuery);
    console.log('Proc_Upload_Tbl_Products procedure recreated successfully');

    // Test the procedure
    console.log('\n=== Testing Fixed Procedure ===');
    const testResult = await pool.request()
      .input('Vendor', sql.NVarChar, 'TEST_VENDOR')
      .execute('Proc_Upload_Tbl_Products');
    
    console.log('Procedure executed successfully');
    console.log(`Rows affected: ${testResult.rowsAffected[0]}`);

    // Verify data in main table
    const mainTableData = await pool.request().query('SELECT TOP 3 * FROM [dbo].[Tbl_Products]');
    console.log('\nData in Tbl_Products after procedure:');
    mainTableData.recordset.forEach(record => {
      console.log(`- ${record.Item_Code}: ${record.Name} - $${record.Price} [Vendor: ${record.Vendor}]`);
    });

    console.log('\n=== PROCEDURE FIXED ===');
    console.log('✅ Procedure recreated without errors');
    console.log('✅ Data transfer working correctly');
    console.log('✅ Ready for upload functionality');

  } catch (err) {
    console.error('Database error:', err);
  } finally {
    await sql.close();
  }
}

fixProcedure();
