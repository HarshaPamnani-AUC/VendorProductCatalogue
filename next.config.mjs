/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      // Only proxy Express-specific routes — NOT Next.js API routes like price-history
      {
        source: '/api/auth/:path*',
        destination: 'http://localhost:5000/api/auth/:path*',
      },
      {
        source: '/api/vendors/:path*',
        destination: 'http://localhost:5000/api/vendors/:path*',
      },
      {
        source: '/api/uploads/:path*',
        destination: 'http://localhost:5000/api/uploads/:path*',
      },
      {
        source: '/api/products/:path*',
        destination: 'http://localhost:5000/api/products/:path*',
      },
      {
        source: '/api/upload-products/:path*',
        destination: 'http://localhost:5000/api/upload-products/:path*',
      },
      {
        source: '/api/table-structure/:path*',
        destination: 'http://localhost:5000/api/table-structure/:path*',
      },
      {
        source: '/api/fix-table/:path*',
        destination: 'http://localhost:5000/api/fix-table/:path*',
      },
      {
        source: '/api/move-data/:path*',
        destination: 'http://localhost:5000/api/move-data/:path*',
      },
    ];
  },
}

export default nextConfig
