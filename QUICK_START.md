# Quick Start Guide - Product Catalog Manager

## Your MSSQL Configuration

```
Server: AUC-Laptop-032\MSSQLSERVER2026
User: sa
Password: 1234
Database: ProductCatalog
```

## Step-by-Step Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables
The `.env.local` file has been created with your MSSQL credentials. No additional configuration needed for the database.

**Important**: For production, change:
- `JWT_SECRET` to a strong random string
- `NODE_ENV` from `development` to `production`

### 3. Test Database Connection
Before running the full application, test your MSSQL connection:

```bash
node scripts/test-connection.js
```

You should see:
```
✓ Database connection successful!
✓ Test query executed successfully
```

If connection fails, check:
- MSSQL Server is running
- Service name is correct: `AUC-Laptop-032\MSSQLSERVER2026`
- SQL Server allows TCP/IP connections
- Firewall isn't blocking port 1433

### 4. Initialize Database
Once connection test passes, create the database schema:

```bash
node scripts/init-database.js
```

You should see all tables created:
```
✓ Database initialization complete!
Created Tables:
  - Users
  - Vendors
  - Products
  - ProductVariants
  - VendorColumnMappings
  - FileUploadHistory
  - PasswordResetTokens
```

### 5. Start Backend Server
```bash
node server.js
```

Expected output:
```
✓ Database connection successful
Server running on port 5000
```

### 6. Start Frontend (in new terminal)
```bash
npm run dev
```

Access the application at: **http://localhost:3000**

## First Steps in the App

1. **Register** a new account at http://localhost:3000/register
2. **Login** with your credentials
3. **Configure Vendors** - Add vendor details and column mappings
4. **Upload Excel Files** - Start uploading your vendor price lists
5. **Search Products** - Find products and compare prices across vendors
6. **Update Products** - Modify product details as needed

## Troubleshooting

### Connection Error: "Cannot connect to AUC-Laptop-032\MSSQLSERVER2026"

**Solution**: Ensure MSSQL Server is running
```bash
# On Windows, open Services and check if SQL Server service is running
# Service name should be: MSSQLSERVER2026
```

### Error: "Database 'ProductCatalog' does not exist"

**Solution**: Run the initialization script
```bash
node scripts/init-database.js
```

### Port 5000 Already in Use

**Solution**: Change PORT in `.env.local` or kill the process:
```bash
# On Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

### JWT_SECRET not set

**Solution**: Add a JWT_SECRET to `.env.local`:
```
JWT_SECRET=your-random-string-here-min-32-chars
```

## API Endpoints

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password
- `GET /api/vendors` - Get all vendors
- `POST /api/vendors` - Add vendor
- `POST /api/uploads` - Upload Excel file
- `GET /api/products/search` - Search products
- `GET /api/products/latest/items` - Recent products
- `GET /api/products/:productCode` - Get product details
- `PUT /api/products/:productCode` - Update product

## File Structure

```
├── server.js                          # Express backend entry point
├── .env.local                         # Your MSSQL credentials
├── routes/
│   ├── auth.js                        # Authentication logic
│   ├── vendors.js                     # Vendor management
│   ├── products.js                    # Product operations
│   └── uploads.js                     # Excel file parsing
├── scripts/
│   ├── 01-create-database-schema.sql  # Database schema
│   ├── test-connection.js             # Connection test
│   └── init-database.js               # Database initializer
├── app/
│   ├── page.tsx                       # Home page
│   ├── login/page.tsx                 # Login page
│   ├── dashboard/                     # Protected dashboard
│   │   ├── page.tsx                   # Dashboard home
│   │   ├── search/page.tsx            # Product search
│   │   ├── upload/page.tsx            # File upload
│   │   └── update/page.tsx            # Product updates
│   └── api/                           # Next.js API routes (proxies)
└── package.json
```

## Next Steps

1. Test the connection and database initialization
2. Start both backend and frontend
3. Register and login
4. Configure your first vendor
5. Upload a sample Excel file
6. Search for products and verify data is in the database

## Need Help?

Check the detailed documentation in:
- `README.md` - Full feature documentation
- `SETUP_GUIDE.md` - Advanced configuration
- Code comments in route files for implementation details
