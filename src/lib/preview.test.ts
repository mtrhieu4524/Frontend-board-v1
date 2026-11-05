import { describe, expect, it } from "vitest";
import { keepPreview, parsePreview } from "./preview";

describe("parsePreview", () => {
  it("reads a known preview state", () => {
    expect(parsePreview("?from=2026-10-01&preview=busy")).toBe("busy");
    expect(parsePreview("preview=empty")).toBe("empty");
  });

  it("ignores an unknown or missing value", () => {
    expect(parsePreview("?page=1")).toBeNull();
    expect(parsePreview("?preview=offline")).toBeNull();
  });
});

describe("keepPreview", () => {
  it("copies preview onto the next search string", () => {
    expect(keepPreview("?preview=error&page=1", "?from=2026-10-01&page=2")).toBe(
      "?from=2026-10-01&page=2&preview=error",
    );
  });

  it("leaves the next search alone when there is no preview", () => {
    expect(keepPreview("?page=1", "?page=2")).toBe("?page=2");
  });
});
