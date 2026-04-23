import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service.js';
import { UsersService } from '../users/users.service.js';
import { OtpService } from '../otp/otp.service.js';
import { MailService } from '../mail/mail.service.js';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TrackingService } from '../tracking/tracking.service.js';
import { CloudinaryAvatarService } from '../common/cloudinary/cloudinary-avatar.service.js';
import { LeadsService } from '../leads/leads.service.js';

describe('AuthService (SSE Ticket)', () => {
  let service: AuthService;

  const mockPrisma = {
    authSession: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: {} },
        { provide: OtpService, useValue: {} },
        { provide: MailService, useValue: {} },
        { provide: AuditService, useValue: {} },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('7d') } },
        { provide: TrackingService, useValue: {} },
        { provide: CloudinaryAvatarService, useValue: {} },
        { provide: LeadsService, useValue: {} },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('1. storeSSETicket returns a UUID string', () => {
    const ticket = service.storeSSETicket('user-1', 'CUSTOMER');
    expect(typeof ticket).toBe('string');
    expect(ticket.length).toBeGreaterThan(0);
  });

  it('2. redeemSSETicket returns userUuid+role and is deleted after first use', async () => {
    const ticket = service.storeSSETicket('user-1', 'CUSTOMER');
    const result = await service.redeemSSETicket(ticket);
    
    expect(result).toEqual({ userUuid: 'user-1', role: 'CUSTOMER' });
    
    // Second call should return null
    const secondResult = await service.redeemSSETicket(ticket);
    expect(secondResult).toBeNull();
  });
});
