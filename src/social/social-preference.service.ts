import { BadRequestException, Injectable } from '@nestjs/common';
import { SocialLanguage, SocialPreference, SocialTopic } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { SocialConfigService } from './social-config.service.js';
import { UpdatePreferenceDto } from './dto/update-preference.dto.js';

@Injectable()
export class SocialPreferenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: SocialConfigService,
  ) {}

  async getPreference(distributorUuid: string): Promise<SocialPreference | null> {
    return this.prisma.socialPreference.findUnique({
      where: { distributorUuid },
    });
  }

  async upsertPreference(
    distributorUuid: string,
    dto: UpdatePreferenceDto,
  ): Promise<SocialPreference> {
    if (dto.selectedLanguages !== undefined) {
      const maxLanguages = await this.configService.getNumber(
        'MAX_LANGUAGES',
        2,
      );
      if (dto.selectedLanguages.length > maxLanguages) {
        throw new BadRequestException(
          `Maximum ${maxLanguages} languages allowed`,
        );
      }
    }

    return this.prisma.socialPreference.upsert({
      where: { distributorUuid },
      create: {
        distributorUuid,
        selectedLanguages: dto.selectedLanguages ?? [],
        selectedTopics: dto.selectedTopics ?? [],
        autoPostEnabled: dto.autoPostEnabled ?? false,
        autoDmEnabled: dto.autoDmEnabled ?? true,
        autoWhatsApp: dto.autoWhatsApp ?? true,
        notifyOnSources: dto.notifyOnSources ?? [],
      },
      update: {
        ...(dto.selectedLanguages !== undefined && {
          selectedLanguages: dto.selectedLanguages,
        }),
        ...(dto.selectedTopics !== undefined && {
          selectedTopics: dto.selectedTopics,
        }),
        ...(dto.autoPostEnabled !== undefined && {
          autoPostEnabled: dto.autoPostEnabled,
        }),
        ...(dto.autoDmEnabled !== undefined && {
          autoDmEnabled: dto.autoDmEnabled,
        }),
        ...(dto.autoWhatsApp !== undefined && {
          autoWhatsApp: dto.autoWhatsApp,
        }),
        ...(dto.notifyOnSources !== undefined && {
          notifyOnSources: dto.notifyOnSources,
        }),
      },
    });
  }

  async getAvailableLanguages(): Promise<SocialLanguage[]> {
    return this.prisma.socialLanguage.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });
  }

  async getAvailableTopics(): Promise<SocialTopic[]> {
    return this.prisma.socialTopic.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });
  }
}
