import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '@prisma/client';

export interface AuditLogEntry {
  actorUuid?: string;
  action: string;
  metadata: Record<string, unknown>;
  ipAddress: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Write an audit log entry. Fire-and-forget — never blocks the caller.
   * Errors are logged but never thrown to the caller.
   */
  log(entry: AuditLogEntry): void {
    this.prisma.auditLog
      .create({
        data: {
          actorUuid: entry.actorUuid || null,
          action: entry.action,
          metadata: entry.metadata as unknown as Prisma.InputJsonValue,
          ipAddress: entry.ipAddress,
        },
      })
      .then(() => {
        this.logger.debug(`Audit: ${entry.action} by ${entry.actorUuid || 'system'}`);
      })
      .catch((error: Error) => {
        this.logger.error(`Failed to write audit log: ${error.message}`, error.stack);
      });
  }
}
