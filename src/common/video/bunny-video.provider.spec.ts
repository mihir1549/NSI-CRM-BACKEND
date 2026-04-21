import { BunnyVideoProvider } from './bunny-video.provider';

describe('BunnyVideoProvider', () => {
  let provider: BunnyVideoProvider;
  const LIBRARY_ID = '12345';
  const API_KEY = 'mock-api-key';
  const VIDEO_ID = 'vid-999';

  beforeEach(() => {
    provider = new BunnyVideoProvider(LIBRARY_ID, API_KEY, 'mock.cdn', 'token-key');
    // Mock global fetch
    global.fetch = jest.fn() as jest.Mock;
  });

  describe('getVideoHeatmap()', () => {
    it('1. Object with contiguous keys "0".."N" → array of length N+1 with correct values', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          heatmap: { "0": 100, "1": 72, "2": 50 }
        }),
      });

      const result = await provider.getVideoHeatmap(VIDEO_ID);
      expect(result.heatmap).toEqual([100, 72, 50]);
      expect(result.heatmap).toHaveLength(3);
    });

    it('2. Empty object {} → empty array []', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ heatmap: {} }),
      });

      const result = await provider.getVideoHeatmap(VIDEO_ID);
      expect(result.heatmap).toEqual([]);
    });

    it('3. Object with gaps: {"0": 100, "2": 45} → [100, 0, 45] (length 3)', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          heatmap: { "0": 100, "2": 45 }
        }),
      });

      const result = await provider.getVideoHeatmap(VIDEO_ID);
      expect(result.heatmap).toEqual([100, 0, 45]);
      expect(result.heatmap).toHaveLength(3);
    });

    it('4. Object with non-numeric key: {"0": 100, "meta": "x"} → filter out non-numeric, result is [100]', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          heatmap: { "0": 100, "meta": "ignored" }
        }),
      });

      const result = await provider.getVideoHeatmap(VIDEO_ID);
      expect(result.heatmap).toEqual([100]);
    });

    it('5. Bunny returns null/undefined for heatmap property → returns empty array []', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ heatmap: null }),
      });

      const result = await provider.getVideoHeatmap(VIDEO_ID);
      expect(result.heatmap).toEqual([]);
    });

    it('6. Bunny API returns non-200 → throws (existing behavior preserved)', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await expect(provider.getVideoHeatmap(VIDEO_ID)).rejects.toThrow(
        'Bunny heatmap fetch failed: 404 for vid-999',
      );
    });
  });

  describe('getVideoAnalytics()', () => {
    it('1. Bunny response includes all 3 new fields → provider returns them correctly', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ guid: VIDEO_ID, views: 10, length: 100, averageWatchTime: 50, totalWatchTime: 500 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            engagementScore: 75,
            countryWatchTime: { IN: 400, US: 100 },
            averageWatchTime: 50,
            viewsPercentageChart: { "100.00": 45 },
            countryViewsChart: { IN: 8, US: 2 }
          }),
        });

      const result = await provider.getVideoAnalytics(VIDEO_ID);
      expect(result.engagementScore).toBe(75);
      expect(result.countryWatchTime).toEqual({ IN: 400, US: 100 });
      expect(result.averageWatchTime).toBe(50);
    });

    it('2. Bunny response missing fields → engagementScore/countryWatchTime are null, averageWatchTime from details', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ guid: VIDEO_ID, views: 5, length: 100, averageWatchTime: 20, totalWatchTime: 100 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            viewsPercentageChart: { "100.00": 10 }
          }),
        });

      const result = await provider.getVideoAnalytics(VIDEO_ID);
      expect(result.engagementScore).toBeNull();
      expect(result.countryWatchTime).toBeNull();
      expect(result.averageWatchTime).toBe(20);
    });

    it('3. Bunny response has partial stats data → correct mapping', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ guid: VIDEO_ID, views: 10, length: 100, averageWatchTime: 30, totalWatchTime: 300 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            engagementScore: 60,
          }),
        });

      const result = await provider.getVideoAnalytics(VIDEO_ID);
      expect(result.engagementScore).toBe(60);
      expect(result.countryWatchTime).toBeNull();
      expect(result.averageWatchTime).toBe(30);
    });
  });
});
