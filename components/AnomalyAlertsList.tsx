/**
 * Price Anomaly Alerts List Component
 * Displays all alerts with filtering, pagination, and search
 */

'use client';

import { useEffect, useState } from 'react';
import { AnomalyAlertCard, type Alert } from './AnomalyAlertCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

export function AnomalyAlertsList() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [severity, setSeverity] = useState<string>('');
  const [alertType, setAlertType] = useState<string>('');
  const [vendor, setVendor] = useState<string>('');
  const [acknowledged, setAcknowledged] = useState<string>('false');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Load alerts
  const loadAlerts = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (severity) params.append('severity', severity);
      if (alertType) params.append('alertType', alertType);
      if (vendor) params.append('vendor', vendor);
      params.append('acknowledged', acknowledged);

      const response = await fetch(`/api/ai/anomalies?${params}`, {
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Failed to load alerts');
      }

      const data = await response.json();
      setAlerts(data.alerts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1); // Reset to first page on filter change
    const timer = setTimeout(loadAlerts, 300); // Debounce
    return () => clearTimeout(timer);
  }, [severity, alertType, vendor, acknowledged]);

  // Paginate alerts
  const totalPages = Math.ceil(alerts.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const paginatedAlerts = alerts.slice(startIdx, startIdx + itemsPerPage);

  // Handle acknowledge
  const handleAcknowledge = async (alertId: number) => {
    try {
      const response = await fetch(`/api/ai/anomalies/${alertId}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Failed to acknowledge alert');
      }

      // Reload alerts
      await loadAlerts();
    } catch (err) {
      console.error('Error acknowledging alert:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border">
        <h3 className="font-semibold mb-4">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Status */}
          <div>
            <label className="text-sm font-medium mb-1 block">Status</label>
            <Select value={acknowledged} onValueChange={setAcknowledged}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="false">Unacknowledged</SelectItem>
                <SelectItem value="true">Acknowledged</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Severity */}
          <div>
            <label className="text-sm font-medium mb-1 block">Severity</label>
            <Select value={severity || 'all'} onValueChange={(val) => setSeverity(val === 'all' ? '' : val)}>
              <SelectTrigger>
                <SelectValue placeholder="All Severities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="CRITICAL">Critical</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Alert Type */}
          <div>
            <label className="text-sm font-medium mb-1 block">Type</label>
            <Select value={alertType || 'all'} onValueChange={(val) => setAlertType(val === 'all' ? '' : val)}>
              <SelectTrigger>
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="PRICE_SPIKE">Price Spike</SelectItem>
                <SelectItem value="PRICE_DROP">Price Drop</SelectItem>
                <SelectItem value="OUTLIER">Outlier</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Vendor Search */}
          <div>
            <label className="text-sm font-medium mb-1 block">Vendor</label>
            <Input
              placeholder="Search vendor..."
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
            />
          </div>

          {/* Clear Filters */}
          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => {
                setSeverity('');
                setAlertType('');
                setVendor('');
                setAcknowledged('false');
              }}
              className="w-full"
            >
              Clear Filters
            </Button>
          </div>
        </div>
      </div>

      {/* Results Summary */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">
          Showing <span className="font-semibold">{paginatedAlerts.length}</span> of{' '}
          <span className="font-semibold">{alerts.length}</span> alerts
        </p>
        <Button
          onClick={loadAlerts}
          variant="outline"
          size="sm"
          disabled={loading}
        >
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Refresh
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg">
          ⚠️ Error: {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
          <p className="mt-2 text-gray-600">Loading alerts...</p>
        </div>
      )}

      {/* Alerts List */}
      {!loading && alerts.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border">
          <p className="text-gray-600 mb-2">No alerts found</p>
          <p className="text-sm text-gray-500">
            {acknowledged === 'false'
              ? 'All anomalies have been acknowledged!'
              : 'Start uploading products to detect price anomalies'}
          </p>
        </div>
      ) : (
        <>
          <div>
            {paginatedAlerts.map((alert) => (
              <AnomalyAlertCard
                key={alert.AlertId}
                alert={alert}
                onAcknowledge={handleAcknowledge}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-6">
              <Button
                variant="outline"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                ← Previous
              </Button>

              <div className="text-sm text-gray-600">
                Page <span className="font-semibold">{currentPage}</span> of{' '}
                <span className="font-semibold">{totalPages}</span>
              </div>

              <Button
                variant="outline"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Next →
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
