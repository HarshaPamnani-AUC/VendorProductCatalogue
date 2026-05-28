/**
 * Map vendor Excel headers to upload fields.
 * Supports template format and extended sheets (SUPPLIER, PRICE IN GBP, etc.).
 */

const CANONICAL = {
  date: ['date'],
  eanUpc: ['ean/upc', 'ean / upc', 'eanupc', 'ean upc', 'ean-upc', 'upc/ean', 'upc'],
  name: ['name', 'product name', 'productname', 'description'],
  itemCode: ['item_code', 'item code', 'itemcode', 'nav', 'product code', 'sku'],
  qty: ['qty', 'quantity', 'stock', 'stock qty', 'order qty'],
  price: ['price', 'unit price', 'cost'],
  priceGbp: ['price in gbp', 'price gbp', 'gbp', 'price (£)', 'price(£)'],
  priceEuro: ['price in euro', 'price euro', 'price in eur', 'eur', 'euro'],
  priceUsd: ['price in usd', 'price usd', 'usd', 'dollar'],
  supplier: ['supplier', 'vendor'],
};

function normalizeHeader(header) {
  return String(header ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, ' ')
    .replace(/[_]+/g, ' ');
}

function findColumnIndex(headers, aliases) {
  const normalized = headers.map((h, i) => ({ i, key: normalizeHeader(h) }));
  for (const alias of aliases) {
    const hit = normalized.find((h) => h.key === alias);
    if (hit) return hit.i;
  }
  return -1;
}

/**
 * @param {unknown[]} headerRow - first row from Excel
 * @returns {{ mapping, displayHeaders, missing, priceColumnIndexes }}
 */
function resolveColumnMapping(headerRow) {
  const headers = headerRow.map((h) => String(h ?? '').trim());
  const displayHeaders = headers.filter(Boolean);

  const mapping = {
    date: findColumnIndex(headers, CANONICAL.date),
    eanUpc: findColumnIndex(headers, CANONICAL.eanUpc),
    name: findColumnIndex(headers, CANONICAL.name),
    itemCode: findColumnIndex(headers, CANONICAL.itemCode),
    qty: findColumnIndex(headers, CANONICAL.qty),
    supplier: findColumnIndex(headers, CANONICAL.supplier),
  };

  const priceColumnIndexes = [];
  const priceGbp = findColumnIndex(headers, CANONICAL.priceGbp);
  const priceEuro = findColumnIndex(headers, CANONICAL.priceEuro);
  const priceUsd = findColumnIndex(headers, CANONICAL.priceUsd);
  const priceGeneric = findColumnIndex(headers, CANONICAL.price);

  if (priceGbp >= 0) priceColumnIndexes.push(priceGbp);
  if (priceEuro >= 0) priceColumnIndexes.push(priceEuro);
  if (priceUsd >= 0) priceColumnIndexes.push(priceUsd);
  if (priceGeneric >= 0 && !priceColumnIndexes.includes(priceGeneric)) {
    priceColumnIndexes.push(priceGeneric);
  }

  const required = ['date', 'eanUpc', 'name', 'itemCode', 'qty'];
  const missing = required.filter((field) => mapping[field] < 0);
  if (priceColumnIndexes.length === 0) {
    missing.push('price');
  }

  return { mapping, displayHeaders, missing, priceColumnIndexes };
}

function getCell(row, index) {
  if (index < 0 || index == null) return '';
  const val = row[index];
  return val == null ? '' : val;
}

function pickPrice(row, priceColumnIndexes) {
  for (const idx of priceColumnIndexes) {
    const val = String(getCell(row, idx)).trim();
    if (val) return val;
  }
  return '';
}

function isDataRow(row, mapping) {
  const item = String(getCell(row, mapping.itemCode)).trim();
  const name = String(getCell(row, mapping.name)).trim();
  const ean = String(getCell(row, mapping.eanUpc)).trim();
  return !!(item || name || ean);
}

function parseRowFromSheet(row, mapping, priceColumnIndexes) {
  return {
    date: getCell(row, mapping.date),
    eanUpc: String(getCell(row, mapping.eanUpc)),
    name: String(getCell(row, mapping.name)),
    itemCode: String(getCell(row, mapping.itemCode)),
    qty: String(getCell(row, mapping.qty)),
    price: pickPrice(row, priceColumnIndexes),
    supplier: String(getCell(row, mapping.supplier)),
  };
}

const SUPPORTED_FORMAT_HELP =
  'Supported columns: DATE, EAN/UPC (or EAN/ UPC), NAME, ITEM CODE (or Item_Code), QTY, and PRICE (or PRICE IN GBP / EURO / USD). SUPPLIER is optional (vendor is chosen in the app).';

module.exports = {
  resolveColumnMapping,
  parseRowFromSheet,
  isDataRow,
  pickPrice,
  SUPPORTED_FORMAT_HELP,
};
