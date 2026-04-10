import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { IStorageProvider, UploadResult } from './storage-provider.interface.js';

@Injectable()
export class CloudflareR2StorageProvider implements IStorageProvider {
  private readonly logger = new Logger(CloudflareR2StorageProvider.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(private readonly configService: ConfigService) {
    const accountId = this.configService.get<string>('R2_ACCOUNT_ID') ?? '';
    const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID') ?? '';
    const secretAccessKey =
      this.configService.get<string>('R2_SECRET_ACCESS_KEY') ?? '';
    this.bucket = this.configService.get<string>('R2_BUCKET_NAME', 'nsi-platform');
    this.publicUrl = this.configService.get<string>('R2_PUBLIC_URL') ?? '';

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async uploadPdf(
    buffer: Buffer,
    folder: string,
    filename: string,
  ): Promise<UploadResult> {
    const key = `${folder}/${filename}.pdf`;

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: 'application/pdf',
          ContentDisposition: `inline; filename="${filename}.pdf"`,
        }),
      );

      const url = `${this.publicUrl}/${key}`;
      this.logger.log(`Uploaded PDF to R2: ${url}`);

      return { url, publicId: key };
    } catch (error) {
      this.logger.error(`R2 upload failed for ${key}`, error);
      throw error;
    }
  }
}
