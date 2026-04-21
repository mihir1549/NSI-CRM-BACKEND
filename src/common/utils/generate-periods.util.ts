export function autoGranularity(from: Date, to: Date): 'daily' | 'weekly' | 'monthly' {
  const days = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 30) return 'daily';
  if (days <= 180) return 'weekly';
  return 'monthly';
}

export function formatPeriod(date: Date, granularity: 'daily' | 'weekly' | 'monthly'): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  if (granularity === 'daily') {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }
  if (granularity === 'weekly') {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    d.setDate(diff);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function generatePeriods(
  from: Date,
  to: Date,
  granularity: 'daily' | 'weekly' | 'monthly',
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  const cursor = new Date(from);

  while (cursor <= to) {
    const label = formatPeriod(cursor, granularity);
    if (!seen.has(label)) {
      seen.add(label);
      result.push(label);
    }
    if (granularity === 'daily') {
      cursor.setDate(cursor.getDate() + 1);
    } else if (granularity === 'weekly') {
      cursor.setDate(cursor.getDate() + 7);
    } else {
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  return result;
}
