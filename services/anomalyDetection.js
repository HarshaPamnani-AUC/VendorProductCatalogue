/**
 * Price Anomaly Detection Service
 * 
 * Purpose: Detect unusual price changes that indicate supplier price gouging,
 *          data errors, or buying opportunities
 * 
 * Algorithm: Z-Score based anomaly detection
 *   - Get historical prices for product-supplier pair (last 90 days)
 *   - Calculate: mean, standard deviation
 *   - Calculate Z-score: (price - mean) / std_dev
 *   - If |Z-score| > 2.5: Alert (99% confidence anomaly)
 * 
 * Integration: Called after file upload, before response
 * 
 * Created: June 3, 2026
 */

const sql = require('mssql');

/**
 * Main function: Detect anomalies for newly uploaded products
 * @param {sql.ConnectionPool} pool - MSSQL connection pool
 * @param {number} fileUploadId - ID of the file upload (from FileUploads table)
 * @param {string} vendorName - Name of supplier (from Vendors table)
 * @returns {Promise<Array>} Array of anomaly alerts
 */
async function detectAnomaliesForUpload(pool, fileUploadId, vendorName) {
  try {
    console.log('🔍 Starting anomaly detection for upload:', fileUploadId, 'from', vendorName);

    // Step 1: Get newly inserted products from this upload
    const newProductsQuery = await pool.request()
      .input('fileUploadId', sql.Int, fileUploadId)
      .input('vendor', sql.NVarChar, vendorName)
      .query(`
        SELECT DISTINCT
          Item_Code,
          Name as ProductName,
          Price,
          Qty,
          Date as UploadDate
        FROM Tbl_Products
        WHERE FileUploadId = @fileUploadId
          AND Vendor = @vendor
        ORDER BY Item_Code
      `);

    const newProducts = newProductsQuery.recordset;
    console.log(`📦 Found ${newProducts.length} products in upload`);

    if (newProducts.length === 0) {
      return [];
    }

    // Step 2: For each product, check for anomalies
    const alerts = [];

    for (const product of newProducts) {
      const alert = await detectAnomalyForProduct(
        pool,
        product.Item_Code,
        product.ProductName,
        vendorName,
        product.Price,
        product.Qty,
        product.UploadDate,
        fileUploadId
      );

      if (alert) {
        alerts.push(alert);
      }
    }

    console.log(`🚨 Detected ${alerts.length} anomalies`);
    return alerts;
  } catch (error) {
    console.error('❌ Anomaly detection error:', error);
    throw error;
  }
}

/**
 * Detect anomaly for a single product-supplier pair
 * @param {sql.ConnectionPool} pool
 * @param {string} productCode - Item_Code
 * @param {string} productName
 * @param {string} vendor - Supplier name
 * @param {number} newPrice - Current price
 * @param {number} qty - Current quantity
 * @param {Date} uploadDate
 * @param {number} fileUploadId
 * @returns {Promise<Object|null>} Alert object or null if no anomaly
 */
async function detectAnomalyForProduct(
  pool,
  productCode,
  productName,
  vendor,
  newPrice,
  qty,
  uploadDate,
  fileUploadId
) {
  try {
    // Step 1: Validate input
    if (!productCode || newPrice <= 0 || !vendor) {
      return null;
    }

    // Step 2: Get historical prices (last 90 days, excluding today's upload)
    const historyQuery = await pool.request()
      .input('productCode', sql.NVarChar, productCode)
      .input('vendor', sql.NVarChar, vendor)
      .input('uploadDate', sql.DateTime, uploadDate)
      .query(`
        SELECT TOP 90
          CAST(Price as DECIMAL(18,2)) as Price,
          CAST(Date as DATE) as PriceDate,
          CAST(ISNULL(Qty, 0) as INT) as Qty
        FROM Tbl_Products_Storage
        WHERE Item_Code = @productCode 
          AND Vendor = @vendor
          AND CAST(Date as DATE) < CAST(@uploadDate as DATE)
        ORDER BY Date DESC
      `);

    const priceHistory = historyQuery.recordset;

    // Step 3: Validate sufficient history
    if (priceHistory.length < 3) {
      // Not enough history to detect anomalies
      console.log(`  ⊘ ${productCode} from ${vendor}: insufficient history (${priceHistory.length} records)`);
      return null;
    }

    // Step 4: Extract and validate prices
    const prices = priceHistory
      .map(p => parseFloat(p.Price))
      .filter(p => p > 0); // Exclude invalid prices

    if (prices.length < 3) {
      return null;
    }

    // Step 5: Calculate statistics
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const variance = prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / prices.length;
    const stdDev = Math.sqrt(variance);

    // Step 6: Handle edge case: no variance
    if (stdDev === 0) {
      // Price has been exactly same for all history
      // Any change is anomaly
      if (Math.abs(newPrice - mean) > mean * 0.05) {
        // More than 5% change
        return createAlert(
          'PRICE_CHANGE',
          'LOW',
          productCode,
          productName,
          vendor,
          mean,
          newPrice,
          10,
          'Price change detected (zero historical variance)',
          `Price changed from constant ${mean.toFixed(2)} to ${newPrice.toFixed(2)}`,
          'Investigate reason for change',
          qty,
          fileUploadId
        );
      }
      return null;
    }

    // Step 7: Calculate Z-score
    const zScore = (newPrice - mean) / stdDev;
    const absZScore = Math.abs(zScore);

    // Step 8: Determine if anomaly
    // Threshold: |Z-score| > 2.5 means 99% confidence it's anomalous
    if (absZScore < 1.5) {
      // Normal price
      return null;
    }

    // Step 9: Classify anomaly type and calculate metrics
    const priceChange = ((newPrice - mean) / mean) * 100;
    const confidence = Math.min(100, absZScore * 20); // 2.5 * 20 = 50%, 3.0 * 20 = 60%, etc.

    let alertType, severity, description, recommendedAction;

    if (absZScore > 3.5) {
      // Extreme anomaly
      alertType = 'OUTLIER';
      severity = 'CRITICAL';
      description = `Extreme price outlier: ${newPrice.toFixed(2)} (${absZScore.toFixed(2)}σ from mean ${mean.toFixed(2)})`;
      recommendedAction = `Verify data entry. This is an extreme value (${absZScore.toFixed(1)} standard deviations away).`;
    } else if (zScore > 2.5) {
      // Price spike
      alertType = 'PRICE_SPIKE';
      severity = priceChange > 20 ? 'HIGH' : 'MEDIUM';
      description = `Price increased ${priceChange.toFixed(1)}%: ${newPrice.toFixed(2)} vs avg ${mean.toFixed(2)}`;
      recommendedAction = `Negotiate with ${vendor} or switch to competitor. Market avg: ${mean.toFixed(2)}`;
    } else if (zScore < -2.5) {
      // Price drop - opportunity
      alertType = 'PRICE_DROP';
      severity = 'MEDIUM'; // Positive, but still needs action
      description = `Price decreased ${Math.abs(priceChange).toFixed(1)}%: ${newPrice.toFixed(2)} vs avg ${mean.toFixed(2)}`;
      recommendedAction = `Opportunity: Buy more at this price if it's limited-time. Current: ${newPrice.toFixed(2)}, was: ${mean.toFixed(2)}`;
    } else if (zScore > 2.0) {
      // Moderate increase
      alertType = 'PRICE_ANOMALY';
      severity = 'MEDIUM';
      description = `Moderate price increase: ${newPrice.toFixed(2)} vs avg ${mean.toFixed(2)}`;
      recommendedAction = `Monitor. If trend continues, negotiate with supplier.`;
    } else {
      // Moderate decrease or other
      alertType = 'PRICE_ANOMALY';
      severity = 'LOW';
      description = `Price change detected: ${newPrice.toFixed(2)} vs avg ${mean.toFixed(2)}`;
      recommendedAction = `Monitor for trend.`;
    }

    // Step 10: Calculate financial impact
    const monthlyVolume = estimateMonthlyVolume(priceHistory);
    const monthlyImpact = monthlyVolume * (newPrice - mean);

    // Step 11: Adjust severity based on impact
    if (Math.abs(monthlyImpact) > 5000) {
      severity = 'CRITICAL';
    } else if (Math.abs(monthlyImpact) > 2000) {
      severity = 'HIGH';
    } else if (Math.abs(monthlyImpact) > 500) {
      if (severity === 'LOW') severity = 'MEDIUM';
    }

    // Step 12: Create alert record
    const alert = createAlert(
      alertType,
      severity,
      productCode,
      productName,
      vendor,
      mean,
      newPrice,
      confidence,
      description,
      zScore.toFixed(3),
      recommendedAction,
      monthlyVolume,
      fileUploadId,
      monthlyImpact
    );

    console.log(`  ✓ ${alertType}: ${productCode} from ${vendor} - ${severity} severity`);
    return alert;
  } catch (error) {
    console.error(`  ❌ Error detecting anomaly for ${productCode}:`, error.message);
    return null; // Don't block upload on detection error
  }
}

/**
 * Helper: Estimate monthly volume from historical quantities
 * @param {Array} priceHistory - Array of price history records
 * @returns {number} Estimated monthly volume
 */
function estimateMonthlyVolume(priceHistory) {
  if (priceHistory.length === 0) return 0;

  const quantities = priceHistory
    .map(p => parseInt(p.Qty) || 0)
    .filter(q => q > 0);

  if (quantities.length === 0) return 0;

  // Average quantity per upload
  const avgQty = quantities.reduce((a, b) => a + b, 0) / quantities.length;

  // Estimate uploads per month: 4.33 (average weeks per month / 1 week typical upload cycle)
  // Adjust based on actual history frequency
  const dateRange = (new Date(priceHistory[0].PriceDate) - new Date(priceHistory[priceHistory.length - 1].PriceDate)) / (1000 * 60 * 60 * 24);
  const uploadsPerDay = priceHistory.length / Math.max(dateRange, 1);
  const uploadsPerMonth = uploadsPerDay * 30;

  return Math.round(avgQty * uploadsPerMonth);
}

/**
 * Helper: Create alert object
 */
function createAlert(
  alertType,
  severity,
  productCode,
  productName,
  vendor,
  oldPrice,
  newPrice,
  confidence,
  description,
  zScore,
  recommendedAction,
  monthlyVolume,
  fileUploadId,
  monthlyImpact = 0
) {
  const priceChange = ((newPrice - oldPrice) / oldPrice) * 100;

  return {
    AlertType: alertType,
    Severity: severity,
    ProductCode: productCode,
    ProductName: productName,
    Vendor: vendor,
    OldPrice: parseFloat(oldPrice.toFixed(2)),
    NewPrice: parseFloat(newPrice.toFixed(2)),
    PriceChange: parseFloat(priceChange.toFixed(2)),
    ZScore: parseFloat(zScore),
    Confidence: Math.min(100, Math.round(confidence)),
    MonthlyVolume: monthlyVolume,
    MonthlyImpact: parseFloat(monthlyImpact.toFixed(2)),
    Description: description,
    RecommendedAction: recommendedAction,
    FileUploadId: fileUploadId
  };
}

/**
 * Store detected alerts in database
 * @param {sql.ConnectionPool} pool
 * @param {Array} alerts - Array of alert objects
 * @returns {Promise<number>} Number of alerts stored
 */
async function storeAlerts(pool, alerts) {
  if (alerts.length === 0) {
    return 0;
  }

  try {
    let storedCount = 0;

    for (const alert of alerts) {
      await pool.request()
        .input('alertType', sql.NVarChar, alert.AlertType)
        .input('severity', sql.NVarChar, alert.Severity)
        .input('productCode', sql.NVarChar, alert.ProductCode)
        .input('productName', sql.NVarChar, alert.ProductName)
        .input('vendor', sql.NVarChar, alert.Vendor)
        .input('oldPrice', sql.Decimal(18, 2), alert.OldPrice)
        .input('newPrice', sql.Decimal(18, 2), alert.NewPrice)
        .input('priceChange', sql.Decimal(5, 2), alert.PriceChange)
        .input('zScore', sql.Decimal(8, 3), alert.ZScore)
        .input('confidence', sql.Decimal(5, 2), alert.Confidence)
        .input('monthlyVolume', sql.Int, alert.MonthlyVolume)
        .input('monthlyImpact', sql.Decimal(12, 2), alert.MonthlyImpact)
        .input('description', sql.NVarChar(sql.MAX), alert.Description)
        .input('recommendedAction', sql.NVarChar(sql.MAX), alert.RecommendedAction)
        .input('fileUploadId', sql.Int, alert.FileUploadId)
        .query(`
          INSERT INTO [dbo].[AI_Alerts] (
            AlertType, Severity, ProductCode, ProductName, Vendor,
            OldPrice, NewPrice, PriceChange, ZScore, Confidence,
            MonthlyVolume, MonthlyImpact, Description, RecommendedAction,
            FileUploadId, IsAcknowledged
          )
          VALUES (
            @alertType, @severity, @productCode, @productName, @vendor,
            @oldPrice, @newPrice, @priceChange, @zScore, @confidence,
            @monthlyVolume, @monthlyImpact, @description, @recommendedAction,
            @fileUploadId, 0
          )
        `);

      storedCount++;
    }

    console.log(`✅ Stored ${storedCount} alerts in database`);
    return storedCount;
  } catch (error) {
    console.error('❌ Error storing alerts:', error);
    throw error;
  }
}

/**
 * Get unacknowledged alerts
 * @param {sql.ConnectionPool} pool
 * @param {Object} filters - Optional filters: severity, alertType, vendor, days
 * @returns {Promise<Array>} Array of alerts
 */
async function getUnacknowledgedAlerts(pool, filters = {}) {
  try {
    let query = `
      SELECT * FROM [dbo].[AI_Alerts]
      WHERE IsAcknowledged = 0
    `;

    const request = pool.request();

    if (filters.severity) {
      query += ` AND Severity = @severity`;
      request.input('severity', sql.NVarChar, filters.severity);
    }

    if (filters.alertType) {
      query += ` AND AlertType = @alertType`;
      request.input('alertType', sql.NVarChar, filters.alertType);
    }

    if (filters.vendor) {
      query += ` AND Vendor LIKE @vendor`;
      request.input('vendor', sql.NVarChar, `%${filters.vendor}%`);
    }

    if (filters.days) {
      query += ` AND CreatedAt > DATEADD(day, -@days, GETUTCDATE())`;
      request.input('days', sql.Int, filters.days);
    }

    query += ` ORDER BY CreatedAt DESC`;

    const result = await request.query(query);
    return result.recordset;
  } catch (error) {
    console.error('Error getting alerts:', error);
    throw error;
  }
}

/**
 * Acknowledge an alert
 * @param {sql.ConnectionPool} pool
 * @param {number} alertId
 * @param {number} userId - User who acknowledged
 * @returns {Promise<boolean>} Success
 */
async function acknowledgeAlert(pool, alertId, userId) {
  try {
    await pool.request()
      .input('alertId', sql.Int, alertId)
      .input('userId', sql.Int, userId)
      .query(`
        UPDATE [dbo].[AI_Alerts]
        SET IsAcknowledged = 1,
            AcknowledgedBy = @userId,
            AcknowledgedAt = GETUTCDATE(),
            UpdatedAt = GETUTCDATE()
        WHERE AlertId = @alertId
      `);

    return true;
  } catch (error) {
    console.error('Error acknowledging alert:', error);
    throw error;
  }
}

module.exports = {
  detectAnomaliesForUpload,
  detectAnomalyForProduct,
  storeAlerts,
  getUnacknowledgedAlerts,
  acknowledgeAlert
};
