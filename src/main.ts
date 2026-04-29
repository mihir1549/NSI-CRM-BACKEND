// See docs/DEPLOYMENT-TIMEZONE.md — TZ=Asia/Kolkata must be set at system level
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

  // ─── Trust Proxy (Cloudflare) ────────────────────
  // Tells Express to trust the first upstream proxy so that req.ip returns
  // the real client IP from the CF-Connecting-IP / X-Forwarded-For header.
  (app.getHttpAdapter().getInstance() as import('express').Express).set(
    'trust proxy',
    1,
  );

  // ─── Security Headers (Helmet) ───────────────────
  // CSP is disabled in development so Swagger UI works
  app.use(
    helmet({
      contentSecurityPolicy:
        process.env.NODE_ENV === 'production' ? undefined : false,
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
    origin: [
      'https://growithnsi.com',
      'https://www.growithnsi.com',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Cache-Control',
    ],
    exposedHeaders: ['Set-Cookie'],
  });

  // ─── Swagger / OpenAPI ───────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('NSI Platform API')
    .setDescription(
      'CRM + LMS + Distributor Management Platform API Documentation',
    )
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
  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 NSI Platform API running on port ${port}`);
  logger.log(`📧 Mail provider: ${process.env.MAIL_PROVIDER || 'mock'}`);
  logger.log(`📱 SMS provider: ${process.env.SMS_PROVIDER || 'mock'}`);
  logger.log(`💳 Payment provider: ${process.env.PAYMENT_PROVIDER || 'mock'}`);
  logger.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
}

void bootstrap();
