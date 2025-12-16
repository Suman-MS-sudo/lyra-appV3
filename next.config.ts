import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Optimized for 1GB RAM and 1 core CPU
  
  // Skip TypeScript type checking during build (run separately with `npm run lint`)
  typescript: {
    ignoreBuildErrors: process.env.SKIP_TYPE_CHECK === 'true',
  },
  
  // Reduce build optimization for faster builds
  productionBrowserSourceMaps: false,
  
  // Optimize for low memory
  compress: true,
  poweredByHeader: false,
  
  // Optimize images
  images: {
    formats: ['image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96],
  },
  
  experimental: {
    // Use lighter build optimizations
    optimizePackageImports: ['lucide-react'],
  },
  
  // Optimize output for production
  output: 'standalone',
  
  // Reduce worker threads for build
  ...(process.env.NODE_ENV === 'production' && {
    experimental: {
      workerThreads: false,
      cpus: 1,
    },
  }),
  
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
