import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const authHeader = req.headers.get('Authorization');
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

    console.log('API Upload Request:', {
      vendorId: body.vendorId,
      fileName: body.fileName,
      fileContentLength: body.fileContent?.length,
      authHeader: authHeader ? 'Present' : 'Missing'
    });

    const response = await fetch(`${apiUrl}/uploads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader || '',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    console.log('API Upload Response:', {
      status: response.status,
      statusText: response.statusText,
      data: data
    });

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('API Upload Error:', error);
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }
}
