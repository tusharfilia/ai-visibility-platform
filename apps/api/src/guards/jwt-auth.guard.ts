/**
 * JWT authentication guard with DEBUG_JWT_MODE support
 */

import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | import('rxjs').Observable<boolean> {
    const debug = process.env.DEBUG_JWT_MODE === 'true' && process.env.NODE_ENV !== 'production';
    if (debug) {
      const req = context.switchToHttp().getRequest();
      // If no bearer or invalid, inject a debug user
      if (!req.headers.authorization) {
        req.user = { sub: 'debug-user', email: 'debug@example.com', workspaceId: 'debug-ws' };
        return true;
      }
    }
    return super.canActivate(context);
  }
}
