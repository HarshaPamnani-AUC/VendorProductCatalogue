-- Fixed procedure that properly transfers data from Upload_Tbl_Products to Tbl_Products
-- using Item_Code as the unique identifier instead of the broken EAN/UPC + Vendor match

CREATE OR ALTER PROCEDURE [dbo].[Proc_Upload_Tbl_Products]
    @Vendor NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @UploadTime DATETIME = GETDATE();

    BEGIN TRY
        BEGIN TRANSACTION;

        -------------------------------------------------
        -- Step 0: Store backup copy
        -------------------------------------------------
        INSERT INTO [dbo].[Tbl_Products_Storage]
        (
            [Date],
            [EAN/UPC],
            [Name],
            [Item_Code],
            [Qty],
            [Price],
            [Vendor],
            [UploadDatetime]
        )
        SELECT
            [Date],
            [EAN/UPC],
            [Name],
            [Item_Code],
            [Qty],
            [Price],
            @Vendor AS Vendor,
            @UploadTime
        FROM [dbo].[Upload_Tbl_Products];

        -------------------------------------------------
        -- Step 1: Update existing records (match on Item_Code)
        -------------------------------------------------
        UPDATE [dbo].[Tbl_Products]
        SET
            [Date] = u.[Date],
            [EAN/UPC] = u.[EAN/UPC],
            [Name] = u.[Name],
            [Qty] = u.[Qty],
            [Price] = u.[Price],
            [UploadDatetime] = @UploadTime
        FROM [dbo].[Tbl_Products] t
        INNER JOIN [dbo].[Upload_Tbl_Products] u
            ON t.[Item_Code] = u.[Item_Code]
            AND t.[Vendor] = @Vendor;

        -------------------------------------------------
        -- Step 2: Insert new records (those not already in Tbl_Products)
        -------------------------------------------------
        INSERT INTO [dbo].[Tbl_Products]
        (
            [Date],
            [EAN/UPC],
            [Name],
            [Item_Code],
            [Qty],
            [Price],
            [Vendor],
            [UploadDatetime]
        )
        SELECT
            u.[Date],
            u.[EAN/UPC],
            u.[Name],
            u.[Item_Code],
            u.[Qty],
            u.[Price],
            @Vendor,
            @UploadTime
        FROM [dbo].[Upload_Tbl_Products] u
        WHERE NOT EXISTS (
            SELECT 1 
            FROM [dbo].[Tbl_Products] t
            WHERE t.[Item_Code] = u.[Item_Code]
            AND t.[Vendor] = @Vendor
        );

        -------------------------------------------------
        -- Step 3: Clear upload table
        -------------------------------------------------
        TRUNCATE TABLE [dbo].[Upload_Tbl_Products];

        COMMIT TRANSACTION;

        -- Return success info
        SELECT 
            @Vendor AS Vendor,
            @UploadTime AS UploadTime,
            'SUCCESS' AS Status;

    END TRY
    BEGIN CATCH

        ROLLBACK TRANSACTION;
        
        -- Return error info
        SELECT 
            @Vendor AS Vendor,
            @UploadTime AS UploadTime,
            'ERROR' AS Status,
            ERROR_MESSAGE() AS ErrorMessage;

        THROW;

    END CATCH

END
