/**
 * Normalize Excel / text date values to yyyy-MM-dd for SQL Server date columns.
 * Handles:
 *   - DD-MM-YYYY / DD/MM/YYYY  (Google Sheets vendor format, e.g. "01-05-2026" = 1 May 2026)
 *   - MM-DD-YY / MM/DD/YY      (upload template format, e.g. "05-01-26" = 1 May 2026)
 *   - YYYY-MM-DD               (ISO, already correct)
 *   - Excel serial numbers     (e.g. 46168)
 *   - JS Date objects
 */

'use strict';

function toYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function excelSerialToDate(serial) {
  const n = Number(serial);
  if (!Number.isFinite(n) || n < 1) return null;
  const ms = Math.round((n - 25569) * 86400 * 1000);
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatUploadDate(val) {
  if (val == null || val === '') return '';

  // JS Date object
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return toYmd(val);
  }

  // Numeric Excel serial
  if (typeof val === 'number' && Number.isFinite(val)) {
    const d = excelSerialToDate(val);
    return d ? toYmd(d) : '';
  }

  const s = String(val).trim();
  if (!s) return '';

  // Numeric string that looks like an Excel serial (e.g. "46168")
  if (/^\d{4,6}$/.test(s)) {
    const n = parseInt(s, 10);
    if (n > 1000 && n < 1000000) {
      const d = excelSerialToDate(n);
      if (d) return toYmd(d);
    }
  }

  // Already ISO: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD-MM-YYYY or DD/MM/YYYY  (4-digit year at end — Google Sheets vendor format)
  // "01-05-2026" → day=1, month=5, year=2026 → 2026-05-01
  const ddmmyyyy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (ddmmyyyy) {
    const day   = parseInt(ddmmyyyy[1], 10);
    const month = parseInt(ddmmyyyy[2], 10);
    const year  = parseInt(ddmmyyyy[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const d = new Date(year, month - 1, day);
      if (!Number.isNaN(d.getTime())) return toYmd(d);
    }
  }

  // MM-DD-YY or MM/DD/YY  (2-digit year — upload template format)
  // "05-01-26" → month=5, day=1, year=2026 → 2026-05-01
  const mmddyy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2})$/);
  if (mmddyy) {
    const month = parseInt(mmddyy[1], 10);
    const day   = parseInt(mmddyy[2], 10);
    let year    = parseInt(mmddyy[3], 10);
    year += year >= 70 ? 1900 : 2000;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const d = new Date(year, month - 1, day);
      if (!Number.isNaN(d.getTime())) return toYmd(d);
    }
  }

  // Last resort — let JS parse it
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return toYmd(parsed);

  return '';
}

/**
 * Rewrite the first worksheet so Date column cells use yyyy-MM-dd strings.
 */
function normalizeWorkbookDates(workbook, XLSX) {
  const { resolveColumnMapping } = require('./uploadColumnMap');
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (!data.length) return workbook;

  const { mapping } = resolveColumnMapping(data[0]);
  const dateCol = mapping.date;
  if (dateCol < 0) return workbook;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;
    const formatted = formatUploadDate(row[dateCol]);
    if (formatted) row[dateCol] = formatted;
  }

  const newSheet = XLSX.utils.aoa_to_sheet(data);
  workbook.Sheets[sheetName] = newSheet;
  return workbook;
}

module.exports = { formatUploadDate, normalizeWorkbookDates, excelSerialToDate };
