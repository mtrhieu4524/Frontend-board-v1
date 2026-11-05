import type { Site } from "@/types";
import { addDays, localDate } from "./dates";

/**
 * Default board range: the last 30 days, ending on the latest "today" across the sites
 * (Sydney can already be a day ahead of Singapore or Jakarta), so nothing created today is cut off.
 */
export function defaultRange(sites: Site[], now = new Date()): { from: string; to: string } {
  const todays = sites.map((s) => localDate(now, s.timezone));
  const to = todays.length ? todays.reduce((a, b) => (a > b ? a : b)) : localDate(now, "UTC");
  return { from: addDays(to, -30), to };
}
