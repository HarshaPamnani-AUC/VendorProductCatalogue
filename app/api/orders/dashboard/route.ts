import { NextRequest, NextResponse } from 'next/server';
import { poolPromise } from '@/lib/db';
import sql from 'mssql';

const EXTRA_TABLES = ['BM_Orders', 'BCGGB_Orders'];

async function ensureExtraTablesExist(pool: sql.ConnectionPool) {
  const createSql = (t: string) => `
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES
                   WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = '${t}')
    BEGIN
      CREATE TABLE [dbo].[${t}] (
        [id]                  INT           PRIMARY KEY IDENTITY(1,1),
        [order_demand_id]     NVARCHAR(255),
        [supplier]            NVARCHAR(255),
        [order_date]          DATE,
        [invoice_so_proforma] NVARCHAR(255),
        [invoice_date]        DATE,
        [delivery_date]       DATE,
        [port_info_date]      DATE,
        [status]              NVARCHAR(255),
        [so]                  NVARCHAR(255),
        [nav]                 NVARCHAR(255),
        [upc_ean]             NVARCHAR(255),
        [brand]               NVARCHAR(255),
        [nav_name]            NVARCHAR(500),
        [currency]            NVARCHAR(50),
        [order_qty]           DECIMAL(15,4),
        [order_price]         DECIMAL(15,4),
        [so_qty]              DECIMAL(15,4),
        [so_price]            DECIMAL(15,4),
        [invoice_qty]         DECIMAL(15,4),
        [inv_price]           DECIMAL(15,4),
        [sheet_type]          NVARCHAR(100) NOT NULL DEFAULT 'PENDING ORDERS',
        [inserted_at]         DATETIME      DEFAULT GETUTCDATE()
      )
    END
  `;
  for (const t of EXTRA_TABLES) {
    await pool.request().query(createSql(t));
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search   = searchParams.get('search') || '';
    const company  = searchParams.get('company') || '';
    const page     = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '100', 10);
    const offset   = (page - 1) * pageSize;

    const pool = await poolPromise;
    if (!pool) return NextResponse.json({ error: 'DB connection failed' }, { status: 500 });

    await ensureExtraTablesExist(pool);

    const req = pool.request();
    req.input('offset',   sql.Int, offset);
    req.input('pageSize', sql.Int, pageSize);

    let where = 'WHERE sheet_type != \'NOT BUY\'';
    if (company) {
      req.input('company', sql.NVarChar, company);
      where += ' AND company = @company';
    }
    if (search) {
      req.input('search', sql.NVarChar, `%${search}%`);
      where += ' AND (supplier LIKE @search OR upc_ean LIKE @search OR nav_name LIKE @search OR order_demand_id LIKE @search)';
    }

    const unionSql = `
      SELECT id, sheet_type, 'LLP' AS company, supplier, invoice_date, currency,
             order_qty, order_price, so_qty, so_price, invoice_qty, inv_price,
             order_demand_id, nav_name, upc_ean, order_date, nav
      FROM [dbo].[LLP_Orders]
      UNION ALL
      SELECT id, sheet_type, 'VW360' AS company, supplier, invoice_date, currency,
             order_qty, order_price, so_qty, so_price, invoice_qty, inv_price,
             order_demand_id, nav_name, upc_ean, order_date, nav
      FROM [dbo].[VW360_Orders]
      UNION ALL
      SELECT id, sheet_type, 'BSLLC' AS company, supplier, invoice_date, currency,
             order_qty, order_price, so_qty, so_price, invoice_qty, inv_price,
             order_demand_id, nav_name, upc_ean, order_date, nav
      FROM [dbo].[BSLLC_Orders]
      UNION ALL
      SELECT id, sheet_type, 'BM' AS company, supplier, invoice_date, currency,
             order_qty, order_price, so_qty, so_price, invoice_qty, inv_price,
             order_demand_id, nav_name, upc_ean, order_date, nav
      FROM [dbo].[BM_Orders]
      UNION ALL
      SELECT id, sheet_type, 'BCGGB' AS company, supplier, invoice_date, currency,
             order_qty, order_price, so_qty, so_price, invoice_qty, inv_price,
             order_demand_id, nav_name, upc_ean, order_date, nav
      FROM [dbo].[BCGGB_Orders]
    `;

    // Run stats (which already includes COUNT(*) as total) and
    // paged data in parallel — two queries instead of three.
    const [statsResult, dataResult] = await Promise.all([
      req.query(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN sheet_type = 'PENDING ORDERS' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN sheet_type = 'DONE ORDERS'    THEN 1 ELSE 0 END) AS done,
          SUM(CASE WHEN sheet_type = 'NOT BUY'        THEN 1 ELSE 0 END) AS not_buy,
          SUM(ISNULL(order_qty * order_price, 0))   AS total_order_value,
          SUM(ISNULL(invoice_qty * inv_price, 0))   AS total_invoice_value
        FROM (${unionSql}) AS all_orders
        ${where}
      `),
      req.query(`
        SELECT * FROM (${unionSql}) AS all_orders
        ${where}
        ORDER BY
          CASE WHEN sheet_type = 'PENDING ORDERS' THEN 0
               WHEN sheet_type = 'DONE ORDERS'    THEN 1
               ELSE 2 END,
          CASE WHEN invoice_date IS NULL THEN 1 ELSE 0 END,
          invoice_date DESC
        OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
      `),
    ]);

    const total = statsResult.recordset[0].total;

    return NextResponse.json({
      stats: statsResult.recordset[0],
      data:  dataResult.recordset,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error: any) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
