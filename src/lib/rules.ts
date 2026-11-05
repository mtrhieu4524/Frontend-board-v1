// Rules 1, 2 and 4 from docs/rules.md. Pure functions so they can be tested without the API.

import type { HelpdeskRequest } from "../types";
import { localDate } from "./dates";

/** Rule 1: which requests count. `from` and `to` are YYYY-MM-DD, inclusive, in the site's local date. */
export function isCounted(request: HelpdeskRequest, timeZone: string, from: string, to: string): boolean {
  if (request.status === "canceled" || request.deleted_at || request.merged_into_id) return false;
  const created = localDate(new Date(request.created_at), timeZone);
  return created >= from && created <= to;
}

/** Rule 2: pending/processing and due before today in the site's timezone. null due date is never overdue. */
export function isOverdue(request: HelpdeskRequest, timeZone: string, now = new Date()): boolean {
  if (request.status !== "pending" && request.status !== "processing") return false;
  if (!request.due_on) return false;
  return request.due_on < localDate(now, timeZone);
}

/** Rule 4: an instant shown in the site's timezone, with the zone named, e.g. "06 Oct 2026, 09:15 GMT+8". */
export function formatInZone(instant: Date | string, timeZone: string): string {
  const date = typeof instant === "string" ? new Date(instant) : instant;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).format(date);
}

/** A site-local calendar date (YYYY-MM-DD) for display, e.g. "07 Nov 2026". No timezone shift: it is already local. */
export function formatLocalDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}
