import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import sql from 'mssql';

// In-memory result cache: key → { ts, payload }
// Keeps the last result per search key for 2 minutes so rapid re-fetches
// (e.g. React Strict Mode double-invoke, page refresh) hit memory, not the DB.
const cache = new Map<string, { ts: number; payload: string }>();
const CACHE_TTL = 2 * 60 * 1000; // 2 min

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query')?.trim();
    const from  = searchParams.get('from');
    const to    = searchParams.get('to');

    if (!query) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
    }

    const cacheKey = `${query}|${from ?? ''}|${to ?? ''}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return new NextResponse(cached.payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Cache': 'HIT',
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=120',
        },
      });
    }

    const pool = await getPool();

    const req = pool.request();
    // Use trailing-wildcard when query looks like an exact code/UPC (no spaces),
    // and full LIKE only for name searches — dramatically faster on indexed columns.
    const isCodeLike = !/\s/.test(query);
    const likeVal    = isCodeLike ? `${query}%` : `%${query}%`;
    req.input('query', sql.NVarChar, likeVal);

    // Bind a plain-prefix pattern for the indexed Item_Code / UPC columns
    // so SQL Server can use index seeks on those, and only fall back to
    // a full scan on Name.
    const prefixVal = `${query}%`;
    req.input('prefix', sql.NVarChar, prefixVal);

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

    // Cap at 5 000 rows — enough for any realistic price history query.
    // NOLOCK avoids shared-lock waits on the large storage table.
    // Prefix-match on indexed columns first; full LIKE only on Name.
    const result = await req.query(`
      SELECT TOP 5000
        [Date]       AS UploadDate,
        [EAN/UPC]    AS UPC,
        [Name]       AS ProductName,
        [Item_Code]  AS ProductCode,
        [Qty]        AS Qty,
        [Price]      AS Price,
        [Vendor]     AS VendorCode
      FROM [dbo].[Tbl_Products_Storage] WITH (NOLOCK)
      WHERE (
        [EAN/UPC]    LIKE @prefix
        OR [Item_Code] LIKE @prefix
        OR [Name]    LIKE @query
      )
      ${dateFilter}
      ORDER BY [EAN/UPC], [Vendor], [Date] ASC
    `);

    if (result.recordset.length === 0) {
      return NextResponse.json({ products: [] });
    }

    // Group by EAN/UPC → vendor
    const upcMap: Record<string, any> = {};

    for (const row of result.recordset) {
      const upcKey    = (row.UPC      ?? '').trim();
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
          vendorCode: vendorKey,
          priceHistory: [],
        };
      }

      const rawPrice = String(row.Price ?? '').replace(/[$,]/g, '').trim();
      const price    = parseFloat(rawPrice);

      let dateStr = '';
      try {
        const d = new Date(row.UploadDate);
        dateStr = d.toISOString().split('T')[0];
      } catch {
        dateStr = String(row.UploadDate);
      }

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
      vendors: Object.values(p.vendors).filter((v: any) => v.priceHistory.length > 0),
    })).filter((p: any) => p.vendors.length > 0);

    const payload = JSON.stringify({ products });
    cache.set(cacheKey, { ts: Date.now(), payload });

    return new NextResponse(payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Cache': 'MISS',
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=120',
      },
    });
  } catch (error: any) {
    console.error('Price history error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
