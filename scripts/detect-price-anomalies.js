/**
 * Real-time Price Anomaly Detection
 * Analyzes Tbl_Products_Storage to detect genuine price anomalies
 * Uses Z-score statistical analysis
 * 
 * Run: node scripts/detect-price-anomalies.js
 * Or scheduled via PM2 in ecosystem.config.js
 */

require('dotenv').config({ path: '.env.production' });
const sql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  authentication: { type: 'default' },
  options: {
    encrypt: true,
    trustServerCertificate: true,
    enableKeepAlive: true,
    connectTimeout: 30000,
    requestTimeout: 180000
  }
};

// Statistical helpers
function calculateStats(prices) {
  if (prices.length === 0) return null;
  
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const variance = prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / prices.length;
  const stdDev = Math.sqrt(variance);
  
  return { mean, stdDev, count: prices.length };
}

function calculateZScore(value, stats) {
  if (!stats || stats.stdDev === 0) return 0;
  return (value - stats.mean) / stats.stdDev;
}

async function detectAnomalies() {
  let pool;
  try {
    console.log('🔄 Connecting to database...');
    pool = new sql.ConnectionPool(config);
    await pool.connect();
    console.log('✅ Connected\n');

    // 1. Get all products grouped by UPC/EAN with pricing data
    console.log('📊 Fetching product price history...');
    const productsResult = await pool.request().query(`
      SELECT TOP 30000
        [EAN/UPC] as EAN,
        [Name],
        [Item_Code],
        [Vendor],
        [Price],
        [Qty],
        [Date],
        [UploadDatetime]
      FROM [dbo].[Tbl_Products_Storage]
      WHERE [Date] >= DATEADD(month, -1, CAST(GETUTCDATE() AS DATE))
        AND [Price] IS NOT NULL
        AND [Price] != ''
      ORDER BY [Date] DESC
    `);

    const allProducts = productsResult.recordset;
    console.log(`✅ Fetched ${allProducts.length} price records\n`);

    if (allProducts.length === 0) {
      console.log('⚠️  No products found in price history');
      return;
    }

    // 2. Group by EAN + Vendor and calculate statistics
    console.log('🔍 Analyzing price patterns by product & vendor...');
    const productVendorGroups = {};

    allProducts.forEach(record => {
      // Parse price (it's stored as text)
      const priceVal = parseFloat(record.Price);
      
      // Skip invalid prices
      if (isNaN(priceVal) || priceVal <= 0 || priceVal > 10000) return;
      
      const key = `${record.EAN}|${record.Vendor}`;
      if (!productVendorGroups[key]) {
        productVendorGroups[key] = {
          ean: record.EAN,
          name: record.Name,
          vendor: record.Vendor,
          itemCode: record.Item_Code,
          prices: [],
          records: []
        };
      }
      productVendorGroups[key].prices.push(priceVal);
      productVendorGroups[key].records.push({ ...record, Price: priceVal });
    });

    // 3. Detect anomalies
    console.log('🎯 Detecting anomalies...\n');
    const anomalies = [];

    Object.entries(productVendorGroups).forEach(([key, group]) => {
      if (group.prices.length < 3) return; // Need min 3 data points

      // Split into recent (last 1/3) and historical (older 2/3)
      const recentCount = Math.max(2, Math.ceil(group.prices.length / 3));
      const recentPrices = group.prices.slice(0, recentCount);
      const historicalPrices = group.prices.slice(recentCount);
      
      if (historicalPrices.length < 2) return;

      const recentMean = recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length;
      const historicalStats = calculateStats(historicalPrices);
      
      if (!historicalStats || historicalStats.stdDev === 0) return;

      // Calculate Z-score of recent prices against historical baseline
      const zScore = (recentMean - historicalStats.mean) / historicalStats.stdDev;
      const latestPrice = group.prices[0];
      const priceChangePercent = ((latestPrice - historicalStats.mean) / historicalStats.mean) * 100;

      // Determine anomaly type and severity
      let alertType = null;
      let severity = null;
      let shouldAlert = false;

      if (Math.abs(zScore) > 2.5) {
        alertType = 'OUTLIER';
        severity = 'CRITICAL';
        shouldAlert = true;
      } else if (zScore > 2.0) {
        alertType = 'PRICE_SPIKE';
        severity = 'HIGH';
        shouldAlert = true;
      } else if (zScore > 1.0) {
        alertType = 'PRICE_SPIKE';
        severity = 'MEDIUM';
        shouldAlert = true;
      } else if (zScore < -2.0) {
        alertType = 'PRICE_DROP';
        severity = 'HIGH';
        shouldAlert = true;
      } else if (zScore < -1.0) {
        alertType = 'PRICE_DROP';
        severity = 'MEDIUM';
        shouldAlert = true;
      }

      if (shouldAlert && alertType && severity) {
        const oldPrice = stats.mean;
        const priceChange = latestPrice - oldPrice;

        // Estimate monthly impact (simple: use avg qty from latest records)
        const avgQty = group.records.slice(0, 5).reduce((a, b) => {
          const qty = parseFloat(b.Qty) || 0;
          return a + qty;
        }, 0) / Math.min(5, group.records.length);
        const monthlyVolume = Math.round(avgQty);
        const monthlyImpact = monthlyVolume * priceChange;

        const confidence = Math.min(99, Math.round(Math.abs(zScore) * 20));

        anomalies.push({
          alertType,
          severity,
          productCode: group.itemCode || group.ean,
          productName: group.name,
          vendor: group.vendor,
          oldPrice: Math.round(oldPrice * 100) / 100,
          newPrice: latestPrice,
          priceChange: Math.round(priceChange * 100) / 100,
          zScore: Math.round(zScore * 100) / 100,
          confidence,
          monthlyVolume,
          monthlyImpact: Math.round(monthlyImpact * 100) / 100,
          description: generateDescription(alertType, priceChangePercent, zScore),
          recommendedAction: generateRecommendation(alertType, severity, latestPrice, oldPrice),
          ean: group.ean
        });
      }
    });

    console.log(`✅ Detected ${anomalies.length} anomalies\n`);

    // 4. Clear old anomalies from AI_Alerts table
    console.log('🧹 Clearing old anomaly data...');
    await pool.request().query(`
      DELETE FROM [dbo].[AI_Alerts]
      WHERE CreatedAt < DATEADD(day, -7, GETUTCDATE())
    `);
    console.log('✅ Cleared\n');

    // 5. Insert new anomalies
    if (anomalies.length > 0) {
      console.log('💾 Storing anomalies in database...');
      
      for (const anomaly of anomalies) {
        try {
          await pool.request()
            .input('alertType', sql.NVarChar, anomaly.alertType)
            .input('severity', sql.NVarChar, anomaly.severity)
            .input('productCode', sql.NVarChar, anomaly.productCode)
            .input('productName', sql.NVarChar, anomaly.productName)
            .input('vendor', sql.NVarChar, anomaly.vendor)
            .input('oldPrice', sql.Decimal(10, 2), anomaly.oldPrice)
            .input('newPrice', sql.Decimal(10, 2), anomaly.newPrice)
            .input('priceChange', sql.Decimal(10, 2), anomaly.priceChange)
            .input('zScore', sql.Decimal(10, 4), anomaly.zScore)
            .input('confidence', sql.Int, anomaly.confidence)
            .input('monthlyVolume', sql.Int, anomaly.monthlyVolume)
            .input('monthlyImpact', sql.Decimal(15, 2), anomaly.monthlyImpact)
            .input('description', sql.NVarChar, anomaly.description)
            .input('recommendedAction', sql.NVarChar, anomaly.recommendedAction)
            .query(`
              INSERT INTO [dbo].[AI_Alerts]
              (AlertType, Severity, ProductCode, ProductName, Vendor, OldPrice, NewPrice,
               PriceChange, ZScore, Confidence, MonthlyVolume, MonthlyImpact,
               Description, RecommendedAction, IsAcknowledged, CreatedAt, UpdatedAt)
              VALUES
              (@alertType, @severity, @productCode, @productName, @vendor, @oldPrice, @newPrice,
               @priceChange, @zScore, @confidence, @monthlyVolume, @monthlyImpact,
               @description, @recommendedAction, 0, GETUTCDATE(), GETUTCDATE())
            `);

          console.log(`  ✅ ${anomaly.productName} (${anomaly.vendor})`);
        } catch (err) {
          console.error(`  ❌ Failed to insert ${anomaly.productName}:`, err.message);
        }
      }

      console.log(`\n✅ Stored ${anomalies.length} anomalies`);
    } else {
      console.log('ℹ️  No anomalies detected');
    }

    // 6. Summary stats
    const criticalCount = anomalies.filter(a => a.severity === 'CRITICAL').length;
    const highCount = anomalies.filter(a => a.severity === 'HIGH').length;
    const spikes = anomalies.filter(a => a.alertType === 'PRICE_SPIKE').length;
    const drops = anomalies.filter(a => a.alertType === 'PRICE_DROP').length;

    console.log('\n📈 SUMMARY');
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Total Anomalies:      ${anomalies.length}`);
    console.log(`  🔴 Critical:        ${criticalCount}`);
    console.log(`  🟠 High:            ${highCount}`);
    console.log(`  📈 Price Spikes:    ${spikes}`);
    console.log(`  📉 Price Drops:     ${drops}`);
    console.log(`Total Impact:         $${anomalies.reduce((sum, a) => sum + a.monthlyImpact, 0).toFixed(2)}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (pool) await pool.close();
  }
}

function generateDescription(alertType, priceChangePercent, zScore) {
  const absZScore = Math.abs(zScore);
  
  if (alertType === 'OUTLIER') {
    return `Extreme price outlier! Price is ${absZScore.toFixed(1)} standard deviations from normal. Likely data entry error or exceptional market condition.`;
  } else if (alertType === 'PRICE_SPIKE') {
    return `Significant price increase detected. Product price jumped ${priceChangePercent.toFixed(0)}% above historical average.`;
  } else if (alertType === 'PRICE_DROP') {
    return `Price drop detected. Current price is ${Math.abs(priceChangePercent).toFixed(0)}% lower than average. Potential buying opportunity or quality concerns.`;
  }
  return 'Price anomaly detected based on statistical analysis.';
}

function generateRecommendation(alertType, severity, newPrice, oldPrice) {
  if (severity === 'CRITICAL') {
    return 'URGENT: Verify data accuracy immediately. Contact supplier to confirm pricing. Review for data entry errors.';
  } else if (alertType === 'PRICE_SPIKE') {
    return 'Verify with supplier for price justification. Check market conditions. Consider alternative suppliers if quality unchanged.';
  } else if (alertType === 'PRICE_DROP') {
    return 'Monitor stock levels carefully. Verify supplier capacity. Confirm product quality not degraded. May indicate clearance pricing.';
  }
  return 'Review market conditions and supplier communications.';
}

// Run detection
detectAnomalies().catch(console.error);
