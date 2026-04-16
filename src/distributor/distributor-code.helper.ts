import { InternalServerErrorException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const MAX_RETRIES = 5;

/**
 * Generate a unique distributor code in format "NSI-XXXXXXXX" (6 alphanumeric chars).
 * Retries up to 5 times on collision. Always generates a fresh code — never reuses old.
 */
export async function generateDistributorCode(
  prisma: PrismaService,
): Promise<string> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    let suffix = '';
    for (let i = 0; i < 6; i++) {
      suffix += CHARS[Math.floor(Math.random() * CHARS.length)];
    }
    const code = `NSI-${suffix}`;

    const existing = await prisma.user.findFirst({
      where: { distributorCode: code },
      select: { uuid: true },
    });

    if (!existing) {
      return code;
    }
  }

  throw new InternalServerErrorException(
    'Failed to generate a unique distributor code after 5 retries',
  );
}
