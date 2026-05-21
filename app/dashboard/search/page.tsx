'use client';



import React, { useState } from "react"

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



export default function SearchPage() {

  const [navCode, setNavCode] = useState('');

  const [upcCode, setUpcCode] = useState('');

  const [productName, setProductName] = useState('');

  const [searchResults, setSearchResults] = useState<Product[]>([]);

  const [loading, setLoading] = useState(false);

  const [searched, setSearched] = useState(false);

  const [error, setError] = useState('');



  


  const handleSearch = async (e: React.FormEvent) => {

    e.preventDefault();

    

    // Check if at least one search field is filled

    if (!navCode.trim() && !upcCode.trim() && !productName.trim()) {

      console.log('No search parameters provided');

      return;

    }



    console.log('Starting search with:', { navCode, upcCode, productName });

    setLoading(true);

    setSearched(true);

    setError('');



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


      const url = `/api/price-intelligence?${params.toString()}`;

      console.log('Fetching from URL:', url);



      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
      });

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('Price Intelligence received a page instead of search data. Please restart the Next.js server and try again.');
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to load price intelligence');
      }

      

      if (Array.isArray(data)) {

        setSearchResults(data);

      } else {

        throw new Error('Price Intelligence returned data in an unexpected format');

      }

    } catch (error: any) {

      console.error('Search error:', error);

      setError(error.message || 'Failed to load price intelligence');

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

    setError('');

    

    // Clear any existing search results

    console.log('Search results cleared');

  };



  


  // Transform data for pivot table display (simple grouping)

  const transformDataForPivotTable = (data: any[]) => {

  const pivotData: { [date: string]: { [vendor: string]: number } } = {};

  const allDates = new Set<string>();

  const allVendors = new Set<string>();



  data.forEach(item => {

    const vendor = ((item.vendorName || 'Unknown').trim().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ')).toUpperCase();

    const date = item.productDate || 'Unknown';



    const price =

      typeof item.price === 'string'

        ? parseFloat(item.price.replace(/[^0-9.-]/g, '')) || 0

        : item.price || 0;



    allDates.add(date);

    allVendors.add(vendor);



    if (!pivotData[date]) {

      pivotData[date] = {};

    }



    // store exact price

    pivotData[date][vendor] = price;

  });



  // ✅ simple date sorting - DESC order (newest first)

  const sortedDates = Array.from(allDates).sort((a, b) => {

    // Parse dates in dd-MM-yyyy format and sort descending

    const dateA = a.split('-').reverse().join('-'); // Convert to yyyy-MM-dd

    const dateB = b.split('-').reverse().join('-'); // Convert to yyyy-MM-dd

    return new Date(dateB).getTime() - new Date(dateA).getTime();

  });

  

  // ✅ vendor sorting by average price (lowest to highest)

  const getVendorAveragePrice = (vendor: string) => {

    const prices = sortedDates.map(date => (pivotData[date] as { [vendor: string]: number })?.[vendor] || 0).filter((p: number) => p > 0);

    if (prices.length === 0) return 0;

    return prices.reduce((sum, price) => sum + price, 0) / prices.length;

  };



  const allUniqueVendors = Array.from(allVendors).sort((a, b) => {

    const avgPriceA = getVendorAveragePrice(a);

    const avgPriceB = getVendorAveragePrice(b);

    return avgPriceA - avgPriceB; // Sort by average price ascending (lowest first)

  });



  return { pivotData, sortedDates, allUniqueVendors };

};



  const { pivotData, sortedDates, allUniqueVendors } = transformDataForPivotTable(searchResults);



  console.log('Raw search results (first 5):', searchResults.slice(0, 5));

  console.log('Sorted dates:', sortedDates);

  console.log('All unique vendors:', allUniqueVendors);



  // Calculate vendor quantity totals for chart

  const getVendorQuantityTotals = () => {

    const vendorQuantities: { [vendor: string]: number } = {};

    

    searchResults.forEach(product => {

      const vendor = ((product.vendorName || 'Unknown').trim().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ')).toUpperCase();

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

  const calculateDateAverage = (date: string) => {

    const prices = Object.values(pivotData[date] || {}).filter(p => p > 0);

    if (prices.length === 0) return 0;

    return prices.reduce((sum, price) => sum + price, 0) / prices.length;

  };



  const calculateVendorAverage = (vendor: string) => {

    const prices = sortedDates.map(date => (pivotData[date] as { [vendor: string]: number })?.[vendor] || 0).filter((p: number) => p > 0);

    if (prices.length === 0) return 0;

    return prices.reduce((sum: number, price: number) => sum + price, 0) / prices.length;

  };



  const handleDownload = () => {

    const headers = ['Date', 'Product Code', 'Product Name', 'UPC', 'Vendor', 'Price', 'Stock Quantity'];



    const excelData = [

      headers,

      ...searchResults.map(product => {

        // Handle different possible data structures

        const productData = typeof product === 'object' && product !== null ? product as any : {};

        

        return [

          productData.productDate || product.productDate || '',

          productData.productCode || product.productCode || '',

          productData.productName || product.productName || '',

          `="${productData.upc || product.upc || ''}"`, // ✅ Force Excel to display full number

          productData.vendorName || product.vendorName || '',

          productData.price || product.price || 0,

          productData.stockQuantity || product.stockQuantity || 0

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

    link.setAttribute('download', `price_intelligence_${new Date().toISOString().split('T')[0]}.csv`);

    link.style.visibility = 'hidden';

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);

  };



  return (

    <div className="p-8">

      {/* Header */}

      <div className="mb-8 flex justify-between items-center">

        <div>

          <h1 className="text-4xl font-bold text-foreground mb-2">Price Intelligence</h1>

          <p className="text-muted-foreground">Analyze product pricing and compare across vendors</p>

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

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">

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

              UPC / EAN Code

            </label>

            <input

              type="text"

              value={upcCode}

              onChange={(e) => setUpcCode(e.target.value)}

              placeholder="Enter UPC/EAN code..."

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

            {loading ? 'Analyzing...' : 'Analyze Prices'}

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



      {error && (

        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-8">

          <p className="text-destructive font-semibold">Price Intelligence search failed</p>

          <p className="text-sm text-destructive/80 mt-1">{error}</p>

        </div>

      )}



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



      {/* Results - Table First */}

      {searched && (

        <div>

          {searchResults.length === 0 ? (

            <div className="bg-card border border-border rounded-lg p-12 text-center">

              <svg className="w-16 h-16 text-muted mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />

              </svg>

              <p className="text-foreground font-semibold mb-2">{error ? 'Search could not be completed' : 'No products found'}</p>

              <p className="text-muted-foreground">{error ? 'Fix the error above and try again' : 'Try adjusting your search criteria'}</p>

            </div>

          ) : (

            <div className="bg-card border border-border rounded-lg overflow-hidden">

              <div className="overflow-x-auto">

                <table className="w-full">

                  <thead className="bg-slate-800 text-white border-b-2 border-slate-900">

                    <tr>

                      <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider border-r border-slate-600">

                        Date

                      </th>

                      {allUniqueVendors.map((vendor: string) => (

                        <th key={vendor} className="px-6 py-4 text-center text-sm font-bold uppercase tracking-wider border-r border-slate-600">

                          {vendor}

                        </th>

                      ))}

                      <th className="px-6 py-4 text-center text-sm font-bold uppercase tracking-wider bg-blue-600">

                        Average

                      </th>

                    </tr>

                  </thead>

                  <tbody className="bg-white divide-y divide-gray-200">

                    {sortedDates.map(date => (

                      <tr key={date} className="hover:bg-gray-50 transition-colors border-b border-gray-200">

                        <td className="px-6 py-4 text-sm font-semibold text-gray-900 border-r border-gray-300 bg-gray-50">

                          {date}

                        </td>

                        {allUniqueVendors.map((vendor: string) => {

  const price = pivotData[date]?.[vendor] || 0;



  return (

    <td

      key={vendor}

      className="px-6 py-4 text-sm font-medium text-right border-r border-gray-300"

    >

      {price ? `$${price.toFixed(2)}` : '-'}

    </td>

  );

})}

                        <td className="px-6 py-4 text-lg font-bold text-blue-700 bg-blue-50 border-r border-gray-300">

                          ${calculateDateAverage(date).toFixed(2)}

                        </td>

                      </tr>

                    ))}

                    <tr className="bg-gradient-to-r from-slate-100 to-slate-200 border-t-2 border-slate-300">

                      <td className="px-6 py-4 text-base font-bold text-slate-800 border-r border-slate-400">

                        Average

                      </td>

                      {allUniqueVendors.map((vendor: string) => (

                        <td key={vendor} className="px-6 py-4 text-base font-bold text-blue-700 text-right border-r border-slate-400 bg-blue-50">

                          ${calculateVendorAverage(vendor).toFixed(2)}

                        </td>

                      ))}

                      <td className="px-6 py-4 text-xl font-bold text-green-700 text-right bg-green-50 border-l-2 border-green-400">

                        ${(allUniqueVendors.reduce((sum: number, vendor: string) => sum + calculateVendorAverage(vendor), 0) / allUniqueVendors.length).toFixed(2)}

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

