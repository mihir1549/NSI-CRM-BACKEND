import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { LeadStatus, LeadAction, UserRole } from '@prisma/client';
import type { UpdateLeadStatusDto } from './dto/update-lead-status.dto.js';

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
      const existing = await this.prisma.lead.findUnique({ where: { userUuid } });
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
          this.logger.warn(`No SUPER_ADMIN found — cannot create lead for user ${userUuid}`);
          return;
        }
        assignedToUuid = superAdmin.uuid;
      }

      // Copy phone if already verified (edge case — usually happens later in funnel)
      const profile = await this.prisma.userProfile.findUnique({ where: { userUuid } });

      await this.prisma.lead.create({
        data: {
          userUuid,
          assignedToUuid,
          distributorUuid,
          status: LeadStatus.NEW,
          phone: profile?.phone ?? null,
        },
      });

      this.logger.log(`Lead created for user ${userUuid}, assignedTo=${assignedToUuid}`);
    } catch (error) {
      // Never throw — this is called fire-and-forget from auth service
      this.logger.error(`Failed to create lead for user ${userUuid}: ${(error as Error).message}`);
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

      const profile = await this.prisma.userProfile.findUnique({ where: { userUuid } });
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

      this.logger.log(`Lead ${lead.uuid} updated to WARM after phone verification`);
    } catch (error) {
      this.logger.error(`Failed to process phone verification for lead ${userUuid}: ${(error as Error).message}`);
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

      this.logger.log(`Lead ${lead.uuid} set to HOT after YES decision`);
    } catch (error) {
      this.logger.error(`Failed to process YES decision for lead ${userUuid}: ${(error as Error).message}`);
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
      const existingEnrollment = await this.prisma.nurtureEnrollment.findUnique({
        where: { leadUuid: lead.uuid },
      });

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
          notes: 'User selected NO at decision step — enrolled in nurture sequence',
        },
      });

      this.logger.log(`Lead ${lead.uuid} enrolled in nurture sequence`);
    } catch (error) {
      this.logger.error(`Failed to process NO decision for lead ${userUuid}: ${(error as Error).message}`);
    }
  }

  // ─── DISTRIBUTOR: Get own leads ───────────────────────────────────────────────

  async getDistributorLeads(distributorUuid: string, status?: string) {
    return this.prisma.lead.findMany({
      where: {
        assignedToUuid: distributorUuid,
        ...(status ? { status: status as LeadStatus } : {}),
      },
      include: {
        user: { select: { uuid: true, fullName: true, email: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getDistributorTodayFollowups(distributorUuid: string) {
    const { startOfDay, endOfDay } = this.getTodayBounds();
    return this.prisma.lead.findMany({
      where: {
        assignedToUuid: distributorUuid,
        status: LeadStatus.FOLLOWUP,
        activities: {
          some: {
            action: LeadAction.FOLLOWUP_SCHEDULED,
            followupAt: { gte: startOfDay, lte: endOfDay },
          },
        },
      },
      include: {
        user: { select: { uuid: true, fullName: true, email: true } },
        activities: {
          where: {
            action: LeadAction.FOLLOWUP_SCHEDULED,
            followupAt: { gte: startOfDay, lte: endOfDay },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  /**
   * Get a single lead for a distributor.
   * Throws ForbiddenException if the lead does not belong to them.
   */
  async getDistributorLead(leadUuid: string, distributorUuid: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { uuid: leadUuid },
      include: {
        user: { select: { uuid: true, fullName: true, email: true } },
        activities: {
          include: { actor: { select: { uuid: true, fullName: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    if (lead.assignedToUuid !== distributorUuid) throw new ForbiddenException('Access denied');
    return lead;
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
    const lead = await this.prisma.lead.findUnique({ where: { uuid: leadUuid } });
    if (!lead) throw new NotFoundException('Lead not found');
    if (lead.assignedToUuid !== distributorUuid) throw new ForbiddenException('Access denied');

    return this.applyStatusChange(lead, distributorUuid, dto);
  }

  // ─── ADMIN: All leads ─────────────────────────────────────────────────────────

  async getAllLeads(status?: string, search?: string) {
    return this.prisma.lead.findMany({
      where: {
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
      },
      include: {
        user: { select: { uuid: true, fullName: true, email: true } },
        assignedTo: { select: { uuid: true, fullName: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getAdminTodayFollowups() {
    const { startOfDay, endOfDay } = this.getTodayBounds();
    return this.prisma.lead.findMany({
      where: {
        status: LeadStatus.FOLLOWUP,
        activities: {
          some: {
            action: LeadAction.FOLLOWUP_SCHEDULED,
            followupAt: { gte: startOfDay, lte: endOfDay },
          },
        },
      },
      include: {
        user: { select: { uuid: true, fullName: true, email: true } },
        assignedTo: { select: { uuid: true, fullName: true } },
        activities: {
          where: {
            action: LeadAction.FOLLOWUP_SCHEDULED,
            followupAt: { gte: startOfDay, lte: endOfDay },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async getAdminLead(leadUuid: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { uuid: leadUuid },
      include: {
        user: { select: { uuid: true, fullName: true, email: true } },
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
    return lead;
  }

  async getLeadsForDistributor(distributorUuid: string) {
    return this.prisma.lead.findMany({
      where: { assignedToUuid: distributorUuid },
      include: {
        user: { select: { uuid: true, fullName: true, email: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async updateAdminLeadStatus(
    leadUuid: string,
    actorUuid: string,
    dto: UpdateLeadStatusDto,
  ) {
    const lead = await this.prisma.lead.findUnique({ where: { uuid: leadUuid } });
    if (!lead) throw new NotFoundException('Lead not found');

    return this.applyStatusChange(lead, actorUuid, dto);
  }

  // ─── SHARED STATUS CHANGE LOGIC ──────────────────────────────────────────────

  private async applyStatusChange(
    lead: { uuid: string; userUuid: string; status: LeadStatus },
    actorUuid: string,
    dto: UpdateLeadStatusDto,
  ) {
    const followupAt = dto.followupAtDate;

    if (dto.status === LeadStatus.FOLLOWUP && !followupAt) {
      throw new BadRequestException('followupAt is required when status is FOLLOWUP');
    }
    if (followupAt && followupAt <= new Date()) {
      throw new BadRequestException('followupAt must be in the future');
    }

    const prevStatus = lead.status;

    // Update lead status
    const updatedLead = await this.prisma.lead.update({
      where: { uuid: lead.uuid },
      data: { status: dto.status },
      include: {
        user: { select: { uuid: true, fullName: true, email: true } },
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

    return updatedLead;
  }

  // ─── HELPERS ─────────────────────────────────────────────────────────────────

  private getTodayBounds() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { startOfDay, endOfDay };
  }
}
