import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CloudinaryAvatarService } from './cloudinary-avatar.service.js';

@Module({
  imports: [ConfigModule],
  providers: [CloudinaryAvatarService],
  exports: [CloudinaryAvatarService],
})
export class CloudinaryModule {}
