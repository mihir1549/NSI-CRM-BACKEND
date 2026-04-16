import {
  Body,
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { randomUUID } from 'crypto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import {
  STORAGE_PROVIDER,
  IStorageProvider,
} from '../common/storage/storage-provider.interface.js';

const THUMBNAIL_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp'];

@ApiTags('LMS - Upload')
@ApiBearerAuth('access-token')
@Controller({ path: 'admin/lms', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class LmsUploadController {
  constructor(
    @Inject(STORAGE_PROVIDER)
    private readonly storageProvider: IStorageProvider,
  ) {}

  /**
   * POST /api/v1/admin/lms/upload-pdf
   * Legacy PDF-only upload (kept for backwards compatibility).
   */
  @ApiOperation({ summary: 'Upload PDF attachment (legacy endpoint)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'PDF file' },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'PDF uploaded',
    schema: { properties: { url: { type: 'string' } } },
  })
  @ApiResponse({ status: 400, description: 'No file or invalid file type' })
  @Post('upload-pdf')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async uploadPdf(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Only PDF files are allowed.');
    }

    const filename = `lms-${Date.now()}-${randomUUID()}.pdf`;

    const result = await this.storageProvider.uploadFile(
      file.buffer,
      'nsi-lms-pdfs',
      filename,
      'application/pdf',
    );

    return { url: result.url };
  }

  /**
   * POST /api/v1/admin/lms/upload
   * General-purpose LMS file upload for thumbnails (images) and attachments (PDFs).
   * Body: multipart/form-data with fields:
   *   - file: binary file
   *   - folder: "thumbnails" | "attachments"
   */
  @ApiOperation({ summary: 'Upload file (thumbnail or PDF attachment)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File to upload',
        },
        folder: {
          type: 'string',
          enum: ['thumbnails', 'attachments'],
          description: 'Target folder',
        },
      },
      required: ['file', 'folder'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'File uploaded',
    schema: {
      properties: {
        url: {
          type: 'string',
          example: 'https://r2-url/nsi-thumbnails/UPLOAD-xxx.jpg',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'No file, invalid folder, or invalid file type',
  })
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB safety net
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('folder') folder: string,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const validFolders = ['thumbnails', 'attachments'];
    if (!folder || !validFolders.includes(folder)) {
      throw new BadRequestException(
        'Invalid folder. Accepted: thumbnails, attachments',
      );
    }

    if (
      folder === 'thumbnails' &&
      !THUMBNAIL_MIMETYPES.includes(file.mimetype)
    ) {
      throw new BadRequestException(
        'Invalid file type for thumbnails. Accepted: JPG, PNG, WEBP',
      );
    }

    if (folder === 'attachments' && file.mimetype !== 'application/pdf') {
      throw new BadRequestException(
        'Invalid file type for attachments. Accepted: PDF',
      );
    }

    const folderMap: Record<string, string> = {
      thumbnails: 'nsi-thumbnails',
      attachments: 'nsi-attachments',
    };

    const r2Folder = folderMap[folder];
    const ext = file.originalname.split('.').pop() ?? 'bin';
    const uniqueName = `UPLOAD-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

    const result = await this.storageProvider.uploadFile(
      file.buffer,
      r2Folder,
      uniqueName,
      file.mimetype,
    );

    return { url: result.url };
  }
}
