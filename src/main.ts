import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';

import { VersioningType } from '@nestjs/common';

async function bootstrap() {
  // rawBody: true enables req.rawBody (Buffer) — required for Razorpay webhook signature verification
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const logger = new Logger('Bootstrap');

  // ─── Security Headers (Helmet) ───────────────────
  // CSP is disabled in development so Swagger UI works
  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
    }),
  );

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
      // Allow ALL origins in development phase
      if (process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }

      // Allow requests with no origin (like Postman or server-to-server)
      if (!origin) {
        return callback(null, true);
      }
      
      const allowedOrigins = [
        process.env.FRONTEND_URL,
        'http://localhost:3000',
        'http://localhost:3000',
        'http://localhost:5173'
      ];

      // Allow if it's in the allowed list, OR if it's an ngrok/localtunnel URL
      if (
        allowedOrigins.includes(origin) || 
        origin.includes('ngrok-free') || 
        origin.includes('loca.lt') ||
        origin.includes('ngrok.app') ||
        origin.includes('ngrok.io') ||
        origin.includes('ngrok.dev') ||
        origin.startsWith('http://192.168') // Allow local network mobile testing
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

  // ─── Swagger / OpenAPI ───────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('NSI Platform API')
    .setDescription('CRM + LMS + Distributor Management Platform API Documentation')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter your JWT access token',
        in: 'header',
      },
      'access-token',
    )
    .addTag('Auth', 'Authentication & Profile')
    .addTag('Funnel', 'User Funnel Journey')
    .addTag('Funnel CMS', 'Admin Funnel Management')
    .addTag('LMS - User', 'Course Browsing & Learning')
    .addTag('LMS - Admin', 'Course Management')
    .addTag('LMS - Upload', 'File Upload to R2')
    .addTag('Leads', 'Lead Management')
    .addTag('Payment', 'Payment & Coupons')
    .addTag('Distributor', 'Distributor Dashboard & Tools')
    .addTag('Distributor - Admin', 'Admin Distributor Management')
    .addTag('Campaign', 'Campaign Management')
    .addTag('Admin - Users', 'User Management')
    .addTag('Admin - Analytics', 'Platform Analytics')
    .addTag('Webhook', 'Razorpay Webhooks')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

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
