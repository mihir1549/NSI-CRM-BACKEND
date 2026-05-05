import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MetaLeadService } from './meta-lead.service';
import { PrismaService } from '../prisma/prisma.service';

const DIST_UUID = 'dist-uuid-1';
const META_LEAD_UUID = 'meta-lead-uuid-1';
const USER_UUID = 'user-uuid-1';

const mockMetaLead = {
  uuid: META_LEAD_UUID,
  distributorUuid: DIST_UUID,
  fullName: 'Rahul Sharma',
  phone: '+919876543210',
  email: 'rahul@example.com',
  status: 'NEW',
  createdAt: new Date(),
};

const mockPrisma = {
  metaLead: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

describe('MetaLeadService', () => {
  let service: MetaLeadService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetaLeadService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<MetaLeadService>(MetaLeadService);
  });

  // ── getMyMetaLeads ────────────────────────────────────────────────────────

  describe('getMyMetaLeads', () => {
    it('returns paginated results for distributor', async () => {
      mockPrisma.metaLead.findMany.mockResolvedValue([mockMetaLead]);
      mockPrisma.metaLead.count.mockResolvedValue(25);

      const result = await service.getMyMetaLeads(DIST_UUID, 2, 10);

      expect(result.items).toEqual([mockMetaLead]);
      expect(result.total).toBe(25);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(3);
      expect(mockPrisma.metaLead.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { distributorUuid: DIST_UUID },
          skip: 10,
          take: 10,
        }),
      );
    });

    it('returns empty list when no leads', async () => {
      mockPrisma.metaLead.findMany.mockResolvedValue([]);
      mockPrisma.metaLead.count.mockResolvedValue(0);

      const result = await service.getMyMetaLeads(DIST_UUID);

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });
  });

  // ── markConverted ─────────────────────────────────────────────────────────

  describe('markConverted', () => {
    it('updates status to CONVERTED and sets userUuid', async () => {
      mockPrisma.metaLead.findUnique.mockResolvedValue(mockMetaLead);
      mockPrisma.metaLead.update.mockResolvedValue({
        ...mockMetaLead,
        status: 'CONVERTED',
        userUuid: USER_UUID,
      });

      const result = await service.markConverted(META_LEAD_UUID, USER_UUID);

      expect(result.status).toBe('CONVERTED');
      expect(result.userUuid).toBe(USER_UUID);
      expect(mockPrisma.metaLead.update).toHaveBeenCalledWith({
        where: { uuid: META_LEAD_UUID },
        data: { status: 'CONVERTED', userUuid: USER_UUID },
      });
    });

    it('throws NotFoundException when meta lead missing', async () => {
      mockPrisma.metaLead.findUnique.mockResolvedValue(null);

      await expect(
        service.markConverted(META_LEAD_UUID, USER_UUID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── getAllMetaLeadsAdmin ──────────────────────────────────────────────────

  describe('getAllMetaLeadsAdmin', () => {
    it('returns all leads paginated with distributor info', async () => {
      const leadWithDist = {
        ...mockMetaLead,
        distributor: { fullName: 'Distributor Name', distributorCode: 'RAJ123' },
      };
      mockPrisma.metaLead.findMany.mockResolvedValue([leadWithDist]);
      mockPrisma.metaLead.count.mockResolvedValue(1);

      const result = await service.getAllMetaLeadsAdmin(1, 20);

      expect(result.items[0].distributor?.distributorCode).toBe('RAJ123');
      expect(mockPrisma.metaLead.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            distributor: {
              select: { fullName: true, distributorCode: true },
            },
          },
        }),
      );
    });
  });
});
