/**
 * Dedicated Anomaly Alerts Page
 * Full-page view of all price anomalies with advanced filtering
 */

'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AnomalyAlertsList } from '@/components/AnomalyAlertsList';
import { AnomalyStatsWidget } from '@/components/AnomalyStatsWidget';
import { AlertCircle, BarChart3 } from 'lucide-react';

export default function AnomaliesPage() {
  const [activeTab, setActiveTab] = useState('alerts');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold">Price Anomalies</h1>
          </div>
          <p className="text-gray-600">
            Monitor and manage unusual price changes from your suppliers
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="alerts" className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Alerts
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          {/* Alerts Tab */}
          <TabsContent value="alerts" className="mt-6">
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800">
                  <p className="font-semibold mb-1">What are Price Anomalies?</p>
                  <p>
                    These are unusual price changes detected using statistical analysis (Z-score). 
                    Price spikes may indicate supplier gouging, data entry errors, or market changes. 
                    Price drops represent buying opportunities.
                  </p>
                </div>
              </div>

              <AnomalyAlertsList />
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="mt-6">
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
                <BarChart3 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-green-800">
                  <p className="font-semibold mb-1">Analytics Dashboard</p>
                  <p>
                    View key metrics, trends, and supplier performance. Monitor the financial impact 
                    of price anomalies and track supplier reliability.
                  </p>
                </div>
              </div>

              <AnomalyStatsWidget />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Footer Info */}
      <div className="bg-white border-t mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-sm text-gray-600">
          <p>
            💡 <span className="font-semibold">Tip:</span> Acknowledge alerts to mark them as reviewed. 
            This helps track which anomalies have been investigated.
          </p>
        </div>
      </div>
    </div>
  );
}
