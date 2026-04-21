import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, url, ip } = request;
    const userAgent = request.get('User-Agent') || 'unknown';
    const now = Date.now();

    this.logger.log(`→ ${method} ${url} | IP: ${ip} | UA: ${userAgent}`);

    // Skip response-time logging for SSE streams (they never complete)
    const contentType = response.getHeader('content-type');
    if (
      typeof contentType === 'string' &&
      contentType.includes('text/event-stream')
    ) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        const responseTime = Date.now() - now;
        this.logger.log(`← ${method} ${url} | ${responseTime}ms`);
      }),
    );
  }
}
