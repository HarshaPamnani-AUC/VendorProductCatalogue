import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { dbConfig } from '@/lib/dbConfig';

function appendUploadLog(entry: Record<string, unknown>) {
  try {
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    fs.appendFileSync(
      path.join(logsDir, 'uploads.log'),
      JSON.stringify({ timestamp: new Date().toISOString(), ...entry }) + '\n',
    );
  } catch {
    // logging must not break the upload
  }
}

/** Chunk an array into batches of `size` */
function chunks<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

export async function POST(request: NextRequest) {
  let vendorName = '';
  let fileName = '';

  try {
    const formData = await request.formData();
    vendorName = formData.get('vendorName') as string;
    const file = formData.get('file') as File;

    appendUploadLog({
      source: 'UPLOAD_PRODUCTS',
      vendorName,
      fileName: file?.name,
      fileSize: file?.size,
      status: 'REQUEST_RECEIVED',
    });

    if (!vendorName || !file) {
      return NextResponse.json(
        { success: false, message: 'Vendor name and file are required' },
        { status: 400 },
      );
    }

    fileName = file.name;

    // ── 1. Parse & normalise Excel ────────────────────────────────────────────
    const XLSX = require('xlsx');
    const { resolveColumnMapping, parseRowFromSheet, isDataRow, SUPPORTED_FORMAT_HELP } =
      require('../../../utils/uploadColumnMap');
    const { normalizeWorkbookDates } = require('../../../utils/formatUploadDate');

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    let workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    workbook = normalizeWorkbookDates(workbook, XLSX);

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data: unknown[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    if (data.length < 2) {
      return NextResponse.json(
        { success: false, message: 'File must contain at least a header row and one data row' },
        { status: 400 },
      );
    }

    const { mapping, displayHeaders, missing, priceColumnIndexes } = resolveColumnMapping(data[0]);

    if (missing.length > 0) {
      return NextResponse.json({
        success: false,
        message: `Missing required columns: ${missing.join(', ')}. ${SUPPORTED_FORMAT_HELP}`,
        validationErrors: {
          required: ['DATE', 'EAN/UPC', 'NAME', 'ITEM CODE', 'QTY', 'PRICE'],
          actual: displayHeaders,
        },
      });
    }

    // ── 2. Build in-memory rows ───────────────────────────────────────────────
    type Row = { date: string; eanUpc: string; name: string; itemCode: string; qty: string; price: string };
    const rows: Row[] = [];

    for (const row of data.slice(1) as unknown[][]) {
      if (!isDataRow(row, mapping)) continue;
      const p = parseRowFromSheet(row, mapping, priceColumnIndexes);
      rows.push({
        date:     String(p.date     ?? '').slice(0, 50),
        eanUpc:   String(p.eanUpc   ?? '').slice(0, 255),
        name:     String(p.name     ?? '').slice(0, 500),
        itemCode: String(p.itemCode ?? '').slice(0, 255),
        qty:      String(p.qty      ?? '').slice(0, 50),
        price:    String(p.price    ?? '').slice(0, 50),
      });
    }

    const rowsInFile = rows.length;

    if (rowsInFile === 0) {
      return NextResponse.json(
        { success: false, message: 'No valid data rows found in the file.' },
        { status: 400 },
      );
    }

    // ── 3. Connect ────────────────────────────────────────────────────────────
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
        requestTimeout:         120000,
      },
    };

    const pool = await sql.connect(sqlConfig);
    const uploadDatetime = new Date().toISOString();

    try {
      // ── 4. Get existing EAN/UPC combinations (for dup check) ──────────────
      // Check against Tbl_Products_Storage for this vendor's latest upload
      // so re-uploading the same file doesn't create duplicate history entries.
      const existingResult = await pool.request()
        .input('Vendor', sql.NVarChar(255), vendorName)
        .query(`
          SELECT DISTINCT [EAN/UPC]
          FROM [dbo].[Tbl_Products_Storage] WITH (NOLOCK)
          WHERE [Vendor] = @Vendor
            AND CAST([UploadDatetime] AS DATE) = CAST(GETDATE() AS DATE)
            AND [EAN/UPC] IS NOT NULL AND [EAN/UPC] != ''
        `);

      const existingSet = new Set<string>();
      for (const row of existingResult.recordset as Array<{ 'EAN/UPC': string }>) {
        existingSet.add(row['EAN/UPC']);
      }

      // ── 5. Filter out today's duplicates in memory ─────────────────────────
      const newRows = rows.filter(r => {
        const ean = String(r.eanUpc).trim();
        return ean && !existingSet.has(ean);
      });
      const rowsSkippedDuplicates = rows.length - newRows.length;

      if (newRows.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'All rows already uploaded today (duplicates).',
          results: {
            rowsInFile,
            rowsInserted: 0,
            rowsSkippedDuplicates,
            rowsFailed: 0,
            vendor: vendorName,
          },
        });
      }

      // ── 6. Bulk-insert into Tbl_Products_Storage ──────────────────────────
      // SQL Server limit: 2100 params. 8 params per row → max 262 rows/batch.
      // Use 250 to stay safely under the limit.
      const BATCH_STORAGE = Math.floor(2000 / 8); // = 250
      let rowsInserted = 0;

      for (const batch of chunks(newRows, BATCH_STORAGE)) {
        const req = pool.request();
        const valueParts: string[] = [];

        batch.forEach((r, i) => {
          req.input(`d${i}`,   sql.NVarChar(50),  r.date);
          req.input(`e${i}`,   sql.NVarChar(255), r.eanUpc);
          req.input(`n${i}`,   sql.NVarChar(500), r.name);
          req.input(`ic${i}`,  sql.NVarChar(255), r.itemCode);
          req.input(`q${i}`,   sql.NVarChar(50),  r.qty);
          req.input(`p${i}`,   sql.NVarChar(50),  r.price);
          req.input(`vn${i}`,  sql.NVarChar(255), vendorName);
          req.input(`ud${i}`,  sql.DateTime,      new Date(uploadDatetime));
          valueParts.push(`(@d${i}, @e${i}, @n${i}, @ic${i}, @q${i}, @p${i}, @vn${i}, @ud${i})`);
        });

        const result = await req.query(`
          INSERT INTO [dbo].[Tbl_Products_Storage]
            ([Date],[EAN/UPC],[Name],[Item_Code],[Qty],[Price],[Vendor],[UploadDatetime])
          VALUES ${valueParts.join(',')};
          SELECT @@ROWCOUNT AS inserted;
        `);

        rowsInserted += result.recordset[0].inserted;
      }

      // ── 7. Also write to Upload_Tbl_Products for legacy compat ───────────
      // Clear previous and re-insert so Proc_Upload_Tbl_Products still works
      // 6 params per row → max 333 rows/batch, use 300 to be safe.
      const BATCH_UPLOAD = Math.floor(2000 / 6); // = 333, use 300
      await pool.request().query('DELETE FROM [dbo].[Upload_Tbl_Products]');
      for (const batch of chunks(newRows, BATCH_UPLOAD)) {
        const req = pool.request();
        const valueParts: string[] = [];
        batch.forEach((r, i) => {
          req.input(`d${i}`,  sql.NVarChar(50),  r.date);
          req.input(`e${i}`,  sql.NVarChar(255), r.eanUpc);
          req.input(`n${i}`,  sql.NVarChar(500), r.name);
          req.input(`ic${i}`, sql.NVarChar(255), r.itemCode);
          req.input(`q${i}`,  sql.NVarChar(50),  r.qty);
          req.input(`p${i}`,  sql.NVarChar(50),  r.price);
          valueParts.push(`(@d${i}, @e${i}, @n${i}, @ic${i}, @q${i}, @p${i})`);
        });
        await req.query(`
          INSERT INTO [dbo].[Upload_Tbl_Products]
            ([Date],[EAN/UPC],[Name],[Item_Code],[Qty],[Price])
          VALUES ${valueParts.join(',')};
        `);
      }

      appendUploadLog({
        source: 'UPLOAD_PRODUCTS',
        vendorName,
        fileName,
        rowsInFile,
        rowsInserted,
        rowsSkippedDuplicates,
        rowsFailed: 0,
        status: 'COMPLETED',
      });

      return NextResponse.json({
        success: true,
        message: `Upload complete. ${rowsInserted} rows inserted for ${vendorName}.`,
        results: {
          rowsInFile,
          rowsInserted,
          rowsSkippedDuplicates,
          rowsFailed: 0,
          vendor: vendorName,
        },
      });

    } finally {
      await pool.close();
    }

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Upload products error:', error);
    appendUploadLog({
      source: 'UPLOAD_PRODUCTS',
      vendorName,
      fileName,
      error: message,
      status: 'FATAL_ERROR',
    });
    return NextResponse.json(
      { success: false, message: `Upload failed: ${message}` },
      { status: 500 },
    );
  }
}
