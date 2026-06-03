/**
 * Dashboard Widget - Quick Anomaly Alert Summary
 * Small widget to display on the main dashboard
 */

'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, TrendingUp, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

interface Alert {
  AlertId: number;
  AlertType: string;
  Severity: string;
  ProductCode: string;
  ProductName: string;
  Vendor: string;
  NewPrice: number;
  OldPrice: number;
  PriceChange: number;
  CreatedAt: string;
  IsAcknowledged: boolean;
}

interface AlertsResponse {
  total: number;
  alerts: Alert[];
}

export function AnomalyAlertsWidget() {
  const [data, setData] = useState<AlertsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAlerts = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/ai/anomalies?acknowledged=false', {
          headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) throw new Error('Failed to load alerts');

        const result = await response.json();
        setData(result);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    loadAlerts();
    const interval = setInterval(loadAlerts, 60000); // Refresh every 60 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border p-6">
        <div className="text-center py-8">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border p-6">
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded text-sm">
          ⚠️ Error loading alerts
        </div>
      </div>
    );
  }

  const alerts = data?.alerts || [];
  const unacknowledgedCount = alerts.filter(a => !a.IsAcknowledged).length;

  // Get severity colors
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'text-red-600 bg-red-50';
      case 'HIGH':
        return 'text-orange-600 bg-orange-50';
      case 'MEDIUM':
        return 'text-yellow-600 bg-yellow-50';
      default:
        return 'text-blue-600 bg-blue-50';
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-500 text-white';
      case 'HIGH':
        return 'bg-orange-500 text-white';
      case 'MEDIUM':
        return 'bg-yellow-500 text-white';
      default:
        return 'bg-blue-500 text-white';
    }
  };

  return (
    <div className="bg-white rounded-lg border">
      {/* Header */}
      <div className="px-6 py-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold">🚨 Price Anomalies</h2>
        </div>
        {unacknowledgedCount > 0 && (
          <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold bg-red-500 text-white">
            {unacknowledgedCount} Alert{unacknowledgedCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="px-6 py-4">
        {alerts.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-600 text-sm mb-2">✅ No price anomalies detected</p>
            <p className="text-gray-500 text-xs">All monitored prices are within normal ranges</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="text-center p-2 bg-gray-50 rounded">
                <p className="text-xl font-bold text-blue-600">{alerts.length}</p>
                <p className="text-xs text-gray-600">Total</p>
              </div>
              <div className="text-center p-2 bg-red-50 rounded">
                <p className="text-xl font-bold text-red-600">
                  {alerts.filter(a => a.Severity === 'CRITICAL').length}
                </p>
                <p className="text-xs text-gray-600">Critical</p>
              </div>
              <div className="text-center p-2 bg-orange-50 rounded">
                <p className="text-xl font-bold text-orange-600">
                  {alerts.filter(a => a.Severity === 'HIGH').length}
                </p>
                <p className="text-xs text-gray-600">High</p>
              </div>
            </div>

            {/* Recent Alerts */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-700 uppercase">Recent Alerts</p>
              {alerts.slice(0, 4).map((alert) => (
                <div
                  key={alert.AlertId}
                  className={`p-3 rounded-lg border-l-4 ${getSeverityColor(alert.Severity)}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {alert.ProductName || alert.ProductCode}
                      </p>
                      <p className="text-xs opacity-75">
                        {alert.Vendor} • ${alert.OldPrice?.toFixed(2)} → ${alert.NewPrice?.toFixed(2)}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${getSeverityBadge(alert.Severity)}`}>
                      {alert.Severity}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            {alerts.length > 4 && (
              <p className="text-xs text-gray-500 pt-2">
                ...and {alerts.length - 4} more
              </p>
            )}
          </div>
        )}
      </div>

      {/* Action Button */}
      <div className="px-6 py-4 border-t bg-gray-50">
        <Link href="/dashboard/anomalies">
          <Button className="w-full" variant="outline">
            View All Alerts
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
