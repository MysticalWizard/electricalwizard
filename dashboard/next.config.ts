import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@electricalwizard/shared'],
  // The API listens on IPv4 loopback only, so don't let `localhost` resolve
  // to ::1
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:7611/api/:path*',
      },
      {
        source: '/auth/:path*',
        destination: 'http://127.0.0.1:7611/auth/:path*',
      },
    ];
  },
};

export default config;
