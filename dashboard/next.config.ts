import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@electricalwizard/shared'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:7611/api/:path*',
      },
      {
        source: '/auth/:path*',
        destination: 'http://localhost:7611/auth/:path*',
      },
    ];
  },
};

export default config;
