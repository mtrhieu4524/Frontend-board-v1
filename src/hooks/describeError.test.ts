import { describe, expect, it } from "vitest";
import { ApiError } from "@/api";
import { describeError } from "./useBoardData";

describe("describeError", () => {
  it("says the helpdesk is busy for a 429", () => {
    expect(describeError(new ApiError(429, "rate limited"))).toBe("The helpdesk is busy right now");
  });

  it("says the helpdesk is unavailable for a server error", () => {
    expect(describeError(new ApiError(503, "boom"))).toBe("The helpdesk is temporarily unavailable");
    expect(describeError(new ApiError(500, "boom"))).toBe("The helpdesk is temporarily unavailable");
  });

  it("explains a refused token", () => {
    expect(describeError(new ApiError(401, "no"))).toBe("The helpdesk refused the access token");
  });

  it("keeps the helpdesk's own message for other errors", () => {
    expect(describeError(new ApiError(0, "Cannot reach the helpdesk"))).toBe("Cannot reach the helpdesk");
    expect(describeError(new ApiError(400, "bad date"))).toBe("bad date (400)");
  });

  it("does not leak raw exceptions", () => {
    expect(describeError(new Error("x is undefined"))).toBe("Something unexpected went wrong");
  });
});
