/** Machines ping every 5 minutes; 10 minutes allows one missed ping before "offline". */
export const ONLINE_WINDOW_MS = 10 * 60 * 1000;

export function isMachineOnline(lastPing?: string | null): boolean {
  return !!lastPing && Date.now() - new Date(lastPing).getTime() < ONLINE_WINDOW_MS;
}
