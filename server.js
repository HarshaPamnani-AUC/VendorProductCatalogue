const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const sql = require('mssql');
const multer = require('multer');

dotenv.config({ path: '.env.local' });

const app = express();

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

// Multer configuration for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB limit
});

// MSSQL Configuration
const sqlConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  server: process.env.DB_SERVER,
  port: 1433,
  pool: {
    max: parseInt(process.env.DB_POOL_MAX || '10'),
    min: parseInt(process.env.DB_POOL_MIN || '0'),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000')
  },
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
    enableKeepAlive: true,
    instanceName: undefined, // Will be parsed from server name if present
  }
};

// Parse instance name from server if provided (e.g., "SERVER\INSTANCE")
if (sqlConfig.server && sqlConfig.server.includes('\\')) {
  const parts = sqlConfig.server.split('\\');
  sqlConfig.server = parts[0];
  sqlConfig.options.instanceName = parts[1];
}

let pool;

// Initialize database connection
async function initializeDatabase() {
  try {
    pool = new sql.ConnectionPool(sqlConfig);
    await pool.connect();
    console.log('Database connection successful');
    
    // Initialize AI_Alerts table if it doesn't exist
    await initializeAIAlertsTable();
  } catch (err) {
    console.error('Database connection failed:', err);
    process.exit(1);
  }
}

// Initialize AI_Alerts table for anomaly detection
async function initializeAIAlertsTable() {
  try {
    console.log('🔍 Checking if AI_Alerts table exists...');
    
    // Check if table exists
    const checkTableQuery = `
      SELECT COUNT(*) as TableCount 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'AI_Alerts'
    `;
    
    const result = await pool.request().query(checkTableQuery);
    
    if (result.recordset[0].TableCount === 0) {
      console.log('📝 Creating AI_Alerts table...');
      
      // Create the table
      const createTableSQL = `
        CREATE TABLE [dbo].[AI_Alerts] (
          [AlertId] INT PRIMARY KEY IDENTITY(1,1),
          [AlertType] NVARCHAR(50) NOT NULL,
          [Severity] NVARCHAR(20) NOT NULL,
          [ProductCode] NVARCHAR(100) NOT NULL,
          [ProductName] NVARCHAR(500),
          [Vendor] NVARCHAR(255) NOT NULL,
          [OldPrice] DECIMAL(18,2),
          [NewPrice] DECIMAL(18,2) NOT NULL,
          [PriceChange] DECIMAL(5,2),
          [ZScore] DECIMAL(8,3),
          [Confidence] DECIMAL(5,2),
          [MonthlyVolume] INT DEFAULT 0,
          [MonthlyImpact] DECIMAL(12,2),
          [Description] NVARCHAR(MAX),
          [RecommendedAction] NVARCHAR(MAX),
          [IsAcknowledged] BIT DEFAULT 0,
          [AcknowledgedBy] INT,
          [AcknowledgedAt] DATETIME,
          [FileUploadId] INT,
          [CreatedAt] DATETIME DEFAULT GETUTCDATE(),
          [UpdatedAt] DATETIME DEFAULT GETUTCDATE(),
          FOREIGN KEY ([FileUploadId]) REFERENCES [dbo].[FileUploads]([FileId]) ON DELETE SET NULL,
          FOREIGN KEY ([AcknowledgedBy]) REFERENCES [dbo].[Users]([UserId]) ON DELETE SET NULL
        );
      `;
      
      await pool.request().query(createTableSQL);
      console.log('✅ Created AI_Alerts table');
      
      // Create indexes
      const indexes = [
        'CREATE NONCLUSTERED INDEX [IX_AI_Alerts_ProductCode] ON [dbo].[AI_Alerts] ([ProductCode]);',
        'CREATE NONCLUSTERED INDEX [IX_AI_Alerts_Vendor] ON [dbo].[AI_Alerts] ([Vendor]);',
        'CREATE NONCLUSTERED INDEX [IX_AI_Alerts_CreatedAt] ON [dbo].[AI_Alerts] ([CreatedAt] DESC);',
        'CREATE NONCLUSTERED INDEX [IX_AI_Alerts_IsAcknowledged] ON [dbo].[AI_Alerts] ([IsAcknowledged], [CreatedAt] DESC);',
        'CREATE NONCLUSTERED INDEX [IX_AI_Alerts_Severity] ON [dbo].[AI_Alerts] ([Severity], [CreatedAt] DESC);',
        'CREATE NONCLUSTERED INDEX [IX_AI_Alerts_AlertType] ON [dbo].[AI_Alerts] ([AlertType], [CreatedAt] DESC);'
      ];
      
      for (const indexSQL of indexes) {
        try {
          await pool.request().query(indexSQL);
        } catch (e) {
          console.log(`⚠️  Index creation note: ${e.message.substring(0, 80)}`);
        }
      }
      
      console.log('✅ AI_Alerts indexes created');
    } else {
      console.log('✅ AI_Alerts table already exists');
    }
  } catch (err) {
    console.error('⚠️  Warning: Could not initialize AI_Alerts table:', err.message);
    // Don't fail startup if table initialization fails
  }
}

// Route imports
const authRoutes = require('./routes/auth');
const vendorRoutes = require('./routes/vendors');
const uploadRoutes = require('./routes/uploads');
const productsRoutes = require('./routes/products');
const tableStructureRoutes = require('./routes/table-structure');
const uploadProductsRoutes = require('./routes/upload-products');
const fixTableRoutes = require('./routes/fix-table');
const moveDataRoutes = require('./routes/move-data');
const productHistoryRoutes = require('./routes/productHistory');
const productSearchRoutes = require('./routes/productSearch');
const aiAnomaliesRoutes = require('./routes/ai-anomalies');

// Make pool available to routes
app.use((req, res, next) => {
  req.pool = pool;
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/products/history', productHistoryRoutes);
app.use('/api/products/search', productSearchRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/table-structure', tableStructureRoutes);
app.use('/api/upload-products', uploadProductsRoutes);
app.use('/api/fix-table', fixTableRoutes);
app.use('/api/move-data', moveDataRoutes);
app.use('/api/ai/anomalies', aiAnomaliesRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 5000;

// Initialize and start server
initializeDatabase().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

module.exports = app;
