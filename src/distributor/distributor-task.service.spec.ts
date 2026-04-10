import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DistributorTaskService } from './distributor-task.service';
import { PrismaService } from '../prisma/prisma.service';
import { TaskStatus } from '@prisma/client';

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const DISTRIBUTOR_UUID = '11111111-1111-1111-1111-111111111111';
const TASK_UUID        = '22222222-2222-2222-2222-222222222222';
const LEAD_UUID        = '33333333-3333-3333-3333-333333333333';

const mockLeadForTask = {
  uuid: LEAD_UUID,
  status: 'HOT',
  user: { fullName: 'Test User', avatarUrl: null },
};

const mockTask = {
  uuid: TASK_UUID,
  distributorUuid: DISTRIBUTOR_UUID,
  title: 'Call the lead',
  status: TaskStatus.TODO,
  order: 1,
  dueDate: null,
  createdAt: new Date('2026-04-01'),
  lead: null,
};

const mockTaskWithLead = {
  ...mockTask,
  lead: mockLeadForTask,
};

// ─── Mocks ────────────────────────────────────────────────────────────────────
const mockPrisma = {
  distributorTask: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  lead: {
    findUnique: jest.fn(),
  },
  leadActivity: {
    findMany: jest.fn(),
  },
};

describe('DistributorTaskService', () => {
  let service: DistributorTaskService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DistributorTaskService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DistributorTaskService>(DistributorTaskService);
    jest.resetAllMocks();

    mockPrisma.distributorTask.findMany.mockResolvedValue([]);
    mockPrisma.distributorTask.findUnique.mockResolvedValue(mockTask);
    mockPrisma.distributorTask.count.mockResolvedValue(2);
    mockPrisma.distributorTask.create.mockResolvedValue(mockTask);
    mockPrisma.distributorTask.update.mockResolvedValue(mockTask);
    mockPrisma.distributorTask.delete.mockResolvedValue(mockTask);
    mockPrisma.lead.findUnique.mockResolvedValue(null);
    mockPrisma.leadActivity.findMany.mockResolvedValue([]);
  });

  // ══════════════════════════════════════════════════════════
  // getTasks()
  // ══════════════════════════════════════════════════════════
  describe('getTasks()', () => {
    it('returns grouped tasks with TODO, IN_PROGRESS, COMPLETE buckets', async () => {
      mockPrisma.distributorTask.findMany.mockResolvedValue([mockTask]);

      const result = await service.getTasks(DISTRIBUTOR_UUID);

      expect(result).toHaveProperty('TODO');
      expect(result).toHaveProperty('IN_PROGRESS');
      expect(result).toHaveProperty('COMPLETE');
      expect(result.TODO).toHaveLength(1);
    });

    it('returns empty buckets when no tasks', async () => {
      mockPrisma.distributorTask.findMany.mockResolvedValue([]);

      const result = await service.getTasks(DISTRIBUTOR_UUID);

      expect(result.TODO).toHaveLength(0);
      expect(result.IN_PROGRESS).toHaveLength(0);
      expect(result.COMPLETE).toHaveLength(0);
    });

    it('groups tasks by status correctly', async () => {
      const inProgressTask = { ...mockTask, status: TaskStatus.IN_PROGRESS, uuid: 'other-task' };
      mockPrisma.distributorTask.findMany.mockResolvedValue([mockTask, inProgressTask]);

      const result = await service.getTasks(DISTRIBUTOR_UUID);

      expect(result.TODO).toHaveLength(1);
      expect(result.IN_PROGRESS).toHaveLength(1);
    });

    it('maps lead to simplified shape with userFullName', async () => {
      mockPrisma.distributorTask.findMany.mockResolvedValue([mockTaskWithLead]);

      const result = await service.getTasks(DISTRIBUTOR_UUID);

      expect((result.TODO[0] as any).lead.userFullName).toBe('Test User');
    });
  });

  // ══════════════════════════════════════════════════════════
  // createTask()
  // ══════════════════════════════════════════════════════════
  describe('createTask()', () => {
    it('creates a task without leadUuid', async () => {
      const dto = { title: 'New Task' };
      mockPrisma.distributorTask.create.mockResolvedValue(mockTask);

      const result = await service.createTask(DISTRIBUTOR_UUID, dto as any);

      expect(mockPrisma.distributorTask.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            distributorUuid: DISTRIBUTOR_UUID,
            title: 'New Task',
            order: 3, // count (2) + 1
          }),
        }),
      );
      expect(result.uuid).toBe(TASK_UUID);
    });

    it('validates lead ownership when leadUuid provided', async () => {
      const dto = { title: 'Task with Lead', leadUuid: LEAD_UUID };
      mockPrisma.lead.findUnique.mockResolvedValue({ uuid: LEAD_UUID, distributorUuid: DISTRIBUTOR_UUID });
      mockPrisma.distributorTask.create.mockResolvedValue({ ...mockTask, lead: mockLeadForTask });

      await service.createTask(DISTRIBUTOR_UUID, dto as any);

      expect(mockPrisma.lead.findUnique).toHaveBeenCalledWith({ where: { uuid: LEAD_UUID } });
    });

    it('throws BadRequestException when leadUuid belongs to different distributor', async () => {
      const dto = { title: 'Task', leadUuid: LEAD_UUID };
      mockPrisma.lead.findUnique.mockResolvedValue({ uuid: LEAD_UUID, distributorUuid: 'other-dist' });

      await expect(service.createTask(DISTRIBUTOR_UUID, dto as any)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when lead not found', async () => {
      const dto = { title: 'Task', leadUuid: LEAD_UUID };
      mockPrisma.lead.findUnique.mockResolvedValue(null);

      await expect(service.createTask(DISTRIBUTOR_UUID, dto as any)).rejects.toThrow(BadRequestException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // updateTask()
  // ══════════════════════════════════════════════════════════
  describe('updateTask()', () => {
    it('updates task title successfully', async () => {
      const dto = { title: 'Updated Title' };
      mockPrisma.distributorTask.update.mockResolvedValue({ ...mockTask, title: 'Updated Title' });

      const result = await service.updateTask(DISTRIBUTOR_UUID, TASK_UUID, dto as any);

      expect(mockPrisma.distributorTask.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { uuid: TASK_UUID },
          data: expect.objectContaining({ title: 'Updated Title' }),
        }),
      );
      expect(result.title).toBe('Updated Title');
    });

    it('throws NotFoundException when task not found', async () => {
      mockPrisma.distributorTask.findUnique.mockResolvedValue(null);

      await expect(service.updateTask(DISTRIBUTOR_UUID, TASK_UUID, {} as any)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when task belongs to different distributor', async () => {
      mockPrisma.distributorTask.findUnique.mockResolvedValue({ ...mockTask, distributorUuid: 'other' });

      await expect(service.updateTask(DISTRIBUTOR_UUID, TASK_UUID, {} as any)).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when new leadUuid is not owned by distributor', async () => {
      const dto = { leadUuid: LEAD_UUID };
      mockPrisma.lead.findUnique.mockResolvedValue({ uuid: LEAD_UUID, distributorUuid: 'other' });

      await expect(service.updateTask(DISTRIBUTOR_UUID, TASK_UUID, dto as any)).rejects.toThrow(BadRequestException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // moveTask()
  // ══════════════════════════════════════════════════════════
  describe('moveTask()', () => {
    it('moves task to IN_PROGRESS with new order', async () => {
      const dto = { status: TaskStatus.IN_PROGRESS, order: 2 };
      mockPrisma.distributorTask.update.mockResolvedValue({ ...mockTask, status: TaskStatus.IN_PROGRESS });

      const result = await service.moveTask(DISTRIBUTOR_UUID, TASK_UUID, dto);

      expect(mockPrisma.distributorTask.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: TaskStatus.IN_PROGRESS, order: 2 },
        }),
      );
    });

    it('throws NotFoundException when task not found', async () => {
      mockPrisma.distributorTask.findUnique.mockResolvedValue(null);

      await expect(service.moveTask(DISTRIBUTOR_UUID, TASK_UUID, { status: TaskStatus.COMPLETE, order: 1 })).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when task belongs to different distributor', async () => {
      mockPrisma.distributorTask.findUnique.mockResolvedValue({ ...mockTask, distributorUuid: 'other' });

      await expect(service.moveTask(DISTRIBUTOR_UUID, TASK_UUID, { status: TaskStatus.COMPLETE, order: 1 })).rejects.toThrow(NotFoundException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // deleteTask()
  // ══════════════════════════════════════════════════════════
  describe('deleteTask()', () => {
    it('deletes task successfully', async () => {
      const result = await service.deleteTask(DISTRIBUTOR_UUID, TASK_UUID);

      expect(mockPrisma.distributorTask.delete).toHaveBeenCalledWith({ where: { uuid: TASK_UUID } });
      expect(result.message).toBe('Task deleted successfully');
    });

    it('throws NotFoundException when task not found', async () => {
      mockPrisma.distributorTask.findUnique.mockResolvedValue(null);

      await expect(service.deleteTask(DISTRIBUTOR_UUID, TASK_UUID)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when task belongs to different distributor', async () => {
      mockPrisma.distributorTask.findUnique.mockResolvedValue({ ...mockTask, distributorUuid: 'other-dist' });

      await expect(service.deleteTask(DISTRIBUTOR_UUID, TASK_UUID)).rejects.toThrow(NotFoundException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // getNotifications()
  // ══════════════════════════════════════════════════════════
  describe('getNotifications()', () => {
    it('returns tasksDueToday, tasksDueSoon, followupsToday and unreadCount', async () => {
      const taskShape = {
        ...mockTask,
        lead: { uuid: LEAD_UUID, status: 'HOT', user: { fullName: 'Test User' } },
      };
      mockPrisma.distributorTask.findMany
        .mockResolvedValueOnce([taskShape]) // tasksDueToday
        .mockResolvedValueOnce([]);          // tasksDueSoon
      mockPrisma.leadActivity.findMany.mockResolvedValue([]);

      const result = await service.getNotifications(DISTRIBUTOR_UUID);

      expect(result.tasksDueToday).toHaveLength(1);
      expect(result.tasksDueSoon).toHaveLength(0);
      expect(result.followupsToday).toHaveLength(0);
      expect(result.unreadCount).toBe(1);
    });

    it('returns empty arrays and zero unreadCount when nothing is due', async () => {
      mockPrisma.distributorTask.findMany.mockResolvedValue([]);
      mockPrisma.leadActivity.findMany.mockResolvedValue([]);

      const result = await service.getNotifications(DISTRIBUTOR_UUID);

      expect(result.tasksDueToday).toHaveLength(0);
      expect(result.tasksDueSoon).toHaveLength(0);
      expect(result.followupsToday).toHaveLength(0);
      expect(result.unreadCount).toBe(0);
    });

    it('includes followupAt activities in followupsToday', async () => {
      mockPrisma.distributorTask.findMany.mockResolvedValue([]);
      mockPrisma.leadActivity.findMany.mockResolvedValue([
        {
          followupAt: new Date(),
          notes: 'Call them',
          lead: { uuid: LEAD_UUID, status: 'HOT', user: { fullName: 'Test User' } },
        },
      ]);

      const result = await service.getNotifications(DISTRIBUTOR_UUID);

      expect(result.followupsToday).toHaveLength(1);
      expect(result.followupsToday[0].leadUuid).toBe(LEAD_UUID);
      expect(result.unreadCount).toBe(1);
    });
  });
});
