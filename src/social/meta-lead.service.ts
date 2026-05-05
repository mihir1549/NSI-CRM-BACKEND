import { Injectable, NotFoundException } from '@nestjs/common';
import { MetaLead } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

export interface PaginatedMetaLeads<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class MetaLeadService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyMetaLeads(
    distributorUuid: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedMetaLeads<MetaLead>> {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.metaLead.findMany({
        where: { distributorUuid },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.metaLead.count({ where: { distributorUuid } }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getAllMetaLeadsAdmin(
    page = 1,
    limit = 20,
  ): Promise<
    PaginatedMetaLeads<
      MetaLead & {
        distributor: { fullName: string; distributorCode: string | null } | null;
      }
    >
  > {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.metaLead.findMany({
        skip,
        take: limit,
        include: {
          distributor: {
            select: { fullName: true, distributorCode: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.metaLead.count(),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async markConverted(
    metaLeadUuid: string,
    userUuid: string,
  ): Promise<MetaLead> {
    const existing = await this.prisma.metaLead.findUnique({
      where: { uuid: metaLeadUuid },
    });
    if (!existing) {
      throw new NotFoundException('Meta lead not found');
    }

    return this.prisma.metaLead.update({
      where: { uuid: metaLeadUuid },
      data: {
        status: 'CONVERTED',
        userUuid,
      },
    });
  }
}
