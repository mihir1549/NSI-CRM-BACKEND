import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import {
  STORAGE_PROVIDER,
  IStorageProvider,
} from '../common/storage/storage-provider.interface.js';

/**
 * CertificateService — generates PDF certificates for completed courses.
 * All generation is fire-and-forget; errors are logged, never thrown to callers.
 */
@Injectable()
export class CertificateService {
  private readonly logger = new Logger(CertificateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    @Inject(STORAGE_PROVIDER)
    private readonly storageProvider: IStorageProvider,
  ) {}

  /**
   * Generate a certificate for a completed enrollment. Fire-and-forget.
   * Call this without awaiting.
   */
  generateForEnrollment(enrollmentUuid: string): void {
    this.doGenerate(enrollmentUuid).catch((err: Error) => {
      this.logger.error(
        `Certificate generation failed for enrollment=${enrollmentUuid}: ${err.message}`,
        err.stack,
      );
    });
  }

  /**
   * Get or generate a certificate for an enrollment.
   * Returns the certificateUrl and certificateId.
   */
  async getOrGenerate(
    enrollmentUuid: string,
  ): Promise<{ certificateUrl: string; certificateId: string }> {
    const enrollment = await this.prisma.courseEnrollment.findUnique({
      where: { uuid: enrollmentUuid },
      include: { user: true, course: true },
    });

    if (!enrollment) {
      throw new Error('Enrollment not found');
    }

    if (enrollment.certificateUrl) {
      // Extract certificateId from filename
      const parts = enrollment.certificateUrl.split('/');
      const filename = parts[parts.length - 1] ?? '';
      const certId = filename.replace('.pdf', '');
      return {
        certificateUrl: enrollment.certificateUrl,
        certificateId: certId,
      };
    }

    return this.doGenerate(enrollmentUuid);
  }

  // ─── INTERNAL GENERATION ─────────────────────────────────

  private async doGenerate(
    enrollmentUuid: string,
  ): Promise<{ certificateUrl: string; certificateId: string }> {
    const enrollment = await this.prisma.courseEnrollment.findUnique({
      where: { uuid: enrollmentUuid },
      include: { user: true, course: true },
    });

    if (!enrollment) throw new Error('Enrollment not found');
    if (!enrollment.completedAt) throw new Error('Course not completed yet');

    // If already generated, return existing
    if (enrollment.certificateUrl) {
      const parts = enrollment.certificateUrl.split('/');
      const filename = parts[parts.length - 1] ?? '';
      const certId = filename.replace('.pdf', '');
      return {
        certificateUrl: enrollment.certificateUrl,
        certificateId: certId,
      };
    }

    const certificateId = `CERT-${this.generateCertId()}`;

    const html = this.buildCertificateHtml(
      enrollment.user.fullName,
      enrollment.course.title,
      enrollment.completedAt,
      certificateId,
    );

    const pdfBuffer = await this.generatePdf(html);

    const uploaded = await this.storageProvider.uploadPdf(
      pdfBuffer,
      'nsi-certificates',
      certificateId,
    );

    const certificateUrl = uploaded.url;

    await this.prisma.courseEnrollment.update({
      where: { uuid: enrollmentUuid },
      data: { certificateUrl },
    });

    // Fire-and-forget certificate email
    this.mailService.sendCertificateReady(
      enrollment.user.email,
      enrollment.user.fullName,
      enrollment.course.title,
      certificateUrl,
    );

    this.logger.log(
      `Certificate generated: ${certificateId} for user=${enrollment.userUuid} course=${enrollment.courseUuid}`,
    );

    return { certificateUrl, certificateId };
  }

  private async generatePdf(html: string): Promise<Buffer> {
    try {
      // Dynamic import to avoid hard crash if puppeteer is not fully initialized
      const puppeteer = await import('puppeteer');
      const browser = await puppeteer.default.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        format: 'A4',
        landscape: true,
        printBackground: true,
      });
      await browser.close();
      return Buffer.from(pdf);
    } catch (err) {
      this.logger.error(
        `Puppeteer PDF generation failed: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      throw new Error('PDF generation unavailable');
    }
  }

  private buildCertificateHtml(
    studentName: string,
    courseTitle: string,
    completedAt: Date,
    certificateId: string,
  ): string {
    const completionDate = completedAt.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Certificate of Completion</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Georgia', serif;
      background: #fefefe;
      width: 297mm;
      height: 210mm;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .certificate {
      width: 270mm;
      height: 190mm;
      border: 8px double #c9a84c;
      padding: 30px 50px;
      text-align: center;
      position: relative;
      background: linear-gradient(135deg, #fffdf5 0%, #fff8e7 50%, #fffdf5 100%);
    }
    .inner-border {
      position: absolute;
      top: 12px; left: 12px; right: 12px; bottom: 12px;
      border: 2px solid #c9a84c;
      pointer-events: none;
    }
    .org-name {
      font-size: 28px;
      font-weight: bold;
      color: #1a3a5c;
      letter-spacing: 3px;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .org-tagline {
      font-size: 13px;
      color: #7a6030;
      letter-spacing: 1px;
      margin-bottom: 20px;
    }
    .cert-title {
      font-size: 42px;
      color: #c9a84c;
      font-style: italic;
      margin-bottom: 10px;
    }
    .presented-to {
      font-size: 14px;
      color: #555;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .student-name {
      font-size: 44px;
      color: #1a3a5c;
      font-weight: bold;
      margin-bottom: 16px;
      font-style: italic;
    }
    .completion-text {
      font-size: 15px;
      color: #444;
      margin-bottom: 6px;
    }
    .course-title {
      font-size: 22px;
      color: #1a3a5c;
      font-weight: bold;
      margin-bottom: 20px;
    }
    .date-line {
      font-size: 13px;
      color: #666;
      margin-bottom: 30px;
    }
    .signatures {
      display: flex;
      justify-content: space-around;
      align-items: flex-end;
      margin-top: 10px;
    }
    .sig-block {
      text-align: center;
      width: 180px;
    }
    .sig-line {
      border-top: 1px solid #555;
      margin-bottom: 6px;
      padding-top: 6px;
    }
    .sig-name {
      font-size: 13px;
      font-weight: bold;
      color: #1a3a5c;
    }
    .sig-title {
      font-size: 11px;
      color: #888;
    }
    .cert-id {
      position: absolute;
      bottom: 22px;
      right: 30px;
      font-size: 10px;
      color: #aaa;
    }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="inner-border"></div>
    <div class="org-name">NSI Platform</div>
    <div class="org-tagline">Network Success Institute</div>
    <div class="cert-title">Certificate of Completion</div>
    <div class="presented-to">This is to certify that</div>
    <div class="student-name">${this.escapeHtml(studentName)}</div>
    <div class="completion-text">has successfully completed the course</div>
    <div class="course-title">${this.escapeHtml(courseTitle)}</div>
    <div class="date-line">Completed on <strong>${completionDate}</strong></div>
    <div class="signatures">
      <div class="sig-block">
        <div class="sig-line">
          <div class="sig-name">Nageshwar Shukla</div>
          <div class="sig-title">Director, NSI Platform</div>
        </div>
      </div>
    </div>
    <div class="cert-id">Certificate ID: ${certificateId}</div>
  </div>
</body>
</html>`;
  }

  private generateCertId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
