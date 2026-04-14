export interface UploadResult {
  url: string;
  publicId: string;
}

export interface IStorageProvider {
  uploadPdf(
    buffer: Buffer,
    folder: string,
    filename: string,
  ): Promise<UploadResult>;

  uploadFile(
    buffer: Buffer,
    folder: string,
    filename: string,
    mimeType: string,
  ): Promise<UploadResult>;
}

export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';
