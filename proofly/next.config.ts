import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['ethers', 'lob', 'resend'],
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
        ],
      },
    ];
  },
};

export default nextConfig;