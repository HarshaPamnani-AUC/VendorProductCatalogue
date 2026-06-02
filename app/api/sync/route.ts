/**
 * POST /api/sync          – trigger a sync now
 * GET  /api/sync          – get last sync status / logs
 * POST /api/sync?force=1  – force re-sync even if file hasn't changed
 */

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

const logsDir = path.join(process.cwd(), 'logs');
const syncStatePath = path.join(logsDir, 'gdrive-sync-state.json');
const syncLogPath  = path.join(logsDir, 'gdrive-sync.log');

export async function GET() {
  try {
    // Return last sync state + last 50 log lines
    let state = {};
    try { state = JSON.parse(fs.readFileSync(syncStatePath, 'utf8')); } catch { /* no state yet */ }

    let recentLogs: any[] = [];
    try {
      const lines = fs.readFileSync(syncLogPath, 'utf8').trim().split('\n').slice(-50);
      recentLogs = lines.map(l => { try { return JSON.parse(l); } catch { return { raw: l }; } });
    } catch { /* no log yet */ }

    const configured = !!(
      process.env.GOOGLE_DRIVE_FOLDER_ID &&
      (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON)
    );

    return NextResponse.json({ configured, state, recentLogs });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const force = request.nextUrl.searchParams.get('force') === '1';

  try {
    // Dynamically require the sync service (it's a CommonJS module)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { runSync } = require('../../../services/googleDriveSync');
    const result = await runSync({ force });
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Sync API error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
