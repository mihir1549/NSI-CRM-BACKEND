import { Injectable, Logger } from '@nestjs/common';
import {
  SocialPost,
  SocialPostStatus,
  SocialPostType,
  SocialLanguage,
  SocialTopic,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { GeminiService } from '../common/gemini/gemini.service.js';
import { SocialConfigService } from './social-config.service.js';

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

@Injectable()
export class SocialPostService {
  private readonly logger = new Logger(SocialPostService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly geminiService: GeminiService,
    private readonly configService: SocialConfigService,
  ) {}

  async generatePostsForDistributor(distributorUuid: string): Promise<void> {
    // 1. Read preference
    const preference = await this.prisma.socialPreference.findUnique({
      where: { distributorUuid },
    });
    if (!preference) {
      throw new Error('No social preference set — skipping');
    }
    if (!preference.selectedLanguages.length) {
      throw new Error('No languages selected — skipping');
    }
    if (!preference.selectedTopics.length) {
      throw new Error('No topics selected — skipping');
    }

    // 2. Read config
    const postsPerDay = await this.configService.getNumber('POSTS_PER_DAY', 2);
    const retryAttempts = await this.configService.getNumber(
      'RETRY_ATTEMPTS',
      3,
    );
    const retryDelayMs = await this.configService.getNumber(
      'RETRY_DELAY_MS',
      30000,
    );

    // 3. Check already generated today
    const generatedFor = new Date();
    generatedFor.setUTCHours(0, 0, 0, 0);

    const existingCount = await this.prisma.socialPost.count({
      where: {
        distributorUuid,
        generatedFor,
        status: {
          in: [
            SocialPostStatus.PENDING,
            SocialPostStatus.APPROVED,
            SocialPostStatus.POSTED,
          ],
        },
      },
    });

    if (existingCount >= postsPerDay) {
      this.logger.log(
        `[SocialPost] Already generated today for ${distributorUuid} — skipping`,
      );
      return;
    }

    // 4. Get distributor info
    const distributor = await this.prisma.user.findUnique({
      where: { uuid: distributorUuid },
      select: { distributorCode: true, fullName: true },
    });

    if (!distributor) {
      throw new Error(`Distributor ${distributorUuid} not found — skipping`);
    }

    const frontendUrl =
      process.env.FRONTEND_URL ?? 'https://growithnsi.com';
    const joinLink = `${frontendUrl}/join/${distributor.distributorCode ?? ''}`;

    // 5. Get topic details
    const topics = await this.prisma.socialTopic.findMany({
      where: {
        code: { in: preference.selectedTopics },
        isActive: true,
      },
    });

    if (!topics.length) {
      throw new Error('No active topics found — skipping');
    }

    // 6. Get language details
    const languages = await this.prisma.socialLanguage.findMany({
      where: {
        code: { in: preference.selectedLanguages },
        isActive: true,
      },
    });

    if (!languages.length) {
      throw new Error('No active languages found — skipping');
    }

    // 7. Build post specs — round-robin across topics and languages
    const postSpecs = Array.from(
      { length: postsPerDay },
      (_, i) => ({
        topic: topics[i % topics.length] as SocialTopic,
        language: languages[i % languages.length] as SocialLanguage,
      }),
    );

    // 8. Generate with retry
    const generateWithRetry = async (spec: {
      topic: SocialTopic;
      language: SocialLanguage;
    }): Promise<void> => {
      for (let attempt = 0; attempt <= retryAttempts; attempt++) {
        try {
          const captionResult = await this.geminiService.generateCaption({
            languageCode: spec.language.code,
            languageLabel: spec.language.label,
            topicCode: spec.topic.code,
            topicLabel: spec.topic.label,
            geminiPromptHint: spec.topic.geminiPromptHint,
            distributorName: distributor.fullName,
            joinLink,
            postsPerDay,
          });

          const imageResult = await this.geminiService.generateImage({
            topicCode: spec.topic.code,
            topicLabel: spec.topic.label,
            geminiPromptHint: spec.topic.geminiPromptHint,
            languageCode: spec.language.code,
            distributorUuid,
            generatedFor: generatedFor.toISOString().split('T')[0],
            newsHook: captionResult.newsHook,
            dominantEmotion: captionResult.dominantEmotion,
            caption: captionResult.caption,
          });

          await this.prisma.socialPost.create({
            data: {
              distributorUuid,
              type: spec.topic.code as SocialPostType,
              languageCode: spec.language.code,
              topicCode: spec.topic.code,
              caption: captionResult.caption,
              hashtags: captionResult.hashtags,
              imageUrl: imageResult.imageUrl,
              imagePrompt: imageResult.prompt,
              status: SocialPostStatus.PENDING,
              platforms: [],
              generatedFor,
              retryCount: attempt,
            },
          });

          this.logger.log(
            `[SocialPost] Generated ${spec.topic.code}/${spec.language.code} for ${distributorUuid}`,
          );
          return;
        } catch (err) {
          if (attempt < retryAttempts) {
            this.logger.warn(
              `[SocialPost] Attempt ${attempt + 1} failed for ${distributorUuid}, retrying...`,
            );
            await sleep(retryDelayMs);
          } else {
            this.logger.error(
              `[SocialPost] All retries exhausted for ${distributorUuid}/${spec.topic.code}`,
            );
            await this.prisma.socialPost.create({
              data: {
                distributorUuid,
                type: spec.topic.code as SocialPostType,
                languageCode: spec.language.code,
                topicCode: spec.topic.code,
                caption: '',
                hashtags: [],
                imageUrl: null,
                imagePrompt: '',
                status: SocialPostStatus.FAILED,
                platforms: [],
                generatedFor,
                retryCount: retryAttempts,
                failureReason:
                  err instanceof Error ? err.message : String(err),
              },
            });
          }
        }
      }
    };

    for (const spec of postSpecs) {
      await generateWithRetry(spec);
    }
  }

  async getMyPosts(
    distributorUuid: string,
    filter: 'today' | '7days' | '30days' | 'all' = 'today',
  ): Promise<SocialPost[]> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    let dateFilter: Record<string, unknown> = {};

    switch (filter) {
      case 'today': {
        const tomorrow = new Date(today);
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        dateFilter = { generatedFor: { gte: today, lt: tomorrow } };
        break;
      }
      case '7days': {
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
        dateFilter = { generatedFor: { gte: sevenDaysAgo } };
        break;
      }
      case '30days': {
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);
        dateFilter = { generatedFor: { gte: thirtyDaysAgo } };
        break;
      }
      case 'all':
        dateFilter = {};
        break;
    }

    return this.prisma.socialPost.findMany({
      where: {
        distributorUuid,
        ...dateFilter,
        status: { not: SocialPostStatus.FAILED },
      },
      orderBy: { generatedFor: 'desc' },
    });
  }

  async getAllPostsAdmin(
    page = 1,
    limit = 20,
  ): Promise<{ items: (SocialPost & { distributor: { fullName: string; distributorCode: string | null } })[]; total: number }> {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.socialPost.findMany({
        skip,
        take: limit,
        include: {
          distributor: {
            select: { fullName: true, distributorCode: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.socialPost.count(),
    ]);

    return { items, total };
  }

  async getFailedPostsAdmin(): Promise<SocialPost[]> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);

    return this.prisma.socialPost.findMany({
      where: {
        status: SocialPostStatus.FAILED,
        createdAt: { gte: sevenDaysAgo },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
