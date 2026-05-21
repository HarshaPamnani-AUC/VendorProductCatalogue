import { NextRequest, NextResponse } from 'next/server';
import { poolPromise } from '@/lib/db';
import sql from 'mssql';

const columnKey = (columnName: string) => columnName.toLowerCase();

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const navCode = searchParams.get('navCode')?.trim();
    const upcCode = searchParams.get('upcCode')?.trim();
    const productName = searchParams.get('productName')?.trim();
    const sortBy = searchParams.get('sortBy');
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(Math.max(Number(limitParam) || 10, 1), 100) : null;

    if (!navCode && !upcCode && !productName && !limit) {
      return NextResponse.json(
        { error: 'At least one search parameter is required' },
        { status: 400 },
      );
    }

    const pool = await poolPromise;
    const columnResult = await pool.request().query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo'
        AND TABLE_NAME = 'Tbl_Products_Storage'
    `);

    const columns = new Set(columnResult.recordset.map((row) => columnKey(row.COLUMN_NAME)));
    const quantityColumn = columns.has(columnKey('Qty'))
      ? 'Qty'
      : columns.has(columnKey('Stock_Qty'))
        ? 'Stock_Qty'
        : null;
    const quantityExpression = quantityColumn
      ? `
        CASE
          WHEN ISNUMERIC(REPLACE(REPLACE([${quantityColumn}], ',', ''), ' ', '')) = 1
          THEN CAST(REPLACE(REPLACE([${quantityColumn}], ',', ''), ' ', '') AS INT)
          ELSE 0
        END
      `
      : '0';
    const dateExpression = columns.has(columnKey('Date'))
      ? "FORMAT([Date], 'dd-MM-yyyy')"
      : "'Current'";
    const brandExpression = columns.has(columnKey('Brand')) ? '[Brand]' : "''";

    const dbRequest = pool.request();
    const filters: string[] = [];

    if (limit) {
      dbRequest.input('limit', sql.Int, limit);
    }

    if (navCode) {
      filters.push('[Item_Code] LIKE @navCode');
      dbRequest.input('navCode', sql.NVarChar, `%${navCode}%`);
    }

    if (upcCode) {
      filters.push('[EAN/UPC] LIKE @upcCode');
      dbRequest.input('upcCode', sql.NVarChar, `%${upcCode}%`);
    }

    if (productName) {
      filters.push('[Name] LIKE @productName');
      dbRequest.input('productName', sql.NVarChar, `%${productName}%`);
    }

    const result = await dbRequest.query(`
      SELECT ${limit ? 'TOP (@limit)' : ''}
        [Item_Code] AS ProductCode,
        [Name] AS ProductName,
        ${dateExpression} AS ProductDate,
        '' AS Description,
        ${brandExpression} AS Brand,
        '' AS Category,
        CASE
          WHEN ISNUMERIC(REPLACE(REPLACE(REPLACE([Price], '$', ''), ',', ''), ' ', '')) = 1
          THEN CAST(REPLACE(REPLACE(REPLACE([Price], '$', ''), ',', ''), ' ', '') AS DECIMAL(18,2))
          ELSE 0.00
        END AS Price,
        ${quantityExpression} AS StockQuantity,
        [EAN/UPC] AS UPC,
        [Vendor] AS VendorName
      FROM [dbo].[Tbl_Products_Storage]
      WHERE ${filters.length > 0 ? filters.join(' AND ') : '1=1'}
      ORDER BY ${getSortClause(sortBy)}
    `);

    return NextResponse.json(
      result.recordset.map((row) => ({
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
    console.error('Price intelligence search error:', error);
    return NextResponse.json(
      { error: `Failed to search price intelligence: ${error.message}` },
      { status: 500 },
    );
  }
}
