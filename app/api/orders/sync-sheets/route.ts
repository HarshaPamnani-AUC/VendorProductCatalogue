import { NextRequest, NextResponse } from 'next/server';
import { poolPromise } from '@/lib/db';
import sql from 'mssql';
import { google } from 'googleapis';
import fs from 'fs';

// ── Sheet → DB table mapping ──────────────────────────────────────────────────
// Each entry: { spreadsheetId, label, table, company, sheetName }
// sheetName: the tab inside the spreadsheet (null = first sheet)
const SHEET_CONFIGS = [
  {
    label: 'BSLLC PENDING ORDERS 2026-27',
    spreadsheetId: '1aA2WLWlzx4fgB8OSAUSTVH-rkvbhCd9VfiQtrIKuEI8',
    sheetName: null,
    table: 'BSLLC_Orders',
    company: 'BSLLC',
  },
  {
    label: 'VW360 PENDING ORDERS 2026-27',
    spreadsheetId: '1U3NTuiDl4OLaZvjWt5NtS5EaSaRoH6YTofbq0SnJ1Lw',
    sheetName: null,
    table: 'VW360_Orders',
    company: 'VW360',
  },
  {
    label: 'BCG GB PENDING ORDERS 2026-27',
    spreadsheetId: '1-V8GbUK5Wld2Zu2_k773P6-467GtjsuNGi3XYPV6FsY',
    sheetName: null,
    table: 'BCGGB_Orders',
    company: 'BCGGB',
  },
  {
    label: 'LLP PENDING ORDERS 2026-27',
    spreadsheetId: '1EdjT2yR_l-0njWe6xoq0u1TZRVHRUnr9DCkfjeiKwXQ',
    sheetName: null,
    table: 'LLP_Orders',
    company: 'LLP',
  },
  {
    label: 'BM PENDING ORDERS 2026-27',
    spreadsheetId: '1QAwhBRCVJhQwT6sbgrK_007AtoMWjTorXaN_c5AnYUU',
    sheetName: null,
    table: 'BM_Orders',
    company: 'BM',
  },
];

// ── Ensure BM_Orders and BCGGB_Orders tables exist ───────────────────────────
// These are created on first use if not present — identical schema to LLP/VW360/BSLLC_Orders
const EXTRA_TABLES = ['BM_Orders', 'BCGGB_Orders'];

async function ensureTablesExist(pool: sql.ConnectionPool): Promise<void> {
  const createSql = (tableName: string) => `
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES
                   WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = '${tableName}')
    BEGIN
      CREATE TABLE [dbo].[${tableName}] (
        [id]                  INT           PRIMARY KEY IDENTITY(1,1),
        [order_demand_id]     NVARCHAR(255),
        [supplier]            NVARCHAR(255),
        [order_date]          DATE,
        [invoice_so_proforma] NVARCHAR(255),
        [invoice_date]        DATE,
        [delivery_date]       DATE,
        [port_info_date]      DATE,
        [status]              NVARCHAR(255),
        [so]                  NVARCHAR(255),
        [nav]                 NVARCHAR(255),
        [upc_ean]             NVARCHAR(255),
        [brand]               NVARCHAR(255),
        [nav_name]            NVARCHAR(500),
        [currency]            NVARCHAR(50),
        [order_qty]           DECIMAL(15,4),
        [order_price]         DECIMAL(15,4),
        [so_qty]              DECIMAL(15,4),
        [so_price]            DECIMAL(15,4),
        [invoice_qty]         DECIMAL(15,4),
        [inv_price]           DECIMAL(15,4),
        [sheet_type]          NVARCHAR(100) NOT NULL DEFAULT 'PENDING ORDERS',
        [inserted_at]         DATETIME      DEFAULT GETUTCDATE()
      )
    END
  `;
  for (const t of EXTRA_TABLES) {
    await pool.request().query(createSql(t));
  }
}

// ── Column name → DB field mapping ───────────────────────────────────────────
// Covers all 5 sheet header variants (trimmed + lowercased before lookup)
const COLUMN_MAP: Record<string, string> = {
  // order/demand id variants
  'order/demand id':          'order_demand_id',
  'order demand id':          'order_demand_id',
  'order/demand':             'order_demand_id',
  'demand/order':             'order_demand_id',
  'demand id':                'order_demand_id',
  'order id':                 'order_demand_id',
  'vw':                       'order_demand_id',   // VW360 sheet

  // supplier
  'supplier':                 'supplier',

  // dates
  'order date':               'order_date',
  'invoice date':             'invoice_date',
  'delivery date':            'delivery_date',
  'posting date':             'port_info_date',    // all sheets use "POSTING DATE"
  'port info date':           'port_info_date',
  'port info  date':          'port_info_date',

  // invoice / so / proforma
  'invoice/so/proforma':      'invoice_so_proforma',
  'invoice/so/ proforma':     'invoice_so_proforma',
  'invoice / so / proforma':  'invoice_so_proforma',
  'invoice so proforma':      'invoice_so_proforma',
  'invoice/proforma':         'invoice_so_proforma',  // BSLLC sheet variant
  'invoice/ proforma':        'invoice_so_proforma',

  // status / so / nav
  'status':                   'status',
  'so':                       'so',
  'nav':                      'nav',

  // upc / ean
  'upc/ean':                  'upc_ean',
  'upc/ ean':                 'upc_ean',
  'ean':                      'upc_ean',            // BSLLC sheet
  'upc':                      'upc_ean',

  // brand — with and without trailing space
  'brand':                    'brand',
  'brand name':               'brand',
  'brand name ':              'brand',

  // nav name
  'nav name':                 'nav_name',
  'navname':                  'nav_name',

  // currency
  'currency':                 'currency',

  // quantities & prices
  'order qty':                'order_qty',
  'order quantity':           'order_qty',
  'price':                    'order_price',        // BSLLC uses just "PRICE"
  'order price':              'order_price',
  'so qty':                   'so_qty',
  'so quantity':              'so_qty',
  'so price':                 'so_price',
  'invoice qty':              'invoice_qty',
  'invoice quantity':         'invoice_qty',
  'inv. price':               'inv_price',
  'inv.price':                'inv_price',
  'inv price':                'inv_price',
  'invoice price':            'inv_price',
};

const DATE_COLS    = new Set(['order_date', 'invoice_date', 'delivery_date', 'port_info_date']);
const NUMERIC_COLS = new Set(['order_qty', 'order_price', 'so_qty', 'so_price', 'invoice_qty', 'inv_price']);

// Fields used to detect duplicates — all non-null mapped fields must match
const DEDUP_FIELDS = [
  'order_demand_id', 'supplier', 'order_date', 'upc_ean', 'nav',
  'order_qty', 'order_price', 'so_qty', 'so_price',
  'invoice_so_proforma', 'brand', 'nav_name',
];

// ── Google Auth ───────────────────────────────────────────────────────────────
function getGoogleAuth() {
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON;

  // Absolute fallback: key file is always at this known path on this server
  const fallbackPath = '/var/www/vendorpro.beautystorellc.com/google-service-account.json';

  let credentials: any;
  if (keyJson) {
    credentials = JSON.parse(keyJson);
  } else {
    const resolvedPath = keyPath || (fs.existsSync(fallbackPath) ? fallbackPath : null);
    if (!resolvedPath) {
      throw new Error(
        'No Google service account credentials configured. ' +
        'Set GOOGLE_SERVICE_ACCOUNT_KEY_PATH or GOOGLE_SERVICE_ACCOUNT_KEY_JSON.'
      );
    }
    credentials = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  }

  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
}

function parseDate(val: any): Date | null {
  if (val == null || val === '') return null;
  // Google Sheets serial number (days since Dec 30 1899)
  if (typeof val === 'number') {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? null : d;
  }
  const s = String(val).trim();
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function parseNum(val: any): number | null {
  if (val == null || val === '') return null;
  const n = parseFloat(String(val).replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

// Normalise a cell to string for dedup fingerprint
function normCell(val: any, isDate: boolean, isNum: boolean): string {
  if (val == null || val === '') return '';
  if (isDate) {
    const d = parseDate(val);
    return d ? d.toISOString().split('T')[0] : '';
  }
  if (isNum) {
    const n = parseNum(val);
    return n != null ? String(n) : '';
  }
  return String(val).trim().toLowerCase();
}

// Build a fingerprint string from a row object using DEDUP_FIELDS
function rowFingerprint(row: Record<string, any>): string {
  return DEDUP_FIELDS.map(f => {
    const v = row[f];
    if (v == null || v === '') return '';
    if (DATE_COLS.has(f)) {
      if (v instanceof Date) return v.toISOString().split('T')[0];
      return String(v).split('T')[0];
    }
    if (NUMERIC_COLS.has(f)) {
      // Use parseFloat to strip trailing zeros — matches CAST(FLOAT) in SQL
      const n = parseFloat(String(v));
      return isNaN(n) ? '' : String(n);
    }
    return String(v).trim().toLowerCase();
  }).join('|');
}

// Fetch first sheet name from a spreadsheet
async function getFirstSheetName(
  sheetsApi: any,
  spreadsheetId: string,
): Promise<string> {
  const meta = await sheetsApi.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  });
  return meta.data.sheets?.[0]?.properties?.title ?? 'Sheet1';
}

// Read all rows from a sheet
async function readSheet(
  sheetsApi: any,
  spreadsheetId: string,
  sheetName: string | null,
): Promise<any[][]> {
  const tab = sheetName ?? (await getFirstSheetName(sheetsApi, spreadsheetId));
  const res = await sheetsApi.spreadsheets.values.get({
    spreadsheetId,
    range: tab,
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });
  return res.data.values || [];
}

// Load existing fingerprints from a DB table to avoid duplicates
async function loadExistingFingerprints(
  pool: sql.ConnectionPool,
  table: string,
): Promise<Set<string>> {
  const result = await pool.request().query(`
    SELECT
      ISNULL(CAST(order_demand_id AS NVARCHAR(500)),''),
      ISNULL(CAST(supplier AS NVARCHAR(500)),''),
      ISNULL(CONVERT(NVARCHAR(10), order_date, 23),''),
      ISNULL(CAST(upc_ean AS NVARCHAR(500)),''),
      ISNULL(CAST(nav AS NVARCHAR(500)),''),
      ISNULL(CAST(CAST(order_qty   AS FLOAT) AS NVARCHAR(100)),''),
      ISNULL(CAST(CAST(order_price AS FLOAT) AS NVARCHAR(100)),''),
      ISNULL(CAST(CAST(so_qty      AS FLOAT) AS NVARCHAR(100)),''),
      ISNULL(CAST(CAST(so_price    AS FLOAT) AS NVARCHAR(100)),''),
      ISNULL(CAST(invoice_so_proforma AS NVARCHAR(500)),''),
      ISNULL(CAST(brand AS NVARCHAR(500)),''),
      ISNULL(CAST(nav_name AS NVARCHAR(500)),'')
    FROM [dbo].[${table}]
  `);
  const set = new Set<string>();
  for (const row of result.recordset) {
    const vals = Object.values(row as Record<string, any>) as string[];
    set.add(vals.map(v => String(v ?? '').trim().toLowerCase()).join('|'));
  }
  return set;
}

// ── Single-sheet processor ────────────────────────────────────────────────────

interface SheetResult {
  label: string;
  table: string;
  inserted: number;
  skipped: number;
  skippedDups: number;
  error?: string;
}

async function processSheet(
  sheetsApi: any,
  pool: sql.ConnectionPool,
  config: typeof SHEET_CONFIGS[number],
): Promise<SheetResult> {
  const { label, spreadsheetId, sheetName, table, company } = config;

  // Fetch raw sheet data
  let raw: any[][];
  try {
    raw = await readSheet(sheetsApi, spreadsheetId, sheetName);
  } catch (e: any) {
    return { label, table, inserted: 0, skipped: 0, skippedDups: 0, error: e.message };
  }

  if (raw.length < 2) {
    return { label, table, inserted: 0, skipped: 0, skippedDups: 0, error: 'Sheet is empty or has no data rows' };
  }

  // Map headers → DB columns
  const headers = (raw[0] as any[]).map(h => String(h ?? '').trim().toLowerCase().replace(/\s+/g, ' '));
  const colMap: Record<number, string> = {};
  headers.forEach((h, i) => {
    const db = COLUMN_MAP[h];
    if (db) colMap[i] = db;
  });

  if (Object.keys(colMap).length === 0) {
    return { label, table, inserted: 0, skipped: 0, skippedDups: 0, error: `No recognisable columns found. Headers were: ${headers.join(', ')}` };
  }

  // Load existing DB fingerprints for this table
  const existingFingerprints = await loadExistingFingerprints(pool, table);

  // Track fingerprints seen within this file to avoid intra-file duplicates
  const seenInFile = new Set<string>();

  let inserted = 0;
  let skipped = 0;
  let skippedDups = 0;

  for (let ri = 1; ri < raw.length; ri++) {
    const row = raw[ri] as any[];
    if (!row || row.every(c => c == null || c === '')) { skipped++; continue; }

    // Build parsed row object
    const parsed: Record<string, any> = {};
    for (const [idxStr, dbCol] of Object.entries(colMap)) {
      const idx = parseInt(idxStr);
      const val = row[idx] ?? null;
      if (DATE_COLS.has(dbCol)) {
        parsed[dbCol] = parseDate(val);
      } else if (NUMERIC_COLS.has(dbCol)) {
        parsed[dbCol] = parseNum(val);
      } else {
        parsed[dbCol] = val != null && val !== '' ? String(val).trim() : null;
      }
    }

    // Build dedup fingerprint
    const fp = rowFingerprint(parsed);

    // Skip if duplicate (DB or within-file)
    if (existingFingerprints.has(fp) || seenInFile.has(fp)) {
      skippedDups++;
      continue;
    }
    seenInFile.add(fp);

    // Insert into DB
    try {
      const req = pool.request();
      const cols: string[] = ['sheet_type'];
      req.input('sheet_type', sql.NVarChar, 'PENDING ORDERS');

      for (const [dbCol, val] of Object.entries(parsed)) {
        if (DATE_COLS.has(dbCol)) {
          req.input(dbCol, sql.Date, val as Date | null);
        } else if (NUMERIC_COLS.has(dbCol)) {
          req.input(dbCol, sql.Decimal(15, 4), val as number | null);
        } else {
          req.input(dbCol, sql.NVarChar, val as string | null);
        }
        cols.push(dbCol);
      }

      const colList   = cols.join(', ');
      const paramList = cols.map(c => `@${c}`).join(', ');

      await req.query(`INSERT INTO [dbo].[${table}] (${colList}) VALUES (${paramList})`);
      inserted++;

      // Add to seen set so subsequent rows in the same sheet are deduped
      existingFingerprints.add(fp);
    } catch (e: any) {
      console.error(`Row ${ri} insert error in "${label}":`, e.message);
      skipped++;
    }
  }

  return { label, table, inserted, skipped, skippedDups };
}

// ── API Route ─────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // Optionally sync only specific sheets (by label) — if body empty, sync all
    let targetLabels: string[] | null = null;
    try {
      const body = await request.json();
      if (Array.isArray(body?.sheets) && body.sheets.length > 0) {
        targetLabels = body.sheets;
      }
    } catch { /* no body — sync all */ }

    const configs = targetLabels
      ? SHEET_CONFIGS.filter(c => targetLabels!.includes(c.label))
      : SHEET_CONFIGS;

    if (configs.length === 0) {
      return NextResponse.json({ error: 'No matching sheets configured' }, { status: 400 });
    }

    // Google auth
    let auth: any;
    try {
      auth = getGoogleAuth();
    } catch (e: any) {
      return NextResponse.json({ error: `Google auth failed: ${e.message}` }, { status: 500 });
    }

    const sheetsApi = google.sheets({ version: 'v4', auth });

    // DB connection
    const pool = await poolPromise;
    if (!pool) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // Create BM_Orders / BCGGB_Orders if they don't exist yet
    await ensureTablesExist(pool);

    // Process all sheets (sequentially to avoid DB connection pressure)
    const results: SheetResult[] = [];
    for (const config of configs) {
      const result = await processSheet(sheetsApi, pool, config);
      results.push(result);
    }

    const totalInserted   = results.reduce((s, r) => s + r.inserted, 0);
    const totalDups       = results.reduce((s, r) => s + r.skippedDups, 0);
    const totalSkipped    = results.reduce((s, r) => s + r.skipped, 0);
    const sheetsWithErrors = results.filter(r => r.error).length;

    return NextResponse.json({
      success: true,
      totalInserted,
      totalDuplicatesSkipped: totalDups,
      totalEmptyRowsSkipped: totalSkipped,
      sheetsProcessed: results.length,
      sheetsWithErrors,
      results,
    });
  } catch (error: any) {
    console.error('Sync sheets error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET — return configured sheet labels (for UI)
export async function GET() {
  return NextResponse.json({
    sheets: SHEET_CONFIGS.map(c => ({
      label: c.label,
      table: c.table,
      company: c.company,
    })),
  });
}
