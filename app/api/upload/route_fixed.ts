import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { verifyToken } from '../../../../lib/auth';

// Configure database connection
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

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
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

    // Parse Excel file (simple CSV parsing for now)
    const content = buffer.toString('utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      return NextResponse.json({ error: 'File must contain at least a header row and one data row' }, { status: 400 });
    }

    // Parse headers and data
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const dataRows = lines.slice(1);

    // Connect to database
    const pool = await sql.connect(sqlConfig);
    
    try {
      // Clear existing upload data
      await pool.request().query('DELETE FROM [dbo].[Upload_Tbl_Products]');
      
      // Insert new data
      let insertedCount = 0;
      
      for (const row of dataRows) {
        if (!row.trim()) continue;
        
        const values = row.split(',').map(v => v.trim().replace(/"/g, ''));
        
        if (values.length >= 5) { // Ensure we have at least the required columns
          await pool.request()
            .input('Date', sql.NVarChar, values[0] || '')
            .input('EAN_UPC', sql.NVarChar, values[1] || '')
            .input('Name', sql.NVarChar, values[2] || '')
            .input('Item_Code', sql.NVarChar, values[3] || '')
            .input('Qty', sql.NVarChar, values[4] || '')
            .input('Price', sql.NVarChar, values[5] || '')
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
        sampleData: dataRows.slice(0, 3) // Return first 3 rows as sample
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
    // Get current upload data
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
