'use client';

import React, { useState, useEffect } from 'react';

interface SyncResult {
  success?: boolean;
  skipped?: boolean;
  error?: string;
  file?: string;
  sheetsProcessed?: number;
  totalInserted?: number;
  totalSkipped?: number;
  totalFailed?: number;
  sheetsWithErrors?: number;
  results?: Array<{
    vendorName: string;
    rowsInserted: number;
    rowsSkipped: number;
    rowsFailed: number;
    error?: string;
  }>;
}

interface SyncStatus {
  configured: boolean;
  state: Record<string, string>;
  recentLogs: Array<{ timestamp?: string; level?: string; message?: string; data?: any; raw?: string }>;
}

export default function SyncPage() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/sync');
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      console.error('Failed to fetch sync status:', err);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const triggerSync = async (force = false) => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch(`/api/sync${force ? '?force=1' : ''}`, { method: 'POST' });
      const data = await res.json();
      setSyncResult(data);
      await fetchStatus();
    } catch (err: any) {
      setSyncResult({ success: false, error: err.message });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-2">Google Drive Sync</h1>
        <p className="text-muted-foreground">Automatically sync vendor data from your Google Drive Excel file</p>
      </div>

      {/* Config status */}
      <div className={`rounded-lg border p-5 mb-6 ${status?.configured ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${status?.configured ? 'bg-green-500' : 'bg-amber-500'}`} />
          <div>
            <p className={`font-semibold ${status?.configured ? 'text-green-800' : 'text-amber-800'}`}>
              {status?.configured ? 'Google Drive integration is configured' : 'Google Drive integration is not configured yet'}
            </p>
            {!status?.configured && (
              <p className="text-sm text-amber-700 mt-1">
                Set <code className="bg-amber-100 px-1 rounded">GOOGLE_DRIVE_FOLDER_ID</code> and{' '}
                <code className="bg-amber-100 px-1 rounded">GOOGLE_SERVICE_ACCOUNT_KEY_PATH</code> in your{' '}
                <code className="bg-amber-100 px-1 rounded">.env.production</code> file. See setup guide below.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-4 mb-8">
        <button
          onClick={() => triggerSync(false)}
          disabled={syncing || !status?.configured}
          className="px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {syncing ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Syncing...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Sync Now
            </>
          )}
        </button>
        <button
          onClick={() => triggerSync(true)}
          disabled={syncing || !status?.configured}
          className="px-6 py-3 bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold rounded-lg transition-colors disabled:opacity-50"
        >
          Force Re-sync
        </button>
        <button
          onClick={fetchStatus}
          className="px-6 py-3 border border-border hover:bg-muted text-foreground font-semibold rounded-lg transition-colors"
        >
          Refresh Status
        </button>
      </div>

      {/* Sync result */}
      {syncResult && (
        <div className={`rounded-lg border p-6 mb-8 ${syncResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <h3 className={`font-bold text-lg mb-3 ${syncResult.success ? 'text-green-800' : 'text-red-800'}`}>
            {syncResult.success ? (syncResult.skipped ? '⏭ Sync Skipped' : '✅ Sync Completed') : '❌ Sync Failed'}
          </h3>

          {syncResult.error && <p className="text-red-700 mb-3">{syncResult.error}</p>}
          {syncResult.skipped && <p className="text-green-700 mb-3">File has not changed since last sync. Use "Force Re-sync" to process anyway.</p>}

          {syncResult.file && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div className="bg-white rounded-lg p-3 border border-green-200">
                <p className="text-xs text-gray-500">File</p>
                <p className="font-semibold text-sm truncate">{syncResult.file}</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-green-200">
                <p className="text-xs text-gray-500">Sheets Processed</p>
                <p className="font-bold text-2xl text-green-700">{syncResult.sheetsProcessed}</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-green-200">
                <p className="text-xs text-gray-500">Rows Inserted</p>
                <p className="font-bold text-2xl text-blue-700">{syncResult.totalInserted?.toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-green-200">
                <p className="text-xs text-gray-500">Rows Skipped (dupes)</p>
                <p className="font-bold text-2xl text-gray-600">{syncResult.totalSkipped?.toLocaleString()}</p>
              </div>
            </div>
          )}

          {syncResult.results && syncResult.results.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left px-3 py-2">Vendor</th>
                    <th className="text-right px-3 py-2">Inserted</th>
                    <th className="text-right px-3 py-2">Skipped</th>
                    <th className="text-right px-3 py-2">Failed</th>
                    <th className="text-left px-3 py-2">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {syncResult.results.map((r, i) => (
                    <tr key={i} className={`border-t ${r.error ? 'bg-red-50' : ''}`}>
                      <td className="px-3 py-2 font-medium">{r.vendorName}</td>
                      <td className="px-3 py-2 text-right text-blue-700">{r.rowsInserted.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-gray-500">{r.rowsSkipped.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-red-600">{r.rowsFailed.toLocaleString()}</td>
                      <td className="px-3 py-2 text-xs text-red-600">{r.error || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Setup guide */}
      <div className="bg-card border border-border rounded-lg p-6 mb-8">
        <h2 className="text-xl font-bold text-foreground mb-4">Setup Guide</h2>
        <ol className="space-y-4 text-sm text-foreground">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">1</span>
            <div>
              <p className="font-semibold">Create a Google Cloud Service Account</p>
              <p className="text-muted-foreground mt-1">Go to <a href="https://console.cloud.google.com" target="_blank" className="text-primary underline">console.cloud.google.com</a> → IAM & Admin → Service Accounts → Create. Enable the Google Drive API for your project.</p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">2</span>
            <div>
              <p className="font-semibold">Download the JSON key</p>
              <p className="text-muted-foreground mt-1">In the service account, go to Keys → Add Key → Create new key → JSON. Save the file to the server, e.g. <code className="bg-muted px-1 rounded">/var/www/vendorpro.beautystorellc.com/google-service-account.json</code></p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">3</span>
            <div>
              <p className="font-semibold">Share the Drive folder with the service account</p>
              <p className="text-muted-foreground mt-1">In Google Drive, right-click the folder containing your monthly Excel files → Share → paste the service account email (looks like <code className="bg-muted px-1 rounded">name@project.iam.gserviceaccount.com</code>) → Viewer access.</p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">4</span>
            <div>
              <p className="font-semibold">Get the folder ID</p>
              <p className="text-muted-foreground mt-1">Open the folder in Drive. The URL looks like <code className="bg-muted px-1 rounded">drive.google.com/drive/folders/FOLDER_ID_HERE</code>. Copy that ID.</p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">5</span>
            <div>
              <p className="font-semibold">Add to .env.production</p>
              <pre className="bg-muted p-3 rounded text-xs mt-2 overflow-x-auto">{`GOOGLE_SERVICE_ACCOUNT_KEY_PATH=/var/www/vendorpro.beautystorellc.com/google-service-account.json
GOOGLE_DRIVE_FOLDER_ID=your_folder_id_here
SYNC_SCHEDULE=0 2 * * *
SYNC_SHEET_SKIP=MASTER`}</pre>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">6</span>
            <div>
              <p className="font-semibold">Start the sync scheduler</p>
              <pre className="bg-muted p-3 rounded text-xs mt-2 overflow-x-auto">{`pm2 start services/syncScheduler.js --name gdrive-sync
pm2 save`}</pre>
              <p className="text-muted-foreground mt-1">This runs the sync automatically every day at 2 AM UTC. Change <code className="bg-muted px-1 rounded">SYNC_SCHEDULE</code> to adjust the frequency.</p>
            </div>
          </li>
        </ol>
      </div>

      {/* Recent logs */}
      {status?.recentLogs && status.recentLogs.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-xl font-bold text-foreground mb-4">Recent Sync Logs</h2>
          <div className="space-y-1 font-mono text-xs max-h-96 overflow-y-auto">
            {status.recentLogs.slice().reverse().map((log, i) => (
              <div key={i} className={`p-2 rounded ${
                log.level === 'ERROR' ? 'bg-red-50 text-red-800' :
                log.level === 'WARN'  ? 'bg-amber-50 text-amber-800' :
                'bg-gray-50 text-gray-700'
              }`}>
                <span className="text-gray-400">{log.timestamp?.slice(0, 19).replace('T', ' ')} </span>
                <span className={`font-bold mr-2 ${log.level === 'ERROR' ? 'text-red-600' : log.level === 'WARN' ? 'text-amber-600' : 'text-blue-600'}`}>
                  [{log.level || 'LOG'}]
                </span>
                {log.message || log.raw}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
