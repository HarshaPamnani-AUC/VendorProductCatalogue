import { NextRequest, NextResponse } from 'next/server';
import { poolPromise } from '@/lib/db';
import sql from 'mssql';

const COLUMN_MAP: Record<string, string> = {
  'order/demand id':      'order_demand_id',
  'order demand id':      'order_demand_id',
  'order/demand':         'order_demand_id',
  'supplier':             'supplier',
  'order date':           'order_date',
  'invoice date':         'invoice_date',
  'delivery date':        'delivery_date',
  'port info date':       'port_info_date',
  'invoice/so/proforma':  'invoice_so_proforma',
  'invoice/so/ proforma': 'invoice_so_proforma',
  'status':               'status',
  'so':                   'so',
  'nav':                  'nav',
  'upc/ean':              'upc_ean',
  'upc/ ean':             'upc_ean',
  'brand':                'brand',
  'nav name':             'nav_name',
  'currency':             'currency',
  'order qty':            'order_qty',
  'order price':          'order_price',
  'so qty':               'so_qty',
  'so price':             'so_price',
  'invoice qty':          'invoice_qty',
  'inv. price':           'inv_price',
  'inv price':            'inv_price',
  'invoice price':        'inv_price',
};

const DATE_COLS    = new Set(['order_date', 'invoice_date', 'delivery_date', 'port_info_date']);
const NUMERIC_COLS = new Set(['order_qty', 'order_price', 'so_qty', 'so_price', 'invoice_qty', 'inv_price']);
const DATE_FORMATS = [
  /^(\d{4})-(\d{2})-(\d{2})$/,   // YYYY-MM-DD
  /^(\d{2})\/(\d{2})\/(\d{4})$/, // MM/DD/YYYY
  /^(\d{2})-(\d{2})-(\d{4})$/,   // DD-MM-YYYY
];

function parseDate(val: any): Date | null {
  if (val == null || val === '') return null;
  // Excel serial number
  if (typeof val === 'number') {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? null : d;
  }
  const s = String(val).trim();
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function parseNum(val: any): number | null {
  if (val == null || val === '') return null;
  const n = parseFloat(String(val).replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

export async function POST(request: NextRequest) {
  try {
    const formData  = await request.formData();
    const file      = formData.get('file') as File;
    const table     = (formData.get('table') as string) || 'LLP_Orders';
    const sheetType = (formData.get('sheet_type') as string) || 'PENDING ORDERS';

    const allowed = ['LLP_Orders', 'VW360_Orders', 'BSLLC_Orders', 'BM_Orders', 'BCGGB_Orders'];
    if (!allowed.includes(table)) {
      return NextResponse.json({ error: 'Invalid table name' }, { status: 400 });
    }
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const XLSX = require('xlsx');
    const buffer   = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
    const sheet    = workbook.Sheets[workbook.SheetNames[0]];
    const raw: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

    if (raw.length < 2) {
      return NextResponse.json({ error: 'File must have a header row and at least one data row' }, { status: 400 });
    }

    // Build header → db column map
    const headers: string[] = (raw[0] as any[]).map(h => String(h ?? '').trim().toLowerCase().replace(/\s+/g, ' '));
    const colMap: Record<number, string> = {};
    headers.forEach((h, i) => {
      const db = COLUMN_MAP[h];
      if (db) colMap[i] = db;
    });

    const pool = await poolPromise;
    if (!pool) return NextResponse.json({ error: 'DB connection failed' }, { status: 500 });

    let inserted = 0;
    let skipped  = 0;

    for (let ri = 1; ri < raw.length; ri++) {
      const row = raw[ri] as any[];
      if (!row || row.every(c => c == null || c === '')) { skipped++; continue; }

      const req = pool.request();
      const cols: string[] = ['sheet_type'];
      req.input('sheet_type', sql.NVarChar, sheetType);

      for (const [idxStr, dbCol] of Object.entries(colMap)) {
        const idx = parseInt(idxStr);
        let val   = row[idx] ?? null;

        if (DATE_COLS.has(dbCol)) {
          val = parseDate(val);
          req.input(dbCol, sql.Date, val);
        } else if (NUMERIC_COLS.has(dbCol)) {
          val = parseNum(val);
          req.input(dbCol, sql.Decimal(15, 4), val);
        } else {
          val = val != null && val !== '' ? String(val) : null;
          req.input(dbCol, sql.NVarChar, val);
        }
        cols.push(dbCol);
      }

      const colList  = cols.map(c => c).join(', ');
      const paramList = cols.map(c => `@${c}`).join(', ');

      await req.query(`INSERT INTO [dbo].[${table}] (${colList}) VALUES (${paramList})`);
      inserted++;
    }

    return NextResponse.json({ success: true, inserted, skipped });
  } catch (error: any) {
    console.error('Orders upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
