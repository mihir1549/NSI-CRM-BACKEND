import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

interface CacheEntry {
  value: string;
  expiresAt: number;
}

@Injectable()
export class SocialConfigService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly CACHE_TTL_MS = 60_000;

  constructor(private readonly prisma: PrismaService) {}

  async get(key: string, defaultValue = ''): Promise<string> {
    const now = Date.now();
    const cached = this.cache.get(key);

    if (cached && cached.expiresAt > now) {
      return cached.value;
    }

    const config = await this.prisma.socialConfig.findUnique({
      where: { key },
    });

    if (!config) {
      return defaultValue;
    }

    this.cache.set(key, {
      value: config.value,
      expiresAt: now + this.CACHE_TTL_MS,
    });

    return config.value;
  }

  async getNumber(key: string, defaultValue: number): Promise<number> {
    const raw = await this.get(key);
    const parsed = parseInt(raw, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  async getAll(): Promise<Record<string, string>> {
    const rows = await this.prisma.socialConfig.findMany();
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }
}
