-- ============================================================
-- Product Catalog Management System - MSSQL Database Schema
-- ============================================================

-- Users Table
CREATE TABLE [dbo].[Users] (
    [UserId] INT PRIMARY KEY IDENTITY(1,1),
    [Email] NVARCHAR(255) NOT NULL UNIQUE,
    [PasswordHash] NVARCHAR(255) NOT NULL,
    [FirstName] NVARCHAR(100),
    [LastName] NVARCHAR(100),
    [IsActive] BIT DEFAULT 1,
    [CreatedAt] DATETIME DEFAULT GETUTCDATE(),
    [UpdatedAt] DATETIME DEFAULT GETUTCDATE()
);

-- Password Reset Tokens
CREATE TABLE [dbo].[PasswordResetTokens] (
    [TokenId] INT PRIMARY KEY IDENTITY(1,1),
    [UserId] INT NOT NULL,
    [Token] NVARCHAR(500) NOT NULL,
    [ExpiresAt] DATETIME NOT NULL,
    [IsUsed] BIT DEFAULT 0,
    [CreatedAt] DATETIME DEFAULT GETUTCDATE(),
    FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users]([UserId]) ON DELETE CASCADE
);

-- Vendors Table - Core vendor information
CREATE TABLE [dbo].[Vendors] (
    [VendorId] INT PRIMARY KEY IDENTITY(1,1),
    [VendorName] NVARCHAR(255) NOT NULL UNIQUE,
    [VendorCode] NVARCHAR(50) NOT NULL UNIQUE,
    [ContactEmail] NVARCHAR(255),
    [ContactPhone] NVARCHAR(20),
    [Address] NVARCHAR(500),
    [City] NVARCHAR(100),
    [Country] NVARCHAR(100),
    [Description] NVARCHAR(MAX),
    [IsActive] BIT DEFAULT 1,
    [CreatedAt] DATETIME DEFAULT GETUTCDATE(),
    [UpdatedAt] DATETIME DEFAULT GETUTCDATE()
);

-- Vendor Column Mappings - Define which columns map to standard fields for each vendor
CREATE TABLE [dbo].[VendorColumnMappings] (
    [MappingId] INT PRIMARY KEY IDENTITY(1,1),
    [VendorId] INT NOT NULL,
    [ProductCodeColumn] NVARCHAR(100) NOT NULL,
    [ProductNameColumn] NVARCHAR(100) NOT NULL,
    [DescriptionColumn] NVARCHAR(100),
    [BrandColumn] NVARCHAR(100),
    [CategoryColumn] NVARCHAR(100),
    [PriceColumn] NVARCHAR(100) NOT NULL,
    [StockQuantityColumn] NVARCHAR(100),
    [UPCColumn] NVARCHAR(100),
    [SkipHeaderRows] INT DEFAULT 0,
    [IsActive] BIT DEFAULT 1,
    [CreatedAt] DATETIME DEFAULT GETUTCDATE(),
    [UpdatedAt] DATETIME DEFAULT GETUTCDATE(),
    FOREIGN KEY ([VendorId]) REFERENCES [dbo].[Vendors]([VendorId]) ON DELETE CASCADE
);

-- File Upload History
CREATE TABLE [dbo].[FileUploads] (
    [FileId] INT PRIMARY KEY IDENTITY(1,1),
    [VendorId] INT NOT NULL,
    [FileName] NVARCHAR(255) NOT NULL,
    [FileSize] BIGINT,
    [UploadedBy] INT NOT NULL,
    [UploadedAt] DATETIME DEFAULT GETUTCDATE(),
    [ProcessedAt] DATETIME,
    [Status] NVARCHAR(50) DEFAULT 'Pending', -- Pending, Processing, Completed, Failed
    [ErrorMessage] NVARCHAR(MAX),
    [RecordsProcessed] INT DEFAULT 0,
    [RecordsSuccess] INT DEFAULT 0,
    [RecordsFailed] INT DEFAULT 0,
    FOREIGN KEY ([VendorId]) REFERENCES [dbo].[Vendors]([VendorId]),
    FOREIGN KEY ([UploadedBy]) REFERENCES [dbo].[Users]([UserId])
);

-- Products Table - Normalized product data
CREATE TABLE [dbo].[Products] (
    [ProductId] INT PRIMARY KEY IDENTITY(1,1),
    [VendorId] INT NOT NULL,
    [ProductCode] NVARCHAR(100) NOT NULL,
    [ProductName] NVARCHAR(500) NOT NULL,
    [Description] NVARCHAR(MAX),
    [Brand] NVARCHAR(200),
    [Category] NVARCHAR(200),
    [Price] DECIMAL(18, 2) NOT NULL,
    [StockQuantity] INT DEFAULT 0,
    [UPC] NVARCHAR(100),
    [VendorProductId] NVARCHAR(100), -- Vendor's internal product ID
    [FileUploadId] INT,
    [IsActive] BIT DEFAULT 1,
    [CreatedAt] DATETIME DEFAULT GETUTCDATE(),
    [UpdatedAt] DATETIME DEFAULT GETUTCDATE(),
    FOREIGN KEY ([VendorId]) REFERENCES [dbo].[Vendors]([VendorId]),
    FOREIGN KEY ([FileUploadId]) REFERENCES [dbo].[FileUploads]([FileId])
);

-- Indexes for common queries
CREATE NONCLUSTERED INDEX [IX_Products_ProductCode] ON [dbo].[Products] ([ProductCode]);
CREATE NONCLUSTERED INDEX [IX_Products_VendorId] ON [dbo].[Products] ([VendorId]);
CREATE NONCLUSTERED INDEX [IX_Products_ProductName] ON [dbo].[Products] ([ProductName]);
CREATE NONCLUSTERED INDEX [IX_Products_Brand] ON [dbo].[Products] ([Brand]);
CREATE NONCLUSTERED INDEX [IX_Products_UPC] ON [dbo].[Products] ([UPC]);
CREATE NONCLUSTERED INDEX [IX_FileUploads_VendorId] ON [dbo].[FileUploads] ([VendorId]);
CREATE NONCLUSTERED INDEX [IX_Users_Email] ON [dbo].[Users] ([Email]);

-- Sample Vendors Data
INSERT INTO [dbo].[Vendors] ([VendorName], [VendorCode], [ContactEmail], [City], [Country], [Description])
VALUES 
    ('ET Perfumes Inc.', 'ET_PERF', 'marcela@etperfume.com', 'Miami', 'USA', 'Premium perfume and fragrance distributor'),
    ('Partheco International', 'PART_INTL', 'info@partheco.com', 'Amsterdam', 'Netherlands', 'International personal care products distributor'),
    ('Global Beauty Supplies', 'GLOBAL_BEAUTY', 'sales@globalbeauty.com', 'New York', 'USA', 'Wholesale beauty and cosmetics supplier'),
    ('Premium Imports Ltd', 'PREMIUM_IMP', 'contact@premiumimports.co.uk', 'London', 'UK', 'Luxury imported goods distributor');

-- Insert sample vendor column mappings (ET Perfumes)
INSERT INTO [dbo].[VendorColumnMappings] 
([VendorId], [ProductCodeColumn], [ProductNameColumn], [DescriptionColumn], [BrandColumn], [CategoryColumn], [PriceColumn], [StockQuantityColumn], [UPCColumn], [SkipHeaderRows])
VALUES
(1, 'PRODUCT#', 'ITEM DESCRIPTION', 'ITEM DESCRIPTION', 'BRAND NAME FRAGANCES', NULL, 'PRICE', 'QTY AVAIL QTY', 'UPC', 11);

-- Insert sample vendor column mappings (Partheco)
INSERT INTO [dbo].[VendorColumnMappings] 
([VendorId], [ProductCodeColumn], [ProductNameColumn], [DescriptionColumn], [BrandColumn], [CategoryColumn], [PriceColumn], [StockQuantityColumn], [UPCColumn], [SkipHeaderRows])
VALUES
(2, 'Product number', 'Description', 'Description', 'Brand', 'Category', 'Price', 'Stock', 'EAN barcode', 9);
