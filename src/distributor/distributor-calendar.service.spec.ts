import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DistributorCalendarService } from './distributor-calendar.service';
import { PrismaService } from '../prisma/prisma.service';

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const DISTRIBUTOR_UUID = '11111111-1111-1111-1111-111111111111';
const NOTE_UUID = '22222222-2222-2222-2222-222222222222';
const NOTE_UUID_2 = '22222222-2222-2222-2222-222222222223';
const NOTE_UUID_3 = '22222222-2222-2222-2222-222222222224';
const TASK_UUID = '44444444-4444-4444-4444-444444444444';
const LEAD_UUID = '33333333-3333-3333-3333-333333333333';
const OTHER_USER_UUID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const mockNote = {
  uuid: NOTE_UUID,
  distributorUuid: DISTRIBUTOR_UUID,
  date: new Date('2026-04-15T00:00:00.000Z'),
  note: 'Follow up with team about quarterly targets',
  time: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockActivity = {
  uuid: 'activity-uuid-1111-1111-111111111111',
  followupAt: new Date('2026-04-10T10:00:00.000Z'),
  notes: 'Check in on progress',
  lead: {
    uuid: LEAD_UUID,
    status: 'HOT',
    user: { fullName: 'Test User' },
  },
};

const mockTask = {
  uuid: TASK_UUID,
  distributorUuid: DISTRIBUTOR_UUID,
  title: 'Call John Doe',
  status: 'TODO',
  dueDate: new Date('2026-04-20T00:00:00.000Z'),
  order: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── Mocks ────────────────────────────────────────────────────────────────────
const mockPrisma = {
  leadActivity: {
    findMany: jest.fn(),
  },
  distributorCalendarNote: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  distributorTask: {
    findMany: jest.fn(),
  },
};

describe('DistributorCalendarService', () => {
  let service: DistributorCalendarService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DistributorCalendarService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DistributorCalendarService>(
      DistributorCalendarService,
    );
    jest.resetAllMocks();

    mockPrisma.leadActivity.findMany.mockResolvedValue([]);
    mockPrisma.distributorCalendarNote.findMany.mockResolvedValue([]);
    mockPrisma.distributorCalendarNote.findFirst.mockResolvedValue(null);
    mockPrisma.distributorCalendarNote.findUnique.mockResolvedValue(mockNote);
    mockPrisma.distributorCalendarNote.create.mockResolvedValue(mockNote);
    mockPrisma.distributorCalendarNote.update.mockResolvedValue(mockNote);
    mockPrisma.distributorCalendarNote.delete.mockResolvedValue(mockNote);
    mockPrisma.distributorTask.findMany.mockResolvedValue([]);
  });

  // ══════════════════════════════════════════════════════════
  // getCalendar()
  // ══════════════════════════════════════════════════════════
  describe('getCalendar()', () => {
    it('returns year, month and empty events when nothing scheduled', async () => {
      const result = await service.getCalendar(DISTRIBUTOR_UUID, 2026, 4);

      expect(result.year).toBe(2026);
      expect(result.month).toBe(4);
      expect(result.events).toHaveLength(0);
    });

    it('includes FOLLOWUP events from lead activities', async () => {
      mockPrisma.leadActivity.findMany.mockResolvedValue([mockActivity]);

      const result = await service.getCalendar(DISTRIBUTOR_UUID, 2026, 4);

      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe('FOLLOWUP');
      expect(result.events[0].leadUuid).toBe(LEAD_UUID);
      expect(result.events[0].title).toContain('Test User');
    });

    it('includes NOTE events from calendar notes', async () => {
      mockPrisma.distributorCalendarNote.findMany.mockResolvedValue([mockNote]);

      const result = await service.getCalendar(DISTRIBUTOR_UUID, 2026, 4);

      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe('NOTE');
      expect(result.events[0].uuid).toBe(NOTE_UUID);
      expect(result.events[0].content).toBe(mockNote.note);
    });

    it('includes TASK events from tasks with dueDate in month', async () => {
      mockPrisma.distributorTask.findMany.mockResolvedValue([mockTask]);

      const result = await service.getCalendar(DISTRIBUTOR_UUID, 2026, 4);

      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe('TASK');
      expect(result.events[0].uuid).toBe(TASK_UUID);
      expect(result.events[0].title).toBe('Call John Doe');
      expect(result.events[0].status).toBe('TODO');
    });

    it('tasks without dueDate do not appear (tasks query filters by dueDate)', async () => {
      // The service only fetches tasks where dueDate is in range — tasks without dueDate
      // are simply not returned by the query. The mock returns empty to simulate this.
      mockPrisma.distributorTask.findMany.mockResolvedValue([]);

      const result = await service.getCalendar(DISTRIBUTOR_UUID, 2026, 4);

      expect(result.events.filter((e) => e.type === 'TASK')).toHaveLength(0);
    });

    it('queries tasks with dueDate in the correct month range', async () => {
      await service.getCalendar(DISTRIBUTOR_UUID, 2026, 4);

      expect(mockPrisma.distributorTask.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            distributorUuid: DISTRIBUTOR_UUID,
            dueDate: expect.objectContaining({
              gte: expect.any(Date),
              lt: expect.any(Date),
            }),
          }),
        }),
      );
    });

    it('multiple notes on same day — all returned', async () => {
      const note1 = {
        ...mockNote,
        uuid: NOTE_UUID,
        time: '09:00',
        note: 'Morning standup',
      };
      const note2 = {
        ...mockNote,
        uuid: NOTE_UUID_2,
        time: '14:30',
        note: 'Afternoon review',
      };
      const note3 = {
        ...mockNote,
        uuid: NOTE_UUID_3,
        time: null,
        note: 'No-time note',
      };
      mockPrisma.distributorCalendarNote.findMany.mockResolvedValue([
        note1,
        note2,
        note3,
      ]);

      const result = await service.getCalendar(DISTRIBUTOR_UUID, 2026, 4);
      const noteEvents = result.events.filter((e) => e.type === 'NOTE');

      expect(noteEvents).toHaveLength(3);
    });

    it('notes with time sorted before notes without time on same date', async () => {
      const timedNote = {
        ...mockNote,
        uuid: NOTE_UUID,
        time: '09:00',
        date: new Date('2026-04-15T00:00:00.000Z'),
      };
      const untimedNote = {
        ...mockNote,
        uuid: NOTE_UUID_2,
        time: null,
        date: new Date('2026-04-15T00:00:00.000Z'),
      };
      mockPrisma.distributorCalendarNote.findMany.mockResolvedValue([
        untimedNote,
        timedNote,
      ]);

      const result = await service.getCalendar(DISTRIBUTOR_UUID, 2026, 4);
      const noteEvents = result.events.filter((e) => e.type === 'NOTE');

      expect(noteEvents[0].time).toBe('09:00');
      expect(noteEvents[1].time).toBeNull();
    });

    it('notes with earlier time come before notes with later time on same date', async () => {
      const early = { ...mockNote, uuid: NOTE_UUID, time: '09:00' };
      const late = { ...mockNote, uuid: NOTE_UUID_2, time: '22:00' };
      const mid = { ...mockNote, uuid: NOTE_UUID_3, time: '14:30' };
      mockPrisma.distributorCalendarNote.findMany.mockResolvedValue([
        late,
        early,
        mid,
      ]);

      const result = await service.getCalendar(DISTRIBUTOR_UUID, 2026, 4);
      const noteEvents = result.events.filter((e) => e.type === 'NOTE');

      expect(noteEvents[0].time).toBe('09:00');
      expect(noteEvents[1].time).toBe('14:30');
      expect(noteEvents[2].time).toBe('22:00');
    });

    it('sorts all event types by date ASC', async () => {
      mockPrisma.leadActivity.findMany.mockResolvedValue([mockActivity]);
      mockPrisma.distributorCalendarNote.findMany.mockResolvedValue([
        { ...mockNote, date: new Date('2026-04-20T00:00:00.000Z') },
      ]);

      const result = await service.getCalendar(DISTRIBUTOR_UUID, 2026, 4);

      const dates = result.events.map((e) => new Date(e.date).getTime());
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i]).toBeGreaterThanOrEqual(dates[i - 1]);
      }
    });

    it('mixed events on same date — timed items come before untimed', async () => {
      const timedNote = {
        ...mockNote,
        uuid: NOTE_UUID,
        time: '10:00',
        date: new Date('2026-04-20T00:00:00.000Z'),
      };
      const task = {
        ...mockTask,
        dueDate: new Date('2026-04-20T00:00:00.000Z'),
      }; // no time
      mockPrisma.distributorCalendarNote.findMany.mockResolvedValue([
        timedNote,
      ]);
      mockPrisma.distributorTask.findMany.mockResolvedValue([task]);

      const result = await service.getCalendar(DISTRIBUTOR_UUID, 2026, 4);
      const aprilEvents = result.events.filter((e) =>
        new Date(e.date).toISOString().startsWith('2026-04-20'),
      );

      expect(aprilEvents[0].time).toBe('10:00');
      expect(aprilEvents[1].time).toBeNull();
    });

    it('skips activities with null followupAt', async () => {
      mockPrisma.leadActivity.findMany.mockResolvedValue([
        { ...mockActivity, followupAt: null },
      ]);

      const result = await service.getCalendar(DISTRIBUTOR_UUID, 2026, 4);

      expect(result.events).toHaveLength(0);
    });

    it('queries lead activities within the correct date range', async () => {
      await service.getCalendar(DISTRIBUTOR_UUID, 2026, 4);

      expect(mockPrisma.leadActivity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ actorUuid: DISTRIBUTOR_UUID }),
        }),
      );
    });
  });

  // ══════════════════════════════════════════════════════════
  // createNote()
  // ══════════════════════════════════════════════════════════
  describe('createNote()', () => {
    const dto = { date: '2026-04-15', note: 'Team meeting at 3pm' };

    it('always creates a new note (never upserts)', async () => {
      mockPrisma.distributorCalendarNote.create.mockResolvedValue({
        ...mockNote,
        note: dto.note,
      });

      await service.createNote(DISTRIBUTOR_UUID, dto);

      expect(mockPrisma.distributorCalendarNote.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            distributorUuid: DISTRIBUTOR_UUID,
            note: dto.note,
          }),
        }),
      );
      // Never looks up existing note first
      expect(
        mockPrisma.distributorCalendarNote.findFirst,
      ).not.toHaveBeenCalled();
    });

    it('creates two notes on the same date (both exist independently)', async () => {
      const dto1 = { date: '2026-04-15', note: 'First note' };
      const dto2 = { date: '2026-04-15', note: 'Second note' };

      mockPrisma.distributorCalendarNote.create
        .mockResolvedValueOnce({
          ...mockNote,
          uuid: NOTE_UUID,
          note: dto1.note,
        })
        .mockResolvedValueOnce({
          ...mockNote,
          uuid: NOTE_UUID_2,
          note: dto2.note,
        });

      await service.createNote(DISTRIBUTOR_UUID, dto1);
      await service.createNote(DISTRIBUTOR_UUID, dto2);

      expect(mockPrisma.distributorCalendarNote.create).toHaveBeenCalledTimes(
        2,
      );
    });

    it('stores optional time when provided', async () => {
      const dtoWithTime = {
        date: '2026-04-15',
        note: 'Meeting',
        time: '14:30',
      };
      mockPrisma.distributorCalendarNote.create.mockResolvedValue({
        ...mockNote,
        time: '14:30',
      });

      await service.createNote(DISTRIBUTOR_UUID, dtoWithTime);

      expect(mockPrisma.distributorCalendarNote.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ time: '14:30' }),
        }),
      );
    });

    it('stores null time when time not provided', async () => {
      await service.createNote(DISTRIBUTOR_UUID, dto);

      expect(mockPrisma.distributorCalendarNote.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ time: null }),
        }),
      );
    });

    it('normalizes date to midnight UTC', async () => {
      await service.createNote(DISTRIBUTOR_UUID, dto);

      const createCall =
        mockPrisma.distributorCalendarNote.create.mock.calls[0];
      const dateArg: Date = createCall[0].data.date;
      expect(dateArg.toISOString()).toBe('2026-04-15T00:00:00.000Z');
    });
  });

  // ══════════════════════════════════════════════════════════
  // getNoteForEdit()
  // ══════════════════════════════════════════════════════════
  describe('getNoteForEdit()', () => {
    it('returns note fields for editing', async () => {
      mockPrisma.distributorCalendarNote.findFirst.mockResolvedValue(mockNote);

      const result = await service.getNoteForEdit(DISTRIBUTOR_UUID, NOTE_UUID);

      expect(result).toMatchObject({
        uuid: NOTE_UUID,
        date: mockNote.date,
        time: null,
        note: mockNote.note,
      });
    });

    it('throws NotFoundException when note not found', async () => {
      mockPrisma.distributorCalendarNote.findFirst.mockResolvedValue(null);

      await expect(
        service.getNoteForEdit(DISTRIBUTOR_UUID, NOTE_UUID),
      ).rejects.toThrow(NotFoundException);
    });

    it('enforces ownership — only finds note scoped to distributorUuid', async () => {
      await service.getNoteForEdit(DISTRIBUTOR_UUID, NOTE_UUID).catch(() => {});

      expect(mockPrisma.distributorCalendarNote.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            uuid: NOTE_UUID,
            distributorUuid: DISTRIBUTOR_UUID,
          }),
        }),
      );
    });
  });

  // ══════════════════════════════════════════════════════════
  // updateNote()
  // ══════════════════════════════════════════════════════════
  describe('updateNote()', () => {
    it('updates note content', async () => {
      mockPrisma.distributorCalendarNote.findFirst.mockResolvedValue(mockNote);
      const updatedNote = { ...mockNote, note: 'Updated content' };
      mockPrisma.distributorCalendarNote.update.mockResolvedValue(updatedNote);

      const result = await service.updateNote(DISTRIBUTOR_UUID, NOTE_UUID, {
        note: 'Updated content',
      });

      expect(mockPrisma.distributorCalendarNote.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { uuid: NOTE_UUID },
          data: expect.objectContaining({ note: 'Updated content' }),
        }),
      );
      expect(result.note).toBe('Updated content');
    });

    it('updates note time', async () => {
      mockPrisma.distributorCalendarNote.findFirst.mockResolvedValue(mockNote);
      mockPrisma.distributorCalendarNote.update.mockResolvedValue({
        ...mockNote,
        time: '09:00',
      });

      await service.updateNote(DISTRIBUTOR_UUID, NOTE_UUID, { time: '09:00' });

      expect(mockPrisma.distributorCalendarNote.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ time: '09:00' }),
        }),
      );
    });

    it('updates note date', async () => {
      mockPrisma.distributorCalendarNote.findFirst.mockResolvedValue(mockNote);
      mockPrisma.distributorCalendarNote.update.mockResolvedValue(mockNote);

      await service.updateNote(DISTRIBUTOR_UUID, NOTE_UUID, {
        date: '2026-04-25',
      });

      expect(mockPrisma.distributorCalendarNote.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            date: new Date('2026-04-25T00:00:00.000Z'),
          }),
        }),
      );
    });

    it('throws NotFoundException when note belongs to a different user', async () => {
      mockPrisma.distributorCalendarNote.findFirst.mockResolvedValue(null);

      await expect(
        service.updateNote(OTHER_USER_UUID, NOTE_UUID, {
          note: 'Hack attempt',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when note does not exist', async () => {
      mockPrisma.distributorCalendarNote.findFirst.mockResolvedValue(null);

      await expect(
        service.updateNote(DISTRIBUTOR_UUID, 'nonexistent-uuid', { note: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('does not update fields that are undefined in the dto', async () => {
      mockPrisma.distributorCalendarNote.findFirst.mockResolvedValue(mockNote);
      mockPrisma.distributorCalendarNote.update.mockResolvedValue(mockNote);

      await service.updateNote(DISTRIBUTOR_UUID, NOTE_UUID, {
        note: 'Only note updated',
      });

      const updateCall =
        mockPrisma.distributorCalendarNote.update.mock.calls[0];
      expect(updateCall[0].data).not.toHaveProperty('time');
      expect(updateCall[0].data).not.toHaveProperty('date');
    });
  });

  // ══════════════════════════════════════════════════════════
  // deleteNote()
  // ══════════════════════════════════════════════════════════
  describe('deleteNote()', () => {
    it('deletes note successfully', async () => {
      const result = await service.deleteNote(DISTRIBUTOR_UUID, NOTE_UUID);

      expect(mockPrisma.distributorCalendarNote.delete).toHaveBeenCalledWith({
        where: { uuid: NOTE_UUID },
      });
      expect(result.message).toBe('Note deleted successfully');
    });

    it('throws NotFoundException when note not found', async () => {
      mockPrisma.distributorCalendarNote.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteNote(DISTRIBUTOR_UUID, NOTE_UUID),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when note belongs to different distributor', async () => {
      mockPrisma.distributorCalendarNote.findUnique.mockResolvedValue({
        ...mockNote,
        distributorUuid: 'other-distributor',
      });

      await expect(
        service.deleteNote(DISTRIBUTOR_UUID, NOTE_UUID),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
