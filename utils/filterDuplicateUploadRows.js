const sql = require('mssql');
const { formatUploadDate } = require('./formatUploadDate');

const FIELD_SEP = '\x1f';

function normalizeText(val) {
  return String(val ?? '').trim().toLowerCase();
}

function normalizePrice(val) {
  return String(val ?? '')
    .replace(/[$,\s]/g, '')
    .trim()
    .toLowerCase();
}

function normalizeQty(val) {
  const s = String(val ?? '').replace(/,/g, '').trim();
  const n = parseFloat(s);
  if (!Number.isNaN(n) && s !== '') return String(n);
  return normalizeText(val);
}

function normalizeRowDate(val) {
  const formatted = formatUploadDate(val);
  if (formatted) return formatted;
  return normalizeText(val);
}

/**
 * Fingerprint when every column matches: Date, EAN/UPC, Name, Item_Code, Qty, Price.
 */
function rowFingerprint(row) {
  return [
    normalizeRowDate(row.date),
    normalizeText(row.eanUpc),
    normalizeText(row.name),
    normalizeText(row.itemCode),
    normalizeQty(row.qty),
    normalizePrice(row.price),
  ].join(FIELD_SEP);
}

function catalogRecordFingerprint(record) {
  return rowFingerprint({
    date: record.Date,
    eanUpc: record['EAN/UPC'],
    name: record.Name,
    itemCode: record.Item_Code,
    qty: record.Qty,
    price: record.Price,
  });
}

/**
 * Keep first occurrence of each fully identical row in the file.
 */
function dedupeWithinFile(rows) {
  const seen = new Set();
  const unique = [];
  let skippedInFile = 0;

  for (const row of rows) {
    const key = rowFingerprint(row);
    if (seen.has(key)) {
      skippedInFile++;
      continue;
    }
    seen.add(key);
    unique.push(row);
  }

  return { unique, skippedInFile };
}

/**
 * Load full-row fingerprints already in Tbl_Products for this vendor.
 */
async function loadExistingCatalogFingerprints(pool, vendorName) {
  const result = await pool
    .request()
    .input('vendor', sql.NVarChar, vendorName)
    .query(`
      SELECT [Date], [EAN/UPC], [Name], [Item_Code], [Qty], [Price]
      FROM [dbo].[Tbl_Products]
      WHERE [Vendor] = @vendor
    `);

  const fingerprints = new Set();
  for (const record of result.recordset) {
    fingerprints.add(catalogRecordFingerprint(record));
  }
  return fingerprints;
}

/**
 * Remove rows that exactly match an existing catalog row (all fields) for this vendor.
 */
function filterExistingInCatalog(rows, existingFingerprints) {
  const newRows = [];
  let skippedExisting = 0;

  for (const row of rows) {
    if (existingFingerprints.has(rowFingerprint(row))) {
      skippedExisting++;
      continue;
    }
    newRows.push(row);
  }

  return { newRows, skippedExisting };
}

module.exports = {
  rowFingerprint,
  dedupeWithinFile,
  loadExistingCatalogFingerprints,
  filterExistingInCatalog,
};
