# VendorPro Deployment Summary

## Domain
**vendorpro.beautystorellc.com**

## Services Running
✅ **Backend** (Express.js API) - Port 5000  
✅ **Frontend** (Next.js) - Port 3000  
✅ **Web Server** (Apache2 Reverse Proxy) - Ports 80/443  

## Deployment Location
```
/var/www/vendorpro.beautystorellc.com/
```

## Key Configuration Files
- **Environment**: `/var/www/vendorpro.beautystorellc.com/.env.local`
- **PM2 Config**: `/var/www/vendorpro.beautystorellc.com/ecosystem.config.js`
- **Apache HTTP**: `/etc/apache2/sites-available/vendorpro.beautystorellc.com.conf`
- **Apache HTTPS**: `/etc/apache2/sites-available/vendorpro.beautystorellc.com-le-ssl.conf`

## Database Configuration
- **Server**: 172.30.36.124 (On-premises MSSQL)
- **Database**: ProductCatalog
- **User**: sa
- **Status**: ⏳ Waiting for VPN/ExpressRoute connectivity

## SSL Certificate
- **Provider**: Let's Encrypt
- **Domain**: vendorpro.beautystorellc.com
- **Expiry**: August 26, 2026
- **Path**: `/etc/letsencrypt/live/vendorpro.beautystorellc.com/`

## Next Steps

### 1. Configure DNS
Point your domain DNS to this Azure VM's public IP:
```
vendorpro.beautystorellc.com → <VM_PUBLIC_IP>
www.vendorpro.beautystorellc.com → <VM_PUBLIC_IP>
```

### 2. Update API URL (if needed)
The frontend currently uses: `http://vendorpro.beautystorellc.com:5000/api`

If this needs adjustment, update in `.env.local`:
```
NEXT_PUBLIC_API_URL=http://vendorpro.beautystorellc.com:5000/api
```

### 3. Database Connectivity
Once your VPN/ExpressRoute is configured and the on-premises MSSQL is reachable:
```bash
cd /var/www/vendorpro.beautystorellc.com
node scripts/test-connection.js
```

If successful, run the database initialization:
```bash
node scripts/init-database.js
```

### 4. Restart services (if needed)
```bash
# Restart both services
pm2 restart vendorpro-backend vendorpro-frontend

# Or restart individual service
pm2 restart vendorpro-backend

# View logs
pm2 logs vendorpro-backend
pm2 logs vendorpro-frontend
```

## Application Access

| URL | Purpose |
|-----|---------|
| `https://vendorpro.beautystorellc.com/` | Main application |
| `https://vendorpro.beautystorellc.com/login` | Login page |
| `https://vendorpro.beautystorellc.com/register` | User registration |
| `https://vendorpro.beautystorellc.com/dashboard` | Dashboard |
| `https://vendorpro.beautystorellc.com/api/health` | API health check |

## Monitoring

### Check service status
```bash
pm2 status
pm2 monit
```

### View logs
```bash
pm2 logs vendorpro-backend
pm2 logs vendorpro-frontend
tail -f /var/log/apache2/vendorpro-error.log
tail -f /var/log/apache2/vendorpro-access.log
```

### Save PM2 processes to start on reboot
```bash
sudo pm2 save
sudo pm2 startup systemd -u wholesaleadmin --hp /home/wholesaleadmin
```

## Troubleshooting

### Backend crashes
Check database connection first:
```bash
cd /var/www/vendorpro.beautystorellc.com
node scripts/test-connection.js
```

### High memory usage
Monitor with `pm2 monit` and check the logs for memory leaks.

### Apache not proxying requests
Verify modules are enabled:
```bash
sudo a2enmod proxy proxy_http rewrite ssl headers
sudo systemctl reload apache2
```

## Architecture

```
┌─────────────────────────────────────────┐
│  User Browser (HTTPS)                   │
│  https://vendorpro.beautystorellc.com   │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│  Apache2 (Reverse Proxy)                │
│  Port 80/443                            │
│  - HTTP → HTTPS redirect                │
│  - SSL/TLS termination                  │
│  - Security headers                     │
└────┬──────────────────────────────┬─────┘
     │                              │
     ▼                              ▼
┌──────────────────┐      ┌──────────────────┐
│ Next.js Frontend │      │ Express Backend  │
│ Port 3000        │      │ Port 5000        │
│ - UI routes      │      │ - API endpoints  │
│ - Static assets  │      │ - Database calls │
└──────────────────┘      └────────┬─────────┘
                                   │
                                   ▼
                        ┌─────────────────────┐
                        │  MSSQL Database     │
                        │  172.30.36.124:1433 │
                        │  (On-premises)      │
                        └─────────────────────┘
```

## Node.js Version
```
v20.20.2
npm 10.8.2
```

## Support
For issues, check the logs first:
```bash
pm2 logs
```
