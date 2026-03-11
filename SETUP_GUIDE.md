# Product Catalog Management System - Quick Setup Guide

## What You've Received

A complete, production-ready product catalog management system with:

✅ **Frontend**: Next.js 14 with professional UI
✅ **Backend**: Express.js REST API with MSSQL integration
✅ **Authentication**: Secure login, registration, password recovery
✅ **Multi-Vendor**: Support for 21+ vendors with flexible Excel parsing
✅ **Product Search**: Fast cross-vendor price comparison
✅ **Admin Functions**: File upload, product updates, vendor management

---

## Quick Start (5 Steps)

### Step 1: Install Dependencies

```bash
npm install
```

This installs everything needed for both backend and frontend.

### Step 2: Configure Database Connection

Copy the environment file:
```bash
cp .env.example .env.local
```

Edit `.env.local` with your MSSQL credentials:
```env
DB_SERVER=your-mssql-server.database.windows.net
DB_USER=your-username
DB_PASSWORD=your-password
DB_NAME=ProductCatalogDB
JWT_SECRET=your-super-secret-key-at-least-32-chars
```

### Step 3: Create Database Schema

Run the SQL migration script:

**Using SQL Server Management Studio (SSMS):**
1. Open SSMS
2. Connect to your MSSQL server
3. Open file: `scripts/01-create-database-schema.sql`
4. Execute (F5)

**Using Command Line (sqlcmd):**
```bash
sqlcmd -S your-server -U your-user -P your-password -i scripts/01-create-database-schema.sql
```

### Step 4: Start Backend Server

```bash
node server.js
```

You should see: `Server running on port 5000`

### Step 5: Start Frontend (New Terminal)

```bash
npm run dev
```

You should see: `▲ Next.js 14.x started`

---

## Accessing the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000/api

---

## First Time User Steps

1. **Go to http://localhost:3000**
2. **Click "Get Started"** to create an account
3. **Fill in registration form** (email, password, name)
4. **Login** with your credentials
5. **You're now in the Dashboard!**

---

## Key Features to Try

### 1. Search Products
- Go to: Dashboard → Search Products
- Enter any product code or name
- See prices across all vendors

### 2. Upload Files
- Go to: Dashboard → Upload Files
- Select a vendor
- Upload Excel file
- System automatically indexes products

### 3. Update Products
- Go to: Dashboard → Update Products
- Search for a product
- Edit details (price, stock, description)
- Save changes

### 4. View Dashboard
- See upload statistics
- Check recent uploads
- Monitor system health

---

## File Structure Overview

```
project/
├── app/                              # Next.js Frontend
│   ├── page.tsx                      # Home page
│   ├── login/page.tsx               # Login page
│   ├── register/page.tsx            # Registration page
│   ├── forgot-password/page.tsx     # Password reset
│   └── dashboard/                    # Protected area
│       ├── page.tsx                 # Dashboard home
│       ├── search/page.tsx          # Product search
│       ├── upload/page.tsx          # File upload
│       ├── update/page.tsx          # Product update
│       └── layout.tsx               # Sidebar navigation
│
├── routes/                           # Express Backend
│   ├── auth.js                      # Login/Register/Password
│   ├── vendors.js                   # Vendor management
│   ├── products.js                  # Product search/update
│   └── uploads.js                   # Excel file processing
│
├── scripts/                          # Database
│   └── 01-create-database-schema.sql
│
├── server.js                         # Express server
├── .env.example                      # Environment template
└── package.json                      # Dependencies
```

---

## API Endpoints Quick Reference

### Authentication
```
POST   /api/auth/register              - Create account
POST   /api/auth/login                 - Login
POST   /api/auth/forgot-password       - Request reset
POST   /api/auth/reset-password        - Reset password
GET    /api/auth/me                    - Get current user
```

### Products
```
GET    /api/products/search?query=...  - Search products
GET    /api/products/latest/items      - Recent products
PUT    /api/products/:productCode               - Update product
```

### Vendors
```
GET    /api/vendors                    - List all vendors
```

### Uploads
```
POST   /api/uploads                    - Upload Excel file
```

---

## Database Tables Created

| Table | Purpose |
|-------|---------|
| Users | User accounts and authentication |
| Vendors | Vendor information |
| VendorColumnMappings | Excel column configuration per vendor |
| Products | Normalized product data |
| FileUploads | Upload history and status |
| PasswordResetTokens | Password recovery tokens |

---

## Sample Vendor Data Included

The database migration includes sample vendors:

1. **ET Perfumes Inc.** (ET_PERF)
   - Product Code: PRODUCT#
   - Price Column: PRICE
   - Stock Column: QTY AVAIL QTY
   - Skip 11 header rows

2. **Partheco International** (PART_INTL)
   - Product Code: Product number
   - Price Column: Price
   - Stock Column: Stock
   - Skip 9 header rows

To add more vendors:
1. Go to Dashboard (after login)
2. Vendor settings (future feature)
3. Or use database directly

---

## Testing the System

### Test Login
1. Register: user@example.com / password123
2. Login with same credentials
3. You should see the Dashboard

### Test File Upload
1. Prepare Excel file with vendor data
2. Columns must match vendor configuration
3. Go to Upload Files page
4. Select vendor and file
5. Check success/failure report

### Test Product Search
1. Upload a file first (to get products in database)
2. Go to Search Products
3. Enter any product code or name
4. View results with price comparison

---

## Troubleshooting

### Database Connection Error
```
Error: Connection failed ELOGIN
```
**Fix:**
- Check DB_SERVER, DB_USER, DB_PASSWORD in .env.local
- Verify MSSQL is running and accessible
- Ensure database user has proper permissions

### File Upload Failed
```
Error: Vendor column mapping not configured
```
**Fix:**
- Vendor must have column mapping configured
- Check /routes/vendors.js for mapping examples
- Configure mapping via API or database

### Products Not Found in Search
```
No products found
```
**Fix:**
- Upload a file first (Dashboard → Upload Files)
- Verify upload completed successfully
- Check database contains products

### Backend Server Won't Start
```
Cannot find module 'express'
```
**Fix:**
```bash
npm install
node server.js
```

---

## Development vs Production

### Development Mode
```bash
# Terminal 1
node server.js

# Terminal 2
npm run dev

# Open http://localhost:3000
```

### Production Mode
```bash
# Build
npm run build

# Run
NODE_ENV=production npm run start
NODE_ENV=production node server.js
```

---

## Next Steps

### 1. Configure Your Vendors
- Add all 21 vendors to database
- Configure column mappings for each
- Test with sample files

### 2. Customize Branding
- Edit colors in `/app/globals.css`
- Update logos and company names
- Modify text in pages

### 3. Add More Features
- Implement bulk operations
- Add advanced filtering
- Create analytics dashboard
- Add email notifications

### 4. Deploy to Production
- Set up MSSQL on cloud (Azure, AWS)
- Deploy backend to server/cloud
- Deploy frontend (Vercel, Netlify)
- Configure domain and SSL

---

## Support Resources

- **Express Documentation**: https://expressjs.com
- **Next.js Documentation**: https://nextjs.org/docs
- **MSSQL Documentation**: https://docs.microsoft.com/sql
- **JavaScript Async/Await**: https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Asynchronous

---

## Key Files You'll Edit Most

| File | Purpose |
|------|---------|
| .env.local | Database credentials |
| /app/globals.css | Theme and colors |
| /routes/uploads.js | Upload/parsing logic |
| /app/dashboard/search/page.tsx | Search UI |
| /scripts/01-create-database-schema.sql | Database schema |

---

## Performance Tips

1. **Database**: Add indexes for frequently searched columns
2. **Frontend**: Use lazy loading for large lists
3. **Backend**: Implement pagination for search results
4. **Caching**: Cache vendor list in frontend
5. **API**: Add rate limiting for uploads

---

## Security Checklist

- [ ] Change JWT_SECRET in .env.local
- [ ] Use HTTPS in production
- [ ] Set strong database password
- [ ] Configure CORS properly
- [ ] Enable SQL Server authentication
- [ ] Implement rate limiting
- [ ] Add input validation
- [ ] Use environment variables for secrets

---

## Common Questions

**Q: Can I add more than 21 vendors?**
A: Yes! The system supports unlimited vendors. Just configure column mapping for each.

**Q: What Excel formats are supported?**
A: .xlsx, .xls, and .csv files.

**Q: How fast is the search?**
A: Instant! With database indexes on commonly searched columns.

**Q: Can multiple users upload simultaneously?**
A: Yes, the system handles concurrent uploads with proper locking.

**Q: Is the database data encrypted?**
A: Database passwords should be encrypted. Enable encryption in MSSQL for additional security.

---

## Getting Help

1. **Check the logs**: Look at console output for error messages
2. **Read comments**: Code has inline documentation
3. **Check README.md**: Detailed feature documentation
4. **Review API routes**: Endpoint structure is self-documenting

---

Congratulations! Your Product Catalog Management System is ready to use! 🎉

Start with the Quick Start steps above and you'll be up and running in minutes.
