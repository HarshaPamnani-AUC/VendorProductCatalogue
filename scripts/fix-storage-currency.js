/**
 * fix-storage-currency.js
 *
 * One-time script to back-fill the correct Currency on Tbl_Products_Storage
 * for vendors whose names in the storage table don't exactly match the
 * Vendors table (name drift over time).
 *
 * Strategy:
 *  1. Exact match  — use Vendors.Currency directly via JOIN
 *  2. Alias map    — hard-coded aliases for known mismatches
 *  3. Anything unmapped stays as-is (assumed USD is correct)
 *
 * Run:  node scripts/fix-storage-currency.js
 * Safe to re-run — it's idempotent (only updates rows where currency differs).
 */

const sql = require('mssql');
require('dotenv').config({ path: '.env.production' });

const config = {
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server:   process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: { encrypt: true, trustServerCertificate: true },
};

// ── Alias map: storage vendor name  →  { canonical vendor name, currency } ──
// Currency is included directly so we don't need a second lookup.
const ALIASES = [
  // SIMEX variants
  { storageVendor: 'SIMEX EURO',    currency: 'EUR' },
  { storageVendor: 'SIMEX  EURO',   currency: 'EUR' },  // double space
  { storageVendor: 'SIMAX EURO',    currency: 'EUR' },  // typo
  { storageVendor: 'SIMEX USD',     currency: 'USD' },
  { storageVendor: 'SIMAX USD',     currency: 'USD' },

  // EUR vendors with name drift
  { storageVendor: 'FORMA ITALIANA', currency: 'EUR' },  // vs FORMA-ITALIANA
  { storageVendor: 'DTF',            currency: 'EUR' },  // vs DTF (ELLE)

  // GBP vendors with name drift
  { storageVendor: 'LUX SCENT',     currency: 'GBP' },  // vs LUXSCENT

  // Everything else below is USD — listed for completeness / documentation
  // { storageVendor: 'ACE VALUE',     currency: 'USD' },
  // { storageVendor: 'SCENT OPHORIA', currency: 'USD' },
  // etc.
];

async function run() {
  const pool = await sql.connect(config);
  console.log('Connected to DB');

  // Step 1 — Fix exact-match rows where Currency is wrong
  // (vendors that DO exist in the Vendors table but were uploaded with USD)
  const exactFix = await pool.request().query(`
    UPDATE s
    SET s.[Currency] = v.[Currency]
    FROM [dbo].[Tbl_Products_Storage] s
    INNER JOIN [dbo].[Vendors] v
      ON v.[VendorName] = s.[Vendor] AND v.[IsActive] = 1
    WHERE v.[Currency] <> 'USD'
      AND (s.[Currency] IS NULL OR s.[Currency] = '' OR s.[Currency] = 'USD')
  `);
  console.log(`Step 1 — Exact-match fix: ${exactFix.rowsAffected[0]} rows updated`);

  // Step 2 — Fix alias rows
  let totalAliasFixed = 0;
  for (const alias of ALIASES) {
    if (alias.currency === 'USD') continue; // USD is already the default, skip

    const req = pool.request();
    req.input('vendor',   sql.NVarChar, alias.storageVendor);
    req.input('currency', sql.NVarChar, alias.currency);

    const result = await req.query(`
      UPDATE [dbo].[Tbl_Products_Storage]
      SET [Currency] = @currency
      WHERE [Vendor] = @vendor
        AND (Currency IS NULL OR Currency = '' OR Currency = 'USD')
    `);
    const count = result.rowsAffected[0];
    totalAliasFixed += count;
    if (count > 0) {
      console.log(`  "${alias.storageVendor}" → ${alias.currency}: ${count} rows`);
    }
  }
  console.log(`Step 2 — Alias fix: ${totalAliasFixed} rows updated`);

  // Step 3 — Same fix for Tbl_Products (current catalog) if it exists
  try {
    const exactFixProducts = await pool.request().query(`
      UPDATE p
      SET p.[Currency] = v.[Currency]
      FROM [dbo].[Tbl_Products] p
      INNER JOIN [dbo].[Vendors] v
        ON v.[VendorName] = p.[Vendor] AND v.[IsActive] = 1
      WHERE v.[Currency] <> 'USD'
        AND (p.[Currency] IS NULL OR p.[Currency] = '' OR p.[Currency] = 'USD')
    `);
    console.log(`Step 3 — Tbl_Products exact fix: ${exactFixProducts.rowsAffected[0]} rows`);

    for (const alias of ALIASES) {
      if (alias.currency === 'USD') continue;
      const req = pool.request();
      req.input('vendor',   sql.NVarChar, alias.storageVendor);
      req.input('currency', sql.NVarChar, alias.currency);
      const r = await req.query(`
        UPDATE [dbo].[Tbl_Products]
        SET [Currency] = @currency
        WHERE [Vendor] = @vendor
          AND (Currency IS NULL OR Currency = '' OR Currency = 'USD')
      `);
      if (r.rowsAffected[0] > 0)
        console.log(`  Tbl_Products "${alias.storageVendor}" → ${alias.currency}: ${r.rowsAffected[0]} rows`);
    }
  } catch (e) {
    console.log('Tbl_Products step skipped (table may not exist or have Currency column):', e.message);
  }

  // Step 4 — Verify
  const verify = await pool.request().query(`
    SELECT Vendor, Currency, COUNT(*) AS cnt
    FROM [dbo].[Tbl_Products_Storage]
    WHERE Vendor IN (
      'SIMEX EURO','SIMEX  EURO','SIMAX EURO',
      'SIMEX USD','SIMAX USD',
      'FORMA ITALIANA','DTF','LUX SCENT',
      'AFL','SGL','LUXSCENT'
    )
    GROUP BY Vendor, Currency
    ORDER BY Vendor, Currency
  `);
  console.log('\nVerification — affected vendors after fix:');
  console.table(verify.recordset);

  await pool.close();
  console.log('\nDone.');
}

run().catch(e => { console.error(e); process.exit(1); });
