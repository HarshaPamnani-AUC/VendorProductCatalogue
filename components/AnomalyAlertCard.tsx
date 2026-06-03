/**
 * Price Anomaly Alert Card Component
 * Displays a single anomaly alert with severity, impact, and action
 */

'use client';

import { AlertCircle, TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export interface Alert {
  AlertId: number;
  AlertType: string;
  Severity: string;
  ProductCode: string;
  ProductName: string;
  Vendor: string;
  OldPrice: number;
  NewPrice: number;
  PriceChange: number;
  ZScore: number;
  Confidence: number;
  MonthlyVolume: number;
  MonthlyImpact: number;
  Description: string;
  RecommendedAction: string;
  IsAcknowledged: boolean;
  CreatedAt: string;
}

interface AnomalyAlertCardProps {
  alert: Alert;
  onAcknowledge?: (alertId: number) => void;
}

export function AnomalyAlertCard({ alert, onAcknowledge }: AnomalyAlertCardProps) {
  const [isAcknowledging, setIsAcknowledging] = useState(false);

  // Severity styling
  const severityColors = {
    CRITICAL: 'bg-red-100 border-red-300 text-red-800',
    HIGH: 'bg-orange-100 border-orange-300 text-orange-800',
    MEDIUM: 'bg-yellow-100 border-yellow-300 text-yellow-800',
    LOW: 'bg-blue-100 border-blue-300 text-blue-800'
  };

  const severityBadgeColors = {
    CRITICAL: 'bg-red-500 text-white',
    HIGH: 'bg-orange-500 text-white',
    MEDIUM: 'bg-yellow-500 text-white',
    LOW: 'bg-blue-500 text-white'
  };

  // Alert type icons and colors
  const getAlertIcon = () => {
    switch (alert.AlertType) {
      case 'PRICE_SPIKE':
        return <TrendingUp className="w-5 h-5 text-red-600" />;
      case 'PRICE_DROP':
        return <TrendingDown className="w-5 h-5 text-green-600" />;
      case 'OUTLIER':
        return <AlertTriangle className="w-5 h-5 text-purple-600" />;
      default:
        return <AlertCircle className="w-5 h-5 text-blue-600" />;
    }
  };

  const handleAcknowledge = async () => {
    if (!onAcknowledge) return;
    
    setIsAcknowledging(true);
    try {
      await onAcknowledge(alert.AlertId);
    } finally {
      setIsAcknowledging(false);
    }
  };

  const priceChangeColor = alert.PriceChange > 0 ? 'text-red-600' : 'text-green-600';

  return (
    <div className={`border-l-4 rounded-lg p-4 mb-4 ${severityColors[alert.Severity as keyof typeof severityColors]}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Header */}
          <div className="flex items-center gap-3 mb-2">
            {getAlertIcon()}
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${severityBadgeColors[alert.Severity as keyof typeof severityBadgeColors]}`}>
              {alert.Severity}
            </span>
            <span className="text-xs font-medium opacity-75">
              {new Date(alert.CreatedAt).toLocaleDateString()}
            </span>
          </div>

          {/* Product and Vendor */}
          <h4 className="font-semibold text-base mb-1">
            {alert.ProductName || alert.ProductCode}
          </h4>
          <p className="text-sm opacity-75 mb-3">
            Supplier: <span className="font-medium">{alert.Vendor}</span>
          </p>

          {/* Price Details */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 text-sm">
            <div>
              <p className="opacity-75">Previous Avg</p>
              <p className="font-semibold">${alert.OldPrice?.toFixed(2)}</p>
            </div>
            <div>
              <p className="opacity-75">Current Price</p>
              <p className="font-semibold">${alert.NewPrice?.toFixed(2)}</p>
            </div>
            <div>
              <p className="opacity-75">Change</p>
              <p className={`font-semibold ${priceChangeColor}`}>
                {alert.PriceChange > 0 ? '+' : ''}{alert.PriceChange?.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="opacity-75">Monthly Impact</p>
              <p className={`font-semibold ${alert.MonthlyImpact > 0 ? 'text-red-600' : 'text-green-600'}`}>
                ${Math.abs(alert.MonthlyImpact)?.toFixed(0)}
              </p>
            </div>
          </div>

          {/* Statistical Data */}
          <div className="text-xs opacity-75 mb-3 space-y-1">
            <p>Z-Score: <span className="font-mono font-semibold">{alert.ZScore?.toFixed(2)}</span></p>
            <p>Confidence: <span className="font-semibold">{alert.Confidence?.toFixed(0)}%</span></p>
            <p>Est. Volume: <span className="font-semibold">{alert.MonthlyVolume?.toLocaleString()} units/month</span></p>
          </div>

          {/* Description */}
          <p className="text-sm mb-2">{alert.Description}</p>

          {/* Recommended Action */}
          <div className="bg-white/30 rounded p-2 mb-3">
            <p className="text-xs font-semibold mb-1">💡 Recommended Action:</p>
            <p className="text-sm">{alert.RecommendedAction}</p>
          </div>
        </div>

        {/* Acknowledge Button */}
        {!alert.IsAcknowledged && (
          <Button
            onClick={handleAcknowledge}
            disabled={isAcknowledging}
            className="ml-4 whitespace-nowrap"
            variant="outline"
            size="sm"
          >
            {isAcknowledging ? 'Acknowledging...' : 'Acknowledge'}
          </Button>
        )}
      </div>
    </div>
  );
}
