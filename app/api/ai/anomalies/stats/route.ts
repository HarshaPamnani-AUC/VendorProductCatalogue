/**
 * GET /api/ai/anomalies/stats
 * Get statistics and metrics for anomaly dashboard
 * 
 * Returns:
 *   - totalAlerts: Total count of all alerts
 *   - unacknowledgedCount: Alerts requiring action
 *   - acknowledgedCount: Reviewed alerts
 *   - acknowledgmentRate: % of alerts acknowledged
 *   - severityDistribution: Count by severity level
 *   - alertTypeDistribution: Count by alert type
 *   - topVendors: Vendors with most alerts
 *   - monthlyImpact: Total financial impact
 */

import { getPool } from '@/lib/db';
import sql from 'mssql';

export async function GET(request: Request) {
  try {
    console.log('📈 GET /api/ai/anomalies/stats');

    const pool = await getPool();

    // Query 1: Total and unacknowledged counts
    const countsResult = await pool.request()
      .query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN IsAcknowledged = 0 THEN 1 ELSE 0 END) as unacknowledged,
          SUM(CASE WHEN IsAcknowledged = 1 THEN 1 ELSE 0 END) as acknowledged
        FROM [dbo].[AI_Alerts]
      `);

    const counts = countsResult.recordset[0] || { total: 0, unacknowledged: 0, acknowledged: 0 };
    const total = counts.total || 0;
    const unacknowledged = counts.unacknowledged || 0;
    const acknowledged = counts.acknowledged || 0;
    const acknowledgmentRate = total > 0 ? Math.round((acknowledged / total) * 100) : 0;

    // Query 2: Severity distribution
    const severityResult = await pool.request()
      .query(`
        SELECT 
          Severity,
          COUNT(*) as count
        FROM [dbo].[AI_Alerts]
        GROUP BY Severity
        ORDER BY 
          CASE Severity 
            WHEN 'CRITICAL' THEN 1 
            WHEN 'HIGH' THEN 2 
            WHEN 'MEDIUM' THEN 3 
            WHEN 'LOW' THEN 4 
          END
      `);

    const severityDistribution = severityResult.recordset.map((row: any) => ({
      severity: row.Severity,
      count: row.count
    }));

    // Query 3: Alert type distribution
    const typeResult = await pool.request()
      .query(`
        SELECT 
          AlertType,
          COUNT(*) as count
        FROM [dbo].[AI_Alerts]
        GROUP BY AlertType
        ORDER BY count DESC
      `);

    const alertTypeDistribution = typeResult.recordset.map((row: any) => ({
      type: row.AlertType,
      count: row.count
    }));

    // Query 4: Top vendors
    const vendorsResult = await pool.request()
      .query(`
        SELECT TOP 10
          Vendor,
          COUNT(*) as alertCount,
          SUM(CASE WHEN IsAcknowledged = 0 THEN 1 ELSE 0 END) as pendingCount,
          SUM(ABS(MonthlyImpact)) as totalImpact
        FROM [dbo].[AI_Alerts]
        GROUP BY Vendor
        ORDER BY alertCount DESC
      `);

    const topVendors = vendorsResult.recordset.map((row: any) => ({
      vendor: row.Vendor,
      alertCount: row.alertCount,
      pendingCount: row.pendingCount || 0,
      totalImpact: Math.round((row.totalImpact || 0) * 100) / 100
    }));

    // Query 5: Monthly impact
    const impactResult = await pool.request()
      .query(`
        SELECT 
          SUM(MonthlyImpact) as totalImpact,
          SUM(CASE WHEN MonthlyImpact > 0 THEN MonthlyImpact ELSE 0 END) as positiveImpact,
          SUM(CASE WHEN MonthlyImpact < 0 THEN ABS(MonthlyImpact) ELSE 0 END) as negativeImpact
        FROM [dbo].[AI_Alerts]
      `);

    const impact = impactResult.recordset[0] || { totalImpact: 0, positiveImpact: 0, negativeImpact: 0 };
    const monthlyImpact = {
      total: Math.round((impact.totalImpact || 0) * 100) / 100,
      positive: Math.round((impact.positiveImpact || 0) * 100) / 100,
      negative: Math.round((impact.negativeImpact || 0) * 100) / 100
    };

    // Query 6: Recent alerts (last 30 days)
    const recentResult = await pool.request()
      .query(`
        SELECT COUNT(*) as count
        FROM [dbo].[AI_Alerts]
        WHERE CreatedAt > DATEADD(day, -30, GETUTCDATE())
      `);

    const alertsLast30Days = recentResult.recordset[0]?.count || 0;

    // Query 7: Critical alerts
    const criticalResult = await pool.request()
      .query(`
        SELECT COUNT(*) as count
        FROM [dbo].[AI_Alerts]
        WHERE Severity = 'CRITICAL' AND IsAcknowledged = 0
      `);

    const criticalAlerts = criticalResult.recordset[0]?.count || 0;

    // Query 8: Coverage (unique vendors and products)
    const coverageResult = await pool.request()
      .query(`
        SELECT 
          COUNT(DISTINCT Vendor) as vendorCount,
          COUNT(DISTINCT ProductCode) as productCount
        FROM [dbo].[AI_Alerts]
      `);

    const coverage = coverageResult.recordset[0] || { vendorCount: 0, productCount: 0 };

    console.log('✅ Stats calculated successfully');

    return Response.json({
      success: true,
      summary: {
        total,
        unacknowledged,
        acknowledged,
        acknowledgmentRate,
        criticalAlerts,
        alertsLast30Days
      },
      distribution: {
        severity: severityDistribution,
        alertType: alertTypeDistribution
      },
      topVendors,
      monthlyImpact,
      coverage: {
        vendors: coverage.vendorCount || 0,
        products: coverage.productCount || 0
      }
    });
  } catch (error) {
    console.error('❌ GET /api/ai/anomalies/stats error:', error);
    return Response.json(
      { 
        error: 'Failed to fetch statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
