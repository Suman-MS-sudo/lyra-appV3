import { NextRequest, NextResponse } from 'next/server';
import { handleError } from '@/lib/error-handler';

export function createApiHandler(
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      return await handler(request);
    } catch (error) {
      return handleError(error);
    }
  };
}

export function jsonResponse<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function successResponse<T>(data: T, message?: string): NextResponse {
  return jsonResponse({
    success: true,
    data,
    ...(message && { message }),
  });
}

export function errorResponse(message: string, code: string, status: number = 400): NextResponse {
  return jsonResponse(
    {
      success: false,
      error: {
        message,
        code,
      },
    },
    status
  );
}
