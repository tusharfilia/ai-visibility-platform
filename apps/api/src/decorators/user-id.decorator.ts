import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator to extract user ID from JWT token
 */
export const GetUserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    // Extract user ID from JWT payload (set by JwtAuthGuard)
    return request.user?.sub || request.user?.id || request.user?.userId || '';
  },
);

