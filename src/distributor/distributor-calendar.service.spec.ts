import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DistributorCalendarService } from './distributor-calendar.service';
import { PrismaService } from '../prisma/prisma.service';

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const DISTRIBUTOR_UUID = '11111111-1111-1111-1111-111111111111';
const NOTE_UUID        = '22222222-2222-2222-2222-222222222222';
const LEAD_UUID        = '33333333-3333-3333-3333-333333333333';

const mockNote = {
  uuid: NOTE_UUID,
  distributorUuid: DISTRIBUTOR_UUID,
  date: new Date('2026-04-15T00:00:00.000Z'),
  note: 'Follow up with team about quarterly targets',
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

    service = module.get<DistributorCalendarService>(DistributorCalendarService);
    jest.resetAllMocks();

    mockPrisma.leadActivity.findMany.mockResolvedValue([]);
    mockPrisma.distributorCalendarNote.findMany.mockResolvedValue([]);
    mockPrisma.distributorCalendarNote.findFirst.mockResolvedValue(null);
    mockPrisma.distributorCalendarNote.findUnique.mockResolvedValue(mockNote);
    mockPrisma.distributorCalendarNote.create.mockResolvedValue(mockNote);
    mockPrisma.distributorCalendarNote.update.mockResolvedValue(mockNote);
    mockPrisma.distributorCalendarNote.delete.mockResolvedValue(mockNote);
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

    it('includes PERSONAL_NOTE events from calendar notes', async () => {
      mockPrisma.distributorCalendarNote.findMany.mockResolvedValue([mockNote]);

      const result = await service.getCalendar(DISTRIBUTOR_UUID, 2026, 4);

      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe('PERSONAL_NOTE');
      expect(result.events[0].noteUuid).toBe(NOTE_UUID);
    });

    it('sorts events by date ASC', async () => {
      mockPrisma.leadActivity.findMany.mockResolvedValue([mockActivity]);
      mockPrisma.distributorCalendarNote.findMany.mockResolvedValue([
        { ...mockNote, date: new Date('2026-04-20T00:00:00.000Z') },
      ]);

      const result = await service.getCalendar(DISTRIBUTOR_UUID, 2026, 4);

      expect(result.events[0].date < result.events[1].date).toBe(true);
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
  // upsertNote()
  // ══════════════════════════════════════════════════════════
  describe('upsertNote()', () => {
    const dto = { date: '2026-04-15', note: 'Team meeting at 3pm' };

    it('creates a new note when none exists for that date', async () => {
      mockPrisma.distributorCalendarNote.findFirst.mockResolvedValue(null);
      mockPrisma.distributorCalendarNote.create.mockResolvedValue({ ...mockNote, note: dto.note });

      const result = await service.upsertNote(DISTRIBUTOR_UUID, dto);

      expect(mockPrisma.distributorCalendarNote.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            distributorUuid: DISTRIBUTOR_UUID,
            note: dto.note,
          }),
        }),
      );
    });

    it('updates existing note when one already exists for that date', async () => {
      mockPrisma.distributorCalendarNote.findFirst.mockResolvedValue(mockNote);
      mockPrisma.distributorCalendarNote.update.mockResolvedValue({ ...mockNote, note: dto.note });

      const result = await service.upsertNote(DISTRIBUTOR_UUID, dto);

      expect(mockPrisma.distributorCalendarNote.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { uuid: NOTE_UUID },
          data: { note: dto.note },
        }),
      );
      expect(mockPrisma.distributorCalendarNote.create).not.toHaveBeenCalled();
    });

    it('normalizes date to midnight UTC', async () => {
      await service.upsertNote(DISTRIBUTOR_UUID, dto);

      const createCall = mockPrisma.distributorCalendarNote.create.mock.calls[0];
      if (createCall) {
        const dateArg: Date = createCall[0].data.date;
        expect(dateArg.toISOString()).toBe('2026-04-15T00:00:00.000Z');
      }
    });
  });

  // ══════════════════════════════════════════════════════════
  // deleteNote()
  // ══════════════════════════════════════════════════════════
  describe('deleteNote()', () => {
    it('deletes note successfully', async () => {
      const result = await service.deleteNote(DISTRIBUTOR_UUID, NOTE_UUID);

      expect(mockPrisma.distributorCalendarNote.delete).toHaveBeenCalledWith({ where: { uuid: NOTE_UUID } });
      expect(result.message).toBe('Note deleted successfully');
    });

    it('throws NotFoundException when note not found', async () => {
      mockPrisma.distributorCalendarNote.findUnique.mockResolvedValue(null);

      await expect(service.deleteNote(DISTRIBUTOR_UUID, NOTE_UUID)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when note belongs to different distributor', async () => {
      mockPrisma.distributorCalendarNote.findUnique.mockResolvedValue({
        ...mockNote,
        distributorUuid: 'other-distributor',
      });

      await expect(service.deleteNote(DISTRIBUTOR_UUID, NOTE_UUID)).rejects.toThrow(NotFoundException);
    });
  });
});
