/** @type {import('next').NextConfig} */
const nextConfig = {
  // PGlite 只在本機開發（沒有 DATABASE_URL）時動態載入，不要打包進伺服器程式
  serverExternalPackages: ['@electric-sql/pglite'],
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

export default nextConfig;
