import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

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

/** Backend Express API base URL (must include /api suffix). */
function getBackendApiBase(): string {
  const raw =
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://172.30.36.124:5000/api';
  const trimmed = raw.replace(/\/+$/, '');
  if (trimmed.endsWith('/api/api')) {
    return trimmed.slice(0, -4);
  }
  return trimmed;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const vendorName = formData.get('vendorName') as string;
    const file = formData.get('file') as File;

    appendUploadLog({
      source: 'NEXTJS_API_PROXY',
      vendorName,
      fileName: file?.name,
      fileSize: file?.size,
      status: 'PROXY_REQUEST_RECEIVED',
    });

    if (!vendorName || !file) {
      return NextResponse.json(
        { success: false, message: 'Vendor name and file are required' },
        { status: 400 },
      );
    }

    const apiBase = getBackendApiBase();
    const backendUrl = `${apiBase}/upload-products`;

    appendUploadLog({
      source: 'NEXTJS_API_PROXY',
      action: 'Forwarding to backend',
      backendUrl,
      status: 'PROXY_FORWARDING',
    });

    // Normalize Excel serial dates (e.g. 46168) before the backend inserts into SQL date columns
    const XLSX = require('xlsx');
    const { normalizeWorkbookDates } = require('../../../utils/formatUploadDate');
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    let workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    workbook = normalizeWorkbookDates(workbook, XLSX);
    const normalizedBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const backendFormData = new FormData();
    backendFormData.append('vendorName', vendorName);
    backendFormData.append(
      'file',
      new Blob([normalizedBuffer], {
        type: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      file.name,
    );

    let response: Response;
    try {
      response = await fetch(backendUrl, {
        method: 'POST',
        body: backendFormData,
      });
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : 'Backend unreachable';
      appendUploadLog({
        source: 'NEXTJS_API_PROXY',
        error: 'Proxy fetch failed',
        errorMessage: message,
        backendUrl,
        status: 'PROXY_ERROR',
      });
      return NextResponse.json(
        {
          success: false,
          message: `Upload server is not reachable (${backendUrl}). Ensure the API server is running.`,
        },
        { status: 503 },
      );
    }

    const contentType = response.headers.get('content-type') || '';
    let data: Record<string, unknown>;
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      appendUploadLog({
        source: 'NEXTJS_API_PROXY',
        backendStatus: response.status,
        error: 'Non-JSON backend response',
        preview: text.slice(0, 200),
        status: 'PROXY_BAD_RESPONSE',
      });
      return NextResponse.json(
        {
          success: false,
          message: `Upload server returned an unexpected response (HTTP ${response.status}). Check API_URL points to the Express backend.`,
        },
        { status: 502 },
      );
    }

    appendUploadLog({
      source: 'NEXTJS_API_PROXY',
      backendStatus: response.status,
      backendResponse: data,
      status: 'PROXY_RESPONSE_RECEIVED',
    });

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Upload proxy error:', error);
    appendUploadLog({
      source: 'NEXTJS_API_PROXY',
      error: 'Proxy error',
      errorMessage: message,
      status: 'PROXY_ERROR',
    });
    return NextResponse.json(
      { success: false, message: `Upload failed: ${message}` },
      { status: 500 },
    );
  }
}
