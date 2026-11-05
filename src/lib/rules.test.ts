import { describe, expect, it } from "vitest";
import type { HelpdeskRequest } from "../types";
import { formatInZone, formatLocalDate, isCounted, isOverdue } from "./rules";

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
