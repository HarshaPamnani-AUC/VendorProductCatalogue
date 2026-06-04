import { NextRequest, NextResponse } from 'next/server';
import { poolPromise } from '@/lib/db';

const ALL_TABLES = ['LLP_Orders', 'VW360_Orders', 'BSLLC_Orders', 'BM_Orders', 'BCGGB_Orders'];

// Removes duplicate rows from an orders table.
// "Duplicate" = two rows where all these fields are identical (or both NULL):
//   order_demand_id, supplier, order_date, upc_ean, nav,
//   order_qty, order_price, so_qty, so_price,
//   invoice_so_proforma, brand, nav_name
// Keeps the row with the lowest id.
export async function POST(request: NextRequest) {
  try {
    let tables = ALL_TABLES;
    try {
      const body = await request.json();
      if (Array.isArray(body?.tables) && body.tables.length > 0) {
        tables = body.tables.filter((t: string) => ALL_TABLES.includes(t));
      }
    } catch { /* no body — dedup all */ }

    const pool = await poolPromise;
    if (!pool) return NextResponse.json({ error: 'DB connection failed' }, { status: 500 });

    const results: Record<string, number> = {};

    for (const table of tables) {
      // Check table exists first
      const exists = await pool.request().query(`
        SELECT 1 FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='${table}'
      `);
      if (!exists.recordset.length) { results[table] = 0; continue; }

      // Delete duplicates — keep the lowest id for each unique combination
      const res = await pool.request().query(`
        WITH ranked AS (
          SELECT id,
            ROW_NUMBER() OVER (
              PARTITION BY
                ISNULL(CAST(order_demand_id     AS NVARCHAR(500)),'__NULL__'),
                ISNULL(CAST(supplier            AS NVARCHAR(500)),'__NULL__'),
                ISNULL(CONVERT(NVARCHAR(10), order_date, 23),'__NULL__'),
                ISNULL(CAST(upc_ean             AS NVARCHAR(500)),'__NULL__'),
                ISNULL(CAST(nav                 AS NVARCHAR(500)),'__NULL__'),
                ISNULL(CAST(CAST(order_qty      AS FLOAT) AS NVARCHAR(100)),'__NULL__'),
                ISNULL(CAST(CAST(order_price    AS FLOAT) AS NVARCHAR(100)),'__NULL__'),
                ISNULL(CAST(CAST(so_qty         AS FLOAT) AS NVARCHAR(100)),'__NULL__'),
                ISNULL(CAST(CAST(so_price       AS FLOAT) AS NVARCHAR(100)),'__NULL__'),
                ISNULL(CAST(invoice_so_proforma AS NVARCHAR(500)),'__NULL__'),
                ISNULL(CAST(brand               AS NVARCHAR(500)),'__NULL__'),
                ISNULL(CAST(nav_name            AS NVARCHAR(500)),'__NULL__')
              ORDER BY id ASC
            ) AS rn
          FROM [dbo].[${table}]
        )
        DELETE FROM ranked WHERE rn > 1
      `);
      results[table] = res.rowsAffected[0] ?? 0;
    }

    const totalDeleted = Object.values(results).reduce((s, n) => s + n, 0);
    return NextResponse.json({ success: true, totalDeleted, byTable: results });
  } catch (error: any) {
    console.error('Dedup error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET — preview how many duplicates exist without deleting
export async function GET() {
  try {
    const pool = await poolPromise;
    if (!pool) return NextResponse.json({ error: 'DB connection failed' }, { status: 500 });

    const preview: Record<string, number> = {};

    for (const table of ALL_TABLES) {
      const exists = await pool.request().query(`
        SELECT 1 FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='${table}'
      `);
      if (!exists.recordset.length) { preview[table] = 0; continue; }

      const res = await pool.request().query(`
        SELECT COUNT(*) AS dup_count FROM (
          SELECT id,
            ROW_NUMBER() OVER (
              PARTITION BY
                ISNULL(CAST(order_demand_id     AS NVARCHAR(500)),'__NULL__'),
                ISNULL(CAST(supplier            AS NVARCHAR(500)),'__NULL__'),
                ISNULL(CONVERT(NVARCHAR(10), order_date, 23),'__NULL__'),
                ISNULL(CAST(upc_ean             AS NVARCHAR(500)),'__NULL__'),
                ISNULL(CAST(nav                 AS NVARCHAR(500)),'__NULL__'),
                ISNULL(CAST(CAST(order_qty      AS FLOAT) AS NVARCHAR(100)),'__NULL__'),
                ISNULL(CAST(CAST(order_price    AS FLOAT) AS NVARCHAR(100)),'__NULL__'),
                ISNULL(CAST(CAST(so_qty         AS FLOAT) AS NVARCHAR(100)),'__NULL__'),
                ISNULL(CAST(CAST(so_price       AS FLOAT) AS NVARCHAR(100)),'__NULL__'),
                ISNULL(CAST(invoice_so_proforma AS NVARCHAR(500)),'__NULL__'),
                ISNULL(CAST(brand               AS NVARCHAR(500)),'__NULL__'),
                ISNULL(CAST(nav_name            AS NVARCHAR(500)),'__NULL__')
              ORDER BY id ASC
            ) AS rn
          FROM [dbo].[${table}]
        ) t WHERE rn > 1
      `);
      preview[table] = res.recordset[0]?.dup_count ?? 0;
    }

    const total = Object.values(preview).reduce((s, n) => s + n, 0);
    return NextResponse.json({ totalDuplicates: total, byTable: preview });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
