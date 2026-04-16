import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import {
  IStorageProvider,
  UploadResult,
} from './storage-provider.interface.js';

@Injectable()
export class CloudflareR2StorageProvider implements IStorageProvider {
  private readonly logger = new Logger(CloudflareR2StorageProvider.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(private readonly configService: ConfigService) {
    const accountId = this.configService.get<string>('R2_ACCOUNT_ID') ?? '';
    const accessKeyId =
      this.configService.get<string>('R2_ACCESS_KEY_ID') ?? '';
    const secretAccessKey =
      this.configService.get<string>('R2_SECRET_ACCESS_KEY') ?? '';
    this.bucket = this.configService.get<string>(
      'R2_BUCKET_NAME',
      'nsi-platform',
    );
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

  async uploadFile(
    buffer: Buffer,
    folder: string,
    filename: string,
    mimeType: string,
  ): Promise<UploadResult> {
    const isImage = mimeType.startsWith('image/');
    // If it's not a generic file but say an image, let's just use filename exactly
    // but typically filename passed in might not have extension.
    // If it's a PDF, etc. The instructions say: "Same as uploadPdf() but use mimeType parameter for ContentType"
    const extension = mimeType.split('/')[1] || 'bin';
    // If filename already has an extension, we shouldn't append it again. But let's follow the pattern of uploadPdf which appends .pdf
    // Wait, the instruction says: "Same as uploadPdf() but use mimeType parameter for ContentType. Not hardcoded to application/pdf"
    const key = `${folder}/${filename}`;

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
          ContentDisposition: `inline; filename="${filename}"`,
        }),
      );

      const url = `${this.publicUrl}/${key}`;
      this.logger.log(`Uploaded file to R2: ${url}`);

      return { url, publicId: key };
    } catch (error) {
      this.logger.error(`R2 file upload failed for ${key}`, error);
      throw error;
    }
  }
}
