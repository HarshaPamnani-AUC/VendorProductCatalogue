'use strict';

const fs      = require('fs');
const path    = require('path');
const { google } = require('googleapis');
const XLSX    = require('xlsx');
const sql     = require('mssql');

const { resolveColumnMapping, parseRowFromSheet, isDataRow } = require('../utils/uploadColumnMap');
const { formatUploadDate }                                    = require('../utils/formatUploadDate');
const { dedupeWithinFile, loadExistingCatalogFingerprints, filterExistingInCatalog } = require('../utils/filterDuplicateUploadRows');

// ─── Logging ─────────────────────────────────────────────────────────────────

const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

function log(level, message, data) {
  const entry = { timestamp: new Date().toISOString(), level, message, ...(data ? { data } : {}) };
  const line  = JSON.stringify(entry);
  console.log(line);
  try { fs.appendFileSync(path.join(logsDir, 'gdrive-sync.log'), line + '\n'); } catch { /* non-fatal */ }
}
const info  = (m, d) => log('INFO',  m, d);
const warn  = (m, d) => log('WARN',  m, d);
const error = (m, d) => log('ERROR', m, d);

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_ORDER   = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const MAX_MONTH     = 'MAY';
const MAX_MONTH_IDX = MONTH_ORDER.indexOf(MAX_MONTH); // 4
const MAX_DATE      = new Date('2026-05-31');          // hard row-level date cap
const BATCH_SIZE    = 250;

// ─── Google Auth ──────────────────────────────────────────────────────────────

function getGoogleAuth() {
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON;
  let credentials;
  if (keyJson)       credentials = JSON.parse(keyJson);
  else if (keyPath)  credentials = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  else throw new Error('Set GOOGLE_SERVICE_ACCOUNT_KEY_PATH or GOOGLE_SERVICE_ACCOUNT_KEY_JSON');

  return new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/spreadsheets.readonly',
    ],
  });
}

// ─── Drive helpers ────────────────────────────────────────────────────────────

async function listExcelFiles(drive, folderId) {
  const res = await drive.files.list({
    q: `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id,name,modifiedTime,mimeType,size)',
    orderBy: 'modifiedTime desc',
    pageSize: 50,
  });
  return (res.data.files || []).filter(f =>
    /\.(xlsx|xls)$/i.test(f.name) ||
    f.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    f.mimeType === 'application/vnd.ms-excel' ||
    f.mimeType === 'application/vnd.google-apps.spreadsheet'
  );
}

function fileMonthIndex(fileName) {
  const upper = fileName.toUpperCase();
  for (let i = 0; i < MONTH_ORDER.length; i++) {
    if (upper.includes(MONTH_ORDER[i])) return i;
  }
  return -1;
}

function pickLatestFile(files) {
  if (!files.length) return null;

  // Only allow files up to MAX_MONTH
  const allowed = files.filter(f => {
    const idx = fileMonthIndex(f.name);
    return idx === -1 || idx <= MAX_MONTH_IDX;
  });

  if (!allowed.length) {
    warn('All files are beyond the MAX_MONTH cap — nothing to sync');
    return null;
  }

  // Prefer file matching current month (capped at MAY)
  const currentMonthIdx = Math.min(new Date().getMonth(), MAX_MONTH_IDX);
  const currentMonth    = MONTH_ORDER[currentMonthIdx];
  const monthMatch = allowed.find(f => f.name.toUpperCase().includes(currentMonth));
  return monthMatch || allowed[0];
}

// ─── Sheets API helpers ───────────────────────────────────────────────────────

async function getSheetNames(sheets, spreadsheetId) {
  const res = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  });
  return (res.data.sheets || []).map(s => s.properties.title);
}

async function readSheetData(sheets, spreadsheetId, sheetName) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetName,
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });
  return res.data.values || [];
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

function getDbConfig() {
  const envPath = path.join(__dirname, '..', '.env.production');
  const envVars = {};
  try {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq < 0) continue;
      envVars[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
    }
  } catch { /* fall back to process.env */ }

  const get = (k, fb) => envVars[k] ?? process.env[k] ?? fb;
  return {
    server:   get('DB_SERVER',   ''),
    user:     get('DB_USER',     ''),
    password: get('DB_PASSWORD', ''),
    database: get('DB_NAME',     ''),
    port: 1433,
    pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
    options: { encrypt: true, trustServerCertificate: true, connectTimeout: 30000, requestTimeout: 120000 },
  };
}

async function getPool() {
  const pool = new sql.ConnectionPool(getDbConfig());
  await pool.connect();
  return pool;
}

// ─── Sheet processing ─────────────────────────────────────────────────────────

async function processSheetData(pool, sheetName, data) {
  const vendorName = sheetName.trim();

  if (data.length < 2) {
    return { vendorName, rowsInserted: 0, rowsSkipped: 0, rowsFailed: 0, error: 'Sheet has no data rows' };
  }

  const { mapping, missing, priceColumnIndexes } = resolveColumnMapping(data[0]);
  if (missing.length > 0) {
    return { vendorName, rowsInserted: 0, rowsSkipped: 0, rowsFailed: 0, error: `Missing columns: ${missing.join(', ')}` };
  }

  // Parse rows — skip anything after May 31 2026
  const rows = [];
  const invalidDateRows = [];
  let futureRows = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0 || !isDataRow(row, mapping)) continue;

    const parsed = parseRowFromSheet(row, mapping, priceColumnIndexes);
    const date   = formatUploadDate(parsed.date);

    if (!date) { invalidDateRows.push(i + 1); continue; }
    if (new Date(date) > MAX_DATE) { futureRows++; continue; }

    rows.push({ date, eanUpc: parsed.eanUpc, name: parsed.name, itemCode: parsed.itemCode, qty: parsed.qty, price: parsed.price });
  }

  if (futureRows > 0)          info(`Sheet "${sheetName}": skipped ${futureRows} rows after May 31`);
  if (invalidDateRows.length)  warn(`Sheet "${sheetName}": ${invalidDateRows.length} invalid-date rows skipped`);

  if (rows.length === 0) {
    return { vendorName, rowsInserted: 0, rowsSkipped: 0, rowsFailed: 0, error: 'No valid data rows after parsing' };
  }

  // Deduplicate — within file and against existing DB rows
  const { unique: uniqueRows, skippedInFile }    = dedupeWithinFile(rows);
  const existingFingerprints                      = await loadExistingCatalogFingerprints(pool, vendorName);
  const { newRows, skippedExisting }              = filterExistingInCatalog(uniqueRows, existingFingerprints);
  const rowsSkipped                               = skippedInFile + skippedExisting;

  if (newRows.length === 0) {
    return { vendorName, rowsInserted: 0, rowsSkipped, rowsFailed: 0 };
  }

  // Truncate staging table and bulk-insert new rows
  await pool.request().query('TRUNCATE TABLE Upload_Tbl_Products');

  let insertedCount = 0;
  let failedCount   = 0;

  for (let b = 0; b < newRows.length; b += BATCH_SIZE) {
    const batch        = newRows.slice(b, b + BATCH_SIZE);
    const placeholders = batch.map((_, i) => `(@d${i},@e${i},@n${i},@i${i},@q${i},@p${i})`).join(',');
    const req          = pool.request();
    batch.forEach((r, i) => {
      req.input(`d${i}`, sql.NVarChar, r.date);
      req.input(`e${i}`, sql.NVarChar, r.eanUpc);
      req.input(`n${i}`, sql.NVarChar, r.name);
      req.input(`i${i}`, sql.NVarChar, r.itemCode);
      req.input(`q${i}`, sql.NVarChar, r.qty);
      req.input(`p${i}`, sql.NVarChar, r.price);
    });
    try {
      await req.query(`INSERT INTO Upload_Tbl_Products (Date,[EAN/UPC],Name,Item_Code,Qty,Price) VALUES ${placeholders}`);
      insertedCount += batch.length;
    } catch (batchErr) {
      failedCount += batch.length;
      warn(`Batch insert failed for "${vendorName}"`, { error: batchErr.message });
    }
  }

  if (insertedCount === 0) {
    return { vendorName, rowsInserted: 0, rowsSkipped, rowsFailed: failedCount, error: 'All batch inserts failed' };
  }

  // Run stored procedure → moves data to Tbl_Products_Storage + Tbl_Products
  await pool.request()
    .input('Vendor', sql.NVarChar, vendorName)
    .execute('Proc_Upload_Tbl_Products');

  return { vendorName, rowsInserted: insertedCount, rowsSkipped, rowsFailed: failedCount };
}

// ─── Sync state ───────────────────────────────────────────────────────────────

const syncStatePath = path.join(logsDir, 'gdrive-sync-state.json');

function loadSyncState() {
  try { return JSON.parse(fs.readFileSync(syncStatePath, 'utf8')); } catch { return {}; }
}
function saveSyncState(state) {
  fs.writeFileSync(syncStatePath, JSON.stringify(state, null, 2));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function runSync({ force = false } = {}) {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) {
    error('GOOGLE_DRIVE_FOLDER_ID is not set');
    return { success: false, error: 'GOOGLE_DRIVE_FOLDER_ID not configured' };
  }

  const skipSheets = (process.env.SYNC_SHEET_SKIP || 'MASTER')
    .split(',').map(s => s.trim().toUpperCase());

  info('Starting Google Drive sync', { folderId, skipSheets, maxDate: '2026-05-31' });

  let auth, drive, sheets;
  try {
    auth   = getGoogleAuth();
    drive  = google.drive({ version: 'v3', auth });
    sheets = google.sheets({ version: 'v4', auth });
  } catch (authErr) {
    error('Google auth failed', { error: authErr.message });
    return { success: false, error: authErr.message };
  }

  // List files and pick the latest allowed one (up to MAY)
  let files;
  try {
    files = await listExcelFiles(drive, folderId);
  } catch (listErr) {
    error('Failed to list Drive files', { error: listErr.message });
    return { success: false, error: listErr.message };
  }

  if (!files.length) return { success: false, error: 'No Excel files found in folder' };

  const targetFile = pickLatestFile(files);
  if (!targetFile)  return { success: false, error: 'No files within the allowed month range (up to MAY)' };

  info(`Selected: "${targetFile.name}" (modified: ${targetFile.modifiedTime}, size: ${((targetFile.size||0)/1024/1024).toFixed(1)}MB)`, { fileId: targetFile.id });

  // Skip if file unchanged since last sync
  const state = loadSyncState();
  if (!force && state[targetFile.id] === targetFile.modifiedTime) {
    info(`"${targetFile.name}" unchanged since last sync — skipping`);
    return { success: true, skipped: true, reason: 'File unchanged since last sync' };
  }

  const isGoogleSheet = targetFile.mimeType === 'application/vnd.google-apps.spreadsheet';

  // Get sheet names
  let sheetNames;
  try {
    if (isGoogleSheet) {
      sheetNames = await getSheetNames(sheets, targetFile.id);
    } else {
      // Native Excel — download and parse
      const res = await drive.files.get({ fileId: targetFile.id, alt: 'media' }, { responseType: 'arraybuffer' });
      const wb  = XLSX.read(Buffer.from(res.data), { type: 'buffer' });
      sheetNames = wb.SheetNames;
    }
    info(`${sheetNames.length} sheets found`, { sheets: sheetNames });
  } catch (err) {
    error('Failed to read sheet names', { error: err.message });
    return { success: false, error: err.message };
  }

  // Connect to DB
  let pool;
  try {
    pool = await getPool();
    info('Connected to database');
  } catch (dbErr) {
    error('Database connection failed', { error: dbErr.message });
    return { success: false, error: dbErr.message };
  }

  // Process each vendor sheet
  const results = [];
  const sheetsToProcess = sheetNames.filter(n => !skipSheets.includes(n.trim().toUpperCase()));
  info(`Processing ${sheetsToProcess.length} vendor sheets (skipping: ${skipSheets.join(', ')})`);

  for (const sheetName of sheetsToProcess) {
    info(`Processing sheet: "${sheetName}"`);
    try {
      const data = isGoogleSheet
        ? await readSheetData(sheets, targetFile.id, sheetName)
        : []; // native Excel path not needed — all files are GSheets

      const result = await processSheetData(pool, sheetName, data);
      results.push(result);

      if (result.error) warn(`Sheet "${sheetName}" issue`, result);
      else              info(`Sheet "${sheetName}" done`, { inserted: result.rowsInserted, skipped: result.rowsSkipped });
    } catch (sheetErr) {
      error(`Sheet "${sheetName}" failed`, { error: sheetErr.message });
      results.push({ vendorName: sheetName.trim(), rowsInserted: 0, rowsSkipped: 0, rowsFailed: 0, error: sheetErr.message });
    }
  }

  try { await pool.close(); } catch { /* ignore */ }

  // Save sync state so unchanged files are skipped next run
  state[targetFile.id] = targetFile.modifiedTime;
  saveSyncState(state);

  const summary = {
    file:            targetFile.name,
    fileId:          targetFile.id,
    sheetsProcessed: results.length,
    totalInserted:   results.reduce((s, r) => s + r.rowsInserted, 0),
    totalSkipped:    results.reduce((s, r) => s + r.rowsSkipped,  0),
    totalFailed:     results.reduce((s, r) => s + r.rowsFailed,   0),
    sheetsWithErrors: results.filter(r => r.error).length,
    results,
  };

  info('Sync completed', summary);
  return { success: true, ...summary };
}

module.exports = { runSync };
