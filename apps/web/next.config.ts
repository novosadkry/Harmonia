import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@harmonia/db', '@harmonia/redis', '@harmonia/types'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: 'i.scdn.co' },
      { protocol: 'https', hostname: 'cdn.discordapp.com' },
    ],
  },
};

export default nextConfig;
