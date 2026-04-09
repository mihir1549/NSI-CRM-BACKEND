import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { v4 as uuidv4 } from 'uuid';
import type { CreatePlanDto } from './dto/create-plan.dto.js';
import type { UpdatePlanDto } from './dto/create-plan.dto.js';

@Injectable()
export class DistributorPlanService {
  private readonly logger = new Logger(DistributorPlanService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  /**
   * POST /api/v1/admin/distributor-plans
   * Create a new Razorpay plan and persist it.
   */
  async createPlan(dto: CreatePlanDto, actorUuid: string, ipAddress: string) {
    // Check for duplicate active plan at same amount
    const existing = await this.prisma.distributorPlan.findFirst({
      where: { amount: dto.amount, isActive: true },
    });
    if (existing) {
      throw new ConflictException(
        'An active plan with this amount already exists. Deactivate it before creating a new one.',
      );
    }

    const isMock = this.config.get<string>('PAYMENT_PROVIDER', 'mock') === 'mock';
    let razorpayPlanId: string;

    if (isMock) {
      razorpayPlanId = `mock_plan_${uuidv4()}`;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Razorpay = require('razorpay');
      const razorpay = new Razorpay({
        key_id: this.config.get<string>('RAZORPAY_KEY_ID'),
        key_secret: this.config.get<string>('RAZORPAY_KEY_SECRET'),
      });

      const plan = await razorpay.plans.create({
        period: 'monthly',
        interval: 1,
        item: {
          name: dto.name,
          amount: dto.amount * 100, // paise
          currency: 'INR',
        },
      });
      razorpayPlanId = plan.id;
    }

    const plan = await this.prisma.distributorPlan.create({
      data: {
        razorpayPlanId,
        name: dto.name,
        amount: dto.amount,
        interval: 'monthly',
        isActive: true,
        tagline: dto.tagline,
        features: dto.features ?? [],
        trustBadges: dto.trustBadges ?? [],
        ctaText: dto.ctaText,
        highlightBadge: dto.highlightBadge,
        testimonials: dto.testimonials ? JSON.stringify(dto.testimonials) : '[]',
      },
    });

    this.audit.log({
      actorUuid,
      action: 'DISTRIBUTOR_PLAN_CREATED',
      metadata: { planUuid: plan.uuid, name: dto.name, amount: dto.amount },
      ipAddress,
    });

    return plan;
  }

  /**
   * GET /api/v1/admin/distributor-plans
   */
  async listPlans() {
    return this.prisma.distributorPlan.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * PATCH /api/v1/admin/distributor-plans/:uuid/deactivate
   */
  async deactivatePlan(uuid: string, actorUuid: string, ipAddress: string) {
    const plan = await this.prisma.distributorPlan.findUnique({ where: { uuid } });
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    await this.prisma.distributorPlan.update({
      where: { uuid },
      data: { isActive: false },
    });

    this.audit.log({
      actorUuid,
      action: 'DISTRIBUTOR_PLAN_DEACTIVATED',
      metadata: { planUuid: uuid },
      ipAddress,
    });

    return { message: 'Plan deactivated successfully' };
  }

  /**
   * PATCH /api/v1/admin/distributor-plans/:uuid
   * Update content fields only. amount, razorpayPlanId, interval are immutable.
   */
  async updatePlan(planUuid: string, dto: UpdatePlanDto) {
    const plan = await this.prisma.distributorPlan.findUnique({ where: { uuid: planUuid } });
    if (!plan) throw new NotFoundException('Distributor plan not found');

    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined)          updateData.name = dto.name;
    if (dto.tagline !== undefined)       updateData.tagline = dto.tagline;
    if (dto.ctaText !== undefined)       updateData.ctaText = dto.ctaText;
    if (dto.highlightBadge !== undefined) updateData.highlightBadge = dto.highlightBadge;
    if (dto.features !== undefined)      updateData.features = dto.features;
    if (dto.trustBadges !== undefined)   updateData.trustBadges = dto.trustBadges;
    if (dto.testimonials !== undefined)  updateData.testimonials = JSON.stringify(dto.testimonials);

    return this.prisma.distributorPlan.update({
      where: { uuid: planUuid },
      data: updateData,
    });
  }

  /**
   * GET /api/v1/distributor/plans
   * User-facing: returns full rich content for the subscribe page.
   * razorpayPlanId is NEVER exposed.
   */
  async getActivePlans() {
    const plans = await this.prisma.distributorPlan.findMany({
      where: { isActive: true },
      select: {
        uuid: true,
        name: true,
        amount: true,
        interval: true,
        tagline: true,
        features: true,
        trustBadges: true,
        ctaText: true,
        highlightBadge: true,
        testimonials: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return plans.map((plan) => ({
      ...plan,
      testimonials: (() => {
        try {
          return JSON.parse(plan.testimonials as string);
        } catch {
          return [];
        }
      })(),
    }));
  }
}
