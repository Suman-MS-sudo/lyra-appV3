import { NextResponse } from 'next/server';
import { AppError } from './errors';
import { logger } from './logger';

export function handleError(error: unknown): NextResponse {
  logger.error('Error occurred', error);

  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: {
          message: error.message,
          code: error.code,
          ...(error instanceof ValidationError && error.field ? { field: error.field } : {}),
        },
      },
      { status: error.statusCode }
    );
  }

  // Handle Supabase errors
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const dbError = error as { code: string; message: string };
    
    // PostgreSQL error codes
    if (dbError.code === '23505') {
      return NextResponse.json(
        { error: { message: 'Resource already exists', code: 'DUPLICATE_ENTRY' } },
        { status: 409 }
      );
    }
    
    if (dbError.code === '23503') {
      return NextResponse.json(
        { error: { message: 'Related resource not found', code: 'FOREIGN_KEY_VIOLATION' } },
        { status: 400 }
      );
    }
  }

  // Generic error response
  return NextResponse.json(
    {
      error: {
        message: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'An unexpected error occurred')
          : 'An unexpected error occurred',
        code: 'INTERNAL_SERVER_ERROR',
      },
    },
    { status: 500 }
  );
}

export class ValidationError extends AppError {
  constructor(message: string, public field?: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}
