import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import sql from 'mssql';

const getSortClause = (sortBy: string | null) => {
  switch (sortBy) {
    case 'name':
      return 'ProductName ASC';
    case 'vendor':
      return 'VendorName ASC';
    case 'price':
    default:
      return 'Price ASC';
  }
};

const columnKey = (tableName: string, columnName: string) => `${tableName}.${columnName}`.toLowerCase();

// Cache schema introspection — the table structure doesn't change at runtime.
// Resolved once on first request, reused for all subsequent calls.
interface SchemaCache {
  storageHasBrand: boolean;
  productsHasBrand: boolean;
  canMatchProducts: boolean;
}
let schemaCache: SchemaCache | null = null;

async function getSchemaInfo(): Promise<SchemaCache> {
  if (schemaCache) return schemaCache;

  const pool = await getPool();
  const columnResult = await pool.request().query(`
    SELECT TABLE_NAME, COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'dbo'
      AND TABLE_NAME IN ('Tbl_Products_Storage', 'Tbl_Products')
  `);
  const columns = new Set(
    columnResult.recordset.map((row) => columnKey(row.TABLE_NAME, row.COLUMN_NAME)),
  );
  schemaCache = {
    storageHasBrand:  columns.has(columnKey('Tbl_Products_Storage', 'Brand')),
    productsHasBrand: columns.has(columnKey('Tbl_Products', 'Brand')),
    canMatchProducts:
      columns.has(columnKey('Tbl_Products', 'Brand')) &&
      columns.has(columnKey('Tbl_Products', 'Item_Code')) &&
      columns.has(columnKey('Tbl_Products', 'EAN/UPC')) &&
      columns.has(columnKey('Tbl_Products', 'Name')),
  };
  return schemaCache;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const navCode = searchParams.get('navCode')?.trim();
    const upcCode = searchParams.get('upcCode')?.trim();
    const productName = searchParams.get('productName')?.trim();
    const brandName = searchParams.get('brandName')?.trim();
    const vendor = searchParams.get('vendor')?.trim();

    if (!navCode && !upcCode && !productName && !brandName && !vendor) {
      return NextResponse.json(
        { error: 'At least one search parameter is required' },
        { status: 400 },
      );
    }

    const { storageHasBrand, canMatchProducts } = await getSchemaInfo();

    // If brandName was sent but Brand column doesn't exist, just ignore it
    // rather than returning an error — silently skip the filter.
    const effectiveBrandName = (brandName && (storageHasBrand || canMatchProducts))
      ? brandName
      : undefined;

    const pool = await getPool();
    const dbRequest = pool.request();
    const filters: string[] = [];
    const brandExpression = storageHasBrand
      ? 's.[Brand]'
      : canMatchProducts
        ? 'matchedProduct.[Brand]'
        : "''";
    const productBrandLookup = !storageHasBrand && canMatchProducts
      ? `
        OUTER APPLY (
          SELECT TOP 1 p.[Brand]
          FROM [dbo].[Tbl_Products] p
          WHERE
            (p.[Item_Code] = s.[Item_Code] AND s.[Item_Code] IS NOT NULL)
            OR (p.[EAN/UPC] = s.[EAN/UPC] AND s.[EAN/UPC] IS NOT NULL)
            OR (p.[Name] = s.[Name] AND s.[Name] IS NOT NULL)
          ORDER BY
            CASE
              WHEN p.[Item_Code] = s.[Item_Code] THEN 1
              WHEN p.[EAN/UPC] = s.[EAN/UPC] THEN 2
              ELSE 3
            END
        ) matchedProduct
      `
      : '';

    if (navCode) {
      filters.push('s.[Item_Code] LIKE @navCode');
      dbRequest.input('navCode', sql.NVarChar, `%${navCode}%`);
    }

    if (upcCode) {
      filters.push('s.[EAN/UPC] LIKE @upcCode');
      dbRequest.input('upcCode', sql.NVarChar, `%${upcCode}%`);
    }

    if (productName) {
      filters.push('s.[Name] LIKE @productName');
      dbRequest.input('productName', sql.NVarChar, `%${productName}%`);
    }

    if (effectiveBrandName) {
      filters.push(`${brandExpression} LIKE @brandName`);
      dbRequest.input('brandName', sql.NVarChar, `%${effectiveBrandName}%`);
    }

    if (vendor) {
      filters.push('UPPER(LTRIM(RTRIM(s.[Vendor]))) = UPPER(@vendor)');
      dbRequest.input('vendor', sql.NVarChar, vendor);
    }

    const result = await dbRequest.query(`
      SELECT DISTINCT
        s.[Item_Code] AS ProductCode,
        s.[Name] AS ProductName,
        FORMAT(s.[Date], 'dd-MM-yyyy') AS ProductDate,
        '' AS Description,
        ${brandExpression} AS Brand,
        '' AS Category,
        CASE
          WHEN ISNUMERIC(REPLACE(REPLACE(REPLACE(s.[Price], '$', ''), ',', ''), ' ', '')) = 1
          THEN CAST(REPLACE(REPLACE(REPLACE(s.[Price], '$', ''), ',', ''), ' ', '') AS DECIMAL(18,2))
          ELSE 0.00
        END AS Price,
        CASE
          WHEN ISNUMERIC(REPLACE(REPLACE(s.[Qty], ',', ''), ' ', '')) = 1
          THEN CAST(CAST(REPLACE(REPLACE(s.[Qty], ',', ''), ' ', '') AS DECIMAL(18,2)) AS INT)
          ELSE 0
        END AS StockQuantity,
        s.[EAN/UPC] AS UPC,
        s.[Vendor] AS VendorName
      FROM [dbo].[Tbl_Products_Storage] s
      ${productBrandLookup}
      WHERE ${filters.join(' AND ')}
      ORDER BY ${getSortClause(searchParams.get('sortBy'))}
    `);

    return NextResponse.json(
      result.recordset.map((row) => ({
        productId: row.ProductCode,
        productCode: row.ProductCode || '',
        productName: row.ProductName || '',
        productDate: row.ProductDate || '',
        description: row.Description || '',
        brand: row.Brand || '',
        category: row.Category || '',
        upc: String(row.UPC || ''),
        price: Number(row.Price || 0),
        stockQuantity: Number(row.StockQuantity || 0),
        vendorName: row.VendorName || '',
        vendors: [],
      })),
    );
  } catch (error: any) {
    console.error('Product insights search error:', error);
    return NextResponse.json(
      { error: `Failed to search product insights: ${error.message}` },
      { status: 500 },
    );
  }
}
