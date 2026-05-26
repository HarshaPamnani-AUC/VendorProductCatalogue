/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Ensure assets are always requested from root, not relative to current page
  assetPrefix: '',
  async rewrites() {
    return [
      {
        source: '/api/auth/:path*',
        destination: 'http://172.30.36.124:5000/api/auth/:path*',
      },
      {
        source: '/api/vendors/:path*',
        destination: 'http://172.30.36.124:5000/api/vendors/:path*',
      },
      {
        source: '/api/products/:path*',
        destination: 'http://172.30.36.124:5000/api/products/:path*',
      },
      {
        source: '/api/uploads/:path*',
        destination: 'http://172.30.36.124:5000/api/uploads/:path*',
      },
      {
        source: '/api/fix-table/:path*',
        destination: 'http://172.30.36.124:5000/api/fix-table/:path*',
      },
      {
        source: '/api/move-data/:path*',
        destination: 'http://172.30.36.124:5000/api/move-data/:path*',
      },
      {
        source: '/api/upload-products',
        destination: 'http://172.30.36.124:5000/api/upload-products',
      },
    ];
  },
}

export default nextConfig
