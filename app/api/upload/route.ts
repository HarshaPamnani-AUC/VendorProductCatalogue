import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Handle file upload
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/octet-stream'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Only Excel files are allowed.' }, { status: 400 });
    }

    // Read file content
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Parse Excel file using xlsx library
    const XLSX = require('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    // Get the first worksheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (jsonData.length < 2) {
      return NextResponse.json({ error: 'File must contain at least a header row and one data row' }, { status: 400 });
    }

    // Parse headers and data
    const headers = jsonData[0] as string[];
    const dataRows = jsonData.slice(1) as string[][];

    // Database configuration
    const sql = require('mssql');
    const sqlConfig = {
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      server: process.env.DB_SERVER,
      database: process.env.DB_NAME,
      options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
        enableArithAbort: true
      }
    };

    // Connect to database
    const pool = await sql.connect(sqlConfig);
    
    try {
      // Clear existing upload data
      await pool.request().query('DELETE FROM [dbo].[Upload_Tbl_Products]');
      
      // Insert new data
      let insertedCount = 0;
      
      for (const row of dataRows) {
        if (!row || row.length === 0) continue;
        
        // Ensure we have at least 6 columns (Date, EAN/UPC, Name, Item_Code, Qty, Price)
        if (row.length >= 5) {
          await pool.request()
            .input('Date', sql.NVarChar, row[0] || '')
            .input('EAN_UPC', sql.NVarChar, row[1] || '')
            .input('Name', sql.NVarChar, row[2] || '')
            .input('Item_Code', sql.NVarChar, row[3] || '')
            .input('Qty', sql.NVarChar, row[4] || '')
            .input('Price', sql.NVarChar, row[5] || '')
            .query(`
              INSERT INTO [dbo].[Upload_Tbl_Products] 
              ([Date], [EAN/UPC], [Name], [Item_Code], [Qty], [Price])
              VALUES (@Date, @EAN_UPC, @Name, @Item_Code, @Qty, @Price)
            `);
          
          insertedCount++;
        }
      }

      return NextResponse.json({ 
        message: 'File uploaded successfully',
        recordsProcessed: insertedCount,
        headers: headers,
        sampleData: dataRows.slice(0, 3)
      }, { status: 200 });

    } finally {
      await pool.close();
    }

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ 
      error: 'Failed to process upload',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Database configuration
    const sql = require('mssql');
    const sqlConfig = {
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      server: process.env.DB_SERVER,
      database: process.env.DB_NAME,
      options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
        enableArithAbort: true
      }
    };

    // Connect to database
    const pool = await sql.connect(sqlConfig);
    
    const result = await pool.request().query(`
      SELECT TOP 10 [Date], [EAN/UPC], [Name], [Item_Code], [Qty], [Price]
      FROM [dbo].[Upload_Tbl_Products]
      ORDER BY [Date] DESC
    `);

    await pool.close();

    return NextResponse.json({
      message: 'Current upload data retrieved',
      data: result.recordset,
      count: result.recordset.length
    });

  } catch (error) {
    console.error('Get upload data error:', error);
    return NextResponse.json({ 
      error: 'Failed to retrieve upload data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
