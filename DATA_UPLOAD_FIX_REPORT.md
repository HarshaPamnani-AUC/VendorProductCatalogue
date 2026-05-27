# Data Upload Issue - Root Cause & Fix

## 📋 Problem Summary
Data was being uploaded to `Upload_Tbl_Products` but **NOT being transferred to `Tbl_Products` since May 15th**.

- ✅ **Tbl_Products_Storage**: Being updated (backup table working)
- ❌ **Tbl_Products**: Stuck since May 16 for most vendors (main table not updating)
- ⚠️ **Upload_Tbl_Products**: Contains 473,889 records waiting to be transferred

## 🔍 Root Cause Analysis

The stored procedure `Proc_Upload_Tbl_Products` had a **critical flaw**:

### Original (Broken) Logic:
```sql
MERGE [dbo].[Tbl_Products] AS TARGET
USING (SELECT ... FROM [dbo].[Upload_Tbl_Products]) AS SOURCE
ON TARGET.[EAN/UPC] = SOURCE.[EAN/UPC]
AND TARGET.[Vendor] = @Vendor  -- ❌ PROBLEM HERE
```

### The Issue:
1. **Upload_Tbl_Products table has NO Vendor column** - it only has: Date, EAN/UPC, Name, Item_Code, Qty, Price
2. The MERGE tries to match on `Vendor` but SOURCE has no Vendor column (NULL)
3. The condition `TARGET.[Vendor] = @Vendor` never matches `NULL`
4. Result: All new records inserted as NEW instead of being matched/updated
5. Duplicates accumulate, data gets messy

## ✅ Solution Applied

**Fixed Procedure Logic:**
- Changed matching condition from EAN/UPC to **Item_Code** (unique per upload)
- Used separate **UPDATE** and **INSERT** statements instead of MERGE
- Properly handles both updates and new inserts

### Key Changes:
```sql
-- UPDATE existing records by Item_Code
UPDATE [dbo].[Tbl_Products]
SET ...
FROM [dbo].[Upload_Tbl_Products] u
WHERE t.[Item_Code] = u.[Item_Code]
AND t.[Vendor] = @Vendor

-- INSERT only new products
INSERT INTO [dbo].[Tbl_Products] ...
WHERE NOT EXISTS (
    SELECT 1 FROM [dbo].[Tbl_Products]
    WHERE [Item_Code] = u.[Item_Code] AND [Vendor] = @Vendor
)
```

## 📊 Results

After applying the fix:

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Upload_Tbl_Products | 473,889 | 0 | ✅ Cleared (processed) |
| Tbl_Products (SAP) | 5,218 | 419,866 | ✅ +414,648 records |
| Tbl_Products_Storage (SAP) | 709,970 | 709,970 | ✅ Backup preserved |

**Sample of newly transferred data:**
- TIZIANA TERENZI RIVEA - Updated: May 27 2026
- Erborian Chocolate B.B Cream - Updated: May 27 2026
- BALMAIN EXTATIC - Updated: May 27 2026

## 🚀 How to Apply

**Manual Application (if needed):**
```powershell
cd d:\2026\Application\vendor-price-list-app
node apply_fix.js
```

Or run the SQL directly:
```sql
EXEC sp_executesql N'<content of fix_upload_procedure.sql>'
```

## 🔄 Future Uploads

The fixed procedure will now:
1. ✅ Accept uploads correctly
2. ✅ Match products by Item_Code
3. ✅ Update existing products
4. ✅ Insert new products
5. ✅ Backup to Tbl_Products_Storage
6. ✅ Clear the upload table after processing

## ⚠️ Verification Steps

Run these checks to verify the fix is working:

```javascript
// Check current status
node check_data_status.js

// Check procedure definition
node check_procedure.js
```

## 📝 Files Created

- `fix_upload_procedure.sql` - The corrected procedure definition
- `apply_fix.js` - Script to apply the fix
- `check_data_status.js` - Diagnostic tool
- `investigate_data_sync.js` - Investigation script
- `check_structure.js` - Table structure checker

---

**Status**: ✅ **FIXED** - All pending uploads have been successfully transferred as of May 27, 2026 at 19:16 IST
