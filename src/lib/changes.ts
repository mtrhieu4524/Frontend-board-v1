import type { Change, HelpdeskRequest, Staff } from "@/types";

export interface MergeResult {
  requests: HelpdeskRequest[];
  changedIds: number[];
}

const sameRequest = (a: HelpdeskRequest, b: HelpdeskRequest) =>
  JSON.stringify(a) === JSON.stringify(b);

export function mergeRequestChanges(
  current: HelpdeskRequest[],
  changes: Change[],
  wanted: (request: HelpdeskRequest) => boolean,
): MergeResult {
  const byId = new Map(current.map((r) => [r.id, r]));
  const changed = new Set<number>();
  for (const change of changes) {
    if (change.type !== "request.created" && change.type !== "request.updated")
      continue;
    const incoming = change.request;
    const existing = byId.get(incoming.id);
    if (existing && existing.updated_at > incoming.updated_at) continue;
    if (wanted(incoming)) {
      if (!existing || !sameRequest(existing, incoming)) {
        byId.set(incoming.id, incoming);
        changed.add(incoming.id);
      }
    } else if (existing) {
      byId.delete(incoming.id);
      changed.add(incoming.id);
    }
  }
  if (changed.size === 0) return { requests: current, changedIds: [] };
  return { requests: [...byId.values()], changedIds: [...changed] };
}

export function mergeStaffChanges(
  current: Staff[],
  changes: Change[],
): Staff[] {
  const byId = new Map(current.map((s) => [s.id, s]));
  let changed = false;
  for (const change of changes) {
    if (change.type !== "staff.updated") continue;
    if (byId.get(change.staff.id)?.name === change.staff.name) continue;
    byId.set(change.staff.id, change.staff);
    changed = true;
  }
  return changed ? [...byId.values()] : current;
}
