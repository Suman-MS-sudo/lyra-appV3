/** IST day boundaries and "time ago" — shared by the admin and customer dashboards. */
export const DAY_MS = 86_400_000;
export const IST_OFFSET_MS = 5.5 * 3_600_000;

/** Now, plus midnight IST for today / yesterday / 6 days ago, as UTC timestamps. */
export function istClock() {
  const now = Date.now();
  const todayStart = Math.floor((now + IST_OFFSET_MS) / DAY_MS) * DAY_MS - IST_OFFSET_MS;
  return { now, todayStart, yesterdayStart: todayStart - DAY_MS, weekStart: todayStart - 6 * DAY_MS };
}

export function timeAgo(iso: string | null | undefined, now: number) {
  if (!iso) return 'never';
  const min = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} h ago`;
  return `${Math.floor(hr / 24)} d ago`;
}
