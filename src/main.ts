import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js';

import { VersioningType } from '@nestjs/common';

async function bootstrap() {
  // rawBody: true enables req.rawBody (Buffer) — required for Razorpay webhook signature verification
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const logger = new Logger('Bootstrap');

  // ─── Global Prefix & API Versioning ────────────────
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // ─── Global Validation Pipe ──────────────────────
  // whitelist: true        → strips unknown properties
  // forbidNonWhitelisted   → rejects requests with unknown properties
  // transform: true        → auto-transforms payloads to DTO instances
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ─── Cookie Parser (for HttpOnly refresh tokens) ─
  app.use(cookieParser());

  // ─── Global Exception Filter ────────────────────
  app.useGlobalFilters(new HttpExceptionFilter());

  // ─── Global Logging Interceptor ──────────────────
  app.useGlobalInterceptors(new LoggingInterceptor());

  // ─── CORS ────────────────────────────────────────
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (like Postman or server-to-server)
      if (!origin) {
        return callback(null, true);
      }
      
      const allowedOrigins = [
        process.env.FRONTEND_URL,
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:5173'
      ];

      // Allow if it's in the allowed list, OR if it's an ngrok/localtunnel URL
      if (
        allowedOrigins.includes(origin) || 
        origin.includes('ngrok-free') || 
        origin.includes('loca.lt') ||
        origin.includes('ngrok.app') ||
        origin.includes('ngrok.io') ||
        origin.includes('ngrok.dev')
      ) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true, // Required for HttpOnly cookies
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // ─── Start Server ───────────────────────────────
  const port = process.env.PORT ?? 3000;
  await app.listen(port,'0.0.0.0');
  logger.log(`🚀 NSI Platform API running on port ${port}`);
  logger.log(`📧 Mail provider: ${process.env.MAIL_PROVIDER || 'mock'}`);
  logger.log(`📱 SMS provider: ${process.env.SMS_PROVIDER || 'mock'}`);
  logger.log(`💳 Payment provider: ${process.env.PAYMENT_PROVIDER || 'mock'}`);
  logger.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
}

bootstrap();
