/**
 * Anomaly Detection Control Panel
 * Shows detection status and allows manual triggering
 */

'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Play, BarChart3 } from 'lucide-react';

interface DetectionStats {
  totalAlerts: number;
  critical: number;
  high: number;
  medium: number;
  priceSpikes: number;
  priceDrops: number;
  totalMonthlyImpact: number;
  lastDetectionTime: string | null;
}

export function AnomalyDetectionPanel() {
  const [stats, setStats] = useState<DetectionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<string | null>(null);

  // Load stats on mount
  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const loadStats = async () => {
    try {
      const response = await fetch('/api/ai/anomalies/detect/status');
      if (!response.ok) throw new Error('Failed to load stats');
      
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
        setError(null);
      }
    } catch (err) {
      console.error('Error loading stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  const handleDetect = async () => {
    setDetecting(true);
    setError(null);
    
    try {
      const response = await fetch('/api/ai/anomalies/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) throw new Error('Detection failed');
      
      const data = await response.json();
      setLastRun(`Detected ${data.detectedCount} anomalies at ${new Date().toLocaleTimeString()}`);
      
      // Reload stats after a brief delay
      setTimeout(loadStats, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Detection failed');
    } finally {
      setDetecting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border p-6">
        <div className="text-center py-4">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" />
        </div>
      </div>
    );
  }

  const lastDetectionDate = stats?.lastDetectionTime 
    ? new Date(stats.lastDetectionTime).toLocaleString()
    : 'Never';

  const getSeverityBadge = (count: number, color: string) => (
    <div className={`text-center p-2 rounded ${color}`}>
      <p className="text-2xl font-bold">{count}</p>
    </div>
  );

  return (
    <div className="bg-white rounded-lg border">
      {/* Header */}
      <div className="px-6 py-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold">🔬 Real-Time Anomaly Detection</h2>
        </div>
        <Button
          onClick={handleDetect}
          disabled={detecting}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {detecting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {detecting ? 'Detecting...' : 'Run Detection Now'}
        </Button>
      </div>

      {/* Content */}
      <div className="px-6 py-4 space-y-4">
        {/* Last Run Status */}
        <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
          <p className="font-semibold mb-1">Last Detection Run</p>
          <p className="text-blue-700">{lastDetectionDate}</p>
          {lastRun && <p className="text-green-700 mt-1">✅ {lastRun}</p>}
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
            <p className="font-semibold mb-1">⚠️ Error</p>
            <p>{error}</p>
          </div>
        )}

        {/* Stats Grid */}
        {stats && (
          <div className="space-y-4">
            {/* Summary Row */}
            <div className="grid grid-cols-4 gap-3">
              {getSeverityBadge(stats.totalAlerts, 'bg-gray-100')}
              {getSeverityBadge(stats.critical, 'bg-red-100 text-red-600')}
              {getSeverityBadge(stats.high, 'bg-orange-100 text-orange-600')}
              {getSeverityBadge(stats.medium, 'bg-yellow-100 text-yellow-600')}
            </div>

            {/* Labels */}
            <div className="grid grid-cols-4 gap-3 text-xs text-center text-gray-600 font-medium">
              <div>Total</div>
              <div>Critical</div>
              <div>High</div>
              <div>Medium</div>
            </div>

            {/* Type Breakdown */}
            <div className="grid grid-cols-3 gap-3 pt-2 border-t">
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{stats.priceSpikes}</p>
                <p className="text-xs text-gray-600">Price Spikes</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{stats.priceDrops}</p>
                <p className="text-xs text-gray-600">Price Drops</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">${stats.totalMonthlyImpact.toLocaleString()}</p>
                <p className="text-xs text-gray-600">Monthly Impact</p>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-gray-50 rounded p-3 text-xs text-gray-700 space-y-1">
              <p>
                <span className="font-semibold">Schedule:</span> Runs automatically every 6 hours
              </p>
              <p>
                <span className="font-semibold">Detection Method:</span> Z-score statistical analysis
              </p>
              <p>
                <span className="font-semibold">Data Source:</span> Real prices from Tbl_Products_Storage
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-3 bg-gray-50 border-t text-xs text-gray-600">
        💡 <span className="font-semibold">Tip:</span> Manual detection runs the same analysis as scheduled runs. 
        Check logs at <code className="bg-gray-200 px-2 py-1 rounded text-gray-700">logs/anomaly-detection-out.log</code>
      </div>
    </div>
  );
}
