# Currency Support Implementation Guide

**Date**: June 3, 2026  
**Status**: ✅ Implementation Complete  

---

## Overview

This document explains how multi-currency support has been added to VendorPro to correctly handle supplier prices in their native currencies (USD, EUR, GBP, etc.) instead of converting everything to dollars.

---

## The Problem

Previously, all supplier prices were stored as USD regardless of the supplier's actual currency:
- UK suppliers (GBP) were stored as USD
- European suppliers (EUR) were stored as USD
- This caused incorrect pricing comparisons and currency conversion errors

---

## The Solution

### 1. Database Changes

Added `Currency` column to key tables:

| Table | New Column | Purpose |
|-------|-----------|---------|
| `Vendors` | `Currency` (NVARCHAR(3)) | Default currency for supplier |
| `Products` | `Currency` (NVARCHAR(3)) | Currency of individual product price |
| `Tbl_Products` | `Currency` (NVARCHAR(3)) | Current catalog prices in original currency |
| `Tbl_Products_Storage` | `Currency` (NVARCHAR(3)) | Historical prices in original currency |
| `Upload_Tbl_Products` | `Currency` (NVARCHAR(3)) | Staging table with currency info |
| `VendorColumnMappings` | `CurrencyColumn` (NVARCHAR(100)) | If supplier file includes currency column |

**Migration File**: [scripts/02-add-currency-support.sql](scripts/02-add-currency-support.sql)

### 2. Vendor Currency Mapping

**File**: [VENDOR_CURRENCIES.js](VENDOR_CURRENCIES.js)

Predefined currencies for all 50+ suppliers based on location:

```javascript
// Examples:
'ET Perfumes Inc.' → USD
'Partheco International' → EUR
'Global Beauty Supplies' → USD
'Premium Imports Ltd' → GBP
```

**Supported Currencies**:
- `USD` - US Dollar (default)
- `EUR` - Euro
- `GBP` - British Pound
- `JPY` - Japanese Yen
- `AUD` - Australian Dollar
- `CAD` - Canadian Dollar
- `CHF` - Swiss Franc
- `CNY` - Chinese Yuan
- `INR` - Indian Rupee

### 3. Setup Process

Run the automated setup script:

```bash
cd /var/www/vendorpro.beautystorellc.com
node SETUP_CURRENCY_SUPPORT.js
```

This script:
✅ Runs SQL migration (adds currency columns)  
✅ Updates all vendors with mapped currencies  
✅ Updates existing products with vendor currencies  
✅ Verifies changes and logs results  

**Log Location**: `logs/currency-setup.log`

---

## API Endpoints

### Update Vendor Currency

```bash
PATCH /api/vendors/:vendorId/currency
Content-Type: application/json

{
  "currency": "GBP"
}
```

**Response**:
```json
{
  "message": "Vendor currency updated successfully",
  "vendorId": 5,
  "currency": "GBP"
}
```

### Get Vendor with Currency

```bash
GET /api/vendors/:vendorId
```

**Response**:
```json
{
  "VendorId": 5,
  "VendorName": "Premium Imports Ltd",
  "VendorCode": "PREMIUM_IMP",
  "Currency": "GBP",
  "Country": "United Kingdom",
  ...
}
```

### Get All Vendors (List View)

```bash
GET /api/vendors/list
```

**Response**:
```json
[
  {
    "VendorId": 1,
    "VendorName": "ET Perfumes Inc.",
    "Currency": "USD"
  },
  {
    "VendorId": 5,
    "VendorName": "Premium Imports Ltd",
    "Currency": "GBP"
  },
  ...
]
```

### Configure Vendor Column Mapping

If a vendor's Excel file includes a Currency column:

```bash
POST /api/vendors/:vendorId/column-mapping
Content-Type: application/json

{
  "productCodeColumn": "PRODUCT#",
  "productNameColumn": "ITEM DESCRIPTION",
  "priceColumn": "PRICE",
  "currencyColumn": "CURRENCY",
  "stockQuantityColumn": "QTY AVAIL QTY",
  "upcColumn": "UPC",
  "skipHeaderRows": 11
}
```

---

## Upload Process with Currency

### Scenario 1: Supplier File WITHOUT Currency Column

The system uses the vendor's **default currency** from the Vendors table:

```
1. User uploads Excel file
   ↓
2. System reads vendor's Currency (e.g., GBP)
   ↓
3. All prices automatically tagged with GBP
   ↓
4. Products stored with: Price=25.99, Currency=GBP
```

### Scenario 2: Supplier File WITH Currency Column

If the supplier includes a Currency column in their file:

```
1. User uploads Excel with prices + Currency column
   ↓
2. System reads Currency from each row
   ↓
3. Falls back to vendor default if cell is empty
   ↓
4. Each product preserves its currency
```

**Example File Structure**:
```
Date | EAN/UPC | Name | Item_Code | Qty | Price | Currency
2026-06-01 | 123456789 | Test Product | SKU001 | 100 | 25.99 | GBP
2026-06-01 | 987654321 | Another Product | SKU002 | 50 | 30.50 | GBP
```

---

## Product Display with Currency

### Price History API with Currency

```bash
GET /api/price-history?query=fragrance&from=2026-01-01&to=2026-06-03
```

**Response** (includes currency):
```json
{
  "data": [
    {
      "upc": "123456789",
      "productName": "Premium Fragrance",
      "vendor": "Partheco",
      "currency": "EUR",
      "history": [
        { "date": "2026-01-15", "price": 45.99, "qty": 200 },
        { "date": "2026-03-20", "price": 48.50, "qty": 180 },
        { "date": "2026-06-01", "price": 52.00, "qty": 150 }
      ]
    }
  ]
}
```

### Product Insights with Currency

```bash
GET /api/product-insights?upcCode=123456789
```

**Response**:
```json
{
  "productCode": "SKU001",
  "productName": "Premium Fragrance",
  "brand": "Luxury Brand",
  "vendors": [
    {
      "vendorName": "Partheco",
      "price": 52.00,
      "currency": "EUR",
      "quantity": 150
    },
    {
      "vendorName": "ET Perfumes",
      "price": 55.99,
      "currency": "USD",
      "quantity": 200
    }
  ]
}
```

---

## Frontend Display

### Example: Show Price with Currency

```javascript
import { formatPrice } from './VENDOR_CURRENCIES';

// Format prices for display
<div>
  {formatPrice(52.00, 'EUR')}  → "€52.00"
  {formatPrice(55.99, 'USD')}  → "$55.99"
  {formatPrice(25.99, 'GBP')}  → "£25.99"
</div>
```

### Compare Prices Across Currencies

```javascript
import { convertCurrency } from './VENDOR_CURRENCIES';

// Convert all prices to USD for comparison
const partheco_usd = convertCurrency(52.00, 'EUR', 'USD');
const etperfumes_usd = convertCurrency(55.99, 'USD', 'USD');

// Now prices are comparable
console.log(`Partheco (in USD): $${partheco_usd.toFixed(2)}`);
console.log(`ET Perfumes (in USD): $${etperfumes_usd.toFixed(2)}`);
```

---

## Correcting Existing Data

### Check Current Currency Status

```bash
# Connect to MSSQL
sqlcmd -S 172.30.36.124 -U sa -P <password> -d ProductCatalog

# Check vendors
SELECT VendorName, Currency FROM Vendors ORDER BY VendorName;

# Check products
SELECT Currency, COUNT(*) as ProductCount 
FROM Tbl_Products 
GROUP BY Currency;

# Check for NULL currencies
SELECT COUNT(*) as NullCurrencyCount 
FROM Tbl_Products 
WHERE Currency IS NULL;
```

### Manual Currency Updates

If a vendor's currency needs to be corrected:

```bash
# Via API
curl -X PATCH http://localhost:3000/api/vendors/5/currency \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"currency": "GBP"}'

# Or via SQL
UPDATE Vendors SET Currency = 'GBP' WHERE VendorName = 'Premium Imports Ltd';
UPDATE Products SET Currency = 'GBP' WHERE VendorId = 5;
UPDATE Tbl_Products SET Currency = 'GBP' WHERE Vendor = 'Premium Imports Ltd';
```

---

## Order Management with Currency

All 5 order tables track currency:
- `LLP_Orders`
- `VW360_Orders`
- `BSLLC_Orders`
- `BM_Orders`
- `BCGGB_Orders`

When creating an order:
```json
{
  "product": "SKU001",
  "quantity": 100,
  "unitPrice": 52.00,
  "currency": "EUR",
  "totalPrice": 5200.00
}
```

---

## Exchange Rate Management

### CurrencyRates Table

For future dynamic exchange rate tracking:

```sql
SELECT * FROM CurrencyRates
WHERE FromCurrency = 'EUR' AND ToCurrency = 'USD'
ORDER BY EffectiveDate DESC;
```

**Structure**:
```
RateId | FromCurrency | ToCurrency | Rate | EffectiveDate
1 | EUR | USD | 1.0870 | 2026-06-03
2 | GBP | USD | 1.2658 | 2026-06-03
3 | EUR | GBP | 0.8590 | 2026-06-03
```

---

## Migration Checklist

- [x] Add Currency columns to all tables
- [x] Create vendor currency mapping (VENDOR_CURRENCIES.js)
- [x] Update Vendors API to accept currency
- [x] Update upload processing to use vendor currency
- [x] Create setup script (SETUP_CURRENCY_SUPPORT.js)
- [x] Update vendor routes with PATCH /currency endpoint
- [x] Add CurrencyColumn to VendorColumnMappings
- [ ] Update frontend components to display currency symbols
- [ ] Update order creation UI to show currency
- [ ] Create exchange rate API endpoint (optional)
- [ ] Add currency conversion to dashboards (optional)

---

## Testing

### Test Upload with Currency

1. Create a vendor with specific currency:
```bash
POST /api/vendors
{
  "vendorName": "Test Vendor UK",
  "vendorCode": "TEST_UK",
  "currency": "GBP"
}
```

2. Upload Excel file - verify prices are tagged with GBP

3. Query products:
```bash
GET /api/product-insights?productName=test
```

4. Verify response includes `"currency": "GBP"`

---

## FAQs

**Q: What if a vendor's currency is not in the list?**  
A: Contact support to add the currency code. Valid ISO 4217 codes can be added to CURRENCY_INFO.

**Q: How do I compare prices across different currencies?**  
A: Use `convertCurrency()` function to convert all prices to a common currency (e.g., USD).

**Q: Should I update historical data with currencies?**  
A: Yes! Run the setup script to backfill all existing products with vendor currencies.

**Q: Does the system support real-time exchange rates?**  
A: Currently uses static rates. The CurrencyRates table is ready for dynamic rates in future.

---

## Support

**For issues or questions:**
1. Check `logs/currency-setup.log` for setup errors
2. Query `CurrencyRates` and `Vendors` tables directly
3. Use PATCH `/api/vendors/:vendorId/currency` to correct currencies

---

## Next Steps

1. ✅ Run `node SETUP_CURRENCY_SUPPORT.js`
2. ✅ Verify vendor currencies: `SELECT * FROM Vendors`
3. ✅ Test upload with a UK vendor (should show GBP)
4. ⏳ Update dashboard UI to display currency symbols
5. ⏳ Add currency conversion utilities to frontend
6. ⏳ Create exchange rate updates (manual or automated)
