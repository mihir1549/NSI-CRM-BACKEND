/**
 * Video provider abstraction layer.
 * All video providers must implement IVideoProvider.
 * The rest of the application only interacts with this interface.
 */

export interface VideoAnalyticsResult {
  videoId: string;
  views: number;
  avgWatchPercent: number;
  completionRate: number;
  totalWatchTimeSeconds: number;
  topCountries: Record<string, number>;
  provider: string;
  providerExtras?: Record<string, any>;

  // NEW (April 21)
  engagementScore: number | null; // 0–100, Bunny composite
  countryWatchTime: Record<string, number> | null; // { "IN": 4446 }
  averageWatchTime: number | null; // seconds per viewer
}

export interface VideoHeatmapResult {
  videoId: string;
  heatmap: number[];
  provider: string;
}

export interface IVideoProvider {
  /**
   * Fetch engagement analytics for a single video from the CDN/streaming provider.
   * Must never throw — callers catch and return zeros on failure.
   */
  getVideoAnalytics(videoId: string): Promise<VideoAnalyticsResult>;

  /**
   * Fetch per-position heatmap data showing where viewers drop off.
   * Must never throw — callers catch and return null on failure.
   */
  getVideoHeatmap(videoId: string): Promise<VideoHeatmapResult>;

  /**
   * Return a signed/authenticated playback URL for a video.
   * Synchronous — token signing happens locally.
   */
  getSignedUrl(videoId: string, expiresInSeconds?: number): string;
}

/**
 * NestJS injection token for the video provider.
 * Used with @Inject(VIDEO_PROVIDER_TOKEN) in service constructors.
 */
export const VIDEO_PROVIDER_TOKEN = 'IVideoProvider';
