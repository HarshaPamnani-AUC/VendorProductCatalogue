// Sync scheduler — DISABLED as of June 1 2026.
// Data is now uploaded manually via the Upload Products page.
// To re-enable: uncomment the cron.schedule block below and run:
//   pm2 start services/syncScheduler.js --name gdrive-sync && pm2 save

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.production') });

const cron = require('node-cron');
const { runSync } = require('./googleDriveSync');

const SCHEDULE = process.env.SYNC_SCHEDULE || '0 2 * * *';

console.log(`[SyncScheduler] DISABLED — schedule was: "${SCHEDULE}"`);
console.log('[SyncScheduler] Uncomment the cron.schedule block to re-enable.');

// ── DISABLED ──────────────────────────────────────────────────────────────────
// Uncomment everything below to re-enable automatic syncing.
//
// (async () => {
//   console.log('[SyncScheduler] Running initial sync on startup...');
//   try {
//     const result = await runSync();
//     console.log('[SyncScheduler] Initial sync result:', JSON.stringify(result, null, 2));
//   } catch (err) {
//     console.error('[SyncScheduler] Initial sync error:', err.message);
//   }
// })();
//
// cron.schedule(SCHEDULE, async () => {
//   console.log(`[SyncScheduler] Cron triggered at ${new Date().toISOString()}`);
//   try {
//     const result = await runSync();
//     console.log('[SyncScheduler] Sync result:', JSON.stringify(result, null, 2));
//   } catch (err) {
//     console.error('[SyncScheduler] Sync error:', err.message);
//   }
// }, { timezone: 'UTC' });
// ── END DISABLED ──────────────────────────────────────────────────────────────
