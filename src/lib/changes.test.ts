import { describe, expect, it } from "vitest";
import type { Change, HelpdeskRequest } from "../types";
import { mergeRequestChanges, mergeStaffChanges } from "./changes";

const make = (id: number, over: Partial<HelpdeskRequest> = {}): HelpdeskRequest => ({
  id,
  ref: `WO-${id}`,
  title: "t",
  location: "l",
  site_id: 1,
  status: "pending",
  priority: null,
  created_at: "2026-10-06T00:00:00Z",
  updated_at: "2026-10-06T00:00:00Z",
  due_on: null,
  assignee: null,
  deleted_at: null,
  merged_into_id: null,
  ...over,
});

const updated = (seq: number, request: HelpdeskRequest): Change => ({ seq, type: "request.updated", at: request.updated_at, request });
const created = (seq: number, request: HelpdeskRequest): Change => ({ seq, type: "request.created", at: request.created_at, request });
const everything = () => true;

describe("mergeRequestChanges", () => {
  it("replaces a request with its newer copy and reports it as changed", () => {
    const current = [make(1), make(2)];
    const result = mergeRequestChanges(current, [updated(5, make(2, { status: "processing", updated_at: "2026-10-07T00:00:00Z" }))], everything);
    expect(result.requests.find((r) => r.id === 2)?.status).toBe("processing");
    expect(result.changedIds).toEqual([2]);
  });

  it("adds a request created after the list was loaded", () => {
    const result = mergeRequestChanges([make(1)], [created(6, make(3))], everything);
    expect(result.requests.map((r) => r.id).sort()).toEqual([1, 3]);
    expect(result.changedIds).toEqual([3]);
  });

  it("ignores a copy that is older than the one it already has", () => {
    const current = [make(1, { status: "complete", updated_at: "2026-10-08T00:00:00Z" })];
    const result = mergeRequestChanges(current, [updated(2, make(1, { status: "pending", updated_at: "2026-10-07T00:00:00Z" }))], everything);
    expect(result.requests).toBe(current);
    expect(result.changedIds).toEqual([]);
  });

  it("does nothing when the same item arrives again", () => {
    const item = updated(3, make(1, { status: "processing", updated_at: "2026-10-07T00:00:00Z" }));
    const first = mergeRequestChanges([make(1)], [item], everything);
    const second = mergeRequestChanges(first.requests, [item], everything);
    expect(second.requests).toBe(first.requests);
    expect(second.changedIds).toEqual([]);
  });

  it("returns the same array when nothing changed, so the board does not re-render", () => {
    const current = [make(1)];
    expect(mergeRequestChanges(current, [], everything).requests).toBe(current);
    const event: Change = { seq: 9, type: "event.created", at: "2026-10-07T00:00:00Z", request_id: 1, event: { id: 1, status: "pending", at: 1, actor_id: null, actor_name: "System", assignee_name: null, due_at: null, note: null, reverts_id: null } };
    expect(mergeRequestChanges(current, [event], everything).requests).toBe(current);
  });

  it("removes a request that no longer belongs on the board", () => {
    const current = [make(1), make(2)];
    const canceled = make(2, { status: "canceled", updated_at: "2026-10-07T00:00:00Z" });
    const result = mergeRequestChanges(current, [updated(4, canceled)], (r) => r.status !== "canceled");
    expect(result.requests.map((r) => r.id)).toEqual([1]);
    expect(result.changedIds).toEqual([2]);
  });

  it("does not add a request that does not belong on the board", () => {
    const result = mergeRequestChanges([make(1)], [created(7, make(9, { site_id: 99 }))], (r) => r.site_id === 1);
    expect(result.requests.map((r) => r.id)).toEqual([1]);
    expect(result.changedIds).toEqual([]);
  });

  it("applies several changes to one request in order", () => {
    const changes = [
      updated(1, make(1, { status: "processing", updated_at: "2026-10-07T00:00:00Z" })),
      updated(2, make(1, { status: "complete", updated_at: "2026-10-08T00:00:00Z" })),
    ];
    const result = mergeRequestChanges([make(1)], changes, everything);
    expect(result.requests[0].status).toBe("complete");
    expect(result.changedIds).toEqual([1]);
  });
});

describe("mergeStaffChanges", () => {
  const staff = [{ id: 1, name: "Grace Ong" }, { id: 2, name: "Marcus Lee" }];

  it("applies a new name", () => {
    const change: Change = { seq: 1, type: "staff.updated", at: "2026-10-07T00:00:00Z", staff: { id: 1, name: "Grace Ong-Wee" } };
    expect(mergeStaffChanges(staff, [change]).find((s) => s.id === 1)?.name).toBe("Grace Ong-Wee");
  });

  it("keeps the same array when no name changed", () => {
    const change: Change = { seq: 1, type: "staff.updated", at: "2026-10-07T00:00:00Z", staff: { id: 2, name: "Marcus Lee" } };
    expect(mergeStaffChanges(staff, [change])).toBe(staff);
  });

  it("adds staff who were not in the list", () => {
    const change: Change = { seq: 1, type: "staff.updated", at: "2026-10-07T00:00:00Z", staff: { id: 3, name: "New Person" } };
    expect(mergeStaffChanges(staff, [change]).map((s) => s.id).sort()).toEqual([1, 2, 3]);
  });
});
