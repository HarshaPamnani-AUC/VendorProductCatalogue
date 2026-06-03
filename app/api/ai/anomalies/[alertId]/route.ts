/**
 * GET /api/ai/anomalies/[alertId]
 * Get a specific alert by ID
 * 
 * DELETE /api/ai/anomalies/[alertId]
 * Soft delete an alert (mark for dismissal)
 */

import { getPool } from '@/lib/db';
import sql from 'mssql';

export async function GET(
  request: Request,
  { params }: { params: { alertId: string } }
) {
  try {
    const alertId = parseInt(params.alertId);

    if (!alertId) {
      return Response.json(
        { error: 'alertId is required' },
        { status: 400 }
      );
    }

    console.log(`📄 GET /api/ai/anomalies/${alertId}`);

    const pool = await getPool();
    const result = await pool.request()
      .input('alertId', sql.Int, alertId)
      .query(`
        SELECT * FROM [dbo].[AI_Alerts]
        WHERE AlertId = @alertId
      `);

    if (result.recordset.length === 0) {
      return Response.json(
        { error: 'Alert not found' },
        { status: 404 }
      );
    }

    console.log(`✅ Alert ${alertId} found`);

    return Response.json({
      success: true,
      alert: result.recordset[0]
    });
  } catch (error) {
    console.error(`❌ GET /api/ai/anomalies/${params.alertId} error:`, error);
    return Response.json(
      { 
        error: 'Failed to fetch alert',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { alertId: string } }
) {
  try {
    const alertId = parseInt(params.alertId);

    if (!alertId) {
      return Response.json(
        { error: 'alertId is required' },
        { status: 400 }
      );
    }

    console.log(`🗑️ DELETE /api/ai/anomalies/${alertId}`);

    const pool = await getPool();
    
    // Soft delete: mark with a flag or move to archive
    // For now, we'll just acknowledge it as dismissed
    const result = await pool.request()
      .input('alertId', sql.Int, alertId)
      .query(`
        UPDATE [dbo].[AI_Alerts]
        SET IsAcknowledged = 1,
            UpdatedAt = GETUTCDATE()
        WHERE AlertId = @alertId
      `);

    if (result.rowsAffected[0] === 0) {
      return Response.json(
        { error: 'Alert not found' },
        { status: 404 }
      );
    }

    console.log(`✅ Alert ${alertId} dismissed`);

    return Response.json({
      success: true,
      message: 'Alert dismissed'
    });
  } catch (error) {
    console.error(`❌ DELETE /api/ai/anomalies/${params.alertId} error:`, error);
    return Response.json(
      { 
        error: 'Failed to delete alert',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
