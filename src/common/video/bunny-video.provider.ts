import * as crypto from 'crypto';
import { Logger } from '@nestjs/common';
import type {
  IVideoProvider,
  VideoAnalyticsResult,
  VideoHeatmapResult,
} from './video-provider.interface.js';

// ─── Bunny API response shapes ────────────────────────────────────────────────

interface BunnyVideoDetails {
  guid: string;
  title: string;
  views: number;
  averageWatchTime: number; // average watch time in seconds
  totalWatchTime: number; // total accumulated watch time in seconds
  length: number; // video duration in seconds
  storageSize: number;
}

interface BunnyStatistics {
  viewsChart: Record<string, number>;
  watchTimeChart: Record<string, number>;
  viewsPercentageChart: Record<string, number>;
  countryViewsChart: Record<string, number>;
  engagementScore?: number;
  countryWatchTime?: Record<string, number>;
  averageWatchTime?: number;
}

interface BunnyHeatmapResponse {
  heatmap?: Record<string, number>;
}

/**
 * Bunny.net Stream video provider.
 * Uses the Bunny Stream REST API for analytics and the Bunny CDN token
 * authentication algorithm for signed playback URLs.
 */
export class BunnyVideoProvider implements IVideoProvider {
  private readonly logger = new Logger(BunnyVideoProvider.name);
  private readonly baseUrl = 'https://video.bunnycdn.com';

  constructor(
    private readonly libraryId: string,
    private readonly apiKey: string,
    private readonly cdnHostname: string,
    private readonly tokenKey: string,
  ) {}

  private get headers(): Record<string, string> {
    return {
      AccessKey: this.apiKey,
      'Content-Type': 'application/json',
    };
  }

  async getVideoAnalytics(videoId: string): Promise<VideoAnalyticsResult> {
    const [detailsRes, statsRes] = await Promise.all([
      fetch(
        `${this.baseUrl}/library/${this.libraryId}/videos/${videoId}`,
        { headers: this.headers },
      ),
      fetch(
        `${this.baseUrl}/library/${this.libraryId}/statistics?videoGuid=${videoId}`,
        { headers: this.headers },
      ),
    ]);

    if (!detailsRes.ok) {
      throw new Error(
        `Bunny video details fetch failed: ${detailsRes.status} for ${videoId}`,
      );
    }

    const details = (await detailsRes.json()) as BunnyVideoDetails;

    let completionRate = 0;
    const topCountries: Record<string, number> = {};

    let engagementScore: number | null = null;
    let countryWatchTime: Record<string, number> | null = null;
    let averageWatchTime: number | null = null;

    if (statsRes.ok) {
      const stats = (await statsRes.json()) as BunnyStatistics;

      // viewsPercentageChart: position (0–100) → % of viewers still watching.
      // The value at "100.00" represents the completion rate.
      const chart = stats.viewsPercentageChart ?? {};
      const sortedKeys = Object.keys(chart).sort(
        (a, b) => parseFloat(b) - parseFloat(a),
      );
      if (sortedKeys.length > 0) {
        completionRate = chart[sortedKeys[0]] ?? 0;
      }

      // Country data if provided
      const countryChart = stats.countryViewsChart ?? {};
      for (const [country, count] of Object.entries(countryChart)) {
        topCountries[country] = count;
      }

      // New Fields (April 21)
      engagementScore = stats.engagementScore ?? null;
      countryWatchTime = stats.countryWatchTime ?? null;
      averageWatchTime = stats.averageWatchTime ?? null;
    }

    const length = details.length ?? 0;
    const avgWatchPercent =
      length > 0 ? (details.averageWatchTime / length) * 100 : 0;

    this.logger.debug(`Bunny analytics fetched for ${videoId}`);

    return {
      videoId,
      views: details.views ?? 0,
      avgWatchPercent: Math.round(avgWatchPercent * 10) / 10,
      completionRate: Math.round(completionRate * 10) / 10,
      totalWatchTimeSeconds: details.totalWatchTime ?? 0,
      topCountries,
      provider: 'bunny',
      engagementScore,
      countryWatchTime,
      averageWatchTime: details.averageWatchTime ?? null,
    };
  }

  async getVideoHeatmap(videoId: string): Promise<VideoHeatmapResult> {
    const res = await fetch(
      `${this.baseUrl}/library/${this.libraryId}/videos/${videoId}/heatmap`,
      { headers: this.headers },
    );

    if (!res.ok) {
      throw new Error(
        `Bunny heatmap fetch failed: ${res.status} for ${videoId}`,
      );
    }

    const data = (await res.json()) as BunnyHeatmapResponse;
    const rawHeatmap = data.heatmap ?? {};

    // 1. Filter to numeric keys only and find the max second
    const heatmapKeys = Object.keys(rawHeatmap)
      .filter((k) => /^\d+$/.test(k))
      .map(Number);

    const maxSecond = heatmapKeys.length > 0 ? Math.max(...heatmapKeys) : -1;
    const transformedHeatmap: number[] = [];

    // 2. Fill gaps and build array
    // Bunny omits seconds past the furthest-watched point. Zero-fill
    // gaps is acceptable because all meaningful seconds appear in the
    // response, and trailing zeros match real "no one watched here"
    // behavior.
    if (maxSecond >= 0) {
      for (let i = 0; i <= maxSecond; i++) {
        transformedHeatmap.push(rawHeatmap[i.toString()] ?? 0);
      }
    }

    return {
      videoId,
      heatmap: transformedHeatmap,
      provider: 'bunny',
    };
  }

  /**
   * Generate a Bunny Stream signed iframe embed URL.
   * Token = SHA256(tokenKey + videoId + expiresTimestamp) as hex
   * Format: https://iframe.mediadelivery.net/embed/{libraryId}/{videoId}?token={hex}&expires={unix}
   */
  getSignedUrl(videoId: string, expiresInSeconds = 3600): string {
    const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const token = crypto
      .createHash('sha256')
      .update(this.tokenKey + videoId + expires.toString())
      .digest('hex');

    return `https://iframe.mediadelivery.net/embed/${this.libraryId}/${videoId}?token=${token}&expires=${expires}`;
  }
}
