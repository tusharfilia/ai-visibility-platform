/**
 * Global exception filter
 */

import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { createErrorResponse } from '@ai-visibility/shared';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_ERROR';
    let details: any = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as any;
        message = responseObj.message || exception.message;
        code = responseObj.code || 'HTTP_ERROR';
        details = responseObj.details;
      } else {
        message = exception.message;
        code = 'HTTP_ERROR';
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      code = 'APPLICATION_ERROR';
    }

    // Log the error
    console.error('Exception caught:', {
      status,
      message,
      code,
      url: request.url,
      method: request.method,
      headers: request.headers,
      body: request.body,
      stack: exception instanceof Error ? exception.stack : undefined,
    });

    // Send error response
    const errorResponse = createErrorResponse({
      code,
      message,
      details,
    });

    response.status(status).json(errorResponse);
  }
}
