'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Database, FileSpreadsheet, Package, Users, TrendingUp, Plus, Clock, CheckCircle, AlertCircle, Search, Filter, MoreVertical, Activity, DollarSign, BarChart3, LogOut } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface UploadStats {
  totalFiles: number;
  totalProducts: number;
  activeVendors: number;
  successRate: number;
  totalRevenue: number;
  monthlyGrowth: number;
}

interface RecentUpload {
  FileId: number;
  FileName: string;
  VendorId: number;
  VendorName: string;
  Status: string;
  UploadedAt: string;
  RecordsSuccess: number;
  RecordsFailed: number;
  FileSize: number;
}

interface TopVendor {
  VendorId: number;
  VendorName: string;
  ProductCount: number;
  SuccessRate: number;
  LastUpload: string;
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
  vendors: any[];
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<UploadStats>({
    totalFiles: 0,
    totalProducts: 0,
    activeVendors: 0,
    successRate: 0,
    totalRevenue: 0,
    monthlyGrowth: 0,
  });
  const [recentUploads, setRecentUploads] = useState<RecentUpload[]>([]);
  const [topVendors, setTopVendors] = useState<TopVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // EAN/UPC Search states
  const [eanUpcSearch, setEanUpcSearch] = useState('');
  const [eanUpcResults, setEanUpcResults] = useState<Product[]>([]);
  const [eanUpcLoading, setEanUpcLoading] = useState(false);
  const [eanUpcSearched, setEanUpcSearched] = useState(true); // Start with true to show chart by default

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        console.log('No token found, redirecting to login');
        router.push('/login');
        return;
      }

      console.log('Token found, fetching dashboard data...');

      // Set initial empty state
      setStats({
        totalFiles: 0,
        totalProducts: 0,
        activeVendors: 0,
        successRate: 0,
        totalRevenue: 0,
        monthlyGrowth: 0,
      });

      setRecentUploads([]);
      setTopVendors([]);

      // Fetch real data in parallel with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

      try {
        const [vendorsResponse, productsResponse] = await Promise.all([
          fetch('/api/vendors', {
            headers: { 
              'Authorization': `Bearer ${token}`
            }
          }),
          fetch('/api/products/latest/items', {
            headers: { 
              'Authorization': `Bearer ${token}`
            }
          }),
        ]);

        clearTimeout(timeoutId);

        // Check for 401 errors specifically
        if (vendorsResponse.status === 401 || productsResponse.status === 401) {
          console.log('Authentication failed, clearing token and redirecting to login');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          router.push('/login');
          return;
        }

        const vendors = await vendorsResponse.json().catch(() => []);
        const products = await productsResponse.json().catch(() => []);

        console.log('Dashboard data fetched:', { vendors: vendors.length || 0, products: products.length || 0 });

        // Update with real data if available
        if (Array.isArray(vendors) || Array.isArray(products)) {
          setStats({
            totalFiles: 0,
            totalProducts: Array.isArray(products) ? products.length : 0,
            activeVendors: Array.isArray(vendors) ? vendors.length : 0,
            successRate: 0,
            totalRevenue: 0,
            monthlyGrowth: 0,
          });
        }
      } catch (fetchError) {
        console.warn('Dashboard data fetch failed:', fetchError);
        // Keep using empty state
      }
    } catch (err) {
      console.error('Dashboard initialization error:', err);
    } finally {
      setLoading(false);
    }
  };

  // EAN/UPC search handler
  const handleEanUpcSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!eanUpcSearch.trim()) {
      console.log('No EAN/UPC search parameter provided');
      return;
    }

    console.log('Starting EAN/UPC search with:', eanUpcSearch);
    setEanUpcLoading(true);
    setEanUpcSearched(true);

    try {
      const params = new URLSearchParams();
      params.append('upcCode', eanUpcSearch.trim());

      const url = `/api/price-intelligence?${params.toString()}`;
      console.log('Fetching EAN/UPC from URL:', url);

      const response = await fetch(url);
      const data = await response.json();
      
      if (Array.isArray(data)) {
        // Sort results by price (lowest to highest)
        const sortedData = data.sort((a, b) => {
          const priceA = typeof a.price === 'string' ? parseFloat(a.price.replace(/[^0-9.-]/g, '')) || 0 : a.price || 0;
          const priceB = typeof b.price === 'string' ? parseFloat(b.price.replace(/[^0-9.-]/g, '')) || 0 : b.price || 0;
          return priceA - priceB;
        });
        setEanUpcResults(sortedData);
      } else {
        console.error('EAN/UPC API returned non-array data:', data);
        setEanUpcResults([]);
      }
    } catch (error) {
      console.error('EAN/UPC search error:', error);
      setEanUpcResults([]);
    } finally {
      setEanUpcLoading(false);
    }
  };

  // Fetch lowest price items by default on component mount
  const fetchLowestPriceItems = async () => {
    try {
      const url = '/api/price-intelligence?limit=10'; // Get top 10 items for best performance
      console.log('Fetching lowest price items from URL:', url);

      const response = await fetch(url);
      const data = await response.json();
      
      if (Array.isArray(data)) {
        // Group by product and find the lowest price item for each product
        const productGroups: { [product: string]: any[] } = {};
        
        data.forEach(item => {
          const productKey = `${item.productCode}_${item.productName}`; // Use product code + name as unique key
          if (!productGroups[productKey]) {
            productGroups[productKey] = [];
          }
          productGroups[productKey].push(item);
        });

        // Find the lowest price item for each product
        const lowestPriceItems: any[] = [];
        Object.keys(productGroups).forEach(productKey => {
          const productItems = productGroups[productKey];
          const lowestItem = productItems.reduce((lowest, current) => {
            const priceLowest = typeof lowest.price === 'string' ? parseFloat(lowest.price.replace(/[^0-9.-]/g, '')) || 0 : lowest.price || 0;
            const priceCurrent = typeof current.price === 'string' ? parseFloat(current.price.replace(/[^0-9.-]/g, '')) || 0 : current.price || 0;
            return priceCurrent < priceLowest ? current : lowest;
          });
          lowestPriceItems.push(lowestItem);
        });

        // Sort all lowest price items by price (lowest to highest)
        const sortedData = lowestPriceItems.sort((a, b) => {
          const priceA = typeof a.price === 'string' ? parseFloat(a.price.replace(/[^0-9.-]/g, '')) || 0 : a.price || 0;
          const priceB = typeof b.price === 'string' ? parseFloat(b.price.replace(/[^0-9.-]/g, '')) || 0 : b.price || 0;
          return priceA - priceB;
        });

        setEanUpcResults(sortedData);
        setEanUpcSearched(true); // Show results by default
      } else {
        // API returned an error object - log quietly, don't show error to user
        if (data?.error) {
          console.warn('Lowest price API error:', data.error);
        }
        setEanUpcResults([]);
      }
    } catch (error) {
      console.error('Lowest price fetch error:', error);
      setEanUpcResults([]);
    }
  };

  // Fetch lowest price items on component mount
  useEffect(() => {
    fetchLowestPriceItems();
  }, []);

  const handleEanUpcClear = () => {
    setEanUpcSearch('');
    setEanUpcSearched(true); // Keep showing results
    fetchLowestPriceItems(); // Reset to default lowest price items
    
    console.log('EAN/UPC search results cleared - showing lowest price items');
  };

  // Calculate EAN/UPC vendor quantity totals for chart
  const getEanUpcVendorQuantityTotals = () => {
    const vendorQuantities: { [vendor: string]: number } = {};
    
    eanUpcResults.forEach(product => {
      const vendor = product.vendorName || 'Unknown';
      const quantity = product.stockQuantity || 0;
      vendorQuantities[vendor] = (vendorQuantities[vendor] || 0) + quantity;
    });

    return Object.entries(vendorQuantities)
      .map(([vendor, quantity]) => ({ vendor, quantity }))
      .sort((a, b) => b.quantity - a.quantity); // Sort by quantity descending
  };

  const eanUpcVendorQuantityTotals = getEanUpcVendorQuantityTotals();

  // Chart colors
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

  const StatCard = ({ icon, title, value, subtitle, color = 'blue' }: any) => {
    const colorClasses: Record<string, string> = {
      blue: 'bg-blue-50 text-blue-600 border-blue-100',
      green: 'bg-green-50 text-green-600 border-green-100',
      purple: 'bg-purple-50 text-purple-600 border-purple-100',
      orange: 'bg-orange-50 text-orange-600 border-orange-100',
    };

    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
        <div className="flex items-start justify-between mb-4">
          <div className={`p-3 rounded-xl ${colorClasses[color]}`}>
            {icon}
          </div>
        </div>
        <div>
          <p className="text-gray-600 text-sm font-medium mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header Skeleton */}
        <div className="bg-white border-b border-gray-200 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="h-8 bg-gray-200 rounded w-48 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-96"></div>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-10 bg-gray-200 rounded w-64"></div>
              <div className="h-10 bg-blue-200 rounded w-28"></div>
            </div>
          </div>
        </div>

        <div className="p-8">
          {/* Stats Grid Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-xl"></div>
                  <div className="h-6 bg-gray-200 rounded w-12"></div>
                </div>
                <div>
                  <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-16"></div>
                  <div className="h-3 bg-gray-200 rounded w-32 mt-1"></div>
                </div>
              </div>
            ))}
          </div>

          {/* Content Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <div className="h-6 bg-gray-200 rounded w-32"></div>
              </div>
              <div className="p-6 space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 bg-gray-50 rounded">
                    <div className="w-8 h-8 bg-gray-200 rounded"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-48 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-24"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <div className="h-6 bg-gray-200 rounded w-32"></div>
              </div>
              <div className="p-6 space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded">
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                      <div>
                        <div className="h-4 bg-gray-200 rounded w-32 mb-1"></div>
                        <div className="h-3 bg-gray-200 rounded w-20"></div>
                      </div>
                    </div>
                    <div className="h-4 bg-gray-200 rounded w-12"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Logout function
  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Call logout API
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        // Clear local storage
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('rememberEmail'); // Clear remembered email
        
        // Redirect to login
        router.push('/login');
      } else {
        console.error('Logout failed');
      }
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear local storage on error
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('rememberEmail'); // Clear remembered email
      router.push('/login');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">Welcome back! Here's your product catalog overview.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button 
              onClick={() => router.push('/dashboard/add-vendor')}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Vendor
            </button>
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="p-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
          <StatCard
            icon={<FileSpreadsheet className="w-6 h-6" />}
            title="Total Files"
            value={stats.totalFiles}
            subtitle="Excel files uploaded"
            color="blue"
          />
          <StatCard
            icon={<Package className="w-6 h-6" />}
            title="Total Products"
            value={stats.totalProducts.toLocaleString()}
            subtitle="Indexed in system"
            color="green"
          />
          <StatCard
            icon={<Users className="w-6 h-6" />}
            title="Active Vendors"
            value={stats.activeVendors}
            subtitle="Connected sources"
            color="purple"
          />
          <StatCard
            icon={<CheckCircle className="w-6 h-6" />}
            title="Success Rate"
            value={`${stats.successRate}%`}
            subtitle="Data processing quality"
            color="green"
          />
          <StatCard
            icon={<DollarSign className="w-6 h-6" />}
            title="Total Revenue"
            value={`$${(stats.totalRevenue / 1000000).toFixed(1)}M`}
            subtitle="Product value tracked"
            color="orange"
          />
          <StatCard
            icon={<BarChart3 className="w-6 h-6" />}
            title="Monthly Growth"
            value={`${stats.monthlyGrowth}%`}
            subtitle="vs last month"
            color="blue"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Uploads */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Recent Uploads</h2>
                <button className="text-blue-600 hover:text-blue-700 font-medium text-sm">
                  View All
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">File Name</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Vendor</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Records</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Size</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Uploaded</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recentUploads.length > 0 ? (
                    recentUploads.map((upload) => (
                      <tr key={upload.FileId} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-50 rounded-lg">
                              <FileSpreadsheet className="w-4 h-4 text-green-600" />
                            </div>
                            <div>
                              <p className="text-gray-900 font-medium">{upload.FileName}</p>
                              <p className="text-gray-500 text-xs">ID: {upload.FileId}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-gray-900 font-medium">{upload.VendorName}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                            upload.Status === 'Completed' 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {upload.Status === 'Completed' ? (
                              <CheckCircle className="w-3 h-3 mr-1" />
                            ) : (
                              <Clock className="w-3 h-3 mr-1" />
                            )}
                            {upload.Status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm">
                            <p className="text-gray-900 font-medium">{upload.RecordsSuccess} success</p>
                            {upload.RecordsFailed > 0 && (
                              <p className="text-red-600 text-xs">{upload.RecordsFailed} failed</p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-gray-900 text-sm">{upload.FileSize} MB</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-gray-600 text-sm">
                            {new Date(upload.UploadedAt).toLocaleDateString()}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <button className="text-gray-400 hover:text-gray-600">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center">
                          <FileSpreadsheet className="w-12 h-12 text-gray-300 mb-4" />
                          <p className="text-gray-500 font-medium">No uploads yet</p>
                          <p className="text-gray-400 text-sm mt-1">Upload your first Excel file to get started</p>
                          <button 
                            onClick={() => router.push('/dashboard/upload')}
                            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                          >
                            Upload Files
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top Vendors */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Top Vendors</h2>
            </div>
            <div className="p-6 space-y-4">
              {topVendors.length > 0 ? (
                topVendors.map((vendor, index) => (
                  <div key={vendor.VendorId} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                        index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-orange-600'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="text-gray-900 font-medium">{vendor.VendorName}</p>
                        <p className="text-gray-500 text-sm">{vendor.ProductCount} products</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-900 font-medium">{vendor.SuccessRate}%</p>
                      <p className="text-gray-500 text-xs">{vendor.LastUpload}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 font-medium">No vendors yet</p>
                  <p className="text-gray-400 text-sm mt-1">Add your first vendor to get started</p>
                  <button 
                    onClick={() => router.push('/dashboard/add-vendor')}
                    className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                  >
                    Add Vendor
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* EAN/UPC Search Section */}
        <div className="mt-8 bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">EAN/UPC Code Search</h2>
            <p className="text-sm text-gray-600">Find products by EAN/UPC code - Lowest to Highest Price</p>
          </div>

          {/* EAN/UPC Search Form */}
          <form onSubmit={handleEanUpcSearch} className="mb-6">
            <div className="flex gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  value={eanUpcSearch}
                  onChange={(e) => setEanUpcSearch(e.target.value)}
                  placeholder="Enter EAN/UPC code to find lowest to highest price..."
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                type="submit"
                disabled={eanUpcLoading || !eanUpcSearch.trim()}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {eanUpcLoading ? 'Searching...' : 'Search'}
              </button>
              <button
                type="button"
                onClick={handleEanUpcClear}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Clear
              </button>
            </div>
          </form>

          {/* EAN/UPC Results - Always Visible */}
          <div>
            {eanUpcResults.length === 0 && !eanUpcLoading ? (
              <div className="text-center py-12">
                <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 font-medium">Loading products...</p>
                <p className="text-gray-400 text-sm mt-1">Fetching lowest price items</p>
              </div>
            ) : eanUpcLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-500 font-medium">Loading...</p>
              </div>
            ) : (
                <>
                  {/* Results Header */}
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-6">
                    <h3 className="text-lg font-semibold text-blue-800">
                      {eanUpcSearch ? `EAN/UPC Search Results: ${eanUpcSearch}` : 'Top 1 Lowest Price Items - Product Wise'}
                    </h3>
                    <p className="text-sm text-blue-600">
                      {eanUpcSearch 
                        ? `Found ${eanUpcResults.length} products - Sorted by price (lowest to highest)`
                        : `Showing ${eanUpcResults.length} lowest price items (1 per product) - Search EAN/UPC for specific results`
                      }
                    </p>
                  </div>

                  {/* Large Bar Chart Only */}
                  <div className="bg-white p-6 border border-gray-200 rounded-lg mb-6">
                    <h3 className="text-xl font-semibold text-gray-800 mb-6 text-center">Quantity by Vendor</h3>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={eanUpcVendorQuantityTotals}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="vendor" 
                          angle={-45}
                          textAnchor="end"
                          height={100}
                          tick={{ fontSize: 14 }}
                        />
                        <YAxis tick={{ fontSize: 14 }} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1f2937', 
                            border: '1px solid #374151',
                            borderRadius: '8px',
                            fontSize: '14px'
                          }}
                          labelStyle={{ color: '#f3f4f6' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '14px' }} />
                        <Bar 
                          dataKey="quantity" 
                          fill="#3b82f6" 
                          name="Total Quantity"
                          radius={[8, 8, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <p className="text-sm text-blue-600 font-medium">Total Vendors</p>
                      <p className="text-2xl font-bold text-blue-800">{eanUpcVendorQuantityTotals.length}</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <p className="text-sm text-green-600 font-medium">Total Quantity</p>
                      <p className="text-2xl font-bold text-green-800">
                        {eanUpcVendorQuantityTotals.reduce((sum, vendor) => sum + vendor.quantity, 0)}
                      </p>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                      <p className="text-sm text-purple-600 font-medium">Top Vendor</p>
                      <p className="text-lg font-bold text-purple-800">
                        {eanUpcVendorQuantityTotals[0]?.vendor || 'N/A'}
                      </p>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                      <p className="text-sm text-orange-600 font-medium">Max Quantity</p>
                      <p className="text-2xl font-bold text-orange-800">
                        {eanUpcVendorQuantityTotals[0]?.quantity || 0}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
        </div>
      </div>
    </div>
  );
}
