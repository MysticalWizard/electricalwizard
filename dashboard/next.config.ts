import type { NextConfig } from 'next';

// Applied to every response, including the API's (proxied by the rewrites
// below). Pages can't be framed, so they can't be overlaid for clickjacking.
const securityHeaders = [
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'same-origin' },
];

const config: NextConfig = {
  transpilePackages: ['@electricalwizard/shared'],
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
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
