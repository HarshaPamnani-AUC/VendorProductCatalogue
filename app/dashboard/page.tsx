'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Database, FileSpreadsheet, Package, Users, TrendingUp, Plus, Clock, CheckCircle, AlertCircle, Search, Filter, MoreVertical, Activity, DollarSign, BarChart3 } from 'lucide-react';

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
            headers: { 'Authorization': `Bearer ${token}` },
            signal: controller.signal,
          }),
          fetch('/api/products/latest/items', {
            headers: { 'Authorization': `Bearer ${token}` },
            signal: controller.signal,
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

        {/* Activity Chart Placeholder */}
        <div className="mt-8 bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Upload Activity</h2>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg font-medium">Week</button>
              <button className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Month</button>
              <button className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Year</button>
            </div>
          </div>
          <div className="h-64 bg-gray-50 rounded-xl flex items-center justify-center">
            <div className="text-center">
              <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Activity chart will be displayed here</p>
              <p className="text-gray-400 text-sm mt-2">Integration with charting library needed</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
