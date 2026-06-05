import { NextRequest, NextResponse } from 'next/server';
import { poolPromise } from '@/lib/db';

const ALL_TABLES = ['LLP_Orders', 'VW360_Orders', 'BSLLC_Orders', 'BM_Orders', 'BCGGB_Orders'];

// DELETE all rows from all (or selected) order tables
export async function POST(request: NextRequest) {
  try {
    let tables = ALL_TABLES;
    try {
      const body = await request.json();
      if (Array.isArray(body?.tables) && body.tables.length > 0) {
        tables = body.tables.filter((t: string) => ALL_TABLES.includes(t));
      }
    } catch { /* no body — clear all */ }

    const pool = await poolPromise;
    if (!pool) return NextResponse.json({ error: 'DB connection failed' }, { status: 500 });

    const results: Record<string, number> = {};

    for (const table of tables) {
      // Check table exists first
      const exists = await pool.request().query(`
        SELECT 1 FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = '${table}'
      `);
      if (!exists.recordset.length) { results[table] = 0; continue; }

      const res = await pool.request().query(
        `DELETE FROM [dbo].[${table}]`
      );
      results[table] = res.rowsAffected[0] ?? 0;
    }

    const totalDeleted = Object.values(results).reduce((s, n) => s + n, 0);
    return NextResponse.json({ success: true, totalDeleted, byTable: results });
  } catch (error: any) {
    console.error('Clear orders error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
