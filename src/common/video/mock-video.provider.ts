import type {
  IVideoProvider,
  VideoAnalyticsResult,
  VideoHeatmapResult,
} from './video-provider.interface.js';

/**
 * Mock video provider for tests and local development.
 * Returns realistic-looking data without making any HTTP calls.
 */
export class MockVideoProvider implements IVideoProvider {
  async getVideoAnalytics(videoId: string): Promise<VideoAnalyticsResult> {
    return {
      videoId,
      views: 100,
      avgWatchPercent: 65,
      completionRate: 40,
      totalWatchTimeSeconds: 3600,
      topCountries: { IN: 60, US: 20, GB: 10 },
      provider: 'mock',
      engagementScore: 65,
      countryWatchTime: { IN: 1000, US: 200 },
      averageWatchTime: 120,
    };
  }

  async getVideoHeatmap(videoId: string): Promise<VideoHeatmapResult> {
    return {
      videoId,
      heatmap: [1.0, 0.9, 0.85, 0.8, 0.75, 0.7, 0.6, 0.5, 0.4, 0.3],
      provider: 'mock',
    };
  }

  getSignedUrl(videoId: string, _expiresInSeconds = 3600): string {
    return `https://mock-cdn.example.com/${videoId}/play_720p.mp4?token=mock-token`;
  }
}
