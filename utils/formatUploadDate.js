/**
 * Normalize Excel / text date values to yyyy-MM-dd for SQL Server date columns.
 * Handles Excel serial numbers (e.g. 46168), MM-DD-YY template format, and Date objects.
 */

function toYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function excelSerialToDate(serial) {
  const n = Number(serial);
  if (!Number.isFinite(n) || n < 1) return null;
  // Excel day 1 = 1899-12-30 in JS UTC (same as SheetJS / orders upload)
  const ms = Math.round((n - 25569) * 86400 * 1000);
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatUploadDate(val) {
  if (val == null || val === '') return '';

  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return toYmd(val);
  }

  if (typeof val === 'number' && Number.isFinite(val)) {
    const fromSerial = excelSerialToDate(val);
    return fromSerial ? toYmd(fromSerial) : '';
  }

  const s = String(val).trim();
  if (!s) return '';

  // Excel serial stored as text (e.g. "46168")
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = parseFloat(s);
    if (n > 1000 && n < 1000000) {
      const fromSerial = excelSerialToDate(n);
      if (fromSerial) return toYmd(fromSerial);
    }
  }

  // Template format: MM-DD-YY or MM/DD/YY
  const shortUs = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (shortUs) {
    const month = parseInt(shortUs[1], 10);
    const day = parseInt(shortUs[2], 10);
    let year = parseInt(shortUs[3], 10);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    const date = new Date(year, month - 1, day);
    if (!Number.isNaN(date.getTime())) return toYmd(date);
  }

  // Already ISO date
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

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
