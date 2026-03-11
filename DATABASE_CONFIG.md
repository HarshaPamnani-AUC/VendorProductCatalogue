# Database Configuration - Product Catalog Manager

## Current Configuration

Your MSSQL database has been configured with the following details:

### Connection Details
- **Server**: `AUC-Laptop-032\MSSQLSERVER2026`
- **User**: `sa`
- **Password**: `1234`
- **Database**: `ProductCatalog`
- **Port**: 1433 (default)

### Connection Options
- **Encryption**: Disabled (DB_ENCRYPT=false)
- **Trust Server Certificate**: Enabled (DB_TRUST_SERVER_CERTIFICATE=true)
- **Pool Size**: Max 10, Min 0 connections
- **Idle Timeout**: 30000ms (30 seconds)
- **Connection Timeout**: 30000ms
- **Request Timeout**: 30000ms

## Stored Locations

### Environment File
**File**: `.env.local`
- Contains your actual credentials
- **Never commit this file to version control**
- Add `.env.local` to `.gitignore`

### Backup Configuration
**File**: `.env.example`
- Template for other developers
- Replace sensitive values with placeholders

## Database Schema

### Tables Created

1. **Users**
   - User authentication and account management
   - Stores username, email, hashed password

2. **Vendors**
   - Vendor information (name, contact, etc.)
   - Used for product source tracking

3. **Products**
   - Main product catalog
   - Stores product code, description, category

4. **ProductVariants**
   - Price and stock information per vendor
   - Tracks price changes over time

5. **VendorColumnMappings**
   - Flexible column mapping for each vendor
   - Allows handling different Excel formats

6. **FileUploadHistory**
   - Upload tracking and audit trail
   - Records which files were uploaded when

7. **PasswordResetTokens**
   - Secure password reset functionality
   - Time-limited reset tokens

## Verification Steps

### 1. Check MSSQL Server is Running
```bash
# On Windows - Open Services
# Look for: SQL Server (MSSQLSERVER2026)
# Status: Running
```

### 2. Test Connection from Application
```bash
npm run db:test
```

Expected output:
```
✓ Database connection successful!
✓ Test query executed successfully
Database Info: {...}
Existing Tables: [...]
```

### 3. Initialize Database Schema
```bash
npm run db:init
```

Expected output:
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

## Troubleshooting

### Issue: Connection Refused

**Symptoms**: 
```
Error: connect ECONNREFUSED
```

**Solutions**:
1. Verify MSSQL Server is running
2. Check server name spelling: `AUC-Laptop-032\MSSQLSERVER2026`
3. Enable TCP/IP protocol in SQL Server Configuration Manager:
   - SQL Server Configuration Manager
   - Protocols for MSSQLSERVER2026
   - Enable TCP/IP

### Issue: Login Failed

**Symptoms**:
```
Error: Login failed for user 'sa'
```

**Solutions**:
1. Verify credentials in `.env.local`
2. Check sa account is enabled in MSSQL
3. Reset sa password if forgotten:
   - Use Windows Authentication to connect
   - Run: `ALTER LOGIN sa ENABLE;`

### Issue: Database Not Found

**Symptoms**:
```
Error: Database 'ProductCatalog' does not exist
```

**Solutions**:
1. Run initialization script: `npm run db:init`
2. Or manually create database:
   ```sql
   CREATE DATABASE ProductCatalog;
   ```

### Issue: Timeout Errors

**Symptoms**:
```
Error: Request timeout
Error: Connection timeout
```

**Solutions**:
1. Check MSSQL Server performance
2. Verify network connection is stable
3. Increase timeout values in `.env.local`:
   ```
   DB_IDLE_TIMEOUT=60000
   ```

## Security Recommendations

### For Development
- Current config is acceptable for local development
- Change `JWT_SECRET` to a strong random string
- Use `NODE_ENV=development`

### For Production
- Use strong password instead of `1234`
- Enable encryption: `DB_ENCRYPT=true`
- Use domain authentication instead of SQL Server authentication
- Implement IP whitelisting
- Use environment variables from secure vault
- Enable SQL Server Auditing
- Regular backups
- Use `NODE_ENV=production`

## Backup and Recovery

### Database Backup
```sql
-- Backup database
BACKUP DATABASE [ProductCatalog]
TO DISK = 'C:\Backups\ProductCatalog.bak'
WITH INIT, COMPRESSION;

-- List backups
RESTORE HEADERONLY FROM DISK = 'C:\Backups\ProductCatalog.bak';

-- Restore database
RESTORE DATABASE [ProductCatalog]
FROM DISK = 'C:\Backups\ProductCatalog.bak'
WITH REPLACE;
```

## Scaling Considerations

### Connection Pool Tuning
Current configuration (Max 10 connections) is suitable for:
- Single user to small team (5-10 users)
- Moderate traffic

For scaling:
```
Low Traffic:     DB_POOL_MAX=5, DB_POOL_MIN=0
Medium Traffic:  DB_POOL_MAX=20, DB_POOL_MIN=5
High Traffic:    DB_POOL_MAX=50, DB_POOL_MIN=10
```

### Performance Optimization
1. Add indexes on frequently searched columns
2. Archive old file upload history
3. Implement product caching
4. Use connection pooling (already configured)
5. Monitor query performance

## Additional Resources

- **MSSQL Documentation**: https://learn.microsoft.com/en-us/sql/
- **mssql npm package**: https://github.com/tediousjs/node-mssql
- **Connection strings**: https://www.connectionstrings.com/sql-server/

## Support

For database-related issues:
1. Check this document first
2. Review QUICK_START.md for setup steps
3. Check server.js for connection configuration
4. Review SQL Server error logs in MSSQL Server Management Studio
