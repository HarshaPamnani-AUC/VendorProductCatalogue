/**
 * Anomaly Detection Scheduler
 * Runs price anomaly detection on a schedule
 * 
 * Schedule: Every 6 hours (02:00, 08:00, 14:00, 20:00 UTC)
 * Also runs 5 minutes after server startup
 */

require('dotenv').config({ path: '.env.production' });
const { spawn } = require('child_process');
const path = require('path');

const SCRIPT_PATH = path.join(__dirname, 'detect-price-anomalies.js');
const SCHEDULE_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours in milliseconds
const STARTUP_DELAY = 5 * 60 * 1000; // 5 minutes

let isRunning = false;

function runDetection() {
  if (isRunning) {
    console.log('⏳ Detection already running, skipping this cycle');
    return;
  }

  isRunning = true;
  const timestamp = new Date().toISOString();
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`🔄 Starting anomaly detection [${timestamp}]`);
  console.log(`${'═'.repeat(50)}`);

  const child = spawn('node', [SCRIPT_PATH], {
    cwd: __dirname + '/..',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120000 // 2 minute timeout
  });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (data) => {
    stdout += data.toString();
    process.stdout.write(data);
  });

  child.stderr.on('data', (data) => {
    stderr += data.toString();
    process.stderr.write(data);
  });

  child.on('close', (code) => {
    isRunning = false;
    const endTime = new Date().toISOString();
    
    if (code === 0) {
      console.log(`✅ Detection completed successfully [${endTime}]`);
    } else {
      console.error(`❌ Detection failed with exit code ${code} [${endTime}]`);
    }
    
    console.log(`${'═'.repeat(50)}\n`);
  });

  child.on('error', (err) => {
    isRunning = false;
    console.error('❌ Failed to start detection script:', err.message);
  });
}

console.log('📊 Anomaly Detection Scheduler Started');
console.log(`⏰ Schedule: Every ${SCHEDULE_INTERVAL / 3600000} hours`);
console.log(`🔄 First run: In ${STARTUP_DELAY / 60000} minutes\n`);

// Run once on startup after delay
setTimeout(() => {
  console.log('🚀 Initial run after startup delay');
  runDetection();
}, STARTUP_DELAY);

// Schedule recurring runs
setInterval(() => {
  runDetection();
}, SCHEDULE_INTERVAL);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n📍 SIGTERM received, shutting down scheduler...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n📍 SIGINT received, shutting down scheduler...');
  process.exit(0);
});

// Log periodic status
setInterval(() => {
  console.log(`⏰ [${new Date().toISOString()}] Scheduler running, waiting for next cycle (${isRunning ? 'RUNNING' : 'idle'})`);
}, 30 * 60 * 1000); // Every 30 minutes
