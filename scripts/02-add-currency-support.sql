-- ============================================================
-- Add Currency Support to VendorPro
-- Migration Script - Run this after initial schema creation
-- ============================================================

-- Step 1: Add Currency column to Vendors table
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'Vendors' AND COLUMN_NAME = 'Currency'
)
BEGIN
    ALTER TABLE [dbo].[Vendors]
    ADD [Currency] NVARCHAR(3) DEFAULT 'USD' NOT NULL;
    
    PRINT 'Added Currency column to Vendors table';
END
ELSE
BEGIN
    PRINT 'Currency column already exists in Vendors table';
END
GO

-- Step 2: Add Currency column to Products table (if it exists)
IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Products')
BEGIN
    IF NOT EXISTS (
        SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'Products' AND COLUMN_NAME = 'Currency'
    )
    BEGIN
        ALTER TABLE [dbo].[Products]
        ADD [Currency] NVARCHAR(3) DEFAULT 'USD' NOT NULL;
        
        PRINT 'Added Currency column to Products table';
    END
    ELSE
    BEGIN
        PRINT 'Currency column already exists in Products table';
    END
END
ELSE
BEGIN
    PRINT 'Products table does not exist (skipped)';
END
GO

-- Step 3: Add Currency column to Tbl_Products (current catalog)
IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Tbl_Products')
BEGIN
    IF NOT EXISTS (
        SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'Tbl_Products' AND COLUMN_NAME = 'Currency'
    )
    BEGIN
        ALTER TABLE [dbo].[Tbl_Products]
        ADD [Currency] NVARCHAR(3) DEFAULT 'USD' NOT NULL;
        
        PRINT 'Added Currency column to Tbl_Products table';
    END
    ELSE
    BEGIN
        PRINT 'Currency column already exists in Tbl_Products table';
    END
END
ELSE
BEGIN
    PRINT 'Tbl_Products table does not exist (skipped)';
END
GO

-- Step 4: Add Currency column to Tbl_Products_Storage (historical)
IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Tbl_Products_Storage')
BEGIN
    IF NOT EXISTS (
        SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'Tbl_Products_Storage' AND COLUMN_NAME = 'Currency'
    )
    BEGIN
        ALTER TABLE [dbo].[Tbl_Products_Storage]
        ADD [Currency] NVARCHAR(3) DEFAULT 'USD' NOT NULL;
        
        PRINT 'Added Currency column to Tbl_Products_Storage table';
    END
    ELSE
    BEGIN
        PRINT 'Currency column already exists in Tbl_Products_Storage table';
    END
END
ELSE
BEGIN
    PRINT 'Tbl_Products_Storage table does not exist (skipped)';
END
GO

-- Step 5: Add Currency column to Upload_Tbl_Products (staging)
IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Upload_Tbl_Products')
BEGIN
    IF NOT EXISTS (
        SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'Upload_Tbl_Products' AND COLUMN_NAME = 'Currency'
    )
    BEGIN
        ALTER TABLE [dbo].[Upload_Tbl_Products]
        ADD [Currency] NVARCHAR(3) DEFAULT 'USD' NOT NULL;
        
        PRINT 'Added Currency column to Upload_Tbl_Products table';
    END
    ELSE
    BEGIN
        PRINT 'Currency column already exists in Upload_Tbl_Products table';
    END
END
ELSE
BEGIN
    PRINT 'Upload_Tbl_Products table does not exist (skipped)';
END
GO

-- Step 6: Add Currency column to VendorColumnMappings
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'VendorColumnMappings' AND COLUMN_NAME = 'CurrencyColumn'
)
BEGIN
    ALTER TABLE [dbo].[VendorColumnMappings]
    ADD [CurrencyColumn] NVARCHAR(100) NULL;
    
    PRINT 'Added CurrencyColumn to VendorColumnMappings table';
END
ELSE
BEGIN
    PRINT 'CurrencyColumn already exists in VendorColumnMappings table';
END
GO

-- Step 7: Add Currency column to FileUploads (if not exists)
IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'FileUploads')
BEGIN
    IF NOT EXISTS (
        SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'FileUploads' AND COLUMN_NAME = 'Currency'
    )
    BEGIN
        ALTER TABLE [dbo].[FileUploads]
        ADD [Currency] NVARCHAR(3) NULL;
        
        PRINT 'Added Currency column to FileUploads table';
    END
    ELSE
    BEGIN
        PRINT 'Currency column already exists in FileUploads table';
    END
END
GO

-- Step 8: Update vendor currencies based on location
-- USA vendors = USD
UPDATE [dbo].[Vendors]
SET [Currency] = 'USD'
WHERE [Country] IN ('USA', 'United States') OR [City] IN ('Miami', 'New York');

-- UK vendors = GBP
UPDATE [dbo].[Vendors]
SET [Currency] = 'GBP'
WHERE [Country] IN ('UK', 'United Kingdom') OR [City] IN ('London');

-- Europe vendors = EUR
UPDATE [dbo].[Vendors]
SET [Currency] = 'EUR'
WHERE [Country] IN ('Netherlands', 'Germany', 'France', 'Italy', 'Spain');

PRINT 'Updated vendor currencies based on country';
GO

-- Step 9: Create a Currency reference table for future use (if not exists)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CurrencyRates')
BEGIN
    CREATE TABLE [dbo].[CurrencyRates] (
        [RateId] INT PRIMARY KEY IDENTITY(1,1),
        [FromCurrency] NVARCHAR(3) NOT NULL,
        [ToCurrency] NVARCHAR(3) NOT NULL,
        [Rate] DECIMAL(18, 6) NOT NULL,
        [EffectiveDate] DATETIME NOT NULL,
        [CreatedAt] DATETIME DEFAULT GETUTCDATE(),
        UNIQUE ([FromCurrency], [ToCurrency], [EffectiveDate])
    );
    
    PRINT 'Created CurrencyRates table for exchange rate tracking';
END
ELSE
BEGIN
    PRINT 'CurrencyRates table already exists';
END
GO

-- Step 10: Verify all changes
SELECT 
    TABLE_NAME,
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE COLUMN_NAME IN ('Currency', 'CurrencyColumn')
ORDER BY TABLE_NAME;

PRINT '========================================';
PRINT 'Currency support migration completed!';
PRINT '========================================';

