/**
 * POST /api/ai/anomalies/[alertId]/acknowledge
 * Mark an alert as acknowledged by the user
 * 
 * Request Body:
 *   - userId: number (ID of user acknowledging)
 */

import { getPool } from '@/lib/db';
import sql from 'mssql';

export async function POST(
  request: Request,
  { params }: { params: { alertId: string } }
) {
  try {
    const alertId = parseInt(params.alertId);
    const body = await request.json();
    const { userId } = body;

    if (!alertId || !userId) {
      return Response.json(
        { error: 'alertId and userId are required' },
        { status: 400 }
      );
    }

    console.log(`✅ POST /api/ai/anomalies/${alertId}/acknowledge - User: ${userId}`);

    const pool = await getPool();
    const result = await pool.request()
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

    if (result.rowsAffected[0] === 0) {
      return Response.json(
        { error: 'Alert not found' },
        { status: 404 }
      );
    }

    console.log(`✅ Alert ${alertId} acknowledged by user ${userId}`);

    return Response.json({
      success: true,
      message: 'Alert acknowledged'
    });
  } catch (error) {
    console.error(`❌ POST /api/ai/anomalies/${params.alertId}/acknowledge error:`, error);
    return Response.json(
      { 
        error: 'Failed to acknowledge alert',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
