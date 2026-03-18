-- Create updated stored procedure for updating products using Product Code and UPC
USE [ProductCatalog]
GO

-- Drop existing procedure if it exists
IF EXISTS (SELECT * FROM sys.objects WHERE type = 'P' AND name = 'Proc_Update_Products')
BEGIN
    DROP PROCEDURE [dbo].[Proc_Update_Products]
END
GO

-- Create new stored procedure that uses Product Code and UPC
CREATE PROCEDURE [dbo].[Proc_Update_Products]
    @ProductCode NVARCHAR(100),
    @UPC NVARCHAR(100) = NULL,
    @ProductName NVARCHAR(500),
    @Description NVARCHAR(MAX) = NULL,
    @Brand NVARCHAR(200) = NULL,
    @Category NVARCHAR(200) = NULL,
    @Price DECIMAL(18, 2) = NULL,
    @StockQuantity INT = NULL,
    @UpdatedBy NVARCHAR(255) = NULL,
    @ResultCode INT OUTPUT,
    @ResultMessage NVARCHAR(500) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRY
        -- Check if product exists by Product Code (and UPC if provided)
        DECLARE @ProductId INT;
        
        IF @UPC IS NOT NULL AND @UPC <> ''
        BEGIN
            -- Find product by both Product Code and UPC
            SELECT @ProductId = ProductId 
            FROM [dbo].[Products] 
            WHERE ProductCode = @ProductCode 
              AND UPC = @UPC 
              AND IsActive = 1;
        END
        ELSE
        BEGIN
            -- Find product by Product Code only
            SELECT @ProductId = ProductId 
            FROM [dbo].[Products] 
            WHERE ProductCode = @ProductCode 
              AND IsActive = 1;
        END
        
        IF @ProductId IS NULL
        BEGIN
            -- Return error code for product not found
            SET @ResultCode = -1;
            SET @ResultMessage = 'Product not found with given Product Code and UPC';
            RETURN;
        END
        
        -- Update product
        UPDATE [dbo].[Products]
        SET 
            ProductName = @ProductName,
            Description = @Description,
            Brand = @Brand,
            Category = @Category,
            Price = @Price,
            StockQuantity = @StockQuantity,
            UpdatedAt = GETUTCDATE()
        WHERE ProductId = @ProductId AND IsActive = 1;
        
        -- Check if update was successful
        IF @@ROWCOUNT = 0
        BEGIN
            SET @ResultCode = -2;
            SET @ResultMessage = 'No rows updated - product may not exist';
            RETURN;
        END
        
        -- Return success code
        SET @ResultCode = 1;
        SET @ResultMessage = 'Product updated successfully';
        
    END TRY
    BEGIN CATCH
        -- Return error code for database error
        SET @ResultCode = -3;
        SET @ResultMessage = ERROR_MESSAGE();
        
        -- Log error
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrorState INT = ERROR_STATE();
        
        PRINT 'Error in Proc_Update_Products: ' + @ErrorMessage;
        
        -- Re-throw error
        RAISERROR(@ErrorMessage, @ErrorSeverity, @ErrorState);
    END CATCH;
    
    SET NOCOUNT OFF;
END
GO

-- Grant execute permission
GRANT EXECUTE ON [dbo].[Proc_Update_Products] TO PUBLIC
GO

PRINT 'Updated stored procedure Proc_Update_Products created successfully (using Product Code and UPC)'
