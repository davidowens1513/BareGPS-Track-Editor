import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs/promises";
import { savedWorkspace } from "./input-helpers";
const files = [
  {
    name: "A.gpx",
    mimeType: "text/xml",
    buffer: Buffer.from(
      '<gpx><trk><name>A</name><trkseg><trkpt lat="53" lon="-6"><ele>100</ele></trkpt><trkpt lat="53.0002" lon="-6"><ele>110</ele></trkpt></trkseg></trk></gpx>',
    ),
  },
  {
    name: "B.gpx",
    mimeType: "text/xml",
    buffer: Buffer.from(
      '<gpx><trk><name>B</name><trkseg><trkpt lat="53.0005" lon="-6"/><trkpt lat="53.0007" lon="-6"><ele>130</ele></trkpt></trkseg></trk></gpx>',
    ),
  },
];
async function load(page: Page) {
  await page.route("**/*.tile.opentopomap.org/**", (r) => r.abort());
  await page.goto("/");
  await page.locator("#edit-tab").click();
  const chooser = page.waitForEvent("filechooser");
  await page.locator("#import").click();
  await (await chooser).setFiles(files);
}
async function stageBoth(page: Page) {
  await page.locator("#add-route").click();
  await page.getByRole("button", { name: "Keep adding", exact: true }).click();
  await page.locator(".track-select").filter({ hasText: "B" }).click();
  await page.locator("#add-route").click();
}
const heights = (url: string) => ({
  status: "OK",
  results: new URL(url).searchParams
    .get("locations")!
    .split("|")
    .map(() => ({ elevation: 777 })),
});
test("Confirm Route fetches missing legs, preserves recorded heights and reuses completed terrain", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/terrain/**", (route) => {
    requests++;
    return route.fulfill({ json: heights(route.request().url()) });
  });
  await load(page);
  await stageBoth(page);
  expect(requests).toBe(0);
  await page.locator("#confirm-route-plan").click();
  await expect(page.locator("#dialog")).not.toBeVisible();
  expect(requests).toBeGreaterThan(0);
  const workspace = await savedWorkspace(page);
  expect(workspace.route.points.map((p: any) => p.ele)).toEqual([
    100, 110, 777, 130,
  ]);
  expect(workspace.tracks[1].points[0].ele).toBeUndefined();
  expect(workspace.routePlan[1].points[0].ele).toBeUndefined();
  await expect(page.locator("#create-terrain")).toBeHidden();
  await expect(page.locator("#card-source-note")).not.toContainText(
    "incomplete",
  );
  const first = requests;
  await page.locator("#open-route-plan").click();
  await page.locator("#confirm-route-plan").click();
  await expect(page.locator("#dialog")).not.toBeVisible();
  expect(requests).toBe(first);
});
test("failed plan fetching keeps prior output, supports explicit incomplete confirmation and retry", async ({
  page,
}) => {
  let failing = true;
  await page.route("**/terrain/**", (route) =>
    failing
      ? route.fulfill({ status: 503, body: "Offline" })
      : route.fulfill({ json: heights(route.request().url()) }),
  );
  await load(page);
  await page.locator("#add-route").click();
  await page.locator("#confirm-route-plan").click();
  await expect(page.locator("#waypoint-count")).toHaveText("2");
  await page.locator(".track-select").filter({ hasText: "B" }).click();
  await page.locator("#add-route").click();
  await page.locator("#confirm-route-plan").click();
  await expect(page.locator("#confirm-without-terrain")).toBeVisible();
  await expect(page.locator("#waypoint-count")).toHaveText("2");
  await page.locator("#back-to-plan").click();
  await expect(page.locator(".plan-grid tbody tr")).toHaveCount(2);
  await page.locator("#confirm-route-plan").click();
  await page.locator("#confirm-without-terrain").click();
  await expect(page.locator("#waypoint-count")).toHaveText("4");
  await expect(page.locator("#card-source-note")).toContainText(
    "Terrain incomplete — ascent is partial",
  );
  failing = false;
  await page.locator("#open-route-plan").click();
  await page.locator("#confirm-route-plan").click();
  await expect(page.locator("#dialog")).not.toBeVisible();
  await expect(page.locator("#card-source-note")).not.toContainText(
    "incomplete",
  );
});
test("cancelling a plan fetch retains the plan and leaves the previous output untouched", async ({
  page,
}) => {
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/terrain/**", async (route) => {
    await held;
    await route.abort().catch(() => {});
  });
  await load(page);
  await stageBoth(page);
  await page.locator("#confirm-route-plan").click();
  await expect(page.locator("#cancel-plan-terrain")).toBeVisible();
  await page.locator("#cancel-plan-terrain").click();
  release();
  await expect(page.locator("#confirm-route-plan")).toBeVisible();
  await expect(page.locator(".plan-grid tbody tr")).toHaveCount(2);
  await expect(page.locator("#waypoint-count")).toHaveText("0");
});
test("Edit map fetch fills missing input heights and complete input confirmation needs no further fetch", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/terrain/**", (route) => {
    requests++;
    return route.fulfill({ json: heights(route.request().url()) });
  });
  await load(page);
  await page.locator(".track-select").filter({ hasText: "B" }).click();
  await expect(page.locator("#input-terrain")).toBeEnabled();
  await page.locator("#input-terrain").click();
  expect(requests).toBe(0);
  await page.locator("#confirm-input-terrain").click();
  await expect(page.locator("#dialog")).not.toBeVisible();
  const count = requests;
  expect(count).toBeGreaterThan(0);
  const workspace = await savedWorkspace(page);
  expect(workspace.tracks[1].points.map((p: any) => p.ele)).toEqual([777, 130]);
  await page.locator("#add-route").click();
  await page.locator("#confirm-route-plan").click();
  await expect(page.locator("#dialog")).not.toBeVisible();
  expect(requests).toBe(count);
});
test("Create Save Route fetches before export and reuses fetched terrain", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/terrain/**", (route) => {
    requests++;
    return route.fulfill({ json: heights(route.request().url()) });
  });
  await page.route("**/*.tile.opentopomap.org/**", (r) => r.abort());
  await page.goto("/");
  await page.evaluate(() => {
    delete (window as any).showSaveFilePicker;
  });
  await page.locator("#create-map").click({ position: { x: 95, y: 120 } });
  await page.locator("#create-map").click({ position: { x: 125, y: 150 } });
  await expect(page.locator("#elevation-note")).toContainText(
    "Terrain not fetched",
  );
  await page.locator("#expand-card").click();
  await expect(page.locator("#dialog")).not.toBeVisible();
  expect(requests).toBe(0);
  await page.locator("#expand-card").click();
  let pending = page.waitForEvent("download");
  await page.locator("#create-save").click();
  let download = await pending;
  expect(download.suggestedFilename()).toBe("Created Route.gpx");
  const xml = await fs.readFile((await download.path())!, "utf8");
  expect(xml).toContain("<ele>777</ele>");
  expect(requests).toBeGreaterThan(0);
  await expect(page.locator("#elevation-note")).toContainText(
    "Terrain up to date",
  );
  const count = requests;
  pending = page.waitForEvent("download");
  await page.locator("#create-save").click();
  download = await pending;
  expect(download.suggestedFilename()).toBe("Created Route.gpx");
  expect(requests).toBe(count);
  await page.locator("#create-map").click({ position: { x: 195, y: 210 } });
  await expect(page.locator("#elevation-note")).toContainText(
    "Terrain needs refresh",
  );
  await savedWorkspace(page);
  await page.reload();
  await expect(page.locator("#elevation-note")).toContainText(
    "Terrain needs refresh",
  );
});
test("Create saving failure does not export until Save without terrain is chosen", async ({
  page,
}) => {
  await page.route("**/terrain/**", (route) =>
    route.fulfill({ status: 503, body: "Offline" }),
  );
  await page.route("**/*.tile.opentopomap.org/**", (r) => r.abort());
  await page.goto("/");
  await page.evaluate(() => {
    delete (window as any).showSaveFilePicker;
  });
  await page.locator("#create-map").click({ position: { x: 95, y: 120 } });
  await page.locator("#create-map").click({ position: { x: 125, y: 150 } });
  let downloads = 0;
  page.on("download", () => downloads++);
  await page.locator("#create-save").click();
  await expect(page.locator("#save-without-terrain")).toBeVisible();
  expect(downloads).toBe(0);
  const pending = page.waitForEvent("download");
  await page.locator("#save-without-terrain").click();
  const xml = await fs.readFile((await (await pending).path())!, "utf8");
  expect(xml).not.toContain("<ele>");
  await expect(page.locator("#waypoint-count")).toHaveText("2");
});

for (const flow of ["create", "input", "plan"] as const) {
  for (const close of ["cross", "cancel", "escape"] as const) {
    test(`${flow} terrain: ${close} cancels an in-flight request without committing late heights`, async ({
      page,
    }) => {
      let release: () => void = () => {};
      let requestStarted: () => void = () => {};
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      const started = new Promise<void>((resolve) => {
        requestStarted = resolve;
      });
      await page.route("**/terrain/**", async (route) => {
        requestStarted();
        await held;
        await route
          .fulfill({ json: heights(route.request().url()) })
          .catch(() => {});
      });
      if (flow === "create") {
        await page.route("**/*.tile.opentopomap.org/**", (r) => r.abort());
        await page.goto("/");
        await page
          .locator("#create-map")
          .click({ position: { x: 90, y: 120 } });
        await page
          .locator("#create-map")
          .click({ position: { x: 180, y: 190 } });
      } else {
        await load(page);
        if (flow === "input")
          await page.locator(".track-select").filter({ hasText: "B" }).click();
        else await stageBoth(page);
      }
      const before = await savedWorkspace(page);
      if (flow === "create") {
        await page.locator("#create-terrain").click();
        await page.locator("#confirm-create-terrain").click();
      } else if (flow === "input") {
        await page.locator("#input-terrain").click();
        await expect(page.locator("#dialog")).toContainText("Open Topo Data");
        await page.locator("#confirm-input-terrain").click();
      } else await page.locator("#confirm-route-plan").click();
      await started;
      await expect(
        page.getByRole("button", { name: "Cancel operation", exact: true }),
      ).toBeVisible();
      if (close === "cross")
        await page
          .getByRole("button", { name: "Cancel operation", exact: true })
          .click();
      else if (close === "escape") await page.keyboard.press("Escape");
      else
        await page
          .locator(
            `#cancel-${flow === "plan" ? "plan" : flow === "input" ? "input" : "create"}-terrain`,
          )
          .click();
      release();
      if (flow === "plan")
        await expect(page.locator("#confirm-route-plan")).toBeVisible();
      else await expect(page.locator("#dialog")).toBeHidden();
      const after = await savedWorkspace(page);
      expect(after.created).toEqual(before.created);
      expect(after.createdTerrain).toEqual(before.createdTerrain);
      expect(after.tracks).toEqual(before.tracks);
      expect(after.routePlan).toEqual(before.routePlan);
      expect(after.route).toEqual(before.route);
      await expect(page.locator("#edit-tab")).toBeEnabled();
    });
  }
}
