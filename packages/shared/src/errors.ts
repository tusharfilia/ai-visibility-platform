/**
 * Error hierarchy for the AI Visibility Platform
 * Provides structured error handling with codes and serialization
 */

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: any;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    details?: any
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 422, details);
    this.name = 'ValidationError';
  }
}

export class ProviderError extends AppError {
  constructor(
    message: string,
    provider: string,
    details?: any
  ) {
    super(message, 'PROVIDER_ERROR', 502, { provider, ...details });
    this.name = 'ProviderError';
  }
}

export class RateLimitError extends AppError {
  constructor(
    message: string,
    retryAfter?: number,
    details?: any
  ) {
    super(message, 'RATE_LIMIT_ERROR', 429, { retryAfter, ...details });
    this.name = 'RateLimitError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 'AUTHENTICATION_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 'AUTHORIZATION_ERROR', 403);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id 
      ? `${resource} with id '${id}' not found`
      : `${resource} not found`;
    super(message, 'NOT_FOUND', 404, { resource, id });
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'CONFLICT', 409, details);
    this.name = 'ConflictError';
  }
}

export class BudgetExceededError extends AppError {
  constructor(workspaceId: string, engine: string, budget: number) {
    super(
      `Daily budget exceeded for ${engine} in workspace ${workspaceId}`,
      'BUDGET_EXCEEDED',
      402,
      { workspaceId, engine, budget }
    );
    this.name = 'BudgetExceededError';
  }
}

export class QuotaExceededError extends AppError {
  constructor(resource: string, limit: number) {
    super(
      `${resource} quota exceeded (limit: ${limit})`,
      'QUOTA_EXCEEDED',
      429,
      { resource, limit }
    );
    this.name = 'QuotaExceededError';
  }
}

// Error codes enum for consistency
export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  BUDGET_EXCEEDED: 'BUDGET_EXCEEDED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

// Utility function to create standardized API error responses
export function createErrorResponse(
  error: AppError
): { ok: false; error: { code: string; message: string; details?: any } } {
  return {
    ok: false,
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
    },
  };
}

// Utility function to handle unknown errors
export function handleUnknownError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(
      error.message,
      ErrorCodes.INTERNAL_ERROR,
      500,
      { originalError: error.name }
    );
  }

  return new AppError(
    'An unknown error occurred',
    ErrorCodes.INTERNAL_ERROR,
    500,
    { originalError: String(error) }
  );
}
