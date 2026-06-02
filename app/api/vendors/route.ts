import { NextResponse } from 'next/server';
import { dbConfig } from '@/lib/dbConfig';

// ── In-memory cache ───────────────────────────────────────────────────────────
// Vendors rarely change, so cache for 10 minutes to keep the dropdown fast.
let cache: { vendors: VendorResponse[]; expiresAt: number } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface VendorResponse {
  VendorId: number;
  VendorName: string;
  ProductCount: number;
  LastUpload: string;
}

export async function GET() {
  // Serve from cache if still fresh
  if (cache && Date.now() < cache.expiresAt) {
    return NextResponse.json(cache.vendors, {
      headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' },
    });
  }

  const sql = require('mssql');
  const sqlConfig = {
    user:     dbConfig.user,
    password: dbConfig.password,
    server:   dbConfig.server,
    database: dbConfig.database,
    options: {
      encrypt:                true,
      trustServerCertificate: true,
      connectTimeout:         30000,
      requestTimeout:         30000,
    },
  };

  try {
    const pool = await sql.connect(sqlConfig);

    // Fetch active vendors + their latest upload date and product count
    // from Tbl_Products_Storage in one join
    const result = await pool.request().query(`
      SELECT
        v.VendorId,
        v.VendorName,
        ISNULL(s.ProductCount, 0)  AS ProductCount,
        ISNULL(s.LatestUpload, '') AS LatestUpload
      FROM [dbo].[Vendors] v
      LEFT JOIN (
        SELECT
          [Vendor],
          COUNT(*)            AS ProductCount,
          MAX([UploadDatetime]) AS LatestUpload
        FROM [dbo].[Tbl_Products_Storage] WITH (NOLOCK)
        GROUP BY [Vendor]
      ) s ON UPPER(LTRIM(RTRIM(s.[Vendor]))) = UPPER(LTRIM(RTRIM(v.VendorName)))
      WHERE v.IsActive = 1
      ORDER BY v.VendorName
    `);

    await pool.close();

    const vendors: VendorResponse[] = result.recordset.map((row: {
      VendorId: number;
      VendorName: string;
      ProductCount: number;
      LatestUpload: Date | string;
    }) => ({
      VendorId:     row.VendorId,
      VendorName:   row.VendorName,
      ProductCount: row.ProductCount,
      LastUpload:   row.LatestUpload
        ? new Date(row.LatestUpload).toLocaleDateString()
        : '',
    }));

    cache = { vendors, expiresAt: Date.now() + CACHE_TTL_MS };

    return NextResponse.json(vendors, {
      headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' },
    });

  } catch (err) {
    console.error('Vendors API error:', err);
    return NextResponse.json(
      { error: 'Failed to load vendors' },
      { status: 500 },
    );
  }
}
