import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { LeadStatus, LeadAction, UserRole, Prisma } from '@prisma/client';
import type { UpdateLeadStatusDto } from './dto/update-lead-status.dto.js';
import type { AdminUpdateLeadStatusDto } from './dto/admin-update-lead-status.dto.js';

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ─── TRIGGER: User profile completed (status → ACTIVE) ──────────────────────

  /**
   * Create a Lead record when a user's status becomes ACTIVE (country selected).
   * Idempotent — silently skips if lead already exists.
   * assignedToUuid = distributorUuid if referred, else first SUPER_ADMIN.
   */
  async createLeadForUser(userUuid: string): Promise<void> {
    try {
      // Idempotent guard
      const existing = await this.prisma.lead.findUnique({
        where: { userUuid },
      });
      if (existing) return;

      // Look up acquisition data for distributor attribution
      const acquisition = await this.prisma.userAcquisition.findUnique({
        where: { userUuid },
      });
      const distributorUuid = acquisition?.distributorUuid ?? null;

      // Determine assignedToUuid
      let assignedToUuid: string;
      if (distributorUuid) {
        assignedToUuid = distributorUuid;
      } else {
        const superAdmin = await this.prisma.user.findFirst({
          where: { role: UserRole.SUPER_ADMIN },
          orderBy: { createdAt: 'asc' },
        });
        if (!superAdmin) {
          this.logger.warn(
            `No SUPER_ADMIN found — cannot create lead for user ${userUuid}`,
          );
          return;
        }
        assignedToUuid = superAdmin.uuid;
      }

      // Copy phone if already verified (edge case — usually happens later in funnel)
      const profile = await this.prisma.userProfile.findUnique({
        where: { userUuid },
      });

      await this.prisma.lead.create({
        data: {
          userUuid,
          assignedToUuid,
          distributorUuid,
          status: LeadStatus.NEW,
          phone: profile?.phone ?? null,
        },
      });

      this.logger.log(
        `Lead created for user ${userUuid}, assignedTo=${assignedToUuid}`,
      );
    } catch (error) {
      // Never throw — this is called fire-and-forget from auth service
      this.logger.error(
        `Failed to create lead for user ${userUuid}: ${(error as Error).message}`,
      );
    }
  }

  // ─── TRIGGER: Phone verified ─────────────────────────────────────────────────

  /**
   * Called after phone verification — copy phone to lead, advance status NEW→WARM.
   */
  async onPhoneVerified(userUuid: string): Promise<void> {
    try {
      const lead = await this.prisma.lead.findUnique({ where: { userUuid } });
      if (!lead) return;

      const profile = await this.prisma.userProfile.findUnique({
        where: { userUuid },
      });
      if (!profile?.phone) return;

      const prevStatus = lead.status;

      await this.prisma.lead.update({
        where: { uuid: lead.uuid },
        data: { phone: profile.phone, status: LeadStatus.WARM },
      });

      await this.prisma.leadActivity.create({
        data: {
          leadUuid: lead.uuid,
          actorUuid: userUuid,
          fromStatus: prevStatus,
          toStatus: LeadStatus.WARM,
          action: LeadAction.STATUS_CHANGE,
          notes: 'Phone number verified',
        },
      });

      this.logger.log(
        `Lead ${lead.uuid} updated to WARM after phone verification`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process phone verification for lead ${userUuid}: ${(error as Error).message}`,
      );
    }
  }

  // ─── TRIGGER: Decision step = YES ────────────────────────────────────────────

  /**
   * Called when user answers YES at decision step.
   * Reactivates leads in LOST/NURTURE as well — always → HOT.
   */
  async onDecisionYes(userUuid: string): Promise<void> {
    try {
      const lead = await this.prisma.lead.findUnique({ where: { userUuid } });
      if (!lead) return;

      const prevStatus = lead.status;

      await this.prisma.lead.update({
        where: { uuid: lead.uuid },
        data: { status: LeadStatus.HOT },
      });

      await this.prisma.leadActivity.create({
        data: {
          leadUuid: lead.uuid,
          actorUuid: userUuid,
          fromStatus: prevStatus,
          toStatus: LeadStatus.HOT,
          action: LeadAction.STATUS_CHANGE,
          notes: 'User selected YES at decision step',
        },
      });

      this.prisma.leadStatusLog
        .create({
          data: {
            leadUuid: lead.uuid,
            fromStatus: prevStatus,
            toStatus: LeadStatus.HOT,
            changedByUuid: null,
            changedByRole: 'SYSTEM',
          },
        })
        .catch((err: unknown) =>
          this.logger.error('Failed to log lead status change', err),
        );

      this.logger.log(`Lead ${lead.uuid} set to HOT after YES decision`);
    } catch (error) {
      this.logger.error(
        `Failed to process YES decision for lead ${userUuid}: ${(error as Error).message}`,
      );
    }
  }

  // ─── TRIGGER: Decision step = NO ─────────────────────────────────────────────

  /**
   * Called when user answers NO at decision step.
   * Sets status → NURTURE, creates NurtureEnrollment, schedules Day 1 email.
   */
  async onDecisionNo(userUuid: string): Promise<void> {
    try {
      const lead = await this.prisma.lead.findUnique({ where: { userUuid } });
      if (!lead) return;

      const prevStatus = lead.status;

      await this.prisma.lead.update({
        where: { uuid: lead.uuid },
        data: { status: LeadStatus.NURTURE },
      });

      // Create nurture enrollment (idempotent — skip if already exists)
      const existingEnrollment = await this.prisma.nurtureEnrollment.findUnique(
        {
          where: { leadUuid: lead.uuid },
        },
      );

      if (!existingEnrollment) {
        const nextEmailAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // now + 1 day
        await this.prisma.nurtureEnrollment.create({
          data: {
            userUuid,
            leadUuid: lead.uuid,
            nextEmailAt,
          },
        });
      }

      await this.prisma.leadActivity.create({
        data: {
          leadUuid: lead.uuid,
          actorUuid: userUuid,
          fromStatus: prevStatus,
          toStatus: LeadStatus.NURTURE,
          action: LeadAction.STATUS_CHANGE,
          notes:
            'User selected NO at decision step — enrolled in nurture sequence',
        },
      });

      this.prisma.leadStatusLog
        .create({
          data: {
            leadUuid: lead.uuid,
            fromStatus: prevStatus,
            toStatus: LeadStatus.NURTURE,
            changedByUuid: null,
            changedByRole: 'SYSTEM',
          },
        })
        .catch((err: unknown) =>
          this.logger.error('Failed to log lead status change', err),
        );

      this.logger.log(`Lead ${lead.uuid} enrolled in nurture sequence`);
    } catch (error) {
      this.logger.error(
        `Failed to process NO decision for lead ${userUuid}: ${(error as Error).message}`,
      );
    }
  }

  // ─── DISTRIBUTOR: Get own leads ───────────────────────────────────────────────

  async getDistributorLeads(
    distributorUuid: string,
    status?: string,
    search?: string,
    page = 1,
    limit = 20,
  ) {
    const skip = (page - 1) * limit;
    const take = limit;

    const where: Prisma.LeadWhereInput = {
      assignedToUuid: distributorUuid,
      ...(status ? { status: status as LeadStatus } : {}),
      ...(search
        ? {
            OR: [
              { user: { fullName: { contains: search, mode: 'insensitive' } } },
              { user: { email: { contains: search, mode: 'insensitive' } } },
              { phone: { contains: search } },
            ],
          }
        : {}),
    };

    const [leads, total] = await Promise.all([
      this.prisma.lead.findMany({
        where,
        include: {
          user: {
            select: {
              uuid: true,
              fullName: true,
              email: true,
              country: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.lead.count({ where }),
    ]);

    return {
      items: leads.map((l) => ({
        ...l,
        displayStatus: this.getDisplayStatus(l.status),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getDistributorTodayFollowups(
    distributorUuid: string,
    page = 1,
    limit = 20,
  ) {
    const { startOfDay, endOfDay } = this.getTodayBounds();
    const skip = (page - 1) * limit;
    const where = {
      assignedToUuid: distributorUuid,
      status: LeadStatus.FOLLOWUP,
      activities: {
        some: {
          action: LeadAction.FOLLOWUP_SCHEDULED,
          followupAt: { gte: startOfDay, lte: endOfDay },
        },
      },
    };
    const [leads, total] = await this.prisma.$transaction([
      this.prisma.lead.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              uuid: true,
              fullName: true,
              email: true,
              country: true,
              avatarUrl: true,
            },
          },
          activities: {
            where: {
              action: LeadAction.FOLLOWUP_SCHEDULED,
              followupAt: { gte: startOfDay, lte: endOfDay },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      this.prisma.lead.count({ where }),
    ]);
    return {
      data: leads.map((l) => ({
        ...l,
        displayStatus: this.getDisplayStatus(l.status),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get a single lead for a distributor.
   * Throws ForbiddenException if the lead does not belong to them.
   */
  async getDistributorLead(leadUuid: string, distributorUuid: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { uuid: leadUuid },
      include: {
        user: {
          select: {
            uuid: true,
            fullName: true,
            email: true,
            country: true,
            avatarUrl: true,
          },
        },
        activities: {
          include: { actor: { select: { uuid: true, fullName: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    if (lead.assignedToUuid !== distributorUuid)
      throw new ForbiddenException('Access denied');

    const funnelProgress = await this.getLeadFunnelProgress(lead.userUuid);
    return {
      ...lead,
      displayStatus: this.getDisplayStatus(lead.status),
      funnelProgress,
    };
  }

  /**
   * Update status on a distributor's own lead.
   * Throws ForbiddenException if not their lead.
   */
  async updateDistributorLeadStatus(
    leadUuid: string,
    distributorUuid: string,
    dto: UpdateLeadStatusDto,
  ) {
    const lead = await this.prisma.lead.findUnique({
      where: { uuid: leadUuid },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    if (lead.assignedToUuid !== distributorUuid)
      throw new ForbiddenException('Access denied');

    return this.applyStatusChange(lead, distributorUuid, dto, 'DISTRIBUTOR');
  }

  // ─── ADMIN: All leads ─────────────────────────────────────────────────────────

  async getAllLeads(status?: string, search?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const take = limit;

    const where: Prisma.LeadWhereInput = {
      distributorUuid: null,
      ...(status ? { status: status as LeadStatus } : {}),
      ...(search
        ? {
            OR: [
              { user: { fullName: { contains: search, mode: 'insensitive' } } },
              { user: { email: { contains: search, mode: 'insensitive' } } },
              { phone: { contains: search } },
            ],
          }
        : {}),
    };

    const [leads, total] = await Promise.all([
      this.prisma.lead.findMany({
        where,
        include: {
          user: {
            select: {
              uuid: true,
              fullName: true,
              email: true,
              country: true,
              avatarUrl: true,
            },
          },
          assignedTo: { select: { uuid: true, fullName: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.lead.count({ where }),
    ]);

    return {
      items: leads.map((l) => ({
        ...l,
        displayStatus: this.getDisplayStatus(l.status),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getAdminTodayFollowups(page = 1, limit = 20) {
    const { startOfDay, endOfDay } = this.getTodayBounds();
    const skip = (page - 1) * limit;
    const where = {
      status: LeadStatus.FOLLOWUP,
      activities: {
        some: {
          action: LeadAction.FOLLOWUP_SCHEDULED,
          followupAt: { gte: startOfDay, lte: endOfDay },
        },
      },
    };
    const [leads, total] = await this.prisma.$transaction([
      this.prisma.lead.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              uuid: true,
              fullName: true,
              email: true,
              country: true,
              avatarUrl: true,
            },
          },
          assignedTo: { select: { uuid: true, fullName: true } },
          activities: {
            where: {
              action: LeadAction.FOLLOWUP_SCHEDULED,
              followupAt: { gte: startOfDay, lte: endOfDay },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      this.prisma.lead.count({ where }),
    ]);
    return {
      data: leads.map((l) => ({
        ...l,
        displayStatus: this.getDisplayStatus(l.status),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getAdminLead(leadUuid: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { uuid: leadUuid },
      include: {
        user: {
          select: {
            uuid: true,
            fullName: true,
            email: true,
            country: true,
            avatarUrl: true,
          },
        },
        assignedTo: { select: { uuid: true, fullName: true } },
        distributor: { select: { uuid: true, fullName: true } },
        activities: {
          include: { actor: { select: { uuid: true, fullName: true } } },
          orderBy: { createdAt: 'desc' },
        },
        nurtureEnrollment: true,
      },
    });
    if (!lead) throw new NotFoundException('Lead not found');

    const [funnelProgress, payments] = await Promise.all([
      this.getLeadFunnelProgress(lead.userUuid),
      this.prisma.payment.findMany({
        where: {
          userUuid: lead.userUuid,
          paymentType: 'COMMITMENT_FEE',
        },
        select: {
          uuid: true,
          amount: true,
          finalAmount: true,
          currency: true,
          status: true,
          paymentType: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      ...lead,
      displayStatus: this.getDisplayStatus(lead.status),
      funnelProgress,
      payments,
    };
  }

  async getLeadsForDistributor(
    distributorUuid: string,
    status?: string,
    search?: string,
    page = 1,
    limit = 20,
  ) {
    const skip = (page - 1) * limit;
    const take = limit;

    const where: Prisma.LeadWhereInput = {
      distributorUuid,
      ...(status ? { status: status as LeadStatus } : {}),
      ...(search
        ? {
            OR: [
              { user: { fullName: { contains: search, mode: 'insensitive' } } },
              { user: { email: { contains: search, mode: 'insensitive' } } },
              { phone: { contains: search } },
            ],
          }
        : {}),
    };

    const [leads, total] = await Promise.all([
      this.prisma.lead.findMany({
        where,
        include: {
          user: {
            select: {
              uuid: true,
              fullName: true,
              email: true,
              country: true,
              avatarUrl: true,
            },
          },
          assignedTo: { select: { uuid: true, fullName: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.lead.count({ where }),
    ]);

    return {
      items: leads.map((l) => ({
        ...l,
        displayStatus: this.getDisplayStatus(l.status),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateAdminLeadStatus(
    leadUuid: string,
    actorUuid: string,
    dto: AdminUpdateLeadStatusDto,
  ) {
    const lead = await this.prisma.lead.findUnique({
      where: { uuid: leadUuid },
    });
    if (!lead) throw new NotFoundException('Lead not found');

    if (lead.distributorUuid !== null) {
      throw new ForbiddenException(
        'This lead belongs to a distributor. Only the distributor can update its status.',
      );
    }

    return this.applyStatusChange(lead, actorUuid, dto, 'SUPER_ADMIN');
  }

  // ─── SHARED STATUS CHANGE LOGIC ──────────────────────────────────────────────

  private async applyStatusChange(
    lead: { uuid: string; userUuid: string; status: LeadStatus },
    actorUuid: string,
    dto: UpdateLeadStatusDto | AdminUpdateLeadStatusDto,
    changedByRole: string,
  ) {
    const followupAt = dto.followupAtDate;

    if (
      dto.status === LeadStatus.FOLLOWUP &&
      (!dto.notes || !dto.notes.trim())
    ) {
      throw new BadRequestException(
        'Notes are required when scheduling a followup',
      );
    }
    if (dto.status === LeadStatus.FOLLOWUP && !followupAt) {
      throw new BadRequestException(
        'followupAt is required when status is FOLLOWUP',
      );
    }
    if (followupAt && followupAt <= new Date()) {
      throw new BadRequestException('followupAt must be in the future');
    }

    const ALLOWED_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
      NEW: [],
      WARM: [],
      HOT: [
        LeadStatus.CONTACTED,
        LeadStatus.FOLLOWUP,
        LeadStatus.MARK_AS_CUSTOMER,
        LeadStatus.LOST,
      ],
      CONTACTED: [
        LeadStatus.FOLLOWUP,
        LeadStatus.MARK_AS_CUSTOMER,
        LeadStatus.LOST,
      ],
      FOLLOWUP: [
        LeadStatus.CONTACTED,
        LeadStatus.MARK_AS_CUSTOMER,
        LeadStatus.LOST,
      ],
      NURTURE: [],
      LOST: [],
      MARK_AS_CUSTOMER: [],
    };

    const allowed = ALLOWED_TRANSITIONS[lead.status] || [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        'Cannot change status. Lead must reach HOT status first before manual management is allowed.',
      );
    }

    const prevStatus = lead.status;

    // Update lead status
    const updatedLead = await this.prisma.lead.update({
      where: { uuid: lead.uuid },
      data: { status: dto.status },
      include: {
        user: {
          select: {
            uuid: true,
            fullName: true,
            email: true,
            country: true,
            avatarUrl: true,
          },
        },
        assignedTo: { select: { uuid: true, fullName: true } },
      },
    });

    // Promote user to CUSTOMER when status = MARK_AS_CUSTOMER
    if (dto.status === LeadStatus.MARK_AS_CUSTOMER) {
      await this.prisma.user.update({
        where: { uuid: lead.userUuid },
        data: { role: UserRole.CUSTOMER },
      });
    }

    // Log activity — FOLLOWUP uses FOLLOWUP_SCHEDULED action
    const action =
      dto.status === LeadStatus.FOLLOWUP
        ? LeadAction.FOLLOWUP_SCHEDULED
        : LeadAction.STATUS_CHANGE;

    await this.prisma.leadActivity.create({
      data: {
        leadUuid: lead.uuid,
        actorUuid,
        fromStatus: prevStatus,
        toStatus: dto.status,
        action,
        notes: dto.notes ?? null,
        followupAt: followupAt ?? null,
      },
    });

    // Fire-and-forget — never block the response
    this.prisma.leadStatusLog
      .create({
        data: {
          leadUuid: lead.uuid,
          fromStatus: prevStatus,
          toStatus: dto.status,
          changedByUuid: actorUuid,
          changedByRole,
        },
      })
      .catch((err: unknown) =>
        this.logger.error('Failed to log lead status change', err),
      );

    return {
      ...updatedLead,
      displayStatus: this.getDisplayStatus(updatedLead.status),
    };
  }

  // ─── HELPERS ─────────────────────────────────────────────────────────────────

  private getDisplayStatus(status: LeadStatus): string {
    if (status === LeadStatus.MARK_AS_CUSTOMER) return 'CUSTOMER';
    return status;
  }

  private getTodayBounds() {
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0,
    );
    const endOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999,
    );
    return { startOfDay, endOfDay };
  }

  private async getLeadFunnelProgress(userUuid: string) {
    const totalSteps = await this.prisma.funnelStep.count({
      where: { isActive: true },
    });

    const fp = await this.prisma.funnelProgress.findUnique({
      where: { userUuid },
      select: {
        currentStepUuid: true,
        phoneVerified: true,
        paymentCompleted: true,
        decisionAnswer: true,
        stepProgress: {
          select: {
            isCompleted: true,
            stepUuid: true,
          },
        },
      },
    });

    if (!fp) return null;

    return {
      phoneVerified: fp.phoneVerified,
      paymentCompleted: fp.paymentCompleted,
      decisionAnswer: fp.decisionAnswer,
      completedSteps: fp.stepProgress.filter((sp) => sp.isCompleted).length,
      totalSteps,
      currentStepUuid: fp.currentStepUuid,
    };
  }

  // ─── LEAD STATUS HISTORY ─────────────────────────────────────────────────────

  async getLeadStatusHistory(
    leadUuid: string,
    requestingUserUuid: string,
    requestingUserRole: string,
  ) {
    const lead = await this.prisma.lead.findUnique({
      where: { uuid: leadUuid },
    });
    if (!lead) throw new NotFoundException('Lead not found');

    if (requestingUserRole === 'DISTRIBUTOR') {
      if (lead.assignedToUuid !== requestingUserUuid) {
        throw new ForbiddenException('Access denied');
      }
    }

    const logs = await this.prisma.leadStatusLog.findMany({
      where: { leadUuid },
      orderBy: { createdAt: 'asc' },
    });

    // Batch-fetch all referenced users in one query
    const changedByUuids = [
      ...new Set(
        logs.map((l) => l.changedByUuid).filter((u): u is string => u !== null),
      ),
    ];

    const users =
      changedByUuids.length > 0
        ? await this.prisma.user.findMany({
            where: { uuid: { in: changedByUuids } },
            select: { uuid: true, fullName: true },
          })
        : [];

    const userMap = new Map(users.map((u) => [u.uuid, u.fullName]));

    return logs.map((log) => ({
      uuid: log.uuid,
      fromStatus: log.fromStatus,
      toStatus: log.toStatus,
      changedBy: {
        uuid: log.changedByUuid,
        fullName: log.changedByUuid
          ? (userMap.get(log.changedByUuid) ?? 'Unknown')
          : 'System',
      },
      changedByRole: log.changedByRole,
      createdAt: log.createdAt,
    }));
  }

  // ─── ADMIN NOTIFICATIONS ─────────────────────────────────────────────────────

  /**
   * GET /api/v1/admin/notifications
   * Returns today's follow-ups and overdue follow-ups for direct/organic leads only.
   */
  async getAdminNotifications(): Promise<{
    followupsToday: Array<{
      leadUuid: string;
      userFullName: string;
      phone: string | null;
      followupAt: Date;
      notes: string | null;
    }>;
    overdueFollowups: Array<{
      leadUuid: string;
      userFullName: string;
      phone: string | null;
      followupAt: Date;
      notes: string | null;
    }>;
  }> {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const endOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999,
    );

    const activitySelect = {
      followupAt: true,
      notes: true,
      lead: {
        select: {
          uuid: true,
          phone: true,
          user: {
            select: { fullName: true },
          },
        },
      },
    } as const;

    const leadFilter = {
      distributorUuid: null,
      status: LeadStatus.FOLLOWUP,
    };

    const [todayActivities, overdueActivities] = await Promise.all([
      this.prisma.leadActivity.findMany({
        where: {
          action: LeadAction.FOLLOWUP_SCHEDULED,
          followupAt: { gte: startOfToday, lte: endOfToday },
          lead: leadFilter,
        },
        orderBy: { followupAt: 'asc' },
        select: activitySelect,
      }),
      this.prisma.leadActivity.findMany({
        where: {
          action: LeadAction.FOLLOWUP_SCHEDULED,
          followupAt: { lt: startOfToday },
          lead: leadFilter,
        },
        orderBy: { followupAt: 'asc' },
        select: activitySelect,
      }),
    ]);

    const mapActivity = (a: {
      followupAt: Date | null;
      notes: string | null;
      lead: { uuid: string; phone: string | null; user: { fullName: string } };
    }) => ({
      leadUuid: a.lead.uuid,
      userFullName: a.lead.user.fullName,
      phone: a.lead.phone,
      followupAt: a.followupAt!,
      notes: a.notes,
    });

    return {
      followupsToday: todayActivities.map(mapActivity),
      overdueFollowups: overdueActivities.map(mapActivity),
    };
  }
}
