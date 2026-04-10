import { InternalServerErrorException } from '@nestjs/common';
import { generateDistributorCode } from './distributor-code.helper';

// ─── Mock PrismaService ───────────────────────────────────────────────────────
const mockPrisma = {
  user: {
    findFirst: jest.fn(),
  },
};

describe('generateDistributorCode()', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns a code in NSI-XXXXXX format when no collision exists', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);

    const code = await generateDistributorCode(mockPrisma as any);

    expect(code).toMatch(/^NSI-[A-Z0-9]{6}$/);
  });

  it('checks DB for uniqueness before returning code', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);

    await generateDistributorCode(mockPrisma as any);

    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ distributorCode: expect.stringMatching(/^NSI-/) }),
      }),
    );
  });

  it('retries on collision and returns unique code on second attempt', async () => {
    mockPrisma.user.findFirst
      .mockResolvedValueOnce({ uuid: 'existing-user' }) // collision on attempt 1
      .mockResolvedValue(null);                          // success on attempt 2

    const code = await generateDistributorCode(mockPrisma as any);

    expect(code).toMatch(/^NSI-[A-Z0-9]{6}$/);
    expect(mockPrisma.user.findFirst).toHaveBeenCalledTimes(2);
  });

  it('retries multiple times if needed (up to 5)', async () => {
    mockPrisma.user.findFirst
      .mockResolvedValueOnce({ uuid: 'u1' })
      .mockResolvedValueOnce({ uuid: 'u2' })
      .mockResolvedValueOnce({ uuid: 'u3' })
      .mockResolvedValue(null);

    const code = await generateDistributorCode(mockPrisma as any);

    expect(code).toMatch(/^NSI-[A-Z0-9]{6}$/);
    expect(mockPrisma.user.findFirst).toHaveBeenCalledTimes(4);
  });

  it('throws InternalServerErrorException after 5 consecutive collisions', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ uuid: 'always-collides' });

    await expect(generateDistributorCode(mockPrisma as any)).rejects.toThrow(InternalServerErrorException);
    expect(mockPrisma.user.findFirst).toHaveBeenCalledTimes(5);
  });

  it('uses only uppercase alphanumeric characters in suffix', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);

    const code = await generateDistributorCode(mockPrisma as any);
    const suffix = code.replace('NSI-', '');

    expect(suffix).toMatch(/^[A-Z0-9]{6}$/);
  });
});
