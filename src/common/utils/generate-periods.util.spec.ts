import { autoGranularity, formatPeriod, generatePeriods } from './generate-periods.util.js';

describe('Generate Periods Util', () => {
  describe('autoGranularity', () => {
    it('returns daily for <= 30 days', () => {
      const from = new Date('2026-04-01');
      const to = new Date('2026-04-30');
      expect(autoGranularity(from, to)).toBe('daily');
    });

    it('returns weekly for <= 180 days', () => {
      const from = new Date('2026-01-01');
      const to = new Date('2026-04-01'); // 90 days
      expect(autoGranularity(from, to)).toBe('weekly');
    });

    it('returns monthly for > 180 days', () => {
      const from = new Date('2026-01-01');
      const to = new Date('2026-12-31'); // 364 days
      expect(autoGranularity(from, to)).toBe('monthly');
    });
  });

  describe('generatePeriods gap-fill', () => {
    it('Empty DB + 30-day range -> 31 entries, all zero (or rather, the period generation returns 31 dates)', () => {
      // For a 30-day difference (e.g. 1st to 31st), it spans 31 days inclusively.
      const from = new Date('2026-04-01T00:00:00.000Z');
      const to = new Date('2026-04-30T00:00:00.000Z');
      const periods = generatePeriods(from, to, 'daily');
      expect(periods).toHaveLength(30);
      expect(periods[0]).toBe('2026-04-01');
      expect(periods[periods.length - 1]).toBe('2026-04-30');
    });

    it('90-day range -> weekly granularity', () => {
      const from = new Date('2026-01-01T00:00:00.000Z');
      const to = new Date('2026-03-31T00:00:00.000Z'); // approx 90 days
      const periods = generatePeriods(from, to, 'weekly');
      // 90 days / 7 = ~13 buckets
      expect(periods.length).toBeGreaterThanOrEqual(13);
      expect(periods.length).toBeLessThanOrEqual(14);
    });

    it('365-day range -> monthly granularity', () => {
      const from = new Date('2026-01-01T00:00:00.000Z');
      const to = new Date('2026-12-31T00:00:00.000Z');
      const periods = generatePeriods(from, to, 'monthly');
      expect(periods).toHaveLength(12);
      expect(periods[0]).toBe('2026-01');
      expect(periods[11]).toBe('2026-12');
    });

    it('Date range crossing month boundary -> correct bucketing', () => {
      const from = new Date('2026-03-25T00:00:00.000Z');
      const to = new Date('2026-04-05T00:00:00.000Z');
      const periods = generatePeriods(from, to, 'daily');
      expect(periods).toContain('2026-03-31');
      expect(periods).toContain('2026-04-01');
      expect(periods).toHaveLength(12); // 25, 26, 27, 28, 29, 30, 31, 1, 2, 3, 4, 5
    });
  });
});
