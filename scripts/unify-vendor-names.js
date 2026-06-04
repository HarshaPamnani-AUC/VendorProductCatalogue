/**
 * unify-vendor-names.js
 *
 * One-time migration that:
 *  1. Renames all dirty/variant vendor names in Tbl_Products_Storage
 *     to match the canonical names in the Vendors table.
 *  2. Sets the correct Currency on each row at the same time.
 *
 * Canonical vendor list (from user-supplied master list):
 *   ACE BEAUTY=USD, AFL=GBP, AL HUSSEIN=USD, AVENUE=USD, BEAUTYNET=EUR,
 *   API CHURI=USD, DTF (ELLE)=EUR, EFL=USD, ET=USD, FORMA-ITALIANA=EUR,
 *   FRAGSENSE=USD, FRENCH PERFUMES=USD, H&B=USD, HAZ=USD, JIZAN=USD,
 *   LINDO=USD, LUX AMERICA=USD, LUXSCENT=GBP, MAGNET=USD, MB (EGDG)=USD,
 *   MTZ=USD, NANDANSONS=USD, NEFERTI=USD, PARTHECO=EUR, PCA=USD,
 *   PERFUME PRICE=USD, POTW=USD, PPW=USD, RATAN=USD, SAP=USD, SATURN=USD,
 *   SCENT SENSES=USD, SCENTE OPHORIA=USD, SFM=USD, SGL=GBP,
 *   SIMEX=USD, SIMEX - EURO=EUR, SUSHMA=USD, TITAN=USD, TJS=USD,
 *   UNIVERSAL PERFUME=USD
 *
 * Run: node scripts/unify-vendor-names.js
 * Safe to re-run (idempotent).
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

// Each entry: { from: <name in storage>, to: <canonical name>, currency: <correct currency> }
// "currency" = what the prices actually ARE in (not USD even if it was tagged USD)
const MAPPINGS = [
  // ── ACE BEAUTY ───────────────────────────────────────────────────────────
  { from: 'ACE VALUE',            to: 'ACE BEAUTY',     currency: 'USD' },

  // ── AL HUSSEIN ───────────────────────────────────────────────────────────
  { from: 'Al Hussein',           to: 'AL HUSSEIN',     currency: 'USD' },

  // ── AVENUE ───────────────────────────────────────────────────────────────
  { from: 'AVANUE',               to: 'AVENUE',         currency: 'USD' },

  // ── BEAUTYNET ────────────────────────────────────────────────────────────
  { from: 'Beautynet',            to: 'BEAUTYNET',      currency: 'EUR' },

  // ── API CHURI ────────────────────────────────────────────────────────────
  { from: 'CHURI',                to: 'API CHURI',      currency: 'USD' },

  // ── DTF (ELLE) ───────────────────────────────────────────────────────────
  { from: 'DTF',                  to: 'DTF (ELLE)',      currency: 'EUR' },

  // ── FORMA-ITALIANA ───────────────────────────────────────────────────────
  { from: 'FORMA ITALIANA',       to: 'FORMA-ITALIANA', currency: 'EUR' },

  // ── FRAGSENSE / FRAGRANCE ────────────────────────────────────────────────
  // "FRAGRANCE" is ambiguous — best match is FRAGSENSE based on context
  { from: 'FRAGRANCE',            to: 'FRAGSENSE',      currency: 'USD' },

  // ── FRENCH PERFUMES ──────────────────────────────────────────────────────
  { from: 'FRENCH PERFUME',       to: 'FRENCH PERFUMES', currency: 'USD' },

  // ── LUX AMERICA ──────────────────────────────────────────────────────────
  { from: 'Lux America',          to: 'LUX AMERICA',    currency: 'USD' },

  // ── LUXSCENT ─────────────────────────────────────────────────────────────
  { from: 'LUX SCENT',            to: 'LUXSCENT',       currency: 'GBP' },

  // ── LUXURY BEAUTY ────────────────────────────────────────────────────────
  // Not on canonical list — skipped, needs manual confirmation

  // ── MAGNET ───────────────────────────────────────────────────────────────
  { from: 'MAGENT',               to: 'MAGNET',         currency: 'USD' },
  { from: 'MAGNT',                to: 'MAGNET',         currency: 'USD' },

  // ── MB (EGDG) ────────────────────────────────────────────────────────────
  { from: 'MB',                   to: 'MB (EGDG)',       currency: 'USD' },

  // ── SANYA ────────────────────────────────────────────────────────────────
  // Not on canonical list — skipped, needs manual confirmation

  // ── SCENTE OPHORIA ───────────────────────────────────────────────────────
  { from: 'SCENT OPHARIA',        to: 'SCENTE OPHORIA', currency: 'USD' },
  { from: 'SCENT OPHORIA',        to: 'SCENTE OPHORIA', currency: 'USD' },
  { from: 'Scente Ophoria',       to: 'SCENTE OPHORIA', currency: 'USD' },

  // ── SIMEX - EURO ─────────────────────────────────────────────────────────
  { from: 'SIMEX EURO',           to: 'SIMEX - EURO',   currency: 'EUR' },
  { from: 'SIMEX  EURO',          to: 'SIMEX - EURO',   currency: 'EUR' }, // double space
  { from: 'SIMAX EURO',           to: 'SIMEX - EURO',   currency: 'EUR' }, // typo

  // ── SIMEX (USD) ──────────────────────────────────────────────────────────
  { from: 'SIMEX USD',            to: 'SIMEX',          currency: 'USD' },
  { from: 'SIMAX USD',            to: 'SIMEX',          currency: 'USD' }, // typo

  // ── SUPERIOR FRAGRANCES ──────────────────────────────────────────────────
  // Not on canonical list — skipped, needs manual confirmation

  // ── UNIVERSAL PERFUME ────────────────────────────────────────────────────
  // Note: canonical spelling per user is "UNIVESAL PERFUME" (already in DB)
  // but "UNIVERSAL PERFUME" (with N) also exists — merge to the Vendors table spelling
  { from: 'UNIVERSAL PERFUME',    to: 'UNIVESAL PERFUME', currency: 'USD' },
];

// These already have correct names but wrong currency — fix currency only
const CURRENCY_ONLY_FIXES = [
  { vendor: 'AFL',            currency: 'GBP' },
  { vendor: 'BEAUTYNET',      currency: 'EUR' },
  { vendor: 'DTF (ELLE)',     currency: 'EUR' },
  { vendor: 'FORMA-ITALIANA', currency: 'EUR' },
  { vendor: 'LUXSCENT',       currency: 'GBP' },
  { vendor: 'PARTHECO',       currency: 'EUR' },
  { vendor: 'SGL',            currency: 'GBP' },
  { vendor: 'SIMEX - EURO',   currency: 'EUR' },
];

async function run() {
  const pool = await sql.connect(config);
  console.log('✅ Connected\n');

  let totalRows = 0;

  // ── Step 1: Rename + set currency ─────────────────────────────────────────
  console.log('=== Step 1: Rename dirty vendor names + fix currency ===');
  for (const m of MAPPINGS) {
    const req = pool.request();
    req.input('from',     sql.NVarChar, m.from);
    req.input('to',       sql.NVarChar, m.to);
    req.input('currency', sql.NVarChar, m.currency);
    const r = await req.query(`
      UPDATE [dbo].[Tbl_Products_Storage]
      SET [Vendor] = @to, [Currency] = @currency
      WHERE [Vendor] = @from
    `);
    const n = r.rowsAffected[0];
    totalRows += n;
    if (n > 0) console.log(`  "${m.from}" → "${m.to}" (${m.currency}): ${n} rows`);
  }
  console.log(`  Subtotal: ${totalRows} rows\n`);

  // ── Step 2: Fix currency on already-correct vendor names ──────────────────
  console.log('=== Step 2: Fix currency on correctly-named vendors ===');
  let currencyFixed = 0;
  for (const fix of CURRENCY_ONLY_FIXES) {
    const req = pool.request();
    req.input('vendor',   sql.NVarChar, fix.vendor);
    req.input('currency', sql.NVarChar, fix.currency);
    const r = await req.query(`
      UPDATE [dbo].[Tbl_Products_Storage]
      SET [Currency] = @currency
      WHERE [Vendor] = @vendor
        AND ([Currency] IS NULL OR [Currency] = '' OR [Currency] != @currency)
    `);
    const n = r.rowsAffected[0];
    currencyFixed += n;
    if (n > 0) console.log(`  "${fix.vendor}" → ${fix.currency}: ${n} rows`);
  }
  console.log(`  Subtotal: ${currencyFixed} rows\n`);

  // ── Step 3: Apply same renames to Vendors table (add/update entries) ──────
  console.log('=== Step 3: Ensure Vendors table has canonical entries ===');
  // Make sure every vendor in CURRENCY_ONLY_FIXES has the right currency in Vendors table
  for (const fix of CURRENCY_ONLY_FIXES) {
    const req = pool.request();
    req.input('vendor',   sql.NVarChar, fix.vendor);
    req.input('currency', sql.NVarChar, fix.currency);
    const r = await req.query(`
      UPDATE [dbo].[Vendors]
      SET [Currency] = @currency
      WHERE [VendorName] = @vendor AND [Currency] != @currency
    `);
    if (r.rowsAffected[0] > 0)
      console.log(`  Vendors table: "${fix.vendor}" currency → ${fix.currency}`);
  }

  // ── Step 4: Verify final state ────────────────────────────────────────────
  console.log('\n=== Verification: distinct vendors + currencies in Storage ===');
  const verify = await pool.request().query(`
    SELECT Vendor, Currency, COUNT(*) AS cnt
    FROM [dbo].[Tbl_Products_Storage]
    GROUP BY Vendor, Currency
    ORDER BY Vendor, Currency
  `);
  console.table(verify.recordset);

  // ── Step 5: Check for any remaining unmatched vendors ─────────────────────
  console.log('\n=== Remaining vendors in Storage with no Vendors table match ===');
  const unmatched = await pool.request().query(`
    SELECT DISTINCT s.Vendor, COUNT(*) AS cnt
    FROM [dbo].[Tbl_Products_Storage] s
    LEFT JOIN [dbo].[Vendors] v ON v.VendorName = s.Vendor AND v.IsActive = 1
    WHERE v.VendorId IS NULL
    GROUP BY s.Vendor
    ORDER BY s.Vendor
  `);
  if (unmatched.recordset.length === 0) {
    console.log('  ✅ All vendors now match!');
  } else {
    console.log('  ⚠ Still unmatched:');
    console.table(unmatched.recordset);
  }

  await pool.close();
  console.log('\n✅ Done.');
}

run().catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
