# MSSQL Setup Guide for Product Catalog Manager

## Your Database Configuration

```
Server: AUC-Laptop-032\MSSQLSERVER2026
User: sa
Password: 1234
Database: ProductCatalog
```

## Prerequisites

- MSSQL Server 2019 or higher installed on `AUC-Laptop-032`
- SQL Server Management Studio (SSMS) installed
- Node.js 16+ installed on your development machine
- Network access to the MSSQL server

## Step 1: Create Database (if not exists)

Open **SQL Server Management Studio** and connect to your server:
- Server name: `AUC-Laptop-032\MSSQLSERVER2026`
- Authentication: SQL Server Authentication
- Login: `sa`
- Password: `1234`

Then run this command to create the database if it doesn't exist:

```sql
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'ProductCatalog')
BEGIN
    CREATE DATABASE ProductCatalog;
END
```

## Step 2: Create Tables

Copy the entire contents of `/scripts/01-create-database-schema.sql` and execute it in SSMS under the **ProductCatalog** database.

This will create all required tables:
- Users (for authentication)
- Vendors (for vendor management and column mapping)
- VendorColumnMappings (for flexible Excel column mapping)
- Products (for product catalog)
- ProductVendorPrices (for multi-vendor pricing)
- FileUploads (for upload tracking)
- PasswordResetTokens (for password recovery)

## Step 3: Environment Configuration

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. The `.env.local` should already have your database credentials:
   ```
   DB_SERVER=AUC-Laptop-032\MSSQLSERVER2026
   DB_USER=sa
   DB_PASSWORD=1234
   DB_NAME=ProductCatalog
   DB_ENCRYPT=false
   DB_TRUST_SERVER_CERTIFICATE=true
   DB_POOL_MAX=10
   DB_POOL_MIN=0
   DB_IDLE_TIMEOUT=30000
   ```

3. Update the JWT_SECRET to something strong:
   ```
   JWT_SECRET=your-very-secure-secret-key-minimum-32-characters-long
   ```

## Step 4: Install Dependencies

```bash
npm install
```

This installs:
- **express** - Web framework
- **mssql** - MSSQL client driver
- **bcryptjs** - Password hashing
- **jsonwebtoken** - JWT authentication
- **multer** - File upload handling
- **xlsx** - Excel file parsing
- **dotenv** - Environment variable management
- **cors** - Cross-origin resource sharing
- **cookie-parser** - HTTP cookie parsing

## Step 5: Run Database Script

Execute the database schema script:

### Option A: Using SQL Server Management Studio (Recommended)

1. Open SSMS
2. Connect to your MSSQL server
3. Open the file `/scripts/01-create-database-schema.sql`
4. Click **Execute** or press **Ctrl+E**
5. Verify all tables are created by viewing the Object Explorer

### Option B: Using Command Line (sqlcmd)

```bash
sqlcmd -S "AUC-Laptop-032\MSSQLSERVER2026" -U sa -P 1234 -d ProductCatalog -i scripts/01-create-database-schema.sql
```

## Step 6: Start the Backend Server

```bash
node server.js
```

Expected output:
```
Database connection successful
Server running on port 5000
```

If you see connection errors:
- Verify MSSQL server is running
- Check server name: `AUC-Laptop-032\MSSQLSERVER2026`
- Verify credentials: `sa` / `1234`
- Ensure ProductCatalog database exists
- Check firewall allows port 1433

## Step 7: Start the Frontend

In a new terminal:

```bash
npm run dev
```

Frontend will run on `http://localhost:3000`

## Step 8: First Login

1. Navigate to `http://localhost:3000`
2. Click "Register" to create an account
3. Use your account to login
4. Start uploading vendor Excel files

## Testing Database Connection

To test your MSSQL connection, run this command:

```bash
node -e "const sql = require('mssql'); const config = { user: 'sa', password: '1234', database: 'ProductCatalog', server: 'AUC-Laptop-032', options: { encrypt: false, trustServerCertificate: true, instanceName: 'MSSQLSERVER2026' } }; new sql.ConnectionPool(config).connect().then(() => { console.log('✓ Connection successful'); process.exit(0); }).catch(err => { console.error('✗ Connection failed:', err); process.exit(1); });"
```

## Troubleshooting

### Connection Error: "Server not found"
- Check server name spelling: `AUC-Laptop-032\MSSQLSERVER2026`
- Ensure MSSQL Server service is running
- Open SQL Server Configuration Manager and verify named pipe and TCP/IP are enabled

### Connection Error: "Login failed"
- Verify credentials: User `sa`, Password `1234`
- Check if `sa` account is enabled in SSMS

### Connection Error: "Network or instance-specific error"
- Ensure MSSQL Browser service is running (required for named instances)
- Check Windows Firewall allows port 1433
- Try connecting with IP: `localhost\MSSQLSERVER2026` or `127.0.0.1\MSSQLSERVER2026`

### Database not found
- Run the CREATE DATABASE command first (Step 2)
- Verify database name is exactly "ProductCatalog"

## Production Deployment

Before deploying to production:

1. Change the `sa` password to a strong password
2. Create a dedicated application user with limited permissions:
   ```sql
   CREATE LOGIN AppUser WITH PASSWORD = 'strong-password';
   USE ProductCatalog;
   CREATE USER AppUser FOR LOGIN AppUser;
   GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::dbo TO AppUser;
   ```

3. Update JWT_SECRET to a cryptographically secure random string
4. Set NODE_ENV=production
5. Enable encryption in options: `DB_ENCRYPT=true`
6. Use environment-specific .env files (.env.production)

## File Upload Notes

When uploading Excel files:

1. **First upload**: You'll need to map columns from your vendor Excel to the system
2. **Vendor format**: The system stores the mapping and reuses it for future uploads
3. **Flexible schema**: Different vendors can have different column formats
4. **Data normalization**: All vendor data is normalized to standard schema

## Getting Help

- Check `/README.md` for API documentation
- Review `/SETUP_GUIDE.md` for general setup
- Check console logs in both frontend and backend for detailed error messages

---

**Your application is now ready for development!**

Navigate to `http://localhost:3000` to start using the Product Catalog Manager.
