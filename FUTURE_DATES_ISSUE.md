# Future-Dated Records Issue

## 📊 Current Situation

| Metric | Count | Status |
|--------|-------|--------|
| **2028 Records** | 30,219 | ❌ All from SAP (Feb 5, 2028) |
| **2027 Records** | 206,349 | ⚠️ May be valid or test data |
| **2026 Records** | 275,294 | ✅ Valid current data |

## 🔍 Analysis

### 2028 Data (SAP Vendor)
- **All 30,219 records** have the exact same date: **February 5, 2028**
- This is clearly an **upload error from SAP's Excel file**
- Examples:
  - HUGO BOSS BOSS MAN - Feb 5, 2028
  - CALVIN KLEIN CK FREE - Feb 5, 2028
  - DAVIDOFF COOL WATER - Feb 5, 2028

### 2027 Data
- 206,349 records from various vendors
- Date range: January 5, 2027 to October 5, 2027
- Could be historical data or test data

## 🛠️ Cleanup Options

### Option 1: Remove 2028 Data (RECOMMENDED)
**Best for**: Corrupted data that should not be in the system

```sql
DELETE FROM [dbo].[Tbl_Products]
WHERE Vendor = 'SAP' AND YEAR([Date]) = 2028;
-- This will delete 30,219 invalid records
```

### Option 2: Correct 2028 Dates to Today (May 27, 2026)
**Best for**: If these are actual current products with wrong date entry

```sql
UPDATE [dbo].[Tbl_Products]
SET [Date] = '2026-05-27'
WHERE Vendor = 'SAP' AND YEAR([Date]) = 2028;
-- Updates all to today's date
```

### Option 3: Delete and Re-Upload from SAP
**Best for**: Ensuring data integrity

1. Delete all SAP records: `DELETE FROM [dbo].[Tbl_Products] WHERE Vendor = 'SAP'`
2. Ask SAP vendor to correct their Excel file
3. Re-upload with correct dates

## 🔄 What You Should Do

1. **Ask SAP vendor**: Why are the dates February 5, 2028?
   - Is this test data?
   - Wrong file?
   - System error?

2. **Decide on action**:
   - If test data → **Delete it** (Option 1)
   - If real products with wrong date → **Correct the dates** (Option 2)
   - If unsure → **Keep a backup first**, then clean

3. **Check 2027 data**: 
   - Determine if 206,349 records from 2027 are valid or also need cleanup

## 📋 Recommended Action

### For Immediate Issue (2028 data):
```javascript
// Delete the 2028 records
DELETE FROM [dbo].[Tbl_Products]
WHERE YEAR([Date]) = 2028 AND Vendor = 'SAP';

// Verify deletion
SELECT COUNT(*) FROM [dbo].[Tbl_Products] WHERE YEAR([Date]) = 2028;
-- Should return 0
```

### For 2027 Data:
- Review with product manager
- Determine if this is valid historical data or should be cleaned

## 🔐 Prevention

1. **Add date validation** to upload process:
   - Reject dates > current year
   - Warn for dates < previous year
   - Auto-correct obvious errors

2. **Data quality checks**:
   - Check for duplicate dates (all 30K records on same date = suspicious)
   - Validate date format before inserting

3. **Vendor communication**:
   - Provide date format guidelines
   - Show examples of valid uploads

---

**Status**: Awaiting your decision on cleanup approach
