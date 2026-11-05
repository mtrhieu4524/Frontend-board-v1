import { describe, expect, it } from "vitest";
import { formatAgo, formatClock } from "./time";

describe("formatAgo", () => {
  it("says just now for the first few seconds", () => {
    expect(formatAgo(0)).toBe("just now");
    expect(formatAgo(4_999)).toBe("just now");
  });
  it("counts seconds, minutes and hours", () => {
    expect(formatAgo(12_000)).toBe("12 s ago");
    expect(formatAgo(59_000)).toBe("59 s ago");
    expect(formatAgo(60_000)).toBe("1 min ago");
    expect(formatAgo(5 * 60_000 + 20_000)).toBe("5 min ago");
    expect(formatAgo(2 * 3_600_000)).toBe("2 h ago");
  });
  it("never goes negative when the clock moves back", () => {
    expect(formatAgo(-3_000)).toBe("just now");
  });
});

describe("formatClock", () => {
  it("shows the time with seconds and names the zone", () => {
    expect(formatClock(new Date("2026-11-05T03:07:09Z"))).toMatch(
      /^\d{2}:\d{2}:\d{2} \S+/,
    );
  });
});
