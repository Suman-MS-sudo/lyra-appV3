export const config = {
  app: {
    name: 'Lyra',
    description: 'Enterprise Vending Machine Management System',
    url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  },
  auth: {
    sessionDuration: 60 * 60 * 24 * 7, // 7 days in seconds
    passwordMinLength: 8,
  },
  rateLimit: {
    api: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 100,
    },
    auth: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 5,
    },
  },
  pagination: {
    defaultLimit: 20,
    maxLimit: 100,
  },
  features: {
    analytics: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
    errorTracking: process.env.NEXT_PUBLIC_ENABLE_ERROR_TRACKING === 'true',
  },
} as const;
