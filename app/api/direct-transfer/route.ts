import { NextRequest, NextResponse } from 'next/server';

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const vendor = body.vendor;
    
    console.log('Simple API - Vendor:', vendor);

    const pool = await sql.connect(sqlConfig);
    
    // Check upload data
    const uploadCheck = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Upload_Tbl_Products]');
    
    if (uploadCheck.recordset[0].Count === 0) {
      return NextResponse.json({ success: false, error: 'No data in upload table' });
    }

    // Get count before
    const beforeCount = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Tbl_Products]');

    // Execute procedure
    const result = await pool.request()
      .input('Vendor', sql.NVarChar, vendor)
      .execute('Proc_Upload_Tbl_Products');

    // Get count after
    const afterCount = await pool.request().query('SELECT COUNT(*) as Count FROM [dbo].[Tbl_Products]');
    const transferred = afterCount.recordset[0].Count - beforeCount.recordset[0].Count;
    
    await pool.close();
    
    return NextResponse.json({ 
      success: true, 
      transferredRecords: transferred,
      message: `Transferred ${transferred} records with vendor: ${vendor}`
    });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ success: false, error: error.message });
  }
}
