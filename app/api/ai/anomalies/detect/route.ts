/**
 * POST /api/ai/anomalies/detect
 * Trigger real-time price anomaly detection
 * 
 * Returns: Detection results and newly created alerts
 */

import { getPool } from '@/lib/db';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: Request) {
  try {
    // Verify auth if needed (optional - could add token check)
    console.log('🚀 Starting anomaly detection...');

    // Run the detection script
    try {
      const { stdout, stderr } = await execAsync('node scripts/detect-price-anomalies.js', {
        cwd: process.cwd(),
        timeout: 120000 // 2 minutes
      });

      console.log('✅ Detection completed');
      console.log(stdout);
      
      if (stderr) {
        console.warn('⚠️  Warnings:', stderr);
      }

      // Fetch newly created alerts (from last 5 minutes)
      const pool = await getPool();
      const result = await pool.request().query(`
        SELECT TOP 100
          AlertId, AlertType, Severity, ProductCode, ProductName, 
          Vendor, OldPrice, NewPrice, PriceChange, CreatedAt
        FROM [dbo].[AI_Alerts]
        WHERE CreatedAt > DATEADD(minute, -5, GETUTCDATE())
        ORDER BY CreatedAt DESC
      `);

      const detectedAlerts = result.recordset;

      return Response.json({
        success: true,
        message: 'Anomaly detection completed successfully',
        detectedCount: detectedAlerts.length,
        alerts: detectedAlerts,
        timestamp: new Date().toISOString()
      });
    } catch (execError: any) {
      console.error('❌ Script execution error:', execError.message);
      return Response.json(
        {
          success: false,
          error: 'Detection script failed',
          message: execError.message
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('❌ POST /api/ai/anomalies/detect error:', error);
    return Response.json(
      {
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ai/anomalies/detect/status
 * Get status of last detection run
 */
export async function GET(request: Request) {
  try {
    const pool = await getPool();
    
    // Get stats from AI_Alerts
    const result = await pool.request().query(`
      SELECT
        COUNT(*) as TotalAlerts,
        SUM(CASE WHEN Severity = 'CRITICAL' THEN 1 ELSE 0 END) as CriticalCount,
        SUM(CASE WHEN Severity = 'HIGH' THEN 1 ELSE 0 END) as HighCount,
        SUM(CASE WHEN Severity = 'MEDIUM' THEN 1 ELSE 0 END) as MediumCount,
        SUM(CASE WHEN AlertType = 'PRICE_SPIKE' THEN 1 ELSE 0 END) as SpikeCount,
        SUM(CASE WHEN AlertType = 'PRICE_DROP' THEN 1 ELSE 0 END) as DropCount,
        MAX(CreatedAt) as LastDetectionTime,
        SUM(MonthlyImpact) as TotalMonthlyImpact
      FROM [dbo].[AI_Alerts]
      WHERE CreatedAt > DATEADD(day, -7, GETUTCDATE())
    `);

    const stats = result.recordset[0] || {};

    return Response.json({
      success: true,
      stats: {
        totalAlerts: stats.TotalAlerts || 0,
        critical: stats.CriticalCount || 0,
        high: stats.HighCount || 0,
        medium: stats.MediumCount || 0,
        priceSpikes: stats.SpikeCount || 0,
        priceDrops: stats.DropCount || 0,
        totalMonthlyImpact: stats.TotalMonthlyImpact || 0,
        lastDetectionTime: stats.LastDetectionTime || null
      }
    });
  } catch (error) {
    console.error('❌ GET /api/ai/anomalies/detect/status error:', error);
    return Response.json(
      {
        success: false,
        error: 'Failed to fetch detection status',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
