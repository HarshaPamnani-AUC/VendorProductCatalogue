import { NextRequest, NextResponse } from 'next/server';
import { poolPromise } from '@/lib/db';
import sql from 'mssql';

const getSortClause = (sortBy: string | null) => {
  switch (sortBy) {
    case 'name':  return 'ProductName ASC';
    case 'vendor': return 'VendorName ASC';
    case 'price':
    default:      return 'Price ASC';
  }
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const navCode     = searchParams.get('navCode')?.trim();
    const upcCode     = searchParams.get('upcCode')?.trim();
    const productName = searchParams.get('productName')?.trim();
    const sortBy      = searchParams.get('sortBy');
    const limit       = Math.min(Math.max(Number(searchParams.get('limit')) || 10, 1), 100);

    const hasSearch = navCode || upcCode || productName;

    const pool = await poolPromise;
    const dbRequest = pool.request();
    dbRequest.input('limit', sql.Int, limit);

    let query: string;

    if (hasSearch) {
      // Search mode — filter by provided params
      const filters: string[] = [];
      if (navCode)     { filters.push('[Item_Code] LIKE @navCode');   dbRequest.input('navCode',     sql.NVarChar, `%${navCode}%`); }
      if (upcCode)     { filters.push('[EAN/UPC]   LIKE @upcCode');   dbRequest.input('upcCode',     sql.NVarChar, `%${upcCode}%`); }
      if (productName) { filters.push('[Name]       LIKE @productName'); dbRequest.input('productName', sql.NVarChar, `%${productName}%`); }

      query = `
        SELECT TOP (@limit)
          [Item_Code]  AS ProductCode,
          [Name]       AS ProductName,
          [Vendor]     AS VendorName,
          [EAN/UPC]    AS UPC,
          TRY_CAST(REPLACE(REPLACE(REPLACE([Price],'$',''),',',''),' ','') AS DECIMAL(18,2)) AS Price,
          TRY_CAST(TRY_CAST(REPLACE(REPLACE(ISNULL([Qty],'0'),',',''),' ','') AS DECIMAL(18,2)) AS INT) AS StockQuantity,
          CONVERT(varchar(10), [Date], 103) AS ProductDate
        FROM [dbo].[Tbl_Products_Storage] WITH (NOLOCK)
        WHERE ${filters.join(' AND ')}
        ORDER BY ${getSortClause(sortBy)}
      `;
    } else {
      // Dashboard mode — cheapest possible: grab TOP N from most recent upload batch
      query = `
        SELECT TOP (@limit)
          [Item_Code]  AS ProductCode,
          [Name]       AS ProductName,
          [Vendor]     AS VendorName,
          [EAN/UPC]    AS UPC,
          TRY_CAST(REPLACE(REPLACE(REPLACE([Price],'$',''),',',''),' ','') AS DECIMAL(18,2)) AS Price,
          TRY_CAST(TRY_CAST(REPLACE(REPLACE(ISNULL([Qty],'0'),',',''),' ','') AS DECIMAL(18,2)) AS INT) AS StockQuantity,
          CONVERT(varchar(10), [Date], 103) AS ProductDate
        FROM [dbo].[Tbl_Products_Storage] WITH (NOLOCK)
        WHERE [UploadDatetime] = (SELECT MAX([UploadDatetime]) FROM [dbo].[Tbl_Products_Storage] WITH (NOLOCK))
        ORDER BY ${getSortClause(sortBy)}
      `;
    }

    const result = await dbRequest.query(query);

    return NextResponse.json(
      result.recordset.map((row) => ({
        productCode:   row.ProductCode   || '',
        productName:   row.ProductName   || '',
        productDate:   row.ProductDate   || '',
        description:   '',
        brand:         '',
        category:      '',
        upc:           String(row.UPC    || ''),
        price:         Number(row.Price  || 0),
        stockQuantity: Number(row.StockQuantity || 0),
        vendorName:    row.VendorName    || '',
        vendors:       [],
      })),
      {
        headers: {
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (error: any) {
    console.error('Price intelligence error:', error);
    return NextResponse.json(
      { error: `Failed to search price intelligence: ${error.message}` },
      { status: 500 }
    );
  }
}
