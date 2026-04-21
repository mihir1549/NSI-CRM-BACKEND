import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SseService } from './sse.service.js';
import { SseController } from './sse.controller.js';
import { SseAuthGuard } from './sse-auth.guard.js';
import { UsersModule } from '../users/users.module.js';

@Global()
@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [SseController],
  providers: [SseService, SseAuthGuard],
  exports: [SseService],
})
export class SseModule {}
