import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('=== UPLOAD PRODUCTS API - PROXYING TO BACKEND ===');
    console.log('Request URL:', request.url);
    console.log('Request method:', request.method);
    console.log('Request headers:', Object.fromEntries(request.headers.entries()));
    
    // Parse FormData from frontend
    const formData = await request.formData();
    const vendorName = formData.get('vendorName') as string;
    const file = formData.get('file') as File;
    
    console.log('Vendor:', vendorName);
    console.log('File:', file?.name, file?.type, file?.size);
    
    // Log to uploads.log file
    const fs = require('fs');
    const logEntry = {
      timestamp: new Date().toISOString(),
      source: 'NEXTJS_API_PROXY',
      vendorName: vendorName,
      fileName: file?.name,
      fileSize: file?.size,
      mimeType: file?.type,
      status: 'PROXY_REQUEST_RECEIVED'
    };
    fs.appendFileSync('logs/uploads.log', JSON.stringify(logEntry) + '\n');
    
    if (!vendorName || !file) {
      console.log('❌ Missing vendor or file');
      const errorEntry = {
        timestamp: new Date().toISOString(),
        source: 'NEXTJS_API_PROXY',
        error: 'Missing vendor or file',
        vendorName: vendorName,
        hasFile: !!file,
        status: 'PROXY_VALIDATION_FAILED'
      };
      fs.appendFileSync('logs/uploads.log', JSON.stringify(errorEntry) + '\n');
      
      return NextResponse.json({
        success: false,
        message: 'File format not good'
      }, { status: 400 });
    }
    
    // Forward to Express backend
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
    console.log('Forwarding to:', `${apiUrl}/upload-products`);
    
    // Create new FormData for backend
    const backendFormData = new FormData();
    backendFormData.append('vendorName', vendorName);
    backendFormData.append('file', file);
    
    const proxyEntry = {
      timestamp: new Date().toISOString(),
      source: 'NEXTJS_API_PROXY',
      action: 'Forwarding to backend',
      backendUrl: `${apiUrl}/upload-products`,
      status: 'PROXY_FORWARDING'
    };
    fs.appendFileSync('logs/uploads.log', JSON.stringify(proxyEntry) + '\n');
    
    const response = await fetch(`${apiUrl}/upload-products`, {
      method: 'POST',
      body: backendFormData,
    });

    const data = await response.json();
    console.log('Backend response status:', response.status);
    console.log('Backend response data:', data);

    const responseEntry = {
      timestamp: new Date().toISOString(),
      source: 'NEXTJS_API_PROXY',
      backendStatus: response.status,
      backendResponse: data,
      status: 'PROXY_RESPONSE_RECEIVED'
    };
    fs.appendFileSync('logs/uploads.log', JSON.stringify(responseEntry) + '\n');

    return NextResponse.json(data, { status: response.status });
    
  } catch (error) {
    console.error('❌ Upload proxy error:', error);
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace available');
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    const errorEntry = {
      timestamp: new Date().toISOString(),
      source: 'NEXTJS_API_PROXY',
      error: 'Proxy error',
      errorMessage: errorMessage,
      stack: errorStack,
      status: 'PROXY_ERROR'
    };
    const fs = require('fs');
    fs.appendFileSync('logs/uploads.log', JSON.stringify(errorEntry) + '\n');
    
    return NextResponse.json({
      success: false,
      message: 'File format not good'
    }, { status: 500 });
  }
}
