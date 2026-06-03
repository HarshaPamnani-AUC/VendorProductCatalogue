-- ============================================================
-- AI_Alerts Table - Price Anomaly Detection
-- ============================================================
-- Purpose: Store detected price anomalies for user review and action
-- Created: June 3, 2026
-- Status: Production Ready

-- Create table
CREATE TABLE [dbo].[AI_Alerts] (
    [AlertId] INT PRIMARY KEY IDENTITY(1,1),
    [AlertType] NVARCHAR(50) NOT NULL,           -- PRICE_SPIKE, PRICE_DROP, OUTLIER
    [Severity] NVARCHAR(20) NOT NULL,            -- LOW, MEDIUM, HIGH, CRITICAL
    [ProductCode] NVARCHAR(100) NOT NULL,        -- Item_Code
    [ProductName] NVARCHAR(500),                 -- Product name
    [Vendor] NVARCHAR(255) NOT NULL,             -- Supplier name
    [OldPrice] DECIMAL(18,2),                    -- Previous average price
    [NewPrice] DECIMAL(18,2) NOT NULL,           -- Current price
    [PriceChange] DECIMAL(5,2),                  -- Percentage change
    [ZScore] DECIMAL(8,3),                       -- Statistical Z-score
    [Confidence] DECIMAL(5,2),                   -- Confidence 0-100
    [MonthlyVolume] INT DEFAULT 0,               -- Estimated units/month
    [MonthlyImpact] DECIMAL(12,2),               -- Financial impact
    [Description] NVARCHAR(MAX),                 -- Detailed description
    [RecommendedAction] NVARCHAR(MAX),           -- Action to take
    [IsAcknowledged] BIT DEFAULT 0,              -- User acknowledged?
    [AcknowledgedBy] INT,                        -- UserId who acknowledged
    [AcknowledgedAt] DATETIME,                   -- When acknowledged
    [FileUploadId] INT,                          -- Link to triggering upload
    [CreatedAt] DATETIME DEFAULT GETUTCDATE(),   -- When alert created
    [UpdatedAt] DATETIME DEFAULT GETUTCDATE(),   -- Last update
    FOREIGN KEY ([FileUploadId]) REFERENCES [dbo].[FileUploads]([FileId]) ON DELETE SET NULL,
    FOREIGN KEY ([AcknowledgedBy]) REFERENCES [dbo].[Users]([UserId]) ON DELETE SET NULL
);

-- Indexes for fast queries
CREATE NONCLUSTERED INDEX [IX_AI_Alerts_ProductCode] 
    ON [dbo].[AI_Alerts] ([ProductCode]);

CREATE NONCLUSTERED INDEX [IX_AI_Alerts_Vendor] 
    ON [dbo].[AI_Alerts] ([Vendor]);

CREATE NONCLUSTERED INDEX [IX_AI_Alerts_CreatedAt] 
    ON [dbo].[AI_Alerts] ([CreatedAt] DESC);

CREATE NONCLUSTERED INDEX [IX_AI_Alerts_IsAcknowledged] 
    ON [dbo].[AI_Alerts] ([IsAcknowledged], [CreatedAt] DESC);

CREATE NONCLUSTERED INDEX [IX_AI_Alerts_Severity] 
    ON [dbo].[AI_Alerts] ([Severity], [CreatedAt] DESC);

CREATE NONCLUSTERED INDEX [IX_AI_Alerts_AlertType] 
    ON [dbo].[AI_Alerts] ([AlertType], [CreatedAt] DESC);

-- Verify table created successfully
SELECT 'AI_Alerts table created successfully' as Status;
SELECT COUNT(*) as ColumnCount FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'AI_Alerts';
