/**
 * API Routes for Price Anomaly Detection
 * Endpoints:
 *   GET  /api/ai/anomalies - Get unacknowledged anomalies
 *   GET  /api/ai/anomalies/stats - Get statistics
 *   POST /api/ai/anomalies/:alertId/acknowledge - Mark as acknowledged
 *   GET  /api/ai/anomalies/severity/:level - Get by severity
 *
 * Created: June 3, 2026
 */

const express = require('express');
const sql = require('mssql');
const router = express.Router();

const { verifyToken } = require('./auth');
const { getUnacknowledgedAlerts, acknowledgeAlert } = require('../services/anomalyDetection');

/**
 * GET /api/ai/anomalies
 * Get unacknowledged price anomaly alerts
 * Query params:
 *   - severity: LOW/MEDIUM/HIGH/CRITICAL
 *   - alertType: PRICE_SPIKE/PRICE_DROP/OUTLIER
 *   - vendor: filter by supplier name
 *   - days: last N days (default 7)
 *   - acknowledged: true/false (default false)
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    console.log('=== GET ANOMALY ALERTS ===');
    console.log('Query params:', req.query);

    const pool = req.pool;
    const { severity, alertType, vendor, days = 7, acknowledged = 'false' } = req.query;

    let query = `
      SELECT * FROM [dbo].[AI_Alerts]
      WHERE 1=1
    `;

    const request = pool.request();

    // Filter by acknowledged status
    const isAcknowledged = acknowledged === 'true' ? 1 : 0;
    query += ` AND IsAcknowledged = ${isAcknowledged}`;

    // Optional filters
    if (severity) {
      query += ` AND Severity = @severity`;
      request.input('severity', sql.NVarChar, severity);
    }

    if (alertType) {
      query += ` AND AlertType = @alertType`;
      request.input('alertType', sql.NVarChar, alertType);
    }

    if (vendor) {
      query += ` AND Vendor LIKE @vendor`;
      request.input('vendor', sql.NVarChar, `%${vendor}%`);
    }

    if (days) {
      query += ` AND CreatedAt > DATEADD(day, -@days, GETUTCDATE())`;
      request.input('days', sql.Int, parseInt(days));
    }

    query += ` ORDER BY Severity DESC, CreatedAt DESC`;

    console.log('Executing query with filters:', { severity, alertType, vendor, days });

    const result = await request.query(query);

    console.log(`✅ Found ${result.recordset.length} alerts`);

    res.json({
      success: true,
      total: result.recordset.length,
      alerts: result.recordset
    });
  } catch (error) {
    console.error('❌ Get alerts error:', error);
    res.status(500).json({ error: 'Failed to fetch alerts: ' + error.message });
  }
});

/**
 * GET /api/ai/anomalies/stats
 * Get aggregated statistics about anomalies
 */
router.get('/stats', verifyToken, async (req, res) => {
  try {
    console.log('=== GET ANOMALY STATISTICS ===');

    const pool = req.pool;

    // Get summary stats
    const statsQuery = await pool.request().query(`
      SELECT
        COUNT(*) as TotalAlerts,
        SUM(CASE WHEN IsAcknowledged = 0 THEN 1 ELSE 0 END) as UnacknowledgedCount,
        SUM(CASE WHEN Severity = 'CRITICAL' THEN 1 ELSE 0 END) as CriticalCount,
        SUM(CASE WHEN Severity = 'HIGH' THEN 1 ELSE 0 END) as HighCount,
        SUM(CASE WHEN Severity = 'MEDIUM' THEN 1 ELSE 0 END) as MediumCount,
        SUM(CASE WHEN Severity = 'LOW' THEN 1 ELSE 0 END) as LowCount,
        SUM(CASE WHEN AlertType = 'PRICE_SPIKE' THEN 1 ELSE 0 END) as SpikeCount,
        SUM(CASE WHEN AlertType = 'PRICE_DROP' THEN 1 ELSE 0 END) as DropCount,
        SUM(CASE WHEN AlertType = 'OUTLIER' THEN 1 ELSE 0 END) as OutlierCount,
        CAST(SUM(ISNULL(MonthlyImpact, 0)) as DECIMAL(12,2)) as TotalMonthlyImpact,
        COUNT(DISTINCT Vendor) as UniqueVendors,
        COUNT(DISTINCT ProductCode) as UniqueProducts
      FROM [dbo].[AI_Alerts]
      WHERE CreatedAt > DATEADD(day, -30, GETUTCDATE())
    `);

    const stats = statsQuery.recordset[0];

    // Get by vendor
    const byVendorQuery = await pool.request().query(`
      SELECT TOP 10
        Vendor,
        COUNT(*) as AlertCount,
        SUM(CASE WHEN IsAcknowledged = 0 THEN 1 ELSE 0 END) as UnacknowledgedCount,
        CAST(SUM(ISNULL(MonthlyImpact, 0)) as DECIMAL(12,2)) as TotalImpact
      FROM [dbo].[AI_Alerts]
      WHERE CreatedAt > DATEADD(day, -30, GETUTCDATE())
      GROUP BY Vendor
      ORDER BY AlertCount DESC
    `);

    // Get top products by alert count
    const topProductsQuery = await pool.request().query(`
      SELECT TOP 10
        ProductCode,
        ProductName,
        COUNT(*) as AlertCount,
        SUM(CASE WHEN IsAcknowledged = 0 THEN 1 ELSE 0 END) as UnacknowledgedCount
      FROM [dbo].[AI_Alerts]
      WHERE CreatedAt > DATEADD(day, -30, GETUTCDATE())
      GROUP BY ProductCode, ProductName
      ORDER BY AlertCount DESC
    `);

    res.json({
      success: true,
      summary: stats,
      byVendor: byVendorQuery.recordset,
      topProducts: topProductsQuery.recordset
    });
  } catch (error) {
    console.error('❌ Get stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics: ' + error.message });
  }
});

/**
 * POST /api/ai/anomalies/:alertId/acknowledge
 * Mark an alert as acknowledged by user
 * Body: optional { note: "user note" }
 */
router.post('/:alertId/acknowledge', verifyToken, async (req, res) => {
  try {
    console.log('=== ACKNOWLEDGE ALERT ===');
    console.log('Alert ID:', req.params.alertId);
    console.log('User:', req.user.userId);

    const pool = req.pool;
    const alertId = parseInt(req.params.alertId);
    const userId = req.user.userId;

    // Update alert
    const result = await pool.request()
      .input('alertId', sql.Int, alertId)
      .input('userId', sql.Int, userId)
      .query(`
        UPDATE [dbo].[AI_Alerts]
        SET 
          IsAcknowledged = 1,
          AcknowledgedBy = @userId,
          AcknowledgedAt = GETUTCDATE(),
          UpdatedAt = GETUTCDATE()
        WHERE AlertId = @alertId
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    console.log(`✅ Alert ${alertId} acknowledged by user ${userId}`);

    res.json({
      success: true,
      message: 'Alert acknowledged',
      alertId
    });
  } catch (error) {
    console.error('❌ Acknowledge alert error:', error);
    res.status(500).json({ error: 'Failed to acknowledge alert: ' + error.message });
  }
});

/**
 * GET /api/ai/anomalies/severity/:level
 * Get alerts by severity level
 */
router.get('/severity/:level', verifyToken, async (req, res) => {
  try {
    const pool = req.pool;
    const level = req.params.level.toUpperCase();

    const validLevels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    if (!validLevels.includes(level)) {
      return res.status(400).json({ error: 'Invalid severity level' });
    }

    const result = await pool.request()
      .input('severity', sql.NVarChar, level)
      .query(`
        SELECT * FROM [dbo].[AI_Alerts]
        WHERE Severity = @severity
          AND IsAcknowledged = 0
        ORDER BY CreatedAt DESC
      `);

    res.json({
      success: true,
      severity: level,
      total: result.recordset.length,
      alerts: result.recordset
    });
  } catch (error) {
    console.error('❌ Get severity alerts error:', error);
    res.status(500).json({ error: 'Failed to fetch alerts: ' + error.message });
  }
});

/**
 * GET /api/ai/anomalies/:alertId
 * Get details of a specific alert
 */
router.get('/:alertId', verifyToken, async (req, res) => {
  try {
    const pool = req.pool;
    const alertId = parseInt(req.params.alertId);

    const result = await pool.request()
      .input('alertId', sql.Int, alertId)
      .query(`
        SELECT * FROM [dbo].[AI_Alerts]
        WHERE AlertId = @alertId
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json({
      success: true,
      alert: result.recordset[0]
    });
  } catch (error) {
    console.error('❌ Get alert error:', error);
    res.status(500).json({ error: 'Failed to fetch alert: ' + error.message });
  }
});

/**
 * DELETE /api/ai/anomalies/:alertId (soft delete by acknowledging)
 * Optional: Hard delete for admins
 */
router.delete('/:alertId', verifyToken, async (req, res) => {
  try {
    const pool = req.pool;
    const alertId = parseInt(req.params.alertId);

    // For now, just acknowledge it (soft delete)
    await acknowledgeAlert(pool, alertId, req.user.userId);

    res.json({
      success: true,
      message: 'Alert dismissed'
    });
  } catch (error) {
    console.error('❌ Delete alert error:', error);
    res.status(500).json({ error: 'Failed to delete alert: ' + error.message });
  }
});

module.exports = router;
