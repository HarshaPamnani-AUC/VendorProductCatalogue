/**
 * VENDOR_CURRENCIES.js
 * Maps vendors to their default currencies and provides utilities
 * Based on supplier location and pricing practices
 * 
 * Generated: June 3, 2026
 */

const VENDOR_CURRENCIES = {
  // ========== USD SUPPLIERS ==========
  'ACE BEAUTY': 'USD',
  'AL HUSSEIN': 'USD',
  'AVENUE': 'USD',
  'BEAUTYYNET': 'USD',
  'API CHURI': 'USD',
  'EFL': 'USD',
  'ET': 'USD',
  'FRAGSENSE': 'USD',
  'FRENCH PERFUMES': 'USD',
  'H&B': 'USD',
  'HAZ': 'USD',
  'JIZAN': 'USD',
  'LINDO': 'USD',
  'LUX AMERICA': 'USD',
  'MAGNET': 'USD',
  'MB (EGDOG)': 'USD',
  'MTZ': 'USD',
  'NANDANSONS': 'USD',
  'NEFERTI': 'USD',
  'PCA': 'USD',
  'PERFUME PRICE': 'USD',
  'POTW': 'USD',
  'PPW': 'USD',
  'RATAN': 'USD',
  'SAP': 'USD',
  'SATURN': 'USD',
  'SCENT SENSES': 'USD',
  'SCENTE OPHORIA': 'USD',
  'SFM': 'USD',
  'SIMEX': 'USD',
  'SUSHMA': 'USD',
  'TITAN': 'USD',
  'US': 'USD',
  'UNIVERSAL PERFUME': 'USD',

  // ========== EURO (EUR) SUPPLIERS ==========
  'BEAUTYNET': 'EUR',
  'DTF (ELLE)': 'EUR',
  'FORMA-ITALIANA': 'EUR',
  'PARTHECO': 'EUR',
  'SIMEX - EURO': 'EUR',

  // ========== GBP SUPPLIERS ==========
  'AFL': 'GBP',
  'LUXSCENT': 'GBP',
  'SGL': 'GBP',
};

/**
 * Get default currency for a vendor
 * @param {string} vendorName - Vendor name or code
 * @returns {string} Currency code (USD, EUR, GBP, etc.) or 'USD' as default
 */
function getVendorCurrency(vendorName) {
  if (!vendorName) return 'USD';
  
  const normalized = vendorName.toUpperCase().trim();
  return VENDOR_CURRENCIES[normalized] || 'USD';
}

/**
 * Get all vendors grouped by currency
 * @returns {object} Object with currency codes as keys, array of vendors as values
 */
function getVendorsByCurrency() {
  const grouped = {};
  
  for (const [vendor, currency] of Object.entries(VENDOR_CURRENCIES)) {
    if (!grouped[currency]) {
      grouped[currency] = [];
    }
    grouped[currency].push(vendor);
  }
  
  return grouped;
}

/**
 * Supported currencies with their symbols
 */
const CURRENCY_INFO = {
  'USD': { symbol: '$', name: 'US Dollar', rate: 1.0 },
  'EUR': { symbol: '€', name: 'Euro', rate: 0.92 }, // Approximate as of June 2026
  'GBP': { symbol: '£', name: 'British Pound', rate: 0.79 }, // Approximate as of June 2026
};

/**
 * Convert price from one currency to another (simple)
 * Note: This uses hardcoded rates. For production, fetch from CurrencyRates table
 * @param {number} amount - Price amount
 * @param {string} fromCurrency - Source currency code
 * @param {string} toCurrency - Target currency code
 * @returns {number} Converted amount
 */
function convertCurrency(amount, fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) return amount;
  
  const fromRate = CURRENCY_INFO[fromCurrency]?.rate || 1.0;
  const toRate = CURRENCY_INFO[toCurrency]?.rate || 1.0;
  
  // Convert to base (USD), then to target
  const inUSD = amount / fromRate;
  return inUSD * toRate;
}

/**
 * Format price with currency symbol
 * @param {number} amount - Price amount
 * @param {string} currency - Currency code
 * @returns {string} Formatted price string
 */
function formatPrice(amount, currency = 'USD') {
  const symbol = CURRENCY_INFO[currency]?.symbol || '$';
  return `${symbol}${amount.toFixed(2)}`;
}

/**
 * Summary statistics
 */
const STATISTICS = {
  totalVendors: Object.keys(VENDOR_CURRENCIES).length,
  usdCount: Object.values(VENDOR_CURRENCIES).filter(c => c === 'USD').length,
  eurCount: Object.values(VENDOR_CURRENCIES).filter(c => c === 'EUR').length,
  gbpCount: Object.values(VENDOR_CURRENCIES).filter(c => c === 'GBP').length,
};

module.exports = {
  VENDOR_CURRENCIES,
  CURRENCY_INFO,
  getVendorCurrency,
  getVendorsByCurrency,
  convertCurrency,
  formatPrice,
  STATISTICS,
};
