import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class DistributorSubscriptionHistoryService {
  private readonly logger = new Logger(
    DistributorSubscriptionHistoryService.name,
  );

  constructor(private readonly prisma: PrismaService) {}

  async log(data: {
    userUuid: string;
    planUuid?: string;
    razorpaySubscriptionId?: string;
    event: string;
    amount?: number;
    invoiceNumber?: string;
    notes?: string;
  }): Promise<void> {
    try {
      await this.prisma.distributorSubscriptionHistory.create({
        data: {
          userUuid: data.userUuid,
          planUuid: data.planUuid ?? null,
          razorpaySubscriptionId: data.razorpaySubscriptionId ?? null,
          event: data.event,
          amount: data.amount ?? null,
          invoiceNumber: data.invoiceNumber ?? null,
          notes: data.notes ?? null,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to log subscription history: ${(error as Error).message}`,
      );
    }
  }

  async getHistory(userUuid: string) {
    return this.prisma.distributorSubscriptionHistory.findMany({
      where: { userUuid },
      orderBy: { createdAt: 'desc' },
      include: {
        plan: { select: { name: true, amount: true } },
      },
    });
  }
}
