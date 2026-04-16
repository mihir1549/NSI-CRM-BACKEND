import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { StepType } from '@prisma/client';

export interface FunnelWarning {
  code: string;
  message: string;
  severity: 'warning';
}

@Injectable()
export class FunnelValidationService {
  constructor(private readonly prisma: PrismaService) {}

  async validateFunnel(): Promise<{ warnings: FunnelWarning[] }> {
    const sections = await this.prisma.funnelSection.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      include: {
        steps: {
          where: { isActive: true },
          orderBy: { order: 'asc' },
        },
      },
    });

    const allActiveSteps = sections.flatMap((s) => s.steps);
    const warnings: FunnelWarning[] = [];

    // Build a flat ordered list with section order context
    const stepsWithGlobalOrder = allActiveSteps.map((step, idx) => ({
      ...step,
      globalIndex: idx,
    }));

    const paymentGates = stepsWithGlobalOrder.filter(
      (s) => s.type === StepType.PAYMENT_GATE,
    );
    const phoneGates = stepsWithGlobalOrder.filter(
      (s) => s.type === StepType.PHONE_GATE,
    );
    const decisionSteps = stepsWithGlobalOrder.filter(
      (s) => s.type === StepType.DECISION,
    );

    // 1. PAYMENT_GATE appears before PHONE_GATE
    if (paymentGates.length > 0 && phoneGates.length > 0) {
      const firstPayment = paymentGates[0];
      const firstPhone = phoneGates[0];
      if (firstPayment.globalIndex < firstPhone.globalIndex) {
        warnings.push({
          code: 'PAYMENT_BEFORE_PHONE',
          message:
            'Payment gate is placed before phone gate. Users will pay before verifying their phone number. Is this intentional?',
          severity: 'warning',
        });
      }
    }

    // 2. More than 1 PAYMENT_GATE
    if (paymentGates.length > 1) {
      warnings.push({
        code: 'MULTIPLE_PAYMENT_GATES',
        message: `You have ${paymentGates.length} payment gates. Users will be asked to pay multiple times. Is this intentional?`,
        severity: 'warning',
      });
    }

    // 3. More than 1 PHONE_GATE
    if (phoneGates.length > 1) {
      warnings.push({
        code: 'MULTIPLE_PHONE_GATES',
        message: `You have ${phoneGates.length} phone gates. Users will verify phone multiple times. Is this intentional?`,
        severity: 'warning',
      });
    }

    // 4. No DECISION step
    if (decisionSteps.length === 0) {
      warnings.push({
        code: 'NO_DECISION_STEP',
        message:
          'No decision step found. Users who complete the funnel will not be asked if they want to buy a machine. No hot leads will be created.',
        severity: 'warning',
      });
    }

    // 5. DECISION step is not the last step
    if (decisionSteps.length > 0) {
      const lastDecision = decisionSteps[decisionSteps.length - 1];
      const lastStep = stepsWithGlobalOrder[stepsWithGlobalOrder.length - 1];
      if (lastDecision.globalIndex !== lastStep?.globalIndex) {
        warnings.push({
          code: 'DECISION_NOT_LAST',
          message:
            'Decision step is not the last step. Any steps after it will never be shown to users.',
          severity: 'warning',
        });
      }
    }

    // 6. Active sections with zero active steps
    for (const section of sections) {
      if (section.steps.length === 0) {
        warnings.push({
          code: 'EMPTY_SECTION',
          message: `Section '${section.name}' has no active steps. It will appear empty to users.`,
          severity: 'warning',
        });
      }
    }

    return { warnings };
  }
}
