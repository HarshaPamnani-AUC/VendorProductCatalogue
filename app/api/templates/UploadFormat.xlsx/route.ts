import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

export async function GET(req: NextRequest) {
  try {
    const templatePath = path.join(process.cwd(), 'public', 'templates', 'UploadFormat.xlsx');
    
    console.log('Template download request:', templatePath);
    
    // Read the Excel file
    const fileBuffer = await readFile(templatePath);
    
    console.log('File read successfully, size:', fileBuffer.length, 'bytes');
    
    // Return the file with proper headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="UploadFormat.xlsx"',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error('Template download error:', error);
    return NextResponse.json(
      { error: 'Template file not found' },
      { status: 404 }
    );
  }
}
