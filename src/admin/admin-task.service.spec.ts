import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminTaskService } from './admin-task.service';
import { PrismaService } from '../prisma/prisma.service';
import { SseService } from '../sse/sse.service';
import { TaskStatus } from '@prisma/client';

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const ADMIN_UUID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const TASK_UUID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const LEAD_UUID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const OTHER_UUID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

const mockLead = {
  uuid: LEAD_UUID,
  status: 'HOT',
  user: { fullName: 'Jane Prospect', avatarUrl: null },
};

const mockTask = {
  uuid: TASK_UUID,
  distributorUuid: ADMIN_UUID,
  title: 'Review quarterly report',
  status: TaskStatus.TODO,
  order: 1,
  dueDate: null,
  createdAt: new Date('2026-04-01'),
  lead: null,
};

const mockTaskWithLead = { ...mockTask, lead: mockLead };

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
};

const mockSseService = {
  sendToUser: jest.fn(),
  sendToRole: jest.fn(),
  sendToAll: jest.fn(),
};

describe('AdminTaskService', () => {
  let service: AdminTaskService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminTaskService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SseService, useValue: mockSseService },
      ],
    }).compile();

    service = module.get<AdminTaskService>(AdminTaskService);
    jest.resetAllMocks();

    // sensible defaults
    mockPrisma.distributorTask.findMany.mockResolvedValue([]);
    mockPrisma.distributorTask.findUnique.mockResolvedValue(mockTask);
    mockPrisma.distributorTask.count.mockResolvedValue(2);
    mockPrisma.distributorTask.create.mockResolvedValue(mockTask);
    mockPrisma.distributorTask.update.mockResolvedValue(mockTask);
    mockPrisma.distributorTask.delete.mockResolvedValue(mockTask);
    mockPrisma.lead.findUnique.mockResolvedValue(null);
  });

  // ══════════════════════════════════════════════════════════
  // getTasks()
  // ══════════════════════════════════════════════════════════
  describe('getTasks()', () => {
    it('returns grouped tasks with TODO, IN_PROGRESS, COMPLETE buckets', async () => {
      mockPrisma.distributorTask.findMany.mockResolvedValue([mockTask]);

      const result = await service.getTasks(ADMIN_UUID);

      expect(result).toHaveProperty('TODO');
      expect(result).toHaveProperty('IN_PROGRESS');
      expect(result).toHaveProperty('COMPLETE');
      expect(result.TODO).toHaveLength(1);
    });

    it('returns empty buckets when no tasks exist', async () => {
      const result = await service.getTasks(ADMIN_UUID);

      expect(result.TODO).toHaveLength(0);
      expect(result.IN_PROGRESS).toHaveLength(0);
      expect(result.COMPLETE).toHaveLength(0);
    });

    it('groups tasks by status correctly', async () => {
      const inProgress = {
        ...mockTask,
        uuid: 'other',
        status: TaskStatus.IN_PROGRESS,
      };
      mockPrisma.distributorTask.findMany.mockResolvedValue([
        mockTask,
        inProgress,
      ]);

      const result = await service.getTasks(ADMIN_UUID);

      expect(result.TODO).toHaveLength(1);
      expect(result.IN_PROGRESS).toHaveLength(1);
      expect(result.COMPLETE).toHaveLength(0);
    });

    it('maps lead to simplified shape with userFullName', async () => {
      mockPrisma.distributorTask.findMany.mockResolvedValue([mockTaskWithLead]);

      const result = await service.getTasks(ADMIN_UUID);

      expect((result.TODO[0] as any).lead.userFullName).toBe('Jane Prospect');
    });

    it('queries with admin UUID as distributorUuid', async () => {
      await service.getTasks(ADMIN_UUID);

      expect(mockPrisma.distributorTask.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { distributorUuid: ADMIN_UUID } }),
      );
    });
  });

  // ══════════════════════════════════════════════════════════
  // createTask()
  // ══════════════════════════════════════════════════════════
  describe('createTask()', () => {
    it('creates a task without leadUuid', async () => {
      const dto = { title: 'New Admin Task' };

      const result = await service.createTask(ADMIN_UUID, dto as any);

      expect(mockPrisma.distributorTask.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            distributorUuid: ADMIN_UUID,
            title: 'New Admin Task',
            order: 3, // count(2) + 1
          }),
        }),
      );
      expect(result.uuid).toBe(TASK_UUID);
    });

    it('creates a task with a valid leadUuid', async () => {
      const dto = { title: 'Task with Lead', leadUuid: LEAD_UUID };
      mockPrisma.lead.findUnique.mockResolvedValue({ uuid: LEAD_UUID });
      mockPrisma.distributorTask.create.mockResolvedValue(mockTaskWithLead);

      await service.createTask(ADMIN_UUID, dto as any);

      expect(mockPrisma.lead.findUnique).toHaveBeenCalledWith({
        where: { uuid: LEAD_UUID },
      });
      expect(mockPrisma.distributorTask.create).toHaveBeenCalled();
    });

    it('throws BadRequestException when leadUuid does not exist', async () => {
      const dto = { title: 'Task', leadUuid: LEAD_UUID };
      mockPrisma.lead.findUnique.mockResolvedValue(null);

      await expect(service.createTask(ADMIN_UUID, dto as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('does NOT enforce distributor ownership on leads (admin can use any lead)', async () => {
      // lead belongs to a different distributor — admin should still be allowed
      const dto = { title: 'Cross-distributor task', leadUuid: LEAD_UUID };
      mockPrisma.lead.findUnique.mockResolvedValue({
        uuid: LEAD_UUID,
        distributorUuid: OTHER_UUID,
      });
      mockPrisma.distributorTask.create.mockResolvedValue(mockTask);

      await expect(
        service.createTask(ADMIN_UUID, dto as any),
      ).resolves.toBeDefined();
    });
  });

  // ══════════════════════════════════════════════════════════
  // getTaskForUpdate()
  // ══════════════════════════════════════════════════════════
  describe('getTaskForUpdate()', () => {
    it('returns task edit fields for admin-owned task', async () => {
      const result = await service.getTaskForUpdate(ADMIN_UUID, TASK_UUID);

      expect(result).toMatchObject({
        title: mockTask.title,
        status: mockTask.status,
        order: mockTask.order,
      });
    });

    it('throws NotFoundException when task not found', async () => {
      mockPrisma.distributorTask.findUnique.mockResolvedValue(null);

      await expect(
        service.getTaskForUpdate(ADMIN_UUID, TASK_UUID),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when task belongs to another user', async () => {
      mockPrisma.distributorTask.findUnique.mockResolvedValue({
        ...mockTask,
        distributorUuid: OTHER_UUID,
      });

      await expect(
        service.getTaskForUpdate(ADMIN_UUID, TASK_UUID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // updateTask()
  // ══════════════════════════════════════════════════════════
  describe('updateTask()', () => {
    it('updates task title successfully', async () => {
      const dto = { title: 'Updated Title' };
      mockPrisma.distributorTask.update.mockResolvedValue({
        ...mockTask,
        title: 'Updated Title',
      });

      const result = await service.updateTask(
        ADMIN_UUID,
        TASK_UUID,
        dto as any,
      );

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

      await expect(
        service.updateTask(ADMIN_UUID, TASK_UUID, {} as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when task belongs to another user', async () => {
      mockPrisma.distributorTask.findUnique.mockResolvedValue({
        ...mockTask,
        distributorUuid: OTHER_UUID,
      });

      await expect(
        service.updateTask(ADMIN_UUID, TASK_UUID, {} as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when leadUuid does not exist', async () => {
      const dto = { leadUuid: LEAD_UUID };
      mockPrisma.lead.findUnique.mockResolvedValue(null);

      await expect(
        service.updateTask(ADMIN_UUID, TASK_UUID, dto as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows any valid lead regardless of distributorUuid', async () => {
      const dto = { leadUuid: LEAD_UUID };
      mockPrisma.lead.findUnique.mockResolvedValue({
        uuid: LEAD_UUID,
        distributorUuid: OTHER_UUID,
      });
      mockPrisma.distributorTask.update.mockResolvedValue(mockTask);

      await expect(
        service.updateTask(ADMIN_UUID, TASK_UUID, dto as any),
      ).resolves.toBeDefined();
    });
  });

  // ══════════════════════════════════════════════════════════
  // moveTask()
  // ══════════════════════════════════════════════════════════
  describe('moveTask()', () => {
    it('moves task to IN_PROGRESS with new order', async () => {
      const dto = { status: TaskStatus.IN_PROGRESS, order: 2 };
      mockPrisma.distributorTask.update.mockResolvedValue({
        ...mockTask,
        status: TaskStatus.IN_PROGRESS,
      });

      await service.moveTask(ADMIN_UUID, TASK_UUID, dto);

      expect(mockPrisma.distributorTask.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: TaskStatus.IN_PROGRESS, order: 2 },
        }),
      );
    });

    it('throws NotFoundException when task not found', async () => {
      mockPrisma.distributorTask.findUnique.mockResolvedValue(null);

      await expect(
        service.moveTask(ADMIN_UUID, TASK_UUID, {
          status: TaskStatus.COMPLETE,
          order: 1,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when task belongs to another user', async () => {
      mockPrisma.distributorTask.findUnique.mockResolvedValue({
        ...mockTask,
        distributorUuid: OTHER_UUID,
      });

      await expect(
        service.moveTask(ADMIN_UUID, TASK_UUID, {
          status: TaskStatus.COMPLETE,
          order: 1,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // deleteTask()
  // ══════════════════════════════════════════════════════════
  describe('deleteTask()', () => {
    it('deletes task successfully', async () => {
      const result = await service.deleteTask(ADMIN_UUID, TASK_UUID);

      expect(mockPrisma.distributorTask.delete).toHaveBeenCalledWith({
        where: { uuid: TASK_UUID },
      });
      expect(result.message).toBe('Task deleted successfully');
    });

    it('throws NotFoundException when task not found', async () => {
      mockPrisma.distributorTask.findUnique.mockResolvedValue(null);

      await expect(service.deleteTask(ADMIN_UUID, TASK_UUID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when task belongs to another user', async () => {
      mockPrisma.distributorTask.findUnique.mockResolvedValue({
        ...mockTask,
        distributorUuid: OTHER_UUID,
      });

      await expect(service.deleteTask(ADMIN_UUID, TASK_UUID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('does not delete tasks scoped to another user', async () => {
      mockPrisma.distributorTask.findUnique.mockResolvedValue({
        ...mockTask,
        distributorUuid: OTHER_UUID,
      });

      await expect(service.deleteTask(ADMIN_UUID, TASK_UUID)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.distributorTask.delete).not.toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════
  // getTaskNotifications()
  // ══════════════════════════════════════════════════════════
  describe('getTaskNotifications()', () => {
    it('returns tasksDueToday and overdueTasks arrays', async () => {
      const result = await service.getTaskNotifications(ADMIN_UUID);

      expect(result).toHaveProperty('tasksDueToday');
      expect(result).toHaveProperty('overdueTasks');
    });

    it('returns empty arrays when nothing is due', async () => {
      const result = await service.getTaskNotifications(ADMIN_UUID);

      expect(result.tasksDueToday).toHaveLength(0);
      expect(result.overdueTasks).toHaveLength(0);
    });

    it('maps tasks due today correctly', async () => {
      const taskShape = {
        ...mockTask,
        dueDate: new Date(),
        lead: {
          uuid: LEAD_UUID,
          status: 'HOT',
          user: { fullName: 'Jane Prospect' },
        },
      };
      mockPrisma.distributorTask.findMany
        .mockResolvedValueOnce([taskShape]) // tasksDueToday
        .mockResolvedValueOnce([]); // overdueTasks

      const result = await service.getTaskNotifications(ADMIN_UUID);

      expect(result.tasksDueToday).toHaveLength(1);
      expect(result.tasksDueToday[0].uuid).toBe(TASK_UUID);
      expect(result.tasksDueToday[0].lead?.userFullName).toBe('Jane Prospect');
    });

    it('maps overdue tasks correctly', async () => {
      const overdueTask = {
        ...mockTask,
        dueDate: new Date('2026-01-01'),
        lead: null,
      };
      mockPrisma.distributorTask.findMany
        .mockResolvedValueOnce([]) // tasksDueToday
        .mockResolvedValueOnce([overdueTask]); // overdueTasks

      const result = await service.getTaskNotifications(ADMIN_UUID);

      expect(result.overdueTasks).toHaveLength(1);
      expect(result.overdueTasks[0].uuid).toBe(TASK_UUID);
      expect(result.overdueTasks[0].lead).toBeNull();
    });

    it('queries using admin UUID as distributorUuid', async () => {
      await service.getTaskNotifications(ADMIN_UUID);

      expect(mockPrisma.distributorTask.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ distributorUuid: ADMIN_UUID }),
        }),
      );
    });

    it('excludes COMPLETE tasks from notifications', async () => {
      await service.getTaskNotifications(ADMIN_UUID);

      const calls = mockPrisma.distributorTask.findMany.mock.calls;
      for (const [arg] of calls) {
        expect(arg.where.status).toEqual({ not: TaskStatus.COMPLETE });
      }
    });
  });
});
