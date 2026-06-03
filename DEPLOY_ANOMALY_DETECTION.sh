#!/bin/bash

# Setup Instructions for Real Anomaly Detection
# Run this to deploy the anomaly detection system

echo "📋 DEPLOYMENT INSTRUCTIONS"
echo "🎯 Real Price Anomaly Detection System"
echo ""
echo "This guide will help you deploy the real anomaly detection system."
echo "The system analyzes actual supplier prices and automatically detects"
echo "unusual price changes using statistical analysis."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Step 0: Pre-flight checks
echo "⚙️  STEP 0: Pre-Flight Checks"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ ! -f .env.production ]; then
    echo "❌ .env.production not found"
    echo "   Create this file with your database credentials"
    exit 1
fi
echo "✅ .env.production exists"

if [ ! -f ecosystem.config.js ]; then
    echo "❌ ecosystem.config.js not found"
    exit 1
fi
echo "✅ ecosystem.config.js exists"

if [ ! -d node_modules ]; then
    echo "ℹ️  node_modules not found, installing..."
    npm install
fi
echo "✅ Dependencies installed"

echo ""
echo "⚙️  STEP 1: Verify New Files"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

files_to_check=(
    "scripts/detect-price-anomalies.js"
    "scripts/anomaly-scheduler.js"
    "app/api/ai/anomalies/detect/route.ts"
    "components/AnomalyDetectionPanel.tsx"
    "REAL_ANOMALY_DETECTION.md"
)

for file in "${files_to_check[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file (MISSING - deployment may be incomplete)"
    fi
done

echo ""
echo "⚙️  STEP 2: Verify Database Tables"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "The system requires these database tables:"
echo "  • Tbl_Products_Storage (price history - MUST EXIST)"
echo "  • AI_Alerts (for storing detected anomalies)"
echo ""
echo "Verify in SQL Server Management Studio:"
echo "  SELECT COUNT(*) FROM [dbo].[Tbl_Products_Storage];"
echo "  SELECT COUNT(*) FROM [dbo].[AI_Alerts];"
echo ""
echo "📌 If AI_Alerts doesn't exist, run:"
echo "  node -e \"console.log('See database schema at: scripts/01-create-database-schema.sql')\""
echo ""

echo "⚙️  STEP 3: Build & Deploy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Build Next.js
echo "Building Next.js..."
npm run build

# Kill existing PM2 processes
if command -v pm2 &> /dev/null; then
    echo "Stopping existing services..."
    pm2 delete all 2>/dev/null || true
fi

echo ""
echo "⚙️  STEP 4: Start Services with PM2"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2 globally..."
    npm install -g pm2
fi

echo "Starting applications..."
pm2 start ecosystem.config.js --env production

echo ""
echo "Waiting for services to start..."
sleep 3

echo ""
pm2 list
echo ""

echo "⚙️  STEP 5: Verify Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Backend service:"
pm2 show vendorpro-backend | head -5 || echo "⚠️  Backend not running"

echo ""
echo "Frontend service:"
pm2 show vendorpro-frontend | head -5 || echo "⚠️  Frontend not running"

echo ""
echo "Anomaly Detection Scheduler:"
pm2 show anomaly-detection-scheduler | head -5 || echo "⚠️  Scheduler not running"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ DEPLOYMENT COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "📝 USAGE COMMANDS"
echo ""
echo "View all services:"
echo "  pm2 list"
echo ""
echo "View anomaly detection logs:"
echo "  pm2 logs anomaly-detection-scheduler"
echo ""
echo "Monitor specific service:"
echo "  pm2 show anomaly-detection-scheduler"
echo ""
echo "Manual detection trigger:"
echo "  curl -X POST http://localhost:5000/api/ai/anomalies/detect"
echo ""
echo "Get detection status:"
echo "  curl http://localhost:5000/api/ai/anomalies/detect/status"
echo ""

echo "🌐 ACCESS POINTS"
echo ""
echo "Dashboard:"
echo "  http://your-domain/dashboard/anomalies"
echo ""
echo "Detection Panel (on main dashboard):"
echo "  http://your-domain/dashboard"
echo ""

echo "📖 DOCUMENTATION"
echo ""
echo "Full guide: REAL_ANOMALY_DETECTION.md"
echo "  • How detection works"
echo "  • Configuration options"
echo "  • Troubleshooting guide"
echo "  • Performance metrics"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
