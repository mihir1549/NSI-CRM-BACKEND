import { Injectable, Logger, Request } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CaptureUtmDto } from './dto/capture-utm.dto.js';
import * as geoip from 'geoip-lite';

export interface AcquisitionData {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  referrerUrl?: string;
  landingPage?: string;
  distributorCode?: string;
  distributorUuid?: string;
  ipAddress?: string;
  country?: string;
  city?: string;
  deviceType?: string;
  browser?: string;
}

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async capture(
    dto: CaptureUtmDto,
    req: import('express').Request,
  ): Promise<{ ok: boolean }> {
    // Extract IP
    const forwarded = req.headers['x-forwarded-for'] as string | undefined;
    const ipAddress = forwarded
      ? forwarded.split(',')[0].trim()
      : (req.ip ?? '');

    // GeoIP lookup
    const geo = geoip.lookup(ipAddress);
    const country = geo?.country ?? undefined;
    const city = geo?.city ?? undefined;

    // Distributor lookup — resolve distributorCode to distributorUuid
    let distributorUuid: string | undefined;
    if (dto.distributorCode) {
      const distributor = await this.prisma.user
        .findFirst({
          where: { distributorCode: dto.distributorCode, role: 'DISTRIBUTOR' },
        })
        .catch(() => null);
      // Only assign if distributor exists and their join link is active
      if (distributor && distributor.joinLinkActive) {
        distributorUuid = distributor.uuid;
      }
      // If joinLinkActive === false: treat as direct registration (no distributorUuid assigned)
    }

    const acquisitionData: AcquisitionData = {
      utmSource: dto.utmSource,
      utmMedium: dto.utmMedium,
      utmCampaign: dto.utmCampaign,
      utmContent: dto.utmContent,
      utmTerm: dto.utmTerm,
      referrerUrl: dto.referrerUrl,
      landingPage: dto.landingPage,
      distributorCode: dto.distributorCode,
      distributorUuid,
      ipAddress,
      country,
      city,
      deviceType: dto.deviceType,
      browser: dto.browser,
    };

    // Store in httpOnly session cookie (24h)
    const res = (req as unknown as { res: import('express').Response }).res;
    if (res) {
      res.cookie('nsi_acquisition', JSON.stringify(acquisitionData), {
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      });
    }

    // If user is already authenticated, upsert immediately
    const jwtUser = (req as unknown as { user?: { sub?: string } }).user;
    if (jwtUser?.sub) {
      await this.upsertAcquisition(jwtUser.sub, acquisitionData);
    }

    return { ok: true };
  }

  /**
   * Called from AuthService after email OTP verified — attaches acquisition data to the newly known user.
   */
  async attachToUser(
    userUuid: string,
    req: import('express').Request,
  ): Promise<void> {
    try {
      const cookie = (req.cookies as Record<string, string | undefined>)[
        'nsi_acquisition'
      ];
      if (!cookie) return;

      let acquisitionData: AcquisitionData;
      try {
        acquisitionData = JSON.parse(cookie) as AcquisitionData;
      } catch (err) {
        // Malformed cookie — skip silently rather than 500 the request
        return;
      }

      // Always call upsert. Whether a row exists or not, upsertAcquisition
      // will merge UTM data in without overwriting existing distributorCode.
      await this.upsertAcquisition(userUuid, acquisitionData);

      // Clear the cookie
      const res = (req as unknown as { res: import('express').Response }).res;
      if (res) {
        res.clearCookie('nsi_acquisition');
      }
    } catch (err) {
      this.logger.error('Failed to attach acquisition to user', err);
    }
  }

  private async upsertAcquisition(
    userUuid: string,
    data: AcquisitionData,
  ): Promise<void> {
    await this.prisma.userAcquisition.upsert({
      where: { userUuid },
      create: {
        userUuid,
        utmSource: data.utmSource ?? null,
        utmMedium: data.utmMedium ?? null,
        utmCampaign: data.utmCampaign ?? null,
        utmContent: data.utmContent ?? null,
        utmTerm: data.utmTerm ?? null,
        referrerUrl: data.referrerUrl ?? null,
        landingPage: data.landingPage ?? null,
        distributorCode: data.distributorCode ?? null,
        distributorUuid: data.distributorUuid ?? null,
        ipAddress: data.ipAddress ?? null,
        country: data.country ?? null,
        city: data.city ?? null,
        deviceType: data.deviceType ?? null,
        browser: data.browser ?? null,
      },
      update: {
        utmSource: data.utmSource ?? undefined,
        utmMedium: data.utmMedium ?? undefined,
        utmCampaign: data.utmCampaign ?? undefined,
        utmContent: data.utmContent ?? undefined,
        utmTerm: data.utmTerm ?? undefined,
        referrerUrl: data.referrerUrl ?? undefined,
        landingPage: data.landingPage ?? undefined,
        distributorCode: data.distributorCode ?? undefined,
        distributorUuid: data.distributorUuid ?? undefined,
        ipAddress: data.ipAddress ?? undefined,
        country: data.country ?? undefined,
        city: data.city ?? undefined,
        deviceType: data.deviceType ?? undefined,
        browser: data.browser ?? undefined,
      },
    });
  }
}
