import { NextRequest, NextResponse } from 'next/server';
import { poolPromise } from '@/lib/db';
import sql from 'mssql';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query')?.trim();
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if (!query) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
    }

    const pool = await poolPromise;
    if (!pool) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    const req = pool.request();
    req.input('query', sql.NVarChar, `%${query}%`);

    let dateFilter = '';
    if (from) {
      req.input('from', sql.DateTime, new Date(from));
      dateFilter += ' AND [Date] >= @from';
    }
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      req.input('to', sql.DateTime, toDate);
      dateFilter += ' AND [Date] <= @to';
    }

    const result = await req.query(`
      SELECT
        [Date]       AS UploadDate,
        [EAN/UPC]    AS UPC,
        [Name]       AS ProductName,
        [Item_Code]  AS ProductCode,
        [Qty]        AS Qty,
        [Price]      AS Price,
        [Vendor]     AS VendorCode
      FROM [dbo].[Tbl_Products_Storage]
      WHERE (
        [EAN/UPC]    LIKE @query
        OR [Item_Code] LIKE @query
        OR [Name]    LIKE @query
      )
      ${dateFilter}
      ORDER BY [EAN/UPC], [Vendor], [Date] ASC
    `);

    if (result.recordset.length === 0) {
      return NextResponse.json({ products: [] });
    }

    // Group by EAN/UPC — so all vendors for the same product are in one card
    const upcMap: Record<string, any> = {};

    for (const row of result.recordset) {
      const upcKey = (row.UPC ?? '').trim();
      // Normalize vendor name: trim and collapse multiple spaces
      const vendorKey = (row.VendorCode ?? '').trim().replace(/\s+/g, ' ');

      if (!upcMap[upcKey]) {
        upcMap[upcKey] = {
          productCode: row.ProductCode,
          productName: row.ProductName,
          upc: upcKey,
          vendors: {},
        };
      }

      if (!upcMap[upcKey].vendors[vendorKey]) {
        upcMap[upcKey].vendors[vendorKey] = {
          vendorCode: vendorKey, // already normalized
          priceHistory: [],
        };
      }

      const rawPrice = String(row.Price ?? '').replace(/[$,]/g, '').trim();
      const price = parseFloat(rawPrice);

      // Format date as YYYY-MM-DD for clean X axis
      let dateStr = '';
      try {
        const d = new Date(row.UploadDate);
        dateStr = d.toISOString().split('T')[0];
      } catch {
        dateStr = String(row.UploadDate);
      }

      // Skip rows with invalid prices (0, negative, or extreme outliers > 10000)
      if (isNaN(price) || price <= 0 || price > 10000) continue;

      upcMap[upcKey].vendors[vendorKey].priceHistory.push({
        date: dateStr,
        price,
        qty: row.Qty,
      });
    }

    const products = Object.values(upcMap).map((p: any) => ({
      productCode: p.productCode,
      productName: p.productName,
      upc: p.upc,
      // Drop vendors with no valid price records
      vendors: Object.values(p.vendors).filter((v: any) => v.priceHistory.length > 0),
    })).filter((p: any) => p.vendors.length > 0);

    return NextResponse.json({ products });
  } catch (error: any) {
    console.error('Price history error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
