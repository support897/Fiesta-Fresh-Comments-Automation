import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    if (process.env.NEXT_PUBLIC_IS_MOBILE_APP === 'true') {
      return [
        {
          source: '/',
          destination: '/swipe',
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
