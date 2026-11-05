import { describe, expect, it } from "vitest";
import type { HelpdeskRequest } from "../types";
import { DEFAULT_QUERY, filterRows, paginate, parseQuery, serializeQuery, sortRows } from "./query";

const make = (id: number, over: Partial<HelpdeskRequest> = {}): HelpdeskRequest => ({
  id,
  ref: `WO-${id}`,
  title: "t",
  location: "l",
  site_id: 1,
  status: "pending",
  priority: null,
  created_at: `2026-10-0${id}T00:00:00Z`,
  updated_at: "2026-10-09T00:00:00Z",
  due_on: null,
  assignee: null,
  deleted_at: null,
  merged_into_id: null,
  ...over,
});

describe("parseQuery / serializeQuery", () => {
  it("round-trips a full query", () => {
    const q = { from: "2026-10-01", to: "2026-10-31", site: 11, status: "pending" as const, sort: "due_asc" as const, page: 3, size: 50 as const };
    expect(parseQuery(serializeQuery(q, null))).toEqual(q);
  });
  it("leaves default page and size out of the URL", () => {
    expect(serializeQuery({ ...DEFAULT_QUERY, page: 1, size: 20 }, null)).toBe("");
    expect(serializeQuery({ ...DEFAULT_QUERY, page: 2, size: 10 }, null)).toBe("?size=10&page=2");
  });
  it("falls back on a bad page or size", () => {
    expect(parseQuery("?page=0&size=7")).toMatchObject({ page: 1, size: 20 });
    expect(parseQuery("?page=abc&size=100")).toMatchObject({ page: 1, size: 100 });
  });
  it("writes the effective range when none was chosen", () => {
    expect(serializeQuery(DEFAULT_QUERY, { from: "2026-10-06", to: "2026-11-05" })).toBe("?from=2026-10-06&to=2026-11-05");
  });
  it("ignores garbage and reversed ranges", () => {
    expect(parseQuery("?from=nope&to=2026-10-01&site=abc&status=canceled&sort=x")).toEqual(DEFAULT_QUERY);
    expect(parseQuery("?from=2026-10-10&to=2026-10-01").from).toBeNull();
    expect(parseQuery("?from=2026-02-31&to=2026-03-05").from).toBeNull();
  });
});

describe("filterRows", () => {
  const rows = [make(1), make(2, { site_id: 2 }), make(3, { status: "complete" })];
  it("filters by site and status", () => {
    expect(filterRows(rows, { site: 2, status: null }).map((r) => r.id)).toEqual([2]);
    expect(filterRows(rows, { site: null, status: "complete" }).map((r) => r.id)).toEqual([3]);
    expect(filterRows(rows, { site: null, status: null })).toHaveLength(3);
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 23 }, (_, i) => i + 1);
  it("slices a page", () => {
    expect(paginate(items, 2, 10)).toEqual({ items: items.slice(10, 20), page: 2, totalPages: 3 });
    expect(paginate(items, 3, 10).items).toHaveLength(3);
  });
  it("clamps a page that is out of range", () => {
    expect(paginate(items, 99, 10).page).toBe(3);
    expect(paginate(items, 0, 10).page).toBe(1);
  });
  it("has one empty page when there are no rows", () => {
    expect(paginate([], 1, 10)).toEqual({ items: [], page: 1, totalPages: 1 });
  });
});

describe("sortRows", () => {
  const rows = [make(1, { due_on: "2026-11-03" }), make(2), make(3, { due_on: "2026-11-01" })];
  it("sorts by created date", () => {
    expect(sortRows(rows, "created_desc").map((r) => r.id)).toEqual([3, 2, 1]);
    expect(sortRows(rows, "created_asc").map((r) => r.id)).toEqual([1, 2, 3]);
  });
  it("puts missing due dates last in both directions", () => {
    expect(sortRows(rows, "due_asc").map((r) => r.id)).toEqual([3, 1, 2]);
    expect(sortRows(rows, "due_desc").map((r) => r.id)).toEqual([1, 3, 2]);
  });
});
