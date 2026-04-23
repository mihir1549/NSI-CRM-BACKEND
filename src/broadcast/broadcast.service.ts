import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateBroadcastDto } from './dto/create-broadcast.dto.js';
import { SseService } from '../sse/sse.service.js';

@Injectable()
export class BroadcastService {
  private readonly logger = new Logger(BroadcastService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sseService: SseService,
  ) {}

  // ─── METHOD 1: Admin creates broadcast/announcement ───────────────────────
  async createAdminBroadcast(dto: CreateBroadcastDto, adminUuid: string) {
    const isAnnouncement = dto.type === 'ANNOUNCEMENT';

    const broadcast = await this.prisma.broadcastMessage.create({
      data: {
        type: dto.type,
        title: dto.title,
        shortMessage: dto.shortMessage,
        fullContent: dto.fullContent ?? null,
        link: dto.link ?? null,
        // Announcements target everyone — ignore role/uuid filters
        targetRole: isAnnouncement
          ? null
          : dto.targetRole === 'ALL'
            ? null
            : (dto.targetRole ?? null),
        targetUuids: isAnnouncement ? [] : (dto.targetUuids ?? []),
        createdByUuid: adminUuid,
        createdByRole: 'SUPER_ADMIN',
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });

    this.logger.log(
      `Admin ${adminUuid} created ${dto.type} broadcast ${broadcast.uuid}`,
    );

    // ─── Real-time delivery via SSE ──────────────────────────────────────────
    const sseData = {
      broadcastUuid: broadcast.uuid,
      title: broadcast.title,
      type: broadcast.type,
      shortMessage: broadcast.shortMessage,
      link: broadcast.link ?? null,
    };

    if (isAnnouncement || dto.targetRole === 'ALL' || !dto.targetRole) {
      this.sseService.sendToRole('CUSTOMER', {
        type: 'broadcast',
        data: sseData,
      });
      this.sseService.sendToRole('DISTRIBUTOR', {
        type: 'broadcast',
        data: sseData,
      });
    } else if (dto.targetUuids && dto.targetUuids.length > 0) {
      dto.targetUuids.forEach((uuid) =>
        this.sseService.sendToUser(uuid, { type: 'broadcast', data: sseData }),
      );
    } else if (dto.targetRole) {
      this.sseService.sendToRole(dto.targetRole, {
        type: 'broadcast',
        data: sseData,
      });
    }

    return broadcast;
  }

  // ─── METHOD 2: Distributor creates broadcast ──────────────────────────────
  async createDistributorBroadcast(
    dto: CreateBroadcastDto,
    distributorUuid: string,
  ) {
    let filteredUuids: string[] = [];

    if (dto.targetUuids && dto.targetUuids.length > 0) {
      // Silently filter to only uuids that belong to this distributor
      const referredLeads = await this.prisma.lead.findMany({
        where: {
          distributorUuid,
          userUuid: { in: dto.targetUuids },
        },
        select: { userUuid: true },
      });
      filteredUuids = referredLeads.map((l) => l.userUuid);
    }

    const broadcast = await this.prisma.broadcastMessage.create({
      data: {
        type: 'BROADCAST',
        title: dto.title,
        shortMessage: dto.shortMessage,
        fullContent: dto.fullContent ?? null,
        link: dto.link ?? null,
        targetRole: null,
        targetUuids: filteredUuids,
        createdByUuid: distributorUuid,
        createdByRole: 'DISTRIBUTOR',
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });

    this.logger.log(
      `Distributor ${distributorUuid} created broadcast ${broadcast.uuid}`,
    );

    // ─── Real-time delivery via SSE ──────────────────────────────────────────
    const sseData = {
      broadcastUuid: broadcast.uuid,
      title: broadcast.title,
      type: 'BROADCAST',
      shortMessage: broadcast.shortMessage,
    };

    if (filteredUuids.length > 0) {
      filteredUuids.forEach((uuid) =>
        this.sseService.sendToUser(uuid, { type: 'broadcast', data: sseData }),
      );
    } else {
      // Targets all leads referred by this distributor
      const allReferred = await this.prisma.lead.findMany({
        where: { distributorUuid },
        select: { userUuid: true },
      });
      allReferred.forEach((l) =>
        this.sseService.sendToUser(l.userUuid, {
          type: 'broadcast',
          data: sseData,
        }),
      );
    }

    return broadcast;
  }

  // ─── METHOD 3: Get active broadcasts for a user ───────────────────────────
  async getActiveBroadcastsForUser(
    userUuid: string,
    userRole: string,
    distributorUuid?: string,
  ) {
    const now = new Date();

    // Fetch all potentially visible active broadcasts
    const allActive = await this.prisma.broadcastMessage.findMany({
      where: {
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { createdAt: 'desc' },
    });

    // Fetch dismissed broadcast uuids for this user
    const readRecords = await this.prisma.broadcastRead.findMany({
      where: { userUuid },
      select: { broadcastUuid: true },
    });
    const dismissedUuids = new Set(readRecords.map((r) => r.broadcastUuid));

    // Fetch lead info: find if this user was referred by any distributor
    const userLead = await this.prisma.lead.findUnique({
      where: { userUuid },
      select: { distributorUuid: true },
    });
    const userDistributorUuid = userLead?.distributorUuid ?? null;

    const announcements: typeof allActive = [];
    const broadcasts: typeof allActive = [];

    for (const msg of allActive) {
      const isVisible = this.isVisibleToUser(
        msg,
        userUuid,
        userRole,
        userDistributorUuid,
      );
      if (!isVisible) continue;

      if (msg.type === 'ANNOUNCEMENT') {
        announcements.push(msg);
      } else {
        // Exclude dismissed broadcasts
        if (!dismissedUuids.has(msg.uuid)) {
          broadcasts.push(msg);
        }
      }
    }

    return {
      announcements: announcements.map((m) => ({
        uuid: m.uuid,
        title: m.title,
        shortMessage: m.shortMessage,
        fullContent: m.fullContent,
        link: m.link,
        createdAt: m.createdAt,
        expiresAt: m.expiresAt,
      })),
      broadcasts: broadcasts.map((m) => ({
        uuid: m.uuid,
        title: m.title,
        shortMessage: m.shortMessage,
        fullContent: m.fullContent,
        link: m.link,
        createdByRole: m.createdByRole,
        createdAt: m.createdAt,
        expiresAt: m.expiresAt,
      })),
      unreadCount: broadcasts.length,
    };
  }

  // ─── Targeting logic ──────────────────────────────────────────────────────
  private isVisibleToUser(
    msg: {
      createdByRole: string;
      createdByUuid: string;
      targetRole: string | null;
      targetUuids: string[];
    },
    userUuid: string,
    userRole: string,
    userDistributorUuid: string | null,
  ): boolean {
    if (msg.createdByRole === 'SUPER_ADMIN') {
      // a. targetRole null + targetUuids empty → CUSTOMER + DISTRIBUTOR only (USER excluded)
      if (!msg.targetRole && msg.targetUuids.length === 0) {
        return userRole === 'CUSTOMER' || userRole === 'DISTRIBUTOR';
      }
      // b. targetRole matches user role
      if (msg.targetRole && msg.targetRole === userRole && msg.targetUuids.length === 0) return true;
      // c. userUuid in targetUuids (direct target, regardless of targetRole)
      if (msg.targetUuids.includes(userUuid)) return true;
      return false;
    }

    if (msg.createdByRole === 'DISTRIBUTOR') {
      // d. userUuid in targetUuids → direct distributor target
      if (msg.targetUuids.includes(userUuid)) return true;
      // e. targetUuids empty + user was referred by this distributor
      if (
        msg.targetUuids.length === 0 &&
        userDistributorUuid === msg.createdByUuid
      ) {
        return true;
      }
      return false;
    }

    return false;
  }

  // ─── METHOD 4: Dismiss a broadcast ───────────────────────────────────────
  async dismissBroadcast(broadcastUuid: string, userUuid: string) {
    const broadcast = await this.prisma.broadcastMessage.findUnique({
      where: { uuid: broadcastUuid },
    });

    if (!broadcast) {
      throw new NotFoundException(`Broadcast ${broadcastUuid} not found`);
    }

    if (broadcast.type === 'ANNOUNCEMENT') {
      throw new BadRequestException('Announcements cannot be dismissed');
    }

    await this.prisma.broadcastRead.createMany({
      data: [{ broadcastUuid, userUuid }],
      skipDuplicates: true,
    });

    return { message: 'Dismissed' };
  }

  // ─── METHOD 5: Admin paginated list ──────────────────────────────────────
  async getAdminBroadcasts(page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      this.prisma.broadcastMessage.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { reads: true } } },
      }),
      this.prisma.broadcastMessage.count(),
    ]);

    const data = messages.map((m) => ({
      uuid: m.uuid,
      type: m.type,
      title: m.title,
      shortMessage: m.shortMessage,
      fullContent: m.fullContent,
      link: m.link,
      targetRole: m.targetRole,
      targetUuids: m.targetUuids,
      createdByUuid: m.createdByUuid,
      createdByRole: m.createdByRole,
      isActive: m.isActive,
      expiresAt: m.expiresAt,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      readCount: m._count.reads,
    }));

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── METHOD 6: Distributor paginated list ────────────────────────────────
  async getDistributorBroadcasts(
    distributorUuid: string,
    page: number,
    limit: number,
  ) {
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      this.prisma.broadcastMessage.findMany({
        where: { createdByUuid: distributorUuid },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { reads: true } } },
      }),
      this.prisma.broadcastMessage.count({
        where: { createdByUuid: distributorUuid },
      }),
    ]);

    const data = messages.map((m) => ({
      uuid: m.uuid,
      type: m.type,
      title: m.title,
      shortMessage: m.shortMessage,
      fullContent: m.fullContent,
      link: m.link,
      targetRole: m.targetRole,
      targetUuids: m.targetUuids,
      createdByUuid: m.createdByUuid,
      createdByRole: m.createdByRole,
      isActive: m.isActive,
      expiresAt: m.expiresAt,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      readCount: m._count.reads,
    }));

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── METHOD 7: Deactivate a broadcast ────────────────────────────────────
  async deactivateBroadcast(
    broadcastUuid: string,
    requesterUuid: string,
    requesterRole: string,
  ) {
    const broadcast = await this.prisma.broadcastMessage.findUnique({
      where: { uuid: broadcastUuid },
    });

    if (!broadcast) {
      throw new NotFoundException(`Broadcast ${broadcastUuid} not found`);
    }

    if (
      requesterRole === 'DISTRIBUTOR' &&
      broadcast.createdByUuid !== requesterUuid
    ) {
      throw new ForbiddenException(
        'You can only deactivate your own broadcasts',
      );
    }

    await this.prisma.broadcastMessage.update({
      where: { uuid: broadcastUuid },
      data: { isActive: false },
    });

    this.logger.log(
      `Broadcast ${broadcastUuid} deactivated by ${requesterUuid} (${requesterRole})`,
    );
    return { message: 'Deactivated' };
  }

  // ─── METHOD 8: Get broadcast detail ──────────────────────────────────────
  async getBroadcastDetail(
    broadcastUuid: string,
    userUuid: string,
    userRole: string,
  ) {
    const broadcast = await this.prisma.broadcastMessage.findUnique({
      where: { uuid: broadcastUuid },
    });

    if (!broadcast) {
      throw new NotFoundException(`Broadcast ${broadcastUuid} not found`);
    }

    const now = new Date();
    if (
      !broadcast.isActive ||
      (broadcast.expiresAt && broadcast.expiresAt < now)
    ) {
      throw new NotFoundException(`Broadcast ${broadcastUuid} not found`);
    }

    // Fetch user's distributor attribution
    const userLead = await this.prisma.lead.findUnique({
      where: { userUuid },
      select: { distributorUuid: true },
    });
    const userDistributorUuid = userLead?.distributorUuid ?? null;

    const isVisible = this.isVisibleToUser(
      broadcast,
      userUuid,
      userRole,
      userDistributorUuid,
    );

    if (!isVisible) {
      throw new NotFoundException(`Broadcast ${broadcastUuid} not found`);
    }

    // Auto-mark as read for BROADCAST type
    if (broadcast.type === 'BROADCAST') {
      void this.prisma.broadcastRead
        .createMany({
          data: [{ broadcastUuid, userUuid }],
          skipDuplicates: true,
        })
        .catch((err: unknown) =>
          this.logger.error(
            `Failed to mark broadcast ${broadcastUuid} as read: ${(err as Error).message}`,
          ),
        );
    }

    return {
      uuid: broadcast.uuid,
      type: broadcast.type,
      title: broadcast.title,
      shortMessage: broadcast.shortMessage,
      fullContent: broadcast.fullContent,
      link: broadcast.link,
      targetRole: broadcast.targetRole,
      targetUuids: broadcast.targetUuids,
      createdByUuid: broadcast.createdByUuid,
      createdByRole: broadcast.createdByRole,
      isActive: broadcast.isActive,
      expiresAt: broadcast.expiresAt,
      createdAt: broadcast.createdAt,
      updatedAt: broadcast.updatedAt,
    };
  }
}
