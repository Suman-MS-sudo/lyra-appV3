import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Temporarily disable React Compiler to speed up build
  // reactCompiler: true,
  
  // Skip TypeScript type checking during build (run separately with `npm run lint`)
  typescript: {
    ignoreBuildErrors: process.env.SKIP_TYPE_CHECK === 'true',
  },
  
  // Add logging to see build progress
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  
  // Reduce build optimization for faster builds
  productionBrowserSourceMaps: false,
  
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com",
              "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com",
              "img-src 'self' data: https:",
              "style-src 'self' 'unsafe-inline'",
              "connect-src 'self' https://*.razorpay.com https://api.razorpay.com https://checkout.razorpay.com https://*.supabase.co wss://*.supabase.co",
              "font-src 'self' data:",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
