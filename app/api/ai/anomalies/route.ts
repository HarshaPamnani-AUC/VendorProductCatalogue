/**
 * GET /api/ai/anomalies
 * Get price anomaly alerts with filtering
 * 
 * Query Parameters:
 *   - acknowledged: 'true' | 'false' (default: false)
 *   - severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
 *   - alertType: 'PRICE_SPIKE' | 'PRICE_DROP' | 'OUTLIER' | 'PRICE_ANOMALY'
 *   - vendor: string (partial match)
 *   - days: number (default: 7)
 *   - limit: number (default: 100)
 *   - offset: number (default: 0)
 */

import { getPool } from '@/lib/db';
import sql from 'mssql';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Get query parameters
    const acknowledged = searchParams.get('acknowledged') || 'false';
    const severity = searchParams.get('severity');
    const alertType = searchParams.get('alertType');
    const vendor = searchParams.get('vendor');
    const days = parseInt(searchParams.get('days') || '7');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    console.log('📊 GET /api/ai/anomalies - Filters:', { 
      acknowledged, severity, alertType, vendor, days, limit, offset 
    });

    const pool = await getPool();
    const request_obj = pool.request();

    // Build parameterized query
    let query = `
      SELECT 
        AlertId, AlertType, Severity, ProductCode, ProductName, 
        Vendor, OldPrice, NewPrice, PriceChange, ZScore, Confidence,
        MonthlyVolume, MonthlyImpact, Description, RecommendedAction,
        IsAcknowledged, AcknowledgedBy, AcknowledgedAt, 
        FileUploadId, CreatedAt, UpdatedAt
      FROM [dbo].[AI_Alerts]
      WHERE 1=1
    `;

    // Add acknowledged filter
    if (acknowledged === 'false') {
      query += ` AND IsAcknowledged = 0`;
    } else if (acknowledged === 'true') {
      query += ` AND IsAcknowledged = 1`;
    }

    // Add severity filter
    if (severity) {
      query += ` AND Severity = @severity`;
      request_obj.input('severity', sql.NVarChar, severity);
    }

    // Add alert type filter
    if (alertType) {
      query += ` AND AlertType = @alertType`;
      request_obj.input('alertType', sql.NVarChar, alertType);
    }

    // Add vendor filter
    if (vendor) {
      query += ` AND Vendor LIKE @vendor`;
      request_obj.input('vendor', sql.NVarChar, `%${vendor}%`);
    }

    // Add date filter
    if (days > 0) {
      query += ` AND CreatedAt > DATEADD(day, -@days, GETUTCDATE())`;
      request_obj.input('days', sql.Int, days);
    }

    // Add sorting and pagination
    query += ` ORDER BY CreatedAt DESC`;
    query += ` OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`;
    request_obj.input('offset', sql.Int, offset);
    request_obj.input('limit', sql.Int, limit);

    const result = await request_obj.query(query);

    console.log(`✅ Found ${result.recordset.length} alerts`);

    return Response.json({
      success: true,
      total: result.recordset.length,
      alerts: result.recordset,
      pagination: { limit, offset }
    });
  } catch (error) {
    console.error('❌ GET /api/ai/anomalies error:', error);
    return Response.json(
      { 
        error: 'Failed to fetch alerts',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
