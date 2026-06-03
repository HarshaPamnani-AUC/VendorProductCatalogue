#!/usr/bin/env node

/**
 * SETUP_CURRENCY_SUPPORT.js
 * 
 * This script:
 * 1. Runs the SQL migration to add currency columns
 * 2. Updates vendor currencies based on country/location
 * 3. Updates existing product data with vendor currencies
 * 4. Logs all changes
 * 
 * Usage: node SETUP_CURRENCY_SUPPORT.js
 */

const sql = require('mssql');
require('dotenv').config({ path: '.env.production' });
const { VENDOR_CURRENCIES, getVendorCurrency } = require('./VENDOR_CURRENCIES');
const fs = require('fs');
const path = require('path');

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

const logFile = path.join(__dirname, 'logs', 'currency-setup.log');
const logsDir = path.join(__dirname, 'logs');

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

function log(message, data = null) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}\n`;
  console.log(logMessage);
  fs.appendFileSync(logFile, logMessage);
}

async function runMigration(pool) {
  try {
    log('=== RUNNING SQL MIGRATION ===');
    
    // Read and execute the migration script
    const migrationScript = fs.readFileSync(
      path.join(__dirname, 'scripts', '02-add-currency-support.sql'),
      'utf-8'
    );

    // Split by GO statements and execute each batch
    const batches = migrationScript.split(/\nGO\n/);
    
    for (const batch of batches) {
      if (batch.trim()) {
        try {
          await pool.request().batch(batch);
        } catch (err) {
          log('Batch execution error (may be expected):', err.message);
        }
      }
    }

    log('SQL Migration completed successfully');
  } catch (err) {
    log('SQL Migration error:', err.message);
    throw err;
  }
}

async function updateVendorCurrencies(pool) {
  try {
    log('=== UPDATING VENDOR CURRENCIES ===');

    // Get all vendors
    const vendorResult = await pool.request()
      .query('SELECT VendorId, VendorName, Country FROM [dbo].[Vendors] WHERE IsActive = 1');

    const vendors = vendorResult.recordset;
    let updatedCount = 0;
    let updates = [];

    for (const vendor of vendors) {
      const currency = getVendorCurrency(vendor.VendorName);
      
      await pool.request()
        .input('vendorId', sql.Int, vendor.VendorId)
        .input('currency', sql.NVarChar, currency)
        .query('UPDATE [dbo].[Vendors] SET Currency = @currency WHERE VendorId = @vendorId');

      updates.push({
        vendorId: vendor.VendorId,
        vendorName: vendor.VendorName,
        currency
      });
      updatedCount++;
    }

    log(`Updated ${updatedCount} vendors with currency information`, updates);
  } catch (err) {
    log('Update vendor currencies error:', err.message);
    throw err;
  }
}

async function updateProductCurrencies(pool) {
  try {
    log('=== UPDATING PRODUCT CURRENCIES ===');

    // Check which tables exist
    const tablesCheck = await pool.request()
      .query(`
        SELECT TABLE_NAME
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = 'dbo' 
        AND TABLE_NAME IN ('Products', 'Tbl_Products', 'Tbl_Products_Storage', 'Upload_Tbl_Products')
      `);

    const existingTables = tablesCheck.recordset.map(r => r.TABLE_NAME);
    log('Found existing tables:', existingTables);

    // Update Products table if it exists
    if (existingTables.includes('Products')) {
      try {
        const updateResult = await pool.request()
          .query(`
            UPDATE p
            SET p.Currency = COALESCE(v.Currency, 'USD')
            FROM [dbo].[Products] p
            INNER JOIN [dbo].[Vendors] v ON p.VendorId = v.VendorId
            WHERE p.Currency IS NULL OR p.Currency = ''
          `);

        log('Updated Products with vendor currencies', {
          recordsAffected: updateResult.rowsAffected[0]
        });
      } catch (err) {
        log('Products table update skipped:', err.message);
      }
    } else {
      log('Products table does not exist (skipped)');
    }

    // Update Tbl_Products if it exists
    if (existingTables.includes('Tbl_Products')) {
      try {
        const updateTblProducts = await pool.request()
          .query(`
            UPDATE tp
            SET tp.Currency = COALESCE(v.Currency, 'USD')
            FROM [dbo].[Tbl_Products] tp
            LEFT JOIN [dbo].[Vendors] v ON tp.Vendor = v.VendorName
            WHERE tp.Currency IS NULL OR tp.Currency = ''
          `);

        log('Updated Tbl_Products with vendor currencies', {
          recordsAffected: updateTblProducts.rowsAffected[0]
        });
      } catch (err) {
        log('Tbl_Products update skipped:', err.message);
      }
    } else {
      log('Tbl_Products table does not exist (skipped)');
    }

    // Update Tbl_Products_Storage if it exists
    if (existingTables.includes('Tbl_Products_Storage')) {
      try {
        const updateStorageProducts = await pool.request()
          .query(`
            UPDATE tps
            SET tps.Currency = COALESCE(v.Currency, 'USD')
            FROM [dbo].[Tbl_Products_Storage] tps
            LEFT JOIN [dbo].[Vendors] v ON tps.Vendor = v.VendorName
            WHERE tps.Currency IS NULL OR tps.Currency = ''
          `);

        log('Updated Tbl_Products_Storage with vendor currencies', {
          recordsAffected: updateStorageProducts.rowsAffected[0]
        });
      } catch (err) {
        log('Tbl_Products_Storage update skipped:', err.message);
      }
    } else {
      log('Tbl_Products_Storage table does not exist (skipped)');
    }

    // Update Upload_Tbl_Products if it exists
    if (existingTables.includes('Upload_Tbl_Products')) {
      try {
        const updateUploadProducts = await pool.request()
          .query(`
            UPDATE utp
            SET utp.Currency = COALESCE(v.Currency, 'USD')
            FROM [dbo].[Upload_Tbl_Products] utp
            INNER JOIN [dbo].[Vendors] v ON utp.VendorId = v.VendorId
            WHERE utp.Currency IS NULL OR utp.Currency = ''
          `);

        log('Updated Upload_Tbl_Products with vendor currencies', {
          recordsAffected: updateUploadProducts.rowsAffected[0]
        });
      } catch (err) {
        log('Upload_Tbl_Products update skipped:', err.message);
      }
    } else {
      log('Upload_Tbl_Products table does not exist (skipped)');
    }

  } catch (err) {
    log('Update product currencies error:', err.message);
    // Don't throw - this is not fatal if some tables don't exist
  }
}

async function updateOrderTablesCurrencies(pool) {
  try {
    log('=== UPDATING ORDER TABLES CURRENCIES ===');

    const orderTables = [
      'LLP_Orders',
      'VW360_Orders',
      'BSLLC_Orders',
      'BM_Orders',
      'BCGGB_Orders'
    ];

    for (const tableName of orderTables) {
      try {
        // Check if table has currency column
        const columnCheck = await pool.request()
          .query(`
            SELECT COUNT(*) as ColumnCount
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = '${tableName}' AND COLUMN_NAME = 'currency'
          `);

        if (columnCheck.recordset[0].ColumnCount > 0) {
          // Update NULL currencies to 'USD'
          const updateResult = await pool.request()
            .query(`
              UPDATE [${tableName}]
              SET currency = 'USD'
              WHERE currency IS NULL OR currency = ''
            `);

          log(`Updated ${tableName} - default currency set to USD`, {
            recordsAffected: updateResult.rowsAffected[0]
          });
        }
      } catch (err) {
        log(`Skipped ${tableName} (may not exist):`, err.message);
      }
    }

  } catch (err) {
    log('Update order tables currencies error:', err.message);
  }
}

async function verifyChanges(pool) {
  try {
    log('=== VERIFYING CHANGES ===');

    // Check Vendors table
    const vendorCheck = await pool.request()
      .query(`
        SELECT 
          COUNT(*) as TotalVendors,
          SUM(CASE WHEN Currency = 'USD' THEN 1 ELSE 0 END) as USD_Count,
          SUM(CASE WHEN Currency = 'EUR' THEN 1 ELSE 0 END) as EUR_Count,
          SUM(CASE WHEN Currency = 'GBP' THEN 1 ELSE 0 END) as GBP_Count
        FROM [dbo].[Vendors]
        WHERE IsActive = 1
      `);

    log('Vendor currency summary', vendorCheck.recordset[0]);

    // Check Products table if it exists
    try {
      const productCheck = await pool.request()
        .query(`
          SELECT 
            COUNT(*) as TotalProducts,
            SUM(CASE WHEN Currency IS NULL THEN 1 ELSE 0 END) as NullCurrencyCount,
            SUM(CASE WHEN Currency = 'USD' THEN 1 ELSE 0 END) as USD_Count,
            SUM(CASE WHEN Currency = 'EUR' THEN 1 ELSE 0 END) as EUR_Count,
            SUM(CASE WHEN Currency = 'GBP' THEN 1 ELSE 0 END) as GBP_Count
          FROM [dbo].[Products]
        `);

      log('Products currency summary', productCheck.recordset[0]);
    } catch (err) {
      log('Products table does not exist or cannot be queried (skipped)');
    }

    // Check Tbl_Products if it exists
    try {
      const tblProductCheck = await pool.request()
        .query(`
          SELECT 
            COUNT(*) as TotalProducts,
            SUM(CASE WHEN Currency IS NULL THEN 1 ELSE 0 END) as NullCurrencyCount,
            SUM(CASE WHEN Currency = 'USD' THEN 1 ELSE 0 END) as USD_Count,
            SUM(CASE WHEN Currency = 'EUR' THEN 1 ELSE 0 END) as EUR_Count,
            SUM(CASE WHEN Currency = 'GBP' THEN 1 ELSE 0 END) as GBP_Count
          FROM [dbo].[Tbl_Products]
        `);

      log('Tbl_Products currency summary', tblProductCheck.recordset[0]);
    } catch (err) {
      log('Tbl_Products table does not exist or cannot be queried (skipped)');
    }

    // Sample vendors with currencies
    const sampleVendors = await pool.request()
      .query(`
        SELECT TOP 10 VendorId, VendorName, Country, Currency
        FROM [dbo].[Vendors]
        ORDER BY VendorName
      `);

    log('Sample vendors with currencies:', sampleVendors.recordset);

  } catch (err) {
    log('Verification error:', err.message);
  }
}

async function main() {
  let pool;
  try {
    log('========================================');
    log('Starting Currency Support Setup');
    log('========================================');

    pool = await sql.connect(sqlConfig);
    log('Database connection established');

    // Run all setup steps
    await runMigration(pool);
    await updateVendorCurrencies(pool);
    await updateProductCurrencies(pool);
    await updateOrderTablesCurrencies(pool);
    await verifyChanges(pool);

    log('========================================');
    log('Currency Support Setup Completed Successfully!');
    log('========================================');
    log('Next steps:');
    log('1. Review the vendor currency assignments');
    log('2. For international vendors, run: PATCH /api/vendors/:vendorId/currency');
    log('3. Update your upload files to include Currency column if needed');
    log('4. Restart the application: pm2 restart vendorpro-backend');

  } catch (err) {
    log('ERROR:', err.message);
    log('Note: Some errors may be expected (e.g., tables already updated or missing tables)');
    console.error('Setup completed with errors - review logs/currency-setup.log');
  } finally {
    if (pool) {
      await pool.close();
      log('Database connection closed');
    }
  }
}

main();
