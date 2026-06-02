import { NextRequest, NextResponse } from 'next/server';
import { poolPromise } from '@/lib/db';
import sql from 'mssql';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 500, 1), 2000);

    const pool = await poolPromise;
    const dbRequest = pool.request();
    dbRequest.input('limit', sql.Int, limit);

    // Materialize the latest upload timestamp once, then use it as a
    // parameter — avoids re-evaluating the correlated subquery for each row.
    const tsResult = await dbRequest.query(`
      SELECT MAX([UploadDatetime]) AS latest FROM [dbo].[Tbl_Products_Storage] WITH (NOLOCK)
    `);
    const latestTs = tsResult.recordset[0]?.latest;
    if (!latestTs) {
      return NextResponse.json([]);
    }
    dbRequest.input('latestTs', sql.DateTime2, latestTs);

    // Return products from the most recent upload batch
    const result = await dbRequest.query(`
      SELECT TOP (@limit)
        [Item_Code]  AS ProductCode,
        [Name]       AS ProductName,
        [Vendor]     AS VendorName,
        [EAN/UPC]    AS UPC,
        TRY_CAST(REPLACE(REPLACE(REPLACE([Price],'$',''),',',''),' ','') AS DECIMAL(18,2)) AS Price,
        TRY_CAST(TRY_CAST(REPLACE(REPLACE(ISNULL([Qty],'0'),',',''),' ','') AS DECIMAL(18,2)) AS INT) AS StockQuantity,
        CONVERT(varchar(10), [Date], 103) AS ProductDate
      FROM [dbo].[Tbl_Products_Storage] WITH (NOLOCK)
      WHERE [UploadDatetime] = @latestTs
      ORDER BY [Name] ASC
    `);

    return NextResponse.json(
      result.recordset.map((row) => ({
        productCode:   row.ProductCode   || '',
        productName:   row.ProductName   || '',
        productDate:   row.ProductDate   || '',
        upc:           String(row.UPC    || ''),
        price:         Number(row.Price  || 0),
        stockQuantity: Number(row.StockQuantity || 0),
        vendorName:    row.VendorName    || '',
      })),
      {
        headers: {
          // Cache for 60 s; serve stale for up to 5 min while revalidating in background
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (error: any) {
    console.error('Products latest items error:', error);
    return NextResponse.json(
      { error: `Failed to fetch latest products: ${error.message}` },
      { status: 500 }
    );
  }
}
