const sql = require('mssql');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

const sqlConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: true,
    enableArithAbort: true
  }
};

async function investigateSource() {
  try {
    const pool = await sql.connect(sqlConfig);
    console.log('🔍 INVESTIGATING SOURCE OF INVALID DATA\n');

    // Check FileUploads table
    console.log('=== FILE UPLOADS HISTORY ===');
    try {
      const uploads = await pool.request().query(`
        SELECT TOP 20 
          FileId,
          VendorId,
          FileName,
          UploadedAt,
          Status,
          RecordsProcessed,
          RecordsSuccess,
          RecordsFailed,
          ErrorMessage
        FROM [dbo].[FileUploads]
        ORDER BY UploadedAt DESC
      `);
      
      console.log('Recent file uploads:');
      uploads.recordset.forEach(row => {
        console.log(`  FileId: ${row.FileId} | Vendor: ${row.VendorId} | File: ${row.FileName}`);
        console.log(`    Uploaded: ${row.UploadedAt}`);
        console.log(`    Status: ${row.Status} | Processed: ${row.RecordsProcessed} | Success: ${row.RecordsSuccess} | Failed: ${row.RecordsFailed}`);
        if (row.ErrorMessage) console.log(`    Error: ${row.ErrorMessage}`);
      });
    } catch (e) {
      console.log('Error checking FileUploads:', e.message);
    }

    // Check backup storage
    console.log('\n=== BACKUP STORAGE TABLE (Tbl_Products_Storage) ===');
    const storage = await pool.request().query(`
      SELECT 
        YEAR(CAST([Date] AS DATE)) as Year,
        Vendor,
        COUNT(*) as Count
      FROM [dbo].[Tbl_Products_Storage]
      WHERE YEAR(CAST([Date] AS DATE)) > 2026
      GROUP BY YEAR(CAST([Date] AS DATE)), Vendor
      ORDER BY Year DESC
    `);
    
    if (storage.recordset.length > 0) {
      console.log('Still in backup storage (future dates):');
      storage.recordset.forEach(row => {
        console.log(`  Year ${row.Year} | Vendor: ${row.Vendor} | ${row.Count} records`);
      });
    } else {
      console.log('No future-dated records in backup storage');
    }

    // Check logs
    console.log('\n=== UPLOAD LOGS ===');
    const logFiles = [
      'logs/uploads.log',
      'logs/api.log',
      'logs/upload.log'
    ];

    for (const logFile of logFiles) {
      if (fs.existsSync(logFile)) {
        console.log(`Found: ${logFile}`);
        const content = fs.readFileSync(logFile, 'utf8');
        const lines = content.split('\n').filter(l => l.includes('SAP') || l.includes('2027') || l.includes('2028'));
        if (lines.length > 0) {
          console.log(`  Relevant entries (${lines.length}):`);
          lines.slice(-5).forEach(line => {
            if (line.trim()) console.log(`    ${line.substring(0, 100)}`);
          });
        }
      }
    }

    // Check raw upload table
    console.log('\n=== RAW UPLOAD TABLE ===');
    try {
      const raw = await pool.request().query(`
        SELECT TOP 5 * FROM [dbo].[Tbl_Raw_Upload]
        WHERE YEAR(CAST([Date] AS DATE)) > 2026
      `);
      
      if (raw.recordset.length > 0) {
        console.log('Found future-dated data in raw upload table:');
        raw.recordset.forEach(row => {
          console.log(`  ${JSON.stringify(row).substring(0, 100)}`);
        });
      } else {
        console.log('No future dates in raw upload table');
      }
    } catch (e) {
      console.log('Raw upload table not found or empty');
    }

    // Check vendor info
    console.log('\n=== VENDOR INFORMATION ===');
    const sapVendor = await pool.request().query(`
      SELECT * FROM [dbo].[Vendors] WHERE VendorName LIKE '%SAP%' OR VendorCode LIKE '%SAP%'
    `);
    
    if (sapVendor.recordset.length > 0) {
      console.log('SAP Vendor info:');
      sapVendor.recordset.forEach(row => {
        console.log(`  VendorId: ${row.VendorId}`);
        console.log(`  Name: ${row.VendorName}`);
        console.log(`  Code: ${row.VendorCode}`);
        console.log(`  Email: ${row.ContactEmail}`);
      });
    }

    await pool.close();

  } catch (error) {
    console.error('Error:', error.message);
  }
}

investigateSource();
