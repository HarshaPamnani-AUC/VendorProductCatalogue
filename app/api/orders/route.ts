import { NextRequest, NextResponse } from 'next/server';
import { poolPromise } from '@/lib/db';
import sql from 'mssql';

// ── GET: fetch orders from all three tables merged ────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const company   = searchParams.get('company') || '';
    const sheetType = searchParams.get('sheet_type') || '';
    const search    = searchParams.get('search') || '';
    const ean       = searchParams.get('ean') || '';
    const nav       = searchParams.get('nav') || '';
    const sortDir   = searchParams.get('sortDir') === 'asc' ? 'ASC' : 'DESC';
    const page      = parseInt(searchParams.get('page') || '1', 10);
    const pageSize  = parseInt(searchParams.get('pageSize') || '50', 10);
    const offset    = (page - 1) * pageSize;

    const pool = await poolPromise;
    if (!pool) return NextResponse.json({ error: 'DB connection failed' }, { status: 500 });

    const req = pool.request();
    req.input('offset',   sql.Int, offset);
    req.input('pageSize', sql.Int, pageSize);

    let whereClause = 'WHERE 1=1';
    if (company) {
      req.input('company', sql.NVarChar, company);
      whereClause += ' AND company = @company';
    }
    if (sheetType) {
      req.input('sheetType', sql.NVarChar, sheetType);
      whereClause += ' AND sheet_type = @sheetType';
    }
    if (search) {
      req.input('search', sql.NVarChar, `%${search}%`);
      whereClause += ' AND (order_demand_id LIKE @search OR supplier LIKE @search OR brand LIKE @search OR nav_name LIKE @search OR upc_ean LIKE @search)';
    }
    if (ean) {
      req.input('ean', sql.NVarChar, `%${ean}%`);
      whereClause += ' AND upc_ean LIKE @ean';
    }
    if (nav) {
      req.input('nav', sql.NVarChar, `%${nav}%`);
      whereClause += ' AND (so LIKE @nav OR invoice_so_proforma LIKE @nav)';
    }

    // Union all three tables, tag each row with its source company
    const unionSql = `
      SELECT id, order_demand_id, supplier, order_date, invoice_so_proforma,
             invoice_date, delivery_date, port_info_date, status, so, nav,
             upc_ean, brand, nav_name, currency,
             order_qty, order_price, so_qty, so_price, invoice_qty, inv_price,
             sheet_type, inserted_at, 'LLP' AS company
      FROM [dbo].[LLP_Orders]
      UNION ALL
      SELECT id, order_demand_id, supplier, order_date, invoice_so_proforma,
             invoice_date, delivery_date, port_info_date, status, so, nav,
             upc_ean, brand, nav_name, currency,
             order_qty, order_price, so_qty, so_price, invoice_qty, inv_price,
             sheet_type, inserted_at, 'VW360' AS company
      FROM [dbo].[VW360_Orders]
      UNION ALL
      SELECT id, order_demand_id, supplier, order_date, invoice_so_proforma,
             invoice_date, delivery_date, port_info_date, status, so, nav,
             upc_ean, brand, nav_name, currency,
             order_qty, order_price, so_qty, so_price, invoice_qty, inv_price,
             sheet_type, inserted_at, 'BSLLC' AS company
      FROM [dbo].[BSLLC_Orders]
    `;

    const countResult = await req.query(
      `SELECT COUNT(*) AS total FROM (${unionSql}) AS all_orders ${whereClause}`
    );
    const total = countResult.recordset[0].total;

    const dataResult = await req.query(`
      SELECT * FROM (${unionSql}) AS all_orders
      ${whereClause}
      ORDER BY 
        CASE WHEN order_date IS NULL THEN 1 ELSE 0 END,
        order_date ${sortDir},
        inserted_at ${sortDir}
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `);

    return NextResponse.json({
      data: dataResult.recordset,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error: any) {
    console.error('Orders GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── PATCH: update order details ──────────────────────────────────────────────
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, table, sheet_type, invoice_so_proforma, invoice_date, invoice_qty, inv_price } = body;

    const allowed = ['LLP_Orders', 'VW360_Orders', 'BSLLC_Orders'];
    const allowedTypes = ['PENDING ORDERS', 'DONE ORDERS', 'NOT BUY'];

    if (!allowed.includes(table)) return NextResponse.json({ error: 'Invalid table' }, { status: 400 });
    if (sheet_type && !allowedTypes.includes(sheet_type)) return NextResponse.json({ error: 'Invalid sheet_type' }, { status: 400 });
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const pool = await poolPromise;
    if (!pool) return NextResponse.json({ error: 'DB connection failed' }, { status: 500 });

    const req = pool.request();
    req.input('id', sql.Int, id);

    const updateFields: string[] = [];
    if (sheet_type !== undefined) {
      req.input('sheet_type', sql.NVarChar, sheet_type);
      updateFields.push('sheet_type = @sheet_type');
    }
    if (invoice_so_proforma !== undefined) {
      req.input('invoice_so_proforma', sql.NVarChar, invoice_so_proforma);
      updateFields.push('invoice_so_proforma = @invoice_so_proforma');
    }
    if (invoice_date !== undefined) {
      req.input('invoice_date', sql.Date, invoice_date ? new Date(invoice_date) : null);
      updateFields.push('invoice_date = @invoice_date');
    }
    if (invoice_qty !== undefined) {
      req.input('invoice_qty', sql.Decimal(15, 4), invoice_qty != null ? parseFloat(invoice_qty) : null);
      updateFields.push('invoice_qty = @invoice_qty');
    }
    if (inv_price !== undefined) {
      req.input('inv_price', sql.Decimal(15, 4), inv_price != null ? parseFloat(inv_price) : null);
      updateFields.push('inv_price = @inv_price');
    }

    if (updateFields.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    await req.query(`UPDATE [dbo].[${table}] SET ${updateFields.join(', ')} WHERE id = @id`);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Orders PATCH error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body  = await request.json();
    const table = body.table || 'LLP_Orders';

    const allowed = ['LLP_Orders', 'VW360_Orders', 'BSLLC_Orders'];
    if (!allowed.includes(table)) {
      return NextResponse.json({ error: 'Invalid table name' }, { status: 400 });
    }

    const pool = await poolPromise;
    if (!pool) return NextResponse.json({ error: 'DB connection failed' }, { status: 500 });

    const req = pool.request();
    req.input('order_demand_id',     sql.NVarChar, body.order_demand_id     || null);
    req.input('supplier',            sql.NVarChar, body.supplier            || null);
    req.input('order_date',          sql.Date,     body.order_date          ? new Date(body.order_date) : null);
    req.input('invoice_so_proforma', sql.NVarChar, body.invoice_so_proforma || null);
    req.input('invoice_date',        sql.Date,     body.invoice_date        ? new Date(body.invoice_date) : null);
    req.input('delivery_date',       sql.Date,     body.delivery_date       ? new Date(body.delivery_date) : null);
    req.input('port_info_date',      sql.Date,     body.port_info_date      ? new Date(body.port_info_date) : null);
    req.input('status',              sql.NVarChar, body.status              || null);
    req.input('so',                  sql.NVarChar, body.so                  || null);
    req.input('nav',                 sql.NVarChar, body.nav                 || null);
    req.input('upc_ean',             sql.NVarChar, body.upc_ean             || null);
    req.input('brand',               sql.NVarChar, body.brand               || null);
    req.input('nav_name',            sql.NVarChar, body.nav_name            || null);
    req.input('currency',            sql.NVarChar, body.currency            || null);
    req.input('order_qty',           sql.Decimal(15, 4), body.order_qty   != null ? parseFloat(body.order_qty)   : null);
    req.input('order_price',         sql.Decimal(15, 4), body.order_price != null ? parseFloat(body.order_price) : null);
    req.input('so_qty',              sql.Decimal(15, 4), body.so_qty      != null ? parseFloat(body.so_qty)      : null);
    req.input('so_price',            sql.Decimal(15, 4), body.so_price    != null ? parseFloat(body.so_price)    : null);
    req.input('invoice_qty',         sql.Decimal(15, 4), body.invoice_qty != null ? parseFloat(body.invoice_qty) : null);
    req.input('inv_price',           sql.Decimal(15, 4), body.inv_price   != null ? parseFloat(body.inv_price)   : null);
    req.input('sheet_type',          sql.NVarChar, body.sheet_type          || 'PENDING ORDERS');

    await req.query(`
      INSERT INTO [dbo].[${table}] (
        order_demand_id, supplier, order_date, invoice_so_proforma,
        invoice_date, delivery_date, port_info_date, status, so, nav,
        upc_ean, brand, nav_name, currency,
        order_qty, order_price, so_qty, so_price, invoice_qty, inv_price, sheet_type
      ) VALUES (
        @order_demand_id, @supplier, @order_date, @invoice_so_proforma,
        @invoice_date, @delivery_date, @port_info_date, @status, @so, @nav,
        @upc_ean, @brand, @nav_name, @currency,
        @order_qty, @order_price, @so_qty, @so_price, @invoice_qty, @inv_price, @sheet_type
      )
    `);

    return NextResponse.json({ success: true, message: 'Order inserted successfully' });
  } catch (error: any) {
    console.error('Orders POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── DELETE: delete selected orders ───────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { rows } = body; // [{ id, table }, ...]

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
    }

    const allowed = ['LLP_Orders', 'VW360_Orders', 'BSLLC_Orders'];
    const pool = await poolPromise;
    if (!pool) return NextResponse.json({ error: 'DB connection failed' }, { status: 500 });

    const byTable: Record<string, number[]> = {};
    for (const { id, table } of rows) {
      if (!allowed.includes(table)) continue;
      if (!byTable[table]) byTable[table] = [];
      byTable[table].push(id);
    }

    let deleted = 0;
    for (const [table, ids] of Object.entries(byTable)) {
      const req = pool.request();
      const paramList = ids.map((id, i) => {
        req.input(`id${i}`, sql.Int, id);
        return `@id${i}`;
      }).join(', ');
      const result = await req.query(
        `DELETE FROM [dbo].[${table}] WHERE id IN (${paramList})`
      );
      deleted += result.rowsAffected[0];
    }

    return NextResponse.json({ success: true, deleted });
  } catch (error: any) {
    console.error('Orders DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
