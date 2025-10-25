/**
 * Correlation ID interceptor
 */

import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    
    // Get or generate correlation ID
    let correlationId = request.headers['x-request-id'] as string;
    if (!correlationId) {
      correlationId = uuidv4();
    }
    
    // Set correlation ID in response headers
    response.setHeader('x-request-id', correlationId);
    
    // Add correlation ID to request for logging
    (request as any).correlationId = correlationId;
    
    return next.handle().pipe(
      tap(() => {
        // Log request completion
        console.log(`Request completed: ${request.method} ${request.url} [${correlationId}]`);
      })
    );
  }
}
