import { describe, expect, it } from "vitest";
import type { HelpdeskRequest } from "../types";
import type { RequestEvent } from "../types";
import { firstResponse, formatEventTime, formatInZone, formatLocalDate, formatWallClock, isCounted, isOverdue, sortEventsOldestFirst, undoneEventIds } from "./rules";

const base: HelpdeskRequest = {
  id: 1,
  ref: "WO-1",
  title: "t",
  location: "l",
  site_id: 1,
  status: "pending",
  priority: null,
  created_at: "2026-10-06T02:15:07Z",
  updated_at: "2026-10-06T02:15:07Z",
  due_on: null,
  assignee: null,
  deleted_at: null,
  merged_into_id: null,
};

describe("isCounted (rule 1)", () => {
  it("uses the site's local date, not UTC", () => {
    // 17:00Z on 05 Oct is already 06 Oct in Singapore, but still 05 Oct in New York.
    const r = { ...base, created_at: "2026-10-05T17:00:00Z" };
    expect(isCounted(r, "Asia/Singapore", "2026-10-06", "2026-10-06")).toBe(true);
    expect(isCounted(r, "America/New_York", "2026-10-06", "2026-10-06")).toBe(false);
  });
  it("is inclusive on both ends", () => {
    expect(isCounted(base, "UTC", "2026-10-06", "2026-10-06")).toBe(true);
  });
  it("skips canceled, deleted and merged", () => {
    expect(isCounted({ ...base, status: "canceled" }, "UTC", "2026-10-01", "2026-10-31")).toBe(false);
    expect(isCounted({ ...base, deleted_at: "2026-10-07T00:00:00Z" }, "UTC", "2026-10-01", "2026-10-31")).toBe(false);
    expect(isCounted({ ...base, merged_into_id: 9 }, "UTC", "2026-10-01", "2026-10-31")).toBe(false);
  });
});

describe("isOverdue (rule 2)", () => {
  const now = new Date("2026-11-05T02:00:00Z"); // 05 Nov in Singapore, still 04 Nov in Los Angeles
  it("is overdue only when due before the site's today", () => {
    expect(isOverdue({ ...base, due_on: "2026-11-04" }, "Asia/Singapore", now)).toBe(true);
    expect(isOverdue({ ...base, due_on: "2026-11-05" }, "Asia/Singapore", now)).toBe(false);
  });
  it("depends on the site timezone", () => {
    expect(isOverdue({ ...base, due_on: "2026-11-04" }, "America/Los_Angeles", now)).toBe(false);
  });
  it("never for null due date or finished requests", () => {
    expect(isOverdue(base, "UTC", now)).toBe(false);
    expect(isOverdue({ ...base, status: "complete", due_on: "2026-01-01" }, "UTC", now)).toBe(false);
    expect(isOverdue({ ...base, status: "processing", due_on: "2026-01-01" }, "UTC", now)).toBe(true);
  });
});

describe("formatting (rule 4)", () => {
  it("names the zone", () => {
    expect(formatInZone("2026-10-06T02:15:07Z", "Asia/Singapore")).toContain("10:15");
    expect(formatInZone("2026-10-06T02:15:07Z", "Asia/Singapore")).toContain("GMT+8");
  });
  it("formats a local date without shifting", () => {
    expect(formatLocalDate("2026-11-07")).toBe("07 Nov 2026");
  });
});

describe("event times (rule 4)", () => {
  it("shows Unix seconds in the site's zone", () => {
    expect(formatEventTime(1793455099, "Asia/Singapore")).toContain("21:58");
    expect(formatEventTime(1793455099, "Australia/Sydney")).toContain("01 Nov 2026, 00:58");
    expect(formatEventTime(1793455099, "Australia/Sydney")).toContain("GMT+11");
  });
  it("shows a local due_at as it is, naming the zone", () => {
    expect(formatWallClock("05/11/2026 17:00", "Asia/Singapore")).toBe("05 Nov 2026, 17:00 GMT+8");
    expect(formatWallClock("05/11/2026 17:00", "Australia/Sydney")).toBe("05 Nov 2026, 17:00 GMT+11");
  });
  it("uses the daylight-saving offset that applies on that date", () => {
    expect(formatWallClock("01/07/2026 09:00", "Australia/Sydney")).toContain("GMT+10");
  });
  it("shows an unreadable due_at as received", () => {
    expect(formatWallClock("soon", "Asia/Singapore")).toBe("soon (Asia/Singapore)");
  });
});

const event = (id: number, over: Partial<RequestEvent> = {}): RequestEvent => ({
  id,
  status: "pending",
  at: 1000 + id,
  actor_id: 1,
  actor_name: "Someone",
  assignee_name: null,
  due_at: null,
  note: null,
  reverts_id: null,
  ...over,
});

describe("undoneEventIds (rule 5)", () => {
  it("hides both the undoing event and the one it undoes", () => {
    const events = [event(1), event(2, { status: "processing" }), event(3, { reverts_id: 2 })];
    expect([...undoneEventIds(events)].sort()).toEqual([2, 3]);
  });
  it("is empty when nothing was undone", () => {
    expect(undoneEventIds([event(1), event(2)]).size).toBe(0);
  });
});

describe("firstResponse (rule 6)", () => {
  it("is the earliest processing event with an actor, whatever order they arrive in", () => {
    const events = [
      event(4, { status: "processing", actor_id: 9 }),
      event(2, { status: "processing", actor_id: 5 }),
      event(3, { status: "complete", actor_id: 5 }),
    ];
    expect(firstResponse(events)?.id).toBe(2);
  });
  it("skips System events", () => {
    const events = [event(1, { status: "processing", actor_id: null }), event(2, { status: "processing", actor_id: 7 })];
    expect(firstResponse(events)?.id).toBe(2);
  });
  it("ignores a processing event that was undone", () => {
    const events = [event(1, { status: "processing", actor_id: 5 }), event(2, { reverts_id: 1 }), event(3, { status: "processing", actor_id: 7 })];
    expect(firstResponse(events)?.id).toBe(3);
  });
  it("is null when nobody has responded", () => {
    expect(firstResponse([event(1), event(2, { status: "processing", actor_id: null })])).toBeNull();
    expect(firstResponse([])).toBeNull();
  });
});

describe("sortEventsOldestFirst", () => {
  it("orders by time, then id, without changing the input", () => {
    const input = [event(3, { at: 50 }), event(1, { at: 90 }), event(2, { at: 50 })];
    expect(sortEventsOldestFirst(input).map((e) => e.id)).toEqual([2, 3, 1]);
    expect(input.map((e) => e.id)).toEqual([3, 1, 2]);
  });
});
