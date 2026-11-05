import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

async function load() {
  vi.resetModules();
  vi.stubEnv("HELPDESK_URL", "http://helpdesk.test");
  vi.stubEnv("HELPDESK_TOKEN", "token");
  return import("./api");
}

describe("get", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("waits for Retry-After on a 429 and then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(429, { error: "slow down" }, { "Retry-After": "2" }))
      .mockResolvedValueOnce(json(200, { data: [] }));
    vi.stubGlobal("fetch", fetchMock);
    const { get } = await load();

    const result = get("/v1/sites");
    await vi.advanceTimersByTimeAsync(1_900);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(200);
    await expect(result).resolves.toEqual({ data: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries a 503 with growing waits and gives up after five attempts", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(json(503, { error: "down" })));
    vi.stubGlobal("fetch", fetchMock);
    const { get, ApiError } = await load();

    const result = get("/v1/sites").catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(10_000);
    const error = await result;
    expect(error).toBeInstanceOf(ApiError);
    expect((error as InstanceType<typeof ApiError>).status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("does not retry a 404", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(404, { error: "not found" }));
    vi.stubGlobal("fetch", fetchMock);
    const { get } = await load();

    await expect(get("/v1/requests/9")).rejects.toMatchObject({ status: 404 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries a network failure and reports it readably when it keeps failing", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);
    const { get } = await load();

    const result = get("/v1/sites").catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await result).toMatchObject({ status: 0, message: "Cannot reach the helpdesk" });
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("ignores a Retry-After it cannot read instead of retrying at once", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(429, { error: "busy" }, { "Retry-After": "Wed, 21 Oct 2026 07:28:00 GMT" }))
      .mockResolvedValueOnce(json(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const { get } = await load();

    const result = get("/v1/sites");
    await vi.advanceTimersByTimeAsync(100);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(600);
    await expect(result).resolves.toEqual({ ok: true });
  });

  it("tells subscribers while a request is waiting to retry", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(503, { error: "down" }))
      .mockResolvedValueOnce(json(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const { get, isRetrying, subscribeRetrying } = await load();
    const seen: boolean[] = [];
    subscribeRetrying(() => seen.push(isRetrying()));

    const result = get("/v1/sites");
    await vi.advanceTimersByTimeAsync(100);
    expect(isRetrying()).toBe(true);
    await vi.advanceTimersByTimeAsync(1_000);
    await result;
    expect(isRetrying()).toBe(false);
    expect(seen).toEqual([true, false]);
  });

  it("reports a reply that is not valid JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>oops</html>", { status: 200 })));
    const { get } = await load();

    await expect(get("/v1/sites")).rejects.toMatchObject({ status: 0 });
  });
});
