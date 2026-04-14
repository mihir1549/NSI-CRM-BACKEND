import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

@Injectable()
export class CloudinaryAvatarService {
  private readonly logger = new Logger(CloudinaryAvatarService.name);

  constructor(private configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  async uploadAvatar(buffer: Buffer, userUuid: string): Promise<{ url: string }> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'nsi-avatars',
          public_id: `avatar-${userUuid}`,
          format: 'webp',
          transformation: [
            { width: 400, height: 400, crop: 'fill', gravity: 'face' }
          ]
        },
        (error, result: UploadApiResponse | undefined) => {
          if (error) {
            this.logger.error(`Cloudinary upload failed for user ${userUuid}`, error);
            return reject(new InternalServerErrorException('Failed to upload avatar image'));
          }
          if (!result) {
            this.logger.error(`Cloudinary upload returned no result for user ${userUuid}`);
            return reject(new InternalServerErrorException('Failed to upload avatar image'));
          }
          this.logger.log(`Avatar successfully uploaded to Cloudinary: ${result.secure_url}`);
          resolve({ url: result.secure_url });
        }
      );

      uploadStream.end(buffer);
    });
  }
}
