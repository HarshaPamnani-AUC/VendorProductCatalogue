const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const sql = require('mssql');
const multer = require('multer');

dotenv.config({ path: '.env.local' });

const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://172.30.36.124:3000', 'http://0.0.0.0:3000'],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

// Multer configuration for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
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
  } catch (err) {
    console.error('Database connection failed:', err);
    process.exit(1);
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

// Make pool available to routes
app.use((req, res, next) => {
  req.pool = pool;
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/table-structure', tableStructureRoutes);
app.use('/api/upload-products', uploadProductsRoutes);
app.use('/api/fix-table', fixTableRoutes);
app.use('/api/move-data', moveDataRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 5000;

// Initialize and start server
initializeDatabase().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Network access: http://your-local-ip:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

module.exports = app;
