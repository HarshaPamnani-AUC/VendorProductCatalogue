const express = require('express');
const cors = require('cors');
const sql = require('mssql');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
require('dotenv').config({ path: '.env.local' });

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// MSSQL Configuration
const sqlConfig = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'Admin@123',
  database: process.env.DB_NAME || 'ProductCatalogDB',
  server: process.env.DB_SERVER || 'localhost',
  port: 1433,
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

let pool;

// Initialize database connection
async function initializeDatabase() {
  try {
    pool = new sql.ConnectionPool(sqlConfig);
    await pool.connect();
    console.log('✅ Database connection successful');
  } catch (err) {
    console.error('❌ Database connection failed:', err);
    process.exit(1);
  }
}

// Middleware to verify token
const verifyToken = (req, res, next) => {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
  
  console.log('=== VERIFY TOKEN ===');
  console.log('Token from cookies:', req.cookies.token ? 'exists' : 'missing');
  console.log('Token from headers:', req.headers.authorization);
  console.log('Extracted token:', token ? token.substring(0, 20) + '...' : 'missing');
  
  if (!token) {
    console.log('❌ No token provided');
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    console.log('✅ Token decoded successfully:', decoded);
    req.user = decoded;
    console.log('=== END VERIFY TOKEN ===');
    next();
  } catch (err) {
    console.log('❌ Token verification failed:', err.message);
    console.log('=== END VERIFY TOKEN ===');
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Login with proper authentication
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('=== LOGIN ATTEMPT ===');
    console.log('Email:', email);
    console.log('Password provided:', password ? 'Yes' : 'No');

    if (!email || !password) {
      console.log('❌ Missing email or password');
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user in database
    const userResult = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT UserId, Email, FirstName, LastName, PasswordHash FROM [dbo].[Users] WHERE Email = @email');

    console.log('User query result count:', userResult.recordset.length);

    if (userResult.recordset.length === 0) {
      console.log('❌ User not found');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.recordset[0];
    console.log('Found user:', user.UserId, user.Email);

    // Verify password - plain text comparison (as per existing system)
    const isPasswordValid = password === user.PasswordHash;
    console.log('Password comparison:', isPasswordValid ? '✅ Valid' : '❌ Invalid');

    if (!isPasswordValid) {
      console.log('❌ Password mismatch');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create JWT token
    const token = jwt.sign(
      { userId: user.UserId, email: user.Email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    console.log('✅ Login successful for:', user.Email);
    console.log('=== END LOGIN ===');

    res.json({
      message: 'Login successful',
      token,
      user: {
        userId: user.UserId,
        email: user.Email,
        firstName: user.FirstName,
        lastName: user.LastName
      }
    });
  } catch (err) {
    console.error('=== LOGIN ERROR ===');
    console.error('Login error:', err);
    console.error('=== END LOGIN ERROR ===');
    res.status(500).json({ error: 'Login failed' });
  }
});

// Auth/me endpoint for dashboard verification
app.get('/api/auth/me', verifyToken, async (req, res) => {
  try {
    console.log('=== AUTH/ME ENDPOINT ===');
    console.log('User from token:', req.user);
    
    const userResult = await pool.request()
      .input('userId', sql.Int, req.user.userId)
      .query('SELECT UserId, Email, FirstName, LastName FROM [dbo].[Users] WHERE UserId = @userId');

    console.log('Database query result count:', userResult.recordset.length);

    if (userResult.recordset.length === 0) {
      console.log('❌ User not found in database');
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userResult.recordset[0];
    console.log('✅ User found:', userData);
    console.log('=== END AUTH/ME ===');
    
    res.json(userData);
  } catch (err) {
    console.error('❌ Auth/me error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Product search endpoint
app.get('/api/products/search', verifyToken, async (req, res) => {
  try {
    const { productName } = req.query;
    
    const result = await pool.request()
      .input('productName', sql.NVarChar, `%${productName}%`)
      .query(`
        SELECT TOP 50
          [Item_Code] as ProductCode,
          [Name] as ProductName,
          [Price],
          [Qty] as StockQuantity,
          [EAN/UPC] as UPC,
          [Vendor] as VendorName
        FROM [dbo].[Tbl_Products]
        WHERE [Name] LIKE @productName
        ORDER BY [UploadDatetime] DESC
      `);
    
    res.json(result.recordset);
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Product update endpoint
app.put('/api/products/:productCode', verifyToken, async (req, res) => {
  try {
    const productCode = req.params.productCode;
    const { productName, price, stockQuantity, upc, vendorName } = req.body;
    const loginName = req.user ? (req.user.email || 'System') : 'System';

    console.log('=== UPDATE DEBUG ===');
    console.log('productCode:', productCode);
    console.log('vendorName:', vendorName);
    console.log('productName:', productName);
    console.log('price:', price);
    console.log('stockQuantity:', stockQuantity);

    const updateResult = await pool.request()
      .input('productCode', sql.NVarChar, productCode)
      .input('vendorName', sql.NVarChar, (vendorName || '').trim())
      .input('name', sql.NVarChar, productName)
      .input('price', sql.NVarChar, price.toString())
      .input('qty', sql.NVarChar, stockQuantity ? stockQuantity.toString() : '0')
      .input('eanUpc', sql.NVarChar, upc || null)
      .input('updatedBy', sql.NVarChar, loginName)
      .query(`
        UPDATE [dbo].[Tbl_Products] 
        SET [Name] = @name,
            [Price] = @price,
            [Qty] = @qty,
            [EAN/UPC] = @eanUpc,
            [UpdatedBy] = @updatedBy
        WHERE [Item_Code] = @productCode AND RTRIM([Vendor]) = @vendorName
      `);

    console.log('Rows affected:', updateResult.rowsAffected[0]);
    console.log('=== END UPDATE DEBUG ===');

    res.json({ 
      message: 'Product updated successfully',
      rowsAffected: updateResult.rowsAffected[0]
    });
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ error: 'Failed to update product: ' + err.message });
  }
});

// Dashboard - Get latest products
app.get('/api/products/latest/items', verifyToken, async (req, res) => {
  try {
    const result = await pool.request()
      .query(`
        SELECT TOP 5
          [Item_Code] as ProductCode,
          [Name] as ProductName,
          [Price],
          [Qty] as StockQuantity,
          [Vendor] as VendorName
        FROM [dbo].[Tbl_Products]
        ORDER BY [UploadDatetime] DESC
      `);
    
    res.json(result.recordset);
  } catch (err) {
    console.error('Latest products error:', err);
    res.status(500).json({ error: 'Failed to fetch latest products' });
  }
});

// Dashboard - Get vendors
app.get('/api/vendors', verifyToken, async (req, res) => {
  try {
    const result = await pool.request()
      .query(`
        SELECT DISTINCT [Vendor] as VendorName
        FROM [dbo].[Tbl_Products]
        WHERE [Vendor] IS NOT NULL AND [Vendor] != ''
        ORDER BY [Vendor]
      `);
    
    res.json(result.recordset);
  } catch (err) {
    console.error('Vendors error:', err);
    res.status(500).json({ error: 'Failed to fetch vendors' });
  }
});

const PORT = 5000;
const HOST = '0.0.0.0';

// Initialize and start server
initializeDatabase().then(() => {
  app.listen(PORT, HOST, () => {
    console.log(`✅ Secure server running on http://${HOST}:${PORT}`);
    console.log(`✅ Local access: http://localhost:${PORT}`);
    console.log(`✅ Network access: http://0.0.0.0:${PORT}`);
    console.log(`✅ Health check: http://localhost:${PORT}/api/health`);
    console.log(`✅ Login endpoint: http://localhost:${PORT}/api/auth/login`);
    console.log('✅ Database authentication enabled');
  });
}).catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
