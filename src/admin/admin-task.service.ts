import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { TaskStatus } from '@prisma/client';
import type { CreateTaskDto } from '../distributor/dto/create-task.dto.js';
import type { UpdateTaskDto } from '../distributor/dto/update-task.dto.js';
import type { MoveTaskDto } from '../distributor/dto/move-task.dto.js';

const LEAD_SELECT = {
  uuid: true,
  status: true,
  user: {
    select: {
      fullName: true,
      avatarUrl: true,
    },
  },
} as const;

function mapLead(
  lead: {
    uuid: string;
    status: string;
    user: { fullName: string; avatarUrl: string | null };
  } | null,
) {
  if (!lead) return null;
  return {
    uuid: lead.uuid,
    userFullName: lead.user.fullName,
    userAvatarUrl: lead.user.avatarUrl,
    status: lead.status,
  };
}

/**
 * AdminTaskService — Kanban task board for Super Admin.
 *
 * Reuses the DistributorTask and DistributorCalendarNote Prisma models (user-scoped).
 * Admin's own UUID is stored as distributorUuid — same table, different user.
 *
 * Key difference from DistributorTaskService: lead ownership is NOT validated
 * against a distributor relationship (admin can associate any lead).
 */
@Injectable()
export class AdminTaskService {
  constructor(private readonly prisma: PrismaService) {}

  async getTasks(adminUuid: string) {
    const tasks = await this.prisma.distributorTask.findMany({
      where: { distributorUuid: adminUuid },
      include: { lead: { select: LEAD_SELECT } },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });

    const grouped: Record<string, unknown[]> = {
      TODO: [],
      IN_PROGRESS: [],
      COMPLETE: [],
    };

    for (const task of tasks) {
      grouped[task.status].push({
        uuid: task.uuid,
        title: task.title,
        status: task.status,
        order: task.order,
        dueDate: task.dueDate ?? null,
        lead: mapLead(task.lead),
        createdAt: task.createdAt,
      });
    }

    return grouped;
  }

  async createTask(adminUuid: string, dto: CreateTaskDto) {
    if (dto.leadUuid) {
      const lead = await this.prisma.lead.findUnique({
        where: { uuid: dto.leadUuid },
      });
      if (!lead) {
        throw new BadRequestException('Lead not found');
      }
    }

    const todoCount = await this.prisma.distributorTask.count({
      where: { distributorUuid: adminUuid, status: TaskStatus.TODO },
    });

    const task = await this.prisma.distributorTask.create({
      data: {
        distributorUuid: adminUuid,
        leadUuid: dto.leadUuid ?? null,
        title: dto.title,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        order: todoCount + 1,
      },
      include: { lead: { select: LEAD_SELECT } },
    });

    return { ...task, lead: mapLead(task.lead) };
  }

  async updateTask(adminUuid: string, taskUuid: string, dto: UpdateTaskDto) {
    const existing = await this.prisma.distributorTask.findUnique({
      where: { uuid: taskUuid },
    });
    if (!existing || existing.distributorUuid !== adminUuid) {
      throw new NotFoundException('Task not found');
    }

    if (dto.leadUuid) {
      const lead = await this.prisma.lead.findUnique({
        where: { uuid: dto.leadUuid },
      });
      if (!lead) {
        throw new BadRequestException('Lead not found');
      }
    }

    const task = await this.prisma.distributorTask.update({
      where: { uuid: taskUuid },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.leadUuid !== undefined && { leadUuid: dto.leadUuid }),
        ...(dto.dueDate !== undefined && {
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        }),
        ...(dto.status !== undefined && { status: dto.status as TaskStatus }),
        ...(dto.order !== undefined && { order: dto.order }),
      },
      include: { lead: { select: LEAD_SELECT } },
    });

    return { ...task, lead: mapLead(task.lead) };
  }

  async getTaskForUpdate(adminUuid: string, taskUuid: string) {
    const existing = await this.prisma.distributorTask.findUnique({
      where: { uuid: taskUuid },
    });
    if (!existing || existing.distributorUuid !== adminUuid) {
      throw new NotFoundException('Task not found');
    }

    return {
      title: existing.title,
      leadUuid: existing.leadUuid,
      dueDate: existing.dueDate ? existing.dueDate.toISOString() : null,
      status: existing.status,
      order: existing.order,
    };
  }

  async moveTask(adminUuid: string, taskUuid: string, dto: MoveTaskDto) {
    const existing = await this.prisma.distributorTask.findUnique({
      where: { uuid: taskUuid },
    });
    if (!existing || existing.distributorUuid !== adminUuid) {
      throw new NotFoundException('Task not found');
    }

    const task = await this.prisma.distributorTask.update({
      where: { uuid: taskUuid },
      data: {
        status: dto.status as TaskStatus,
        order: dto.order,
      },
      include: { lead: { select: LEAD_SELECT } },
    });

    return { ...task, lead: mapLead(task.lead) };
  }

  async deleteTask(adminUuid: string, taskUuid: string) {
    const existing = await this.prisma.distributorTask.findUnique({
      where: { uuid: taskUuid },
    });
    if (!existing || existing.distributorUuid !== adminUuid) {
      throw new NotFoundException('Task not found');
    }

    await this.prisma.distributorTask.delete({ where: { uuid: taskUuid } });
    return { message: 'Task deleted successfully' };
  }

  async getTaskNotifications(adminUuid: string) {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const taskInclude = {
      lead: {
        select: {
          uuid: true,
          status: true,
          user: { select: { fullName: true } },
        },
      },
    } as const;

    const [tasksDueTodayRaw, overdueTasksRaw] = await Promise.all([
      this.prisma.distributorTask.findMany({
        where: {
          distributorUuid: adminUuid,
          dueDate: { gte: todayStart, lt: todayEnd },
          status: { not: TaskStatus.COMPLETE },
        },
        include: taskInclude,
        orderBy: { dueDate: 'asc' },
      }),
      this.prisma.distributorTask.findMany({
        where: {
          distributorUuid: adminUuid,
          dueDate: { lt: todayStart },
          status: { not: TaskStatus.COMPLETE },
        },
        include: taskInclude,
        orderBy: { dueDate: 'asc' },
      }),
    ]);

    const mapTask = (t: (typeof tasksDueTodayRaw)[number]) => ({
      uuid: t.uuid,
      title: t.title,
      dueDate: t.dueDate,
      lead: t.lead
        ? {
            uuid: t.lead.uuid,
            userFullName: t.lead.user.fullName,
            status: t.lead.status,
          }
        : null,
    });

    return {
      tasksDueToday: tasksDueTodayRaw.map(mapTask),
      overdueTasks: overdueTasksRaw.map(mapTask),
    };
  }
}
