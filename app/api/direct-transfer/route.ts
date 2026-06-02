import { NextRequest, NextResponse } from 'next/server';
import { dbConfig as rawConfig } from '@/lib/dbConfig';

const sql = require('mssql');

const sqlConfig = {
  user: rawConfig.user,
  password: rawConfig.password,
  server: rawConfig.server,
  database: rawConfig.database,
  options: {
    encrypt: true,
    trustServerCertificate: true,
    connectTimeout: 15000,
    requestTimeout: 30000,
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
