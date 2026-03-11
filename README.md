# Product Catalog Management System

A professional, full-stack web application for managing vendor price lists and product catalogs. Built with Node.js (Express), Next.js, and MSSQL.

## Features

### Core Features
- **User Authentication**: Secure login/registration with JWT tokens
- **Password Recovery**: Forgot password functionality with email reset links
- **Multi-Vendor Support**: Manage products from 21+ vendors with flexible data mapping
- **Excel File Upload**: Import vendor price lists with automatic data parsing
- **Product Search**: Search products by code, name, or UPC with cross-vendor price comparison
- **Price Comparison**: View lowest to highest prices across vendors
- **Product Update**: Edit product details, prices, and stock quantities
- **Responsive Dashboard**: Professional UI with sidebar navigation

### Technical Highlights
- **Flexible Vendor Column Mapping**: Each vendor can have different Excel formats
- **Automatic Data Normalization**: Maps vendor-specific columns to standard product schema
- **Row-Level Security**: Database-backed access control
- **Error Handling**: Detailed upload reports with success/failure counts
- **Real-time Search**: Fast product discovery across all vendors

## System Requirements

- Node.js 18+
- Next.js 14+
- MSSQL Server 2019+
- npm or yarn

## Installation

### 1. Backend Setup

```bash
# Install backend dependencies
npm install

# Required packages:
# - express
# - mssql
# - bcryptjs
# - jsonwebtoken
# - cors
# - cookie-parser
# - dotenv
# - xlsx

# Copy environment template
cp .env.example .env.local

# Update .env.local with your MSSQL credentials
```

### 2. Database Setup

```bash
# Run migration script to create database schema
# This script is located at: /scripts/01-create-database-schema.sql

# Option 1: Using SSMS (SQL Server Management Studio)
# - Open SSMS
# - Connect to your MSSQL server
# - Open the script file
# - Execute it

# Option 2: Using command line (sqlcmd)
sqlcmd -S your-server -U your-user -P your-password -i scripts/01-create-database-schema.sql
```

### 3. Frontend Setup

```bash
# Install Next.js dependencies (if not already installed)
npm install

# Next.js is included with create-next-app template
```

### 4. Environment Configuration

Update `.env.local` with your actual values:

```env
# MSSQL Configuration
DB_SERVER=your-mssql-server.database.windows.net
DB_USER=your-database-user
DB_PASSWORD=your-database-password
DB_NAME=ProductCatalogDB

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-min-32-chars

# Server
PORT=5000
NODE_ENV=production

# API URLs
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

## Running the Application

### Development Environment

```bash
# Terminal 1: Start Backend Server
node server.js
# Server runs on http://localhost:5000

# Terminal 2: Start Next.js Frontend
npm run dev
# Frontend runs on http://localhost:3000
```

### Production Environment

```bash
# Build Next.js
npm run build

# Start with production settings
NODE_ENV=production node server.js
NODE_ENV=production npm run start
```

## Application Structure

```
├── /app                          # Next.js application
│   ├── /api                      # API proxy routes
│   │   ├── /auth                # Authentication endpoints
│   │   ├── /products            # Product search/update
│   │   ├── /vendors             # Vendor management
│   │   └── /uploads             # File upload handling
│   ├── /dashboard               # Protected dashboard pages
│   │   ├── /search              # Product search page
│   │   ├── /upload              # File upload page
│   │   ├── /update              # Product update page
│   │   └── layout.tsx           # Dashboard sidebar layout
│   ├── /login                   # Login page
│   ├── /register                # Registration page
│   ├── /forgot-password         # Password reset page
│   └── layout.tsx               # Root layout
│
├── /routes                       # Express backend routes
│   ├── auth.js                  # Authentication & JWT
│   ├── vendors.js               # Vendor management
│   ├── products.js              # Product operations
│   └── uploads.js               # Excel file parsing & import
│
├── /scripts                      # Database scripts
│   └── 01-create-database-schema.sql
│
├── server.js                     # Express server entry point
├── .env.example                  # Environment template
└── package.json                  # Dependencies
```

## Database Schema

### Key Tables

**Users**: User accounts and authentication
- UserId (PK), Email (UNIQUE), PasswordHash, FirstName, LastName, IsActive, CreatedAt, UpdatedAt

**Vendors**: Vendor information
- VendorId (PK), VendorName (UNIQUE), VendorCode (UNIQUE), ContactEmail, City, Country, etc.

**VendorColumnMappings**: Excel column mapping per vendor
- MappingId (PK), VendorId (FK), ProductCodeColumn, ProductNameColumn, PriceColumn, etc.

**Products**: Normalized product data
- ProductId (PK), VendorId (FK), ProductCode, ProductName, Description, Brand, Category, Price, StockQuantity, UPC, etc.

**FileUploads**: Upload history and processing status
- FileId (PK), VendorId (FK), FileName, Status, RecordsSuccess, RecordsFailed, etc.

**PasswordResetTokens**: Password recovery tokens
- TokenId (PK), UserId (FK), Token, ExpiresAt, IsUsed

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create new account
- `POST /api/auth/login` - Login with credentials
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token
- `GET /api/auth/me` - Get current user (requires token)

### Vendors
- `GET /api/vendors` - List all active vendors
- `GET /api/vendors/:id` - Get vendor details with column mapping
- `POST /api/vendors` - Create new vendor (admin)
- `POST /api/vendors/:id/column-mapping` - Configure vendor column mapping

### Products
- `GET /api/products/search?query=...` - Search products across vendors
- `GET /api/products/latest/items` - Get latest products
- `GET /api/products/:productCode` - Get product details
- `PUT /api/products/:productCode` - Update product

### File Uploads
- `POST /api/uploads` - Upload and process Excel file
- `GET /api/uploads/history/:vendorId` - Get upload history

## Usage Guide

### 1. First Time Setup

1. Register a new account at `/register`
2. Login with credentials
3. Configure vendor column mappings (see admin panel)
4. Start uploading Excel files

### 2. Uploading Files

1. Go to "Upload Files" page
2. Select vendor from dropdown
3. Choose Excel file from your computer
4. Click "Upload and Process"
5. System automatically:
   - Parses Excel using vendor's column mapping
   - Validates data
   - Inserts/updates products in database
   - Shows success/failure report

### 3. Searching Products

1. Go to "Search Products" page
2. Enter product code, name, or UPC
3. Optionally filter by vendor
4. View results with price comparison across vendors
5. See lowest to highest prices

### 4. Updating Products

1. Go to "Update Products" page
2. Search for product
3. Select product from results
4. Edit details (name, price, stock, etc.)
5. Click "Update Product"

## Vendor Configuration

Each vendor can have a different Excel format. Configure column mappings:

### Example: ET Perfumes
- Product Code Column: "PRODUCT#"
- Product Name Column: "ITEM DESCRIPTION"
- Price Column: "PRICE"
- Stock Column: "QTY AVAIL QTY"
- Skip Header Rows: 11

### Example: Partheco International
- Product Code Column: "Product number"
- Product Name Column: "Description"
- Price Column: "Price"
- Stock Column: "Stock"
- Skip Header Rows: 9

Configure in `/dashboard/vendors` or via API.

## Security Features

- **Password Hashing**: bcrypt with salt rounds
- **JWT Authentication**: Token-based API security
- **SQL Injection Prevention**: Parameterized queries
- **CORS Protection**: Configured for API endpoints
- **HTTP-Only Cookies**: Secure token storage option
- **Input Validation**: Server-side validation on all inputs

## Performance Optimization

- **Database Indexes**: On frequently searched columns
- **Connection Pooling**: MSSQL connection pool management
- **Lazy Loading**: Dashboard components load on demand
- **Caching**: Vendor list cached in frontend
- **Pagination Ready**: API structure supports pagination

## Troubleshooting

### Database Connection Issues
```
Error: Login failed for user
- Check DB_USER and DB_PASSWORD in .env.local
- Verify MSSQL server is running
- Confirm database exists and user has permissions
```

### File Upload Fails
```
Error: Vendor column mapping not configured
- Go to vendor settings
- Configure column mapping for the vendor
- Retry upload
```

### Search Returns No Results
```
- Check if products are uploaded (Dashboard > Recent Uploads)
- Verify product code/name is correct
- Try different search terms
- Check database contains products
```

### Password Reset Not Working
```
- Verify email server configuration (SMTP)
- Check token hasn't expired (1 hour)
- Ensure database can access PasswordResetTokens table
```

## Development Tips

### Adding a New Vendor
1. Create vendor in database: `INSERT INTO Vendors...`
2. Configure column mapping: API endpoint `/api/vendors/:id/column-mapping`
3. Upload first file to test
4. Adjust mapping if needed

### Modifying Product Fields
1. Update VendorColumnMappings table to include new column
2. Update SQL schema if adding permanent columns
3. Update upload parsing logic in `/routes/uploads.js`
4. Test with sample file

### Customizing UI
- Theme colors: Edit `/app/globals.css` design tokens
- Sidebar: Modify `/app/dashboard/layout.tsx`
- Components: Update individual pages in `/app/dashboard/`

## Support & Documentation

For detailed API documentation, see the inline comments in route files.

For MSSQL setup help: https://docs.microsoft.com/en-us/sql/

For Next.js documentation: https://nextjs.org/docs

For Express documentation: https://expressjs.com/

## License

This project is proprietary and confidential.

## Future Enhancements

- [ ] Bulk operations (update multiple products)
- [ ] Advanced filtering and sorting
- [ ] Product categories and hierarchies
- [ ] Vendor performance analytics
- [ ] Email notifications for uploads
- [ ] API rate limiting
- [ ] Two-factor authentication
- [ ] Product image support
- [ ] Inventory alerts
- [ ] Price history tracking

## Contact

For support or questions, contact the development team.
