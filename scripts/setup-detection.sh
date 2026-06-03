#!/bin/bash

# Quick Start Guide for Real Anomaly Detection
# This script will help you verify and start the detection system

set -e

echo "════════════════════════════════════════════════════════════════"
echo "🔬 Real Anomaly Detection System - Setup & Verification"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo "❌ Error: .env.production not found"
    echo "   Please ensure .env.production exists with database credentials"
    exit 1
fi
echo "✅ .env.production found"

# Check if required Node packages exist
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js not found"
    exit 1
fi
echo "✅ Node.js available: $(node --version)"

# Check mssql package
if [ ! -d "node_modules/mssql" ]; then
    echo "⚠️  Installing mssql package..."
    npm install mssql --save
fi
echo "✅ mssql package available"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Step 1: Verify Database Connection"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

node -e "
require('dotenv').config({ path: '.env.production' });
const sql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: { encrypt: true, trustServerCertificate: true }
};

(async () => {
  try {
    const pool = new sql.ConnectionPool(config);
    await pool.connect();
    console.log('✅ Connected to database');
    
    const result = await pool.request().query(\`
      SELECT COUNT(*) as RecordCount FROM [dbo].[Tbl_Products_Storage]
    \`);
    console.log('✅ Product history records:', result.recordset[0].RecordCount);
    
    const alertResult = await pool.request().query(\`
      SELECT COUNT(*) as AlertCount FROM [dbo].[AI_Alerts]
    \`);
    console.log('✅ Existing alerts:', alertResult.recordset[0].AlertCount);
    
    await pool.close();
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
" || exit 1

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Step 2: Run One-Time Detection Test"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ -f "scripts/detect-price-anomalies.js" ]; then
    echo "Running detection script..."
    node scripts/detect-price-anomalies.js || {
        echo "⚠️  Detection script had warnings, but may have completed"
    }
else
    echo "❌ Error: scripts/detect-price-anomalies.js not found"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Step 3: Update PM2 Configuration & Restart"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if command -v pm2 &> /dev/null; then
    echo "Checking PM2..."
    echo "Current apps:"
    pm2 list || true
    echo ""
    echo "To reload with new anomaly detection scheduler, run:"
    echo "  pm2 reload ecosystem.config.js"
    echo ""
    echo "To verify it started:"
    echo "  pm2 show anomaly-detection-scheduler"
    echo "  pm2 logs anomaly-detection-scheduler"
else
    echo "⚠️  PM2 not installed globally. Install with: npm install -g pm2"
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "✅ Setup Complete!"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "📋 Next Steps:"
echo "  1. Reload PM2: pm2 reload ecosystem.config.js"
echo "  2. Check logs: tail -f logs/anomaly-detection-out.log"
echo "  3. View dashboard: http://your-domain/dashboard/anomalies"
echo "  4. Trigger detection: curl -X POST http://localhost:5000/api/ai/anomalies/detect"
echo ""
echo "📖 Documentation: See REAL_ANOMALY_DETECTION.md"
echo ""
