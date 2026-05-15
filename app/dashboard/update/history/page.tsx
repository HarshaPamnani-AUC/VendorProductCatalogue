'use client';

import React, { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface Vendor {
  vendorId: number;
  vendorName: string;
  price: number;
  stockQuantity: number;
}

interface Product {
  productCode: string;
  productName: string;
  productDate: string;
  description: string;
  brand: string;
  category: string;
  upc: string;
  price: number;
  stockQuantity: number;
  vendorName: string;
  lowestPrice: number;
  highestPrice: number;
  vendors: Vendor[];
}

export default function ProductHistoryPage() {
  const [navCode, setNavCode] = useState('');
  const [upcCode, setUpcCode] = useState('');
  const [productName, setProductName] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if at least one search field is filled
    if (!navCode.trim() && !upcCode.trim() && !productName.trim()) {
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      const params = new URLSearchParams();

      // Add search parameters that are not empty
      if (navCode.trim()) {
        params.append('navCode', navCode.trim());
      }
      if (upcCode.trim()) {
        params.append('upcCode', upcCode.trim());
      }
      if (productName.trim()) {
        params.append('productName', productName.trim());
      }

      const response = await fetch(`/api/products/history?${params}`);
      const data = await response.json();
      if (Array.isArray(data)) {
        setSearchResults(data as Product[]);
      } else if (typeof data === 'object' && data !== null) {
        // Convert object with numeric keys to array
        const resultsArray = Object.values(data) as Product[];
        setSearchResults(resultsArray);
      } else {
        setSearchResults([]);
      }
    } catch (err) {
      console.error('Search error:', err);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setNavCode('');
    setUpcCode('');
    setProductName('');
    setSearchResults([]);
    setSearched(false);
  };

  const handleDownload = () => {
    const headers = ['Product Code', 'Product Name', 'Date', 'UPC', 'Vendor', 'Price', 'Stock Quantity'];

    const excelData = [
      headers,
      ...searchResults.map(product => {
        // Handle different possible data structures
        const productData = typeof product === 'object' && product !== null ? product as any : {};
        
        return [
          productData.productCode || '',
          productData.productName || '',
          productData.productDate || '',
          `="${productData.upc || ''}"`, // ✅ Force Excel to display full number
          productData.vendorName || '',
          productData.price || 0,
          productData.stockQuantity || 0
        ];
      })
    ];

    // Convert to CSV
    const csvContent = excelData.map(row => row.join(',')).join('\n');

    // Download CSV
    const blob = new Blob(['\ufeff' + csvContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `product_history_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Transform data for pivot table display
  const transformDataForPivotTable = (data: Product[]) => {
    // Group data by vendor and date
    const pivotData: { [vendor: string]: { [date: string]: number } } = {};
    const allDates = new Set<string>();
    const allVendors = new Set<string>();

    data.forEach(item => {
      const vendor = item.vendorName || 'Unknown';
      const date = item.productDate || 'Unknown';
      const price = item.price || 0;

      allVendors.add(vendor);
      allDates.add(date);

      if (!pivotData[vendor]) {
        pivotData[vendor] = {};
      }
      pivotData[vendor][date] = price;
    });

    // Sort dates in DESC order (newest first)
    const sortedDates = Array.from(allDates).sort((a, b) => {
      const dateA = a.split('-').reverse().join('-'); // Convert to yyyy-MM-dd
      const dateB = b.split('-').reverse().join('-'); // Convert to yyyy-MM-dd
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

    // Sort vendors by average price (lowest to highest)
    const getVendorAveragePrice = (vendor: string) => {
      const prices = sortedDates.map(date => pivotData[vendor]?.[date] || 0).filter(p => p > 0);
      if (prices.length === 0) return 0;
      return prices.reduce((sum, price) => sum + price, 0) / prices.length;
    };

    const sortedVendors = Array.from(allVendors).sort((a, b) => {
      const avgPriceA = getVendorAveragePrice(a);
      const avgPriceB = getVendorAveragePrice(b);
      return avgPriceA - avgPriceB; // Sort by average price ascending (lowest first)
    });

    return { pivotData, sortedDates, sortedVendors };
  };

  const { pivotData, sortedDates, sortedVendors } = transformDataForPivotTable(searchResults);

  // Calculate vendor quantity totals for chart
  const getVendorQuantityTotals = () => {
    const vendorQuantities: { [vendor: string]: number } = {};
    
    searchResults.forEach(product => {
      const vendor = product.vendorName || 'Unknown';
      const quantity = product.stockQuantity || 0;
      vendorQuantities[vendor] = (vendorQuantities[vendor] || 0) + quantity;
    });

    return Object.entries(vendorQuantities)
      .map(([vendor, quantity]) => ({ vendor, quantity }))
      .sort((a, b) => b.quantity - a.quantity); // Sort by quantity descending
  };

  const vendorQuantityTotals = getVendorQuantityTotals();

  // Chart colors
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

  // Calculate averages
  const calculateVendorAverage = (vendor: string) => {
    const prices = Object.values(pivotData[vendor] || {}).filter(p => p > 0);
    if (prices.length === 0) return 0;
    return prices.reduce((sum, price) => sum + price, 0) / prices.length;
  };

  const calculateDateAverage = (date: string) => {
    const prices = Object.values(pivotData)
      .map(vendorData => vendorData[date] || 0)
      .filter(p => p > 0);
    if (prices.length === 0) return 0;
    return prices.reduce((sum, price) => sum + price, 0) / prices.length;
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">Product Insights</h1>
          <p className="text-muted-foreground">Analyze historical product data and gain valuable insights</p>
        </div>
        {/* Download Button - Top Right */}
        {searchResults.length > 0 && (
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Download ({searchResults.length} items)
          </button>
        )}
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="bg-card border border-border rounded-lg p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              NAV Code
            </label>
            <input
              type="text"
              value={navCode}
              onChange={(e) => setNavCode(e.target.value)}
              placeholder="Enter NAV code..."
              className="w-full px-4 py-3 rounded-lg border border-border bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              UPC Code
            </label>
            <input
              type="text"
              value={upcCode}
              onChange={(e) => setUpcCode(e.target.value)}
              placeholder="Enter UPC code..."
              className="w-full px-4 py-3 rounded-lg border border-border bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Product Name
            </label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Enter product name..."
              className="w-full px-4 py-3 rounded-lg border border-border bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <button
            type="submit"
            disabled={loading || (!navCode.trim() && !upcCode.trim() && !productName.trim())}
            className="w-full py-3 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Analyzing...' : 'Analyze Insights'}
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="w-full py-3 px-4 bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold rounded-lg transition-colors"
          >
            Clear All Fields
          </button>
        </div>
      </form>

      {/* Product Names Display Section */}
      {searched && searchResults.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-foreground mb-4">Product Names Found</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from(new Set(searchResults.map(product => product.productName).filter(name => name && name.trim()))).map((productName, index) => (
              <div key={index} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-700 font-semibold text-blue-900 bg-blue-100 px-3 py-1 rounded inline-block">
                  {productName}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 text-sm text-muted-foreground">
            Found {searchResults.length} results for {Array.from(new Set(searchResults.map(product => product.productName).filter(name => name && name.trim()))).length} unique products
          </div>
        </div>
      )}

      {/* Results */}
      {searched && (
        <div>
          {searchResults.length === 0 ? (
            <div className="bg-card border border-border rounded-lg p-12 text-center">
              <svg className="w-16 h-16 text-muted mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-foreground font-semibold mb-2">No products found in history</p>
              <p className="text-muted-foreground">Try adjusting your search criteria</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-800 text-white border-b-2 border-slate-900">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider border-r border-slate-600">
                        Account/Vendor
                      </th>
                      {sortedDates.map(date => (
                        <th key={date} className="px-6 py-4 text-center text-sm font-bold uppercase tracking-wider border-r border-slate-600">
                          {date}
                        </th>
                      ))}
                      <th className="px-6 py-4 text-center text-sm font-bold uppercase tracking-wider bg-blue-600">
                        Average
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sortedVendors.map(vendor => (
                      <tr key={vendor} className="hover:bg-gray-50 transition-colors border-b border-gray-200">
                        <td className="px-6 py-4 text-sm font-semibold text-gray-900 border-r border-gray-300 bg-gray-50">
                          {vendor}
                        </td>
                        {sortedDates.map(date => (
                          <td key={date} className="px-6 py-4 text-sm font-medium text-right border-r border-gray-300">
                            {pivotData[vendor]?.[date] ? `$${pivotData[vendor][date].toFixed(2)}` : '-'}
                          </td>
                        ))}
                        <td className="px-6 py-4 text-lg font-bold text-blue-700 bg-blue-50 border-r border-gray-300">
                          ${calculateVendorAverage(vendor).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-gradient-to-r from-slate-100 to-slate-200 border-t-2 border-slate-300">
                      <td className="px-6 py-4 text-base font-bold text-slate-800 border-r border-slate-400">
                        Average
                      </td>
                      {sortedDates.map(date => (
                        <td key={date} className="px-6 py-4 text-base font-bold text-blue-700 text-right border-r border-slate-400 bg-blue-50">
                          ${calculateDateAverage(date).toFixed(2)}
                        </td>
                      ))}
                      <td className="px-6 py-4 text-xl font-bold text-green-700 text-right bg-green-50 border-l-2 border-green-400">
                        ${(sortedDates.reduce((sum, date) => sum + calculateDateAverage(date), 0) / sortedDates.length).toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chart Activity Section - After Table */}
      {searched && searchResults.length > 0 && (
        <div className="mb-8">
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-2xl font-bold text-foreground mb-6">Vendor Product Distribution</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Bar Chart */}
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">Quantity by Vendor</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={vendorQuantityTotals}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="vendor" 
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1f2937', 
                        border: '1px solid #374151',
                        borderRadius: '8px'
                      }}
                      labelStyle={{ color: '#f3f4f6' }}
                    />
                    <Legend />
                    <Bar 
                      dataKey="quantity" 
                      fill="#3b82f6" 
                      name="Total Quantity"
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Pie Chart */}
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">Vendor Quantity Share</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={vendorQuantityTotals}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ vendor, percent }) => `${vendor}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="quantity"
                    >
                      {vendorQuantityTotals.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1f2937', 
                        border: '1px solid #374151',
                        borderRadius: '8px'
                      }}
                      labelStyle={{ color: '#f3f4f6' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-600 font-medium">Total Vendors</p>
                <p className="text-2xl font-bold text-blue-800">{vendorQuantityTotals.length}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <p className="text-sm text-green-600 font-medium">Total Quantity</p>
                <p className="text-2xl font-bold text-green-800">
                  {vendorQuantityTotals.reduce((sum, vendor) => sum + vendor.quantity, 0)}
                </p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                <p className="text-sm text-purple-600 font-medium">Top Vendor</p>
                <p className="text-lg font-bold text-purple-800">
                  {vendorQuantityTotals[0]?.vendor || 'N/A'}
                </p>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                <p className="text-sm text-orange-600 font-medium">Max Quantity</p>
                <p className="text-2xl font-bold text-orange-800">
                  {vendorQuantityTotals[0]?.quantity || 0}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
