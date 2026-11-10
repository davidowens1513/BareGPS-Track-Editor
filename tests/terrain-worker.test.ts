import { describe, it, expect, vi, afterEach } from "vitest";
import worker from "../scripts/website/terrain-worker.mjs";
const endpoint =
  "https://appsbyonzy.dev/tools/baregps-route-planner/terrain/v1/mapzen";
const env = () => ({
  ASSETS: { fetch: vi.fn(async () => new Response("static")) },
});
afterEach(() => vi.restoreAllMocks());
describe("hosted route preview terrain", () => {
  it("leaves the existing website and downloads on static asset serving", async () => {
    const assets = env();
    const response = await worker.fetch(
      new Request("https://appsbyonzy.dev/"),
      assets,
    );
    expect(await response.text()).toBe("static");
    expect(assets.ASSETS.fetch).toHaveBeenCalledOnce();
  });
  it("accepts a bounded coordinate batch and contacts only the fixed terrain provider", async () => {
    const upstream = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ status: "OK", results: [{ elevation: 123 }] }),
        ),
      );
    const response = await worker.fetch(
      new Request(endpoint + "?locations=51.99947,-9.74269"),
      env(),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).results[0].elevation).toBe(123);
    expect(String(upstream.mock.calls[0][0])).toBe(
      "https://api.opentopodata.org/v1/mapzen?locations=51.99947%2C-9.74269",
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it("rejects malformed or oversized batches and unapproved parameters without contacting upstream", async () => {
    const upstream = vi.spyOn(globalThis, "fetch");
    for (const query of [
      "",
      "?locations=91,0",
      "?locations=abc",
      "?locations=0,181",
      "?locations=0,0&url=https://example.org",
      "?locations=0,0&locations=1,1",
      "?locations=" + Array(101).fill("0,0").join("|"),
    ]) {
      expect(
        (await worker.fetch(new Request(endpoint + query), env())).status,
      ).toBe(400);
    }
    expect(upstream).not.toHaveBeenCalled();
    expect(
      (
        await worker.fetch(
          new Request(endpoint + "?locations=0,0", { method: "POST" }),
          env(),
        )
      ).status,
    ).toBe(405);
    expect(
      (
        await worker.fetch(
          new Request(endpoint.replace("mapzen", "other")),
          env(),
        )
      ).status,
    ).toBe(404);
  });
  it("returns a useful service failure if terrain cannot be fetched", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    expect(
      (await worker.fetch(new Request(endpoint + "?locations=0,0"), env()))
        .status,
    ).toBe(503);
  });
});

it("declines provider redirects using the redirect mode supported by Cloudflare", async () => {
  const upstream = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(null, {
      status: 302,
      headers: { Location: "https://example.org/" },
    }),
  );
  const response = await worker.fetch(
    new Request(endpoint + "?locations=0,0"),
    env(),
  );
  expect(response.status).toBe(503);
  expect(upstream).toHaveBeenCalledOnce();
  expect(upstream.mock.calls[0][1]?.redirect).toBe("manual");
});

it.each(["baregps-route-maker", "baregps-track-editor"])(
  "serves terrain for standalone %s",
  async (slug) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ status: "OK", results: [{ elevation: 100 }] }),
      ),
    );
    const response = await worker.fetch(
      new Request(
        `https://appsbyonzy.dev/tools/${slug}/terrain/v1/mapzen?locations=53,-6`,
      ),
      env(),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).results[0].elevation).toBe(100);
  },
);
