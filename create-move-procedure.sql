-- Create stored procedure to move data from Upload_Tbl_Products to Products
CREATE OR ALTER PROCEDURE [dbo].[MoveUploadDataToProducts]
    @VendorName NVARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @VendorId INT;
    
    -- Get VendorId from VendorName
    SELECT @VendorId = VendorId 
    FROM [dbo].[Vendors] 
    WHERE VendorName = @VendorName;
    
    IF @VendorId IS NULL
    BEGIN
        RAISERROR('Vendor not found: %s', 16, 1, @VendorName);
        RETURN;
    END
    
    -- Move data from Upload_Tbl_Products to Products
    INSERT INTO [dbo].[Products] (
        Item_Code,
        Name,
        Price,
        Qty,
        VendorId,
        FileUploadId,
        CreatedAt,
        UpdatedAt
    )
    SELECT 
        Item_Code,
        Name,
        CAST(Price AS DECIMAL(10,2)) AS Price,
        CAST(Qty AS INT) AS Qty,
        @VendorId AS VendorId,
        FileUploadId,
        GETDATE() AS CreatedAt,
        GETDATE() AS UpdatedAt
    FROM [dbo].[Upload_Tbl_Products]
    WHERE VendorId = @VendorId
      AND Item_Code IS NOT NULL 
      AND Item_Code != ''
      AND Name IS NOT NULL 
      AND Name != '';
    
    -- Get number of rows moved
    DECLARE @RowsMoved INT = @@ROWCOUNT;
    
    -- Optionally, delete the moved data from Upload_Tbl_Products
    -- DELETE FROM [dbo].[Upload_Tbl_Products]
    -- WHERE VendorId = @VendorId;
    
    SELECT @RowsMoved AS RowsMoved, @VendorId AS VendorId;
END
