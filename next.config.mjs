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
    const backendUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://172.30.36.124:5000/api';
    const trimmed = backendUrl.replace(/\/+$/, '').replace(/\/api$/, '');
    return [
      {
        source: '/api/auth/:path*',
        destination: `${trimmed}/api/auth/:path*`,
      },
      {
        source: '/api/vendors/:path*',
        destination: `${trimmed}/api/vendors/:path*`,
      },
      {
        source: '/api/products/:path*',
        destination: `${trimmed}/api/products/:path*`,
      },
      {
        source: '/api/uploads/:path*',
        destination: `${trimmed}/api/uploads/:path*`,
      },
      {
        source: '/api/fix-table/:path*',
        destination: `${trimmed}/api/fix-table/:path*`,
      },
      {
        source: '/api/move-data/:path*',
        destination: `${trimmed}/api/move-data/:path*`,
      },
      {
        source: '/api/upload-products',
        destination: `${trimmed}/api/upload-products`,
      },
    ];
  },
}

export default nextConfig
