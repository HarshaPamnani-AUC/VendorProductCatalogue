-- Create stored procedure for adding vendors
USE [ProductCatalog]
GO

-- Drop existing procedure if it exists
IF EXISTS (SELECT * FROM sys.objects WHERE type = 'P' AND name = 'Proc_Add_Vendors')
BEGIN
    DROP PROCEDURE [dbo].[Proc_Add_Vendors]
END
GO

-- Create new stored procedure
CREATE PROCEDURE [dbo].[Proc_Add_Vendors]
    @VendorName NVARCHAR(255),
    @VendorCode NVARCHAR(50),
    @ContactEmail NVARCHAR(255) = NULL,
    @ContactPhone NVARCHAR(50) = NULL,
    @Address NVARCHAR(MAX) = NULL,
    @City NVARCHAR(200) = NULL,
    @Country NVARCHAR(200) = NULL,
    @Description NVARCHAR(MAX) = NULL,
    @NewVendorId INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRY
        -- Check if vendor code already exists
        IF EXISTS (SELECT 1 FROM [dbo].[Vendors] WHERE VendorCode = @VendorCode AND IsActive = 1)
        BEGIN
            -- Return error code for duplicate vendor code
            SET @NewVendorId = -1;
            RETURN;
        END
        
        -- Insert new vendor with correct column mapping
        INSERT INTO [dbo].[Vendors] (
            VendorName,
            VendorCode,
            ContactEmail,
            ContactPhone,
            Address,
            City,
            Country,
            Description,
            IsActive,
            CreatedAt,
            UpdatedAt
        )
        VALUES (
            @VendorName,
            @VendorCode,
            @ContactEmail,
            @ContactPhone,
            @Address,
            @City,
            @Country,
            @Description,
            1,
            GETUTCDATE(),
            GETUTCDATE()
        );
        
        -- Get the newly created vendor ID
        SET @NewVendorId = SCOPE_IDENTITY();
        
    END TRY
    BEGIN CATCH
        -- Return error code for database error
        SET @NewVendorId = -2;
        
        -- Log the error
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrorState INT = ERROR_STATE();
        
        -- You can log to a custom error table here if needed
        PRINT 'Error in Proc_Add_Vendors: ' + @ErrorMessage;
        
        -- Re-throw the error
        RAISERROR(@ErrorMessage, @ErrorSeverity, @ErrorState);
    END CATCH;
    
    SET NOCOUNT OFF;
END
GO

-- Grant execute permission
GRANT EXECUTE ON [dbo].[Proc_Add_Vendors] TO PUBLIC
GO

PRINT 'Stored procedure Proc_Add_Vendors created successfully'
