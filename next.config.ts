import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Skip TypeScript type checking during build (run separately with `npm run lint`)
  typescript: {
    ignoreBuildErrors: process.env.SKIP_TYPE_CHECK === 'true',
  },

  productionBrowserSourceMaps: false,
  compress: true,
  poweredByHeader: false,

  // Optimize images
  images: {
    formats: ['image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96],
  },

  experimental: {
    optimizePackageImports: ['lucide-react'],
    // Server Actions compare the request's Origin header against this list
    // as a CSRF guard. lyra-app.co.in is a custom domain proxied onto the
    // lyra-app-v3-chi.vercel.app deployment, so the browser's Origin
    // (lyra-app.co.in) doesn't match the deployment's own host -- without
    // this, every Server Action submitted from the custom domain is
    // rejected with "Invalid Server Actions request" before any of our
    // code runs.
    serverActions: {
      allowedOrigins: ['lyra-app.co.in', 'www.lyra-app.co.in', 'lyra-app-v3-chi.vercel.app'],
    },
  },

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
