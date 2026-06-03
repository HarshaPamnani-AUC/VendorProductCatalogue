/**
 * Anomaly Statistics Component
 * Shows key metrics and trends
 */

'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, TrendingUp, DollarSign, AlertTriangle } from 'lucide-react';
import { Loader2 } from 'lucide-react';

interface StatsSummary {
  TotalAlerts: number;
  UnacknowledgedCount: number;
  CriticalCount: number;
  HighCount: number;
  MediumCount: number;
  LowCount: number;
  SpikeCount: number;
  DropCount: number;
  OutlierCount: number;
  TotalMonthlyImpact: number;
  UniqueVendors: number;
  UniqueProducts: number;
}

interface VendorStats {
  Vendor: string;
  AlertCount: number;
  UnacknowledgedCount: number;
  TotalImpact: number;
}

interface Stats {
  summary: StatsSummary;
  byVendor: VendorStats[];
  topProducts: any[];
}

export function AnomalyStatsWidget() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/ai/anomalies/stats', {
          headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
          throw new Error('Failed to load statistics');
        }

        const data = await response.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    loadStats();
    const interval = setInterval(loadStats, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg">
        ⚠️ Error: {error}
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const { summary, byVendor, topProducts } = stats;

  // Severity distribution
  const severityData = [
    { label: 'Critical', count: summary.CriticalCount, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'High', count: summary.HighCount, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Medium', count: summary.MediumCount, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { label: 'Low', count: summary.LowCount, color: 'text-blue-600', bg: 'bg-blue-50' }
  ];

  const totalAcknowledged = summary.TotalAlerts - summary.UnacknowledgedCount;
  const acknowledgeRate = summary.TotalAlerts > 0 
    ? Math.round((totalAcknowledged / summary.TotalAlerts) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Alerts */}
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm mb-1">Total Alerts</p>
              <p className="text-2xl font-bold">{summary.TotalAlerts}</p>
              <p className="text-xs text-green-600 mt-1">
                ✓ {totalAcknowledged} resolved ({acknowledgeRate}%)
              </p>
            </div>
            <AlertCircle className="w-8 h-8 text-blue-500 opacity-20" />
          </div>
        </div>

        {/* Unacknowledged */}
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm mb-1">Needs Action</p>
              <p className="text-2xl font-bold text-orange-600">{summary.UnacknowledgedCount}</p>
              <p className="text-xs text-gray-500 mt-1">
                Pending review
              </p>
            </div>
            <AlertTriangle className="w-8 h-8 text-orange-500 opacity-20" />
          </div>
        </div>

        {/* Monthly Impact */}
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm mb-1">Monthly Impact</p>
              <p className={`text-2xl font-bold ${summary.TotalMonthlyImpact > 0 ? 'text-red-600' : 'text-green-600'}`}>
                ${Math.abs(summary.TotalMonthlyImpact).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {summary.TotalMonthlyImpact > 0 ? 'Additional cost' : 'Potential savings'}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-green-500 opacity-20" />
          </div>
        </div>

        {/* Critical Alerts */}
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm mb-1">Critical</p>
              <p className="text-2xl font-bold text-red-600">{summary.CriticalCount}</p>
              <p className="text-xs text-gray-500 mt-1">
                Require immediate action
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-red-500 opacity-20" />
          </div>
        </div>
      </div>

      {/* Alert Type Distribution */}
      <div className="bg-white border rounded-lg p-4">
        <h3 className="font-semibold mb-4">Alert Types (Last 30 Days)</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <p className="text-2xl font-bold text-red-600">{summary.SpikeCount}</p>
            <p className="text-sm text-gray-600">Price Spikes</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-2xl font-bold text-green-600">{summary.DropCount}</p>
            <p className="text-sm text-gray-600">Price Drops</p>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <p className="text-2xl font-bold text-purple-600">{summary.OutlierCount}</p>
            <p className="text-sm text-gray-600">Outliers</p>
          </div>
        </div>
      </div>

      {/* Severity Distribution */}
      <div className="bg-white border rounded-lg p-4">
        <h3 className="font-semibold mb-4">Severity Distribution</h3>
        <div className="space-y-3">
          {severityData.map((item) => (
            <div key={item.label}>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium">{item.label}</span>
                <span className={`text-sm font-bold ${item.color}`}>{item.count}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${item.bg}`}
                  style={{
                    width: `${summary.TotalAlerts > 0 ? (item.count / summary.TotalAlerts) * 100 : 0}%`
                  }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Vendors */}
      {byVendor.length > 0 && (
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold mb-4">Top Vendors by Alerts</h3>
          <div className="space-y-2">
            {byVendor.slice(0, 5).map((vendor) => (
              <div key={vendor.Vendor} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">{vendor.Vendor}</p>
                  <p className="text-xs text-gray-500">
                    {vendor.AlertCount} alerts ({vendor.UnacknowledgedCount} pending)
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${vendor.TotalImpact > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    ${Math.abs(vendor.TotalImpact).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Coverage Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          📊 <span className="font-semibold">Monitoring</span> {summary.UniqueVendors} suppliers and {summary.UniqueProducts} products
        </p>
      </div>
    </div>
  );
}
