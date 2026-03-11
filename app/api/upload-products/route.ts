import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('=== UPLOAD PRODUCTS API - PROXYING TO BACKEND ===');
    
    // Parse FormData from frontend
    const formData = await request.formData();
    const vendorName = formData.get('vendorName') as string;
    const file = formData.get('file') as File;
    
    console.log('Vendor:', vendorName);
    console.log('File:', file?.name, file?.type, file?.size);
    
    if (!vendorName || !file) {
      console.log('❌ Missing vendor or file');
      return NextResponse.json({
        success: false,
        message: 'File format not good'
      }, { status: 400 });
    }
    
    // Forward to Express backend
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    
    // Create new FormData for backend
    const backendFormData = new FormData();
    backendFormData.append('vendorName', vendorName);
    backendFormData.append('file', file);
    
    const response = await fetch(`${apiUrl}/api/upload-products`, {
      method: 'POST',
      body: backendFormData,
    });

    const data = await response.json();
    console.log('Backend response:', data);

    return NextResponse.json(data, { status: response.status });
    
  } catch (error) {
    console.error('❌ Upload proxy error:', error);
    return NextResponse.json({
      success: false,
      message: 'File format not good'
    }, { status: 500 });
  }
}
