import { NextRequest, NextResponse } from 'next/server';
import { RateLimitError } from './errors';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

export class RateLimiter {
  private windowMs: number;
  private maxRequests: number;

  constructor(windowMs: number = 60000, maxRequests: number = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  private getKey(request: NextRequest): string {
    // Use IP address or user ID as key
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : 'unknown';
    return ip;
  }

  check(request: NextRequest): { allowed: boolean; remaining: number; resetTime: number } {
    const key = this.getKey(request);
    const now = Date.now();

    if (!store[key] || now > store[key].resetTime) {
      store[key] = {
        count: 1,
        resetTime: now + this.windowMs,
      };
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetTime: store[key].resetTime,
      };
    }

    store[key].count++;

    if (store[key].count > this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: store[key].resetTime,
      };
    }

    return {
      allowed: true,
      remaining: this.maxRequests - store[key].count,
      resetTime: store[key].resetTime,
    };
  }
}

export function withRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse>,
  limiter: RateLimiter = new RateLimiter()
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const { allowed, remaining, resetTime } = limiter.check(request);

    if (!allowed) {
      const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
      return NextResponse.json(
        { error: { message: 'Too many requests', code: 'RATE_LIMIT_EXCEEDED' } },
        {
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': limiter['maxRequests'].toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': resetTime.toString(),
          },
        }
      );
    }

    const response = await handler(request);
    
    response.headers.set('X-RateLimit-Limit', limiter['maxRequests'].toString());
    response.headers.set('X-RateLimit-Remaining', remaining.toString());
    response.headers.set('X-RateLimit-Reset', resetTime.toString());

    return response;
  };
}
