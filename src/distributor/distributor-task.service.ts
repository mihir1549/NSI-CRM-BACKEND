import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { TaskStatus } from '@prisma/client';
import type { CreateTaskDto } from './dto/create-task.dto.js';
import type { UpdateTaskDto } from './dto/update-task.dto.js';
import type { MoveTaskDto } from './dto/move-task.dto.js';

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

function mapLead(lead: { uuid: string; status: string; user: { fullName: string; avatarUrl: string | null } } | null) {
  if (!lead) return null;
  return {
    uuid: lead.uuid,
    userFullName: lead.user.fullName,
    userAvatarUrl: lead.user.avatarUrl,
    status: lead.status,
  };
}

@Injectable()
export class DistributorTaskService {
  constructor(private readonly prisma: PrismaService) {}

  async getTasks(distributorUuid: string) {
    const tasks = await this.prisma.distributorTask.findMany({
      where: { distributorUuid },
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

  async createTask(distributorUuid: string, dto: CreateTaskDto) {
    if (dto.leadUuid) {
      const lead = await this.prisma.lead.findUnique({ where: { uuid: dto.leadUuid } });
      if (!lead || lead.distributorUuid !== distributorUuid) {
        throw new BadRequestException('Lead not found or does not belong to this distributor');
      }
    }

    const todoCount = await this.prisma.distributorTask.count({
      where: { distributorUuid, status: TaskStatus.TODO },
    });

    const task = await this.prisma.distributorTask.create({
      data: {
        distributorUuid,
        leadUuid: dto.leadUuid ?? null,
        title: dto.title,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        order: todoCount + 1,
      },
      include: { lead: { select: LEAD_SELECT } },
    });

    return { ...task, lead: mapLead(task.lead) };
  }

  async updateTask(distributorUuid: string, taskUuid: string, dto: UpdateTaskDto) {
    const existing = await this.prisma.distributorTask.findUnique({ where: { uuid: taskUuid } });
    if (!existing || existing.distributorUuid !== distributorUuid) {
      throw new NotFoundException('Task not found');
    }

    if (dto.leadUuid) {
      const lead = await this.prisma.lead.findUnique({ where: { uuid: dto.leadUuid } });
      if (!lead || lead.distributorUuid !== distributorUuid) {
        throw new BadRequestException('Lead not found or does not belong to this distributor');
      }
    }

    const task = await this.prisma.distributorTask.update({
      where: { uuid: taskUuid },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.leadUuid !== undefined && { leadUuid: dto.leadUuid }),
        ...(dto.dueDate !== undefined && { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }),
        ...(dto.status !== undefined && { status: dto.status as TaskStatus }),
        ...(dto.order !== undefined && { order: dto.order }),
      },
      include: { lead: { select: LEAD_SELECT } },
    });

    return { ...task, lead: mapLead(task.lead) };
  }

  async moveTask(distributorUuid: string, taskUuid: string, dto: MoveTaskDto) {
    const existing = await this.prisma.distributorTask.findUnique({ where: { uuid: taskUuid } });
    if (!existing || existing.distributorUuid !== distributorUuid) {
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

  async deleteTask(distributorUuid: string, taskUuid: string) {
    const existing = await this.prisma.distributorTask.findUnique({ where: { uuid: taskUuid } });
    if (!existing || existing.distributorUuid !== distributorUuid) {
      throw new NotFoundException('Task not found');
    }

    await this.prisma.distributorTask.delete({ where: { uuid: taskUuid } });
    return { message: 'Task deleted successfully' };
  }

  async getNotifications(distributorUuid: string) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const soonEnd = new Date(todayStart.getTime() + 4 * 24 * 60 * 60 * 1000);

    const taskInclude = {
      lead: {
        select: {
          uuid: true,
          status: true,
          user: { select: { fullName: true } },
        },
      },
    } as const;

    const [tasksDueTodayRaw, tasksDueSoonRaw, followupActivities] = await Promise.all([
      this.prisma.distributorTask.findMany({
        where: {
          distributorUuid,
          dueDate: { gte: todayStart, lt: todayEnd },
          status: { not: TaskStatus.COMPLETE },
        },
        include: taskInclude,
      }),
      this.prisma.distributorTask.findMany({
        where: {
          distributorUuid,
          dueDate: { gte: todayEnd, lt: soonEnd },
          status: { not: TaskStatus.COMPLETE },
        },
        include: taskInclude,
      }),
      this.prisma.leadActivity.findMany({
        where: {
          actorUuid: distributorUuid,
          followupAt: { gte: todayStart, lt: todayEnd },
        },
        include: {
          lead: {
            select: {
              uuid: true,
              status: true,
              user: { select: { fullName: true } },
            },
          },
        },
      }),
    ]);

    const mapTask = (t: (typeof tasksDueTodayRaw)[number]) => ({
      uuid: t.uuid,
      title: t.title,
      dueDate: t.dueDate,
      lead: t.lead
        ? { uuid: t.lead.uuid, userFullName: t.lead.user.fullName, status: t.lead.status }
        : null,
    });

    const tasksDueToday = tasksDueTodayRaw.map(mapTask);
    const tasksDueSoon = tasksDueSoonRaw.map(mapTask);

    const followupsToday = followupActivities.map((a) => ({
      leadUuid: a.lead.uuid,
      userFullName: a.lead.user.fullName,
      leadStatus: a.lead.status,
      followupAt: a.followupAt,
      notes: a.notes ?? null,
    }));

    return {
      tasksDueToday,
      tasksDueSoon,
      followupsToday,
      unreadCount: tasksDueToday.length + followupsToday.length,
    };
  }
}
