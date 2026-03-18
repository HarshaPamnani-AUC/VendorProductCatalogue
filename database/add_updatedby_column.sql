-- Add UpdatedBy column to Tbl_Products if it doesn't exist
IF NOT EXISTS (
    SELECT * 
    FROM sys.columns 
    WHERE Name = N'UpdatedBy' 
    AND Object_ID = Object_ID(N'[dbo].[Tbl_Products]')
)
BEGIN
    ALTER TABLE [dbo].[Tbl_Products]
    ADD [UpdatedBy] [nvarchar](100) NULL;
    
    PRINT 'Column UpdatedBy added successfully';
END
ELSE
BEGIN
    PRINT 'Column UpdatedBy already exists';
END
GO

-- Verify column was added
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Tbl_Products'
ORDER BY ORDINAL_POSITION;
