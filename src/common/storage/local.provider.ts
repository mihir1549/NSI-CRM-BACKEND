import { Injectable, Logger } from '@nestjs/common';
import { IStorageProvider, UploadResult } from './storage-provider.interface.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';

@Injectable()
export class LocalStorageProvider implements IStorageProvider {
  private readonly logger = new Logger(LocalStorageProvider.name);

  async uploadPdf(
    buffer: Buffer,
    folder: string,
    filename: string,
  ): Promise<UploadResult> {
    const dir = resolve(process.cwd(), 'uploads', folder);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const filePath = resolve(dir, `${filename}.pdf`);
    writeFileSync(filePath, buffer);
    const url = `/uploads/${folder}/${filename}.pdf`;
    this.logger.log(`[LOCAL STORAGE] Saved PDF to ${filePath}`);
    return {
      url,
      publicId: `${folder}/${filename}`,
    };
  }

  async uploadFile(
    buffer: Buffer,
    folder: string,
    filename: string,
    mimeType: string,
  ): Promise<UploadResult> {
    const dir = resolve(process.cwd(), 'uploads', folder);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const filePath = resolve(dir, filename);
    writeFileSync(filePath, buffer);
    const url = `/uploads/${folder}/${filename}`;
    this.logger.log(`[LOCAL STORAGE] Saved file to ${filePath}`);
    return {
      url,
      publicId: filename,
    };
  }
}
