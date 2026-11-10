import { afterEach, describe, expect, it, vi } from "vitest";
import { CapacitorHttp } from "@capacitor/core";
import { enrichTerrain } from "../src/terrain";
import type { Track } from "../src/model";
const platform = vi.hoisted(() => ({ native: false }));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => platform.native },
  CapacitorHttp: { get: vi.fn() },
}));
const track = (count = 2): Track => ({
  id: "test",
  name: "test",
  source: "test",
  kind: "track",
  color: "#16724d",
  points: Array.from({ length: count }, (_, i) => ({
    lat: 53 + i * 0.00001,
    lon: -6,
    gapBefore: i > 0,
  })),
});
const body = (count = 2) => ({
  status: "OK",
  results: Array.from({ length: count }, () => ({ elevation: 100 })),
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  platform.native = false;
});
describe("terrain operation cancellation and deadlines", () => {
  it.each([false, true])(
    "cancels while waiting on transport (native=%s) and ignores late responses",
    async (native) => {
      platform.native = native;
      let finish!: (value: any) => void;
      const pending = new Promise<any>((resolve) => {
        finish = resolve;
      });
      const fetchMock = vi.fn(() => pending);
      vi.stubGlobal("fetch", fetchMock);
      vi.mocked(CapacitorHttp.get).mockReturnValue(pending);
      const input = track();
      const controller = new AbortController();
      const result = enrichTerrain(input, () => {}, controller.signal);
      const rejected = expect(result).rejects.toMatchObject({
        name: "AbortError",
      });
      await vi.waitFor(() =>
        expect(native ? CapacitorHttp.get : fetchMock).toHaveBeenCalled(),
      );
      controller.abort();
      await rejected;
      finish(
        native
          ? { status: 200, data: body() }
          : { ok: true, json: async () => body() },
      );
      await Promise.resolve();
      expect(input.points.every((p) => p.ele === undefined)).toBe(true);
    },
  );
  it.each(["cancel", "timeout"])(
    "covers a stalled browser body: %s",
    async (action) => {
      vi.useFakeTimers();
      let reading = false;
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
          ok: true,
          json: () => {
            reading = true;
            return new Promise(() => {});
          },
        })),
      );
      const controller = new AbortController();
      const result = enrichTerrain(track(), () => {}, controller.signal);
      const rejected =
        action === "cancel"
          ? expect(result).rejects.toMatchObject({ name: "AbortError" })
          : expect(result).rejects.toThrow("request timed out");
      await vi.advanceTimersByTimeAsync(0);
      expect(reading).toBe(true);
      if (action === "cancel") controller.abort();
      else await vi.advanceTimersByTimeAsync(20000);
      await rejected;
    },
  );
  it("cancels between batches without starting another request", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => body(100),
    }));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    const result = enrichTerrain(track(102), () => {}, controller.signal);
    const rejected = expect(result).rejects.toMatchObject({
      name: "AbortError",
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    controller.abort();
    await rejected;
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("bounds the whole job even when individual batches keep completing", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10000));
        return { ok: true, json: async () => body(100) };
      }),
    );
    const result = enrichTerrain(
      track(2000),
      () => {},
      new AbortController().signal,
    );
    const rejected = expect(result).rejects.toThrow("job timed out");
    await vi.advanceTimersByTimeAsync(180000);
    await rejected;
  });
});
