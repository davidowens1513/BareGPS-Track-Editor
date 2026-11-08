import { confirmPlanWithoutTerrain } from "./input-helpers";
import { trimBefore, trimAfter, selectInputPoint } from "./input-helpers";
import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
const first = `<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>Valley trail</name><trkseg><trkpt lat="56" lon="-5"><ele>100</ele></trkpt><trkpt lat="56.001" lon="-5"><ele>150</ele></trkpt><trkpt lat="56.002" lon="-5"><ele>120</ele></trkpt><trkpt lat="56.003" lon="-5"><ele>160</ele></trkpt><trkpt lat="56.004" lon="-5"><ele>200</ele></trkpt></trkseg></trk></gpx>`;
const second = first
  .replace("Valley trail", "Upper trail")
  .replaceAll("56.00", "56.02")
  .replace('lat="56"', 'lat="56.02"');
async function importTracks(
  page: import("@playwright/test").Page,
  files: { name: string; buffer: Buffer; mimeType: string }[],
) {
  await page.getByRole("tab", { name: "Edit Existing", exact: true }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Open files", exact: true }).click();
  await (await chooser).setFiles(files);
}
test.beforeEach(async ({ page }) => {
  // Test interaction without depending on availability of an external tile server.
  await page.route("**/*.tile.opentopomap.org/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
        "base64",
      ),
    }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "BareGPS Route Planner home" }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Create New", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab").first()).toHaveText("Create New");
  await page.getByRole("tab", { name: "Edit Existing", exact: true }).click();
});
test("import, trim, join, include gaps, undo, export and restore", async ({
  page,
}) => {
  await importTracks(page, [
    {
      name: "valley.gpx",
      mimeType: "application/gpx+xml",
      buffer: Buffer.from(first),
    },
    {
      name: "upper.gpx",
      mimeType: "application/gpx+xml",
      buffer: Buffer.from(second),
    },
  ]);
  await expect(page.locator("#source-count")).toHaveText("2");
  await expect(page.locator("#ascent")).toContainText("130");
  await trimBefore(page, 2);
  await expect(page.locator("#ascent")).toContainText("80");
  await page.getByRole("button", { name: "Add to Route Plan" }).click();
  await confirmPlanWithoutTerrain(page);
  await page
    .getByRole("button", { name: /Upper trail/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Add to Route Plan" }).click();
  await confirmPlanWithoutTerrain(page);
  await expect(page.locator("#create-name")).toHaveValue("Edited Route");
  await expect(page.locator("#route-card")).toHaveCount(0);
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.locator("#distance")).toContainText("2.56");
  await expect(page.locator("#analytics-source")).toContainText(
    "1.78 km of connections",
  );
  await expect(page.locator("#ascent")).toContainText("210");
  await expect(page.locator("#elevation-note")).toContainText(
    "endpoint heights",
  );
  // Force the portable download fallback for automated file-content verification.
  await page.evaluate(() => {
    Object.defineProperty(window, "showSaveFilePicker", {
      value: undefined,
      configurable: true,
    });
    delete (window as any).showSaveFilePicker;
  });
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#create-save").click();
  const download = await downloadPromise;
  const xml = await fs.readFile((await download.path())!, "utf8");
  expect(xml).toContain("<b:gapBefore>true</b:gapBefore>");
  expect(xml.match(/<trkpt /g)).toHaveLength(9);
  await expect(page.locator("#save-state")).toContainText("Saved on device");
  await page.reload();
  await page.getByRole("tab", { name: "Edit Existing", exact: true }).click();
  await expect(page.locator("#source-count")).toHaveText("2");
  await expect(
    page.getByRole("button", { name: "Open GPX file(s)", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /Valley trail/ })
    .first()
    .click();
  await expect(page.locator("#create-name")).toHaveValue("Edited Route");
  await page.locator("#create-clear").click();
  await page.locator("#confirm-clear-edit").click();
  await expect(page.locator("#waypoint-count")).toHaveText("0");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator("#create-name")).toHaveValue("Edited Route");
});
test("trims whole inputs and reverses with undo while keeping the input list intact", async ({
  page,
}) => {
  await importTracks(page, [
    { name: "valley.gpx", mimeType: "text/xml", buffer: Buffer.from(first) },
  ]);
  await trimAfter(page, 3);
  await expect(page.locator("#source-count")).toHaveText("1");
  await expect(page.locator("#point-count")).toHaveText("3 points");
  await expect(page.locator("#ascent")).toContainText("50");
  await page.locator("#reverse").click();
  await expect(page.locator("#ascent")).toContainText("30");
  await page.locator("#undo").click();
  await expect(page.locator("#ascent")).toContainText("50");
  await page.locator("#undo").click();
  await expect(page.locator("#point-count")).toHaveText("5 points");
  await expect(
    page.getByRole("button", { name: "Split", exact: true }),
  ).toHaveCount(0);
});
test("rejects bad files, accepts valid files in the same batch, and renders names safely", async ({
  page,
}) => {
  await importTracks(page, [
    { name: "broken.gpx", mimeType: "text/xml", buffer: Buffer.from("<gpx>") },
    {
      name: "safe.gpx",
      mimeType: "text/xml",
      buffer: Buffer.from(
        first.replace("Valley trail", "&lt;img src=x onerror=alert(1)&gt;"),
      ),
    },
  ]);
  await expect(page.getByRole("alert")).toContainText("not a valid GPX");
  await expect(page.locator("#source-count")).toHaveText("1");
  await expect(page.locator(".track-select")).toContainText(
    "<img src=x onerror=alert(1)>",
  );
  expect(await page.locator("#track-list img").count()).toBe(0);
});
test("map handles change selection and analytics remain visible while expanded", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await importTracks(page, [
    {
      name: "valley.gpx",
      mimeType: "application/gpx+xml",
      buffer: Buffer.from(first),
    },
    {
      name: "upper.gpx",
      mimeType: "application/gpx+xml",
      buffer: Buffer.from(second),
    },
  ]);
  await expect(page.locator(".track-handle")).toHaveCount(2);
  await page.getByRole("button", { name: "Expand map", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Collapse map" }),
  ).toBeVisible();
  await expect(page.locator("#analytics")).toBeVisible();
  await expect(page.locator(".brand")).toBeVisible();
  const handles = page.locator(".track-handle");
  // Expansion schedules a map resize; drag only after the handles settle.
  let lastBounds = "",
    stableSince = 0;
  await expect
    .poll(
      async () => {
        const bounds = JSON.stringify(
          await handles.evaluateAll((nodes) =>
            nodes.map((node) => {
              const box = node.getBoundingClientRect();
              return [box.x, box.y, box.width, box.height];
            }),
          ),
        );
        if (bounds !== lastBounds) {
          lastBounds = bounds;
          stableSince = Date.now();
        }
        return Date.now() - stableSince >= 120;
      },
      { intervals: [50] },
    )
    .toBe(true);
  const from = await handles.first().boundingBox(),
    to = await handles.last().boundingBox();
  await page.mouse.move(from!.x + 16, from!.y + 16);
  await page.mouse.down();
  await page.mouse.move(
    (from!.x + to!.x) / 2 + 16,
    (from!.y + to!.y) / 2 + 16,
    { steps: 20 },
  );
  await page.mouse.up();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Expand map", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#point-count")).toHaveText("5 points");
  await expect(page.locator("#input-terrain")).toBeEnabled();
  // Mobile layout must never overflow horizontally.
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("cancelling and reopening the file picker keeps file actions enabled", async ({
  page,
}) => {
  let chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Open files", exact: true }).click();
  await (await chooser).setFiles([]);
  await expect(
    page.getByRole("button", { name: "Open files", exact: true }),
  ).toBeEnabled();
  await importTracks(page, [
    { name: "first.gpx", mimeType: "text/xml", buffer: Buffer.from(first) },
  ]);
  await expect(
    page.getByRole("button", { name: "Open files", exact: true }),
  ).toBeEnabled();
  await importTracks(page, [
    { name: "second.gpx", mimeType: "text/xml", buffer: Buffer.from(second) },
  ]);
  await expect(page.locator("#source-count")).toHaveText("2");
});

test("closed-loop endpoints keep both map handles reachable", async ({
  page,
}) => {
  const closed = first.replace('lat="56.004" lon="-5"', 'lat="56" lon="-5"');
  await importTracks(page, [
    { name: "loop.gpx", mimeType: "text/xml", buffer: Buffer.from(closed) },
  ]);
  const handles = page.locator(".track-handle");
  await expect(handles).toHaveCount(2);
  const a = await handles.first().boundingBox(),
    b = await handles.last().boundingBox();
  expect(Math.abs(a!.x - b!.x)).toBeGreaterThanOrEqual(37);
  await expect(page.locator("#range-start")).toHaveCount(0);
});

test("colour picker and selected-section export preserve the chosen colour", async ({
  page,
}) => {
  await importTracks(page, [
    { name: "colour.gpx", mimeType: "text/xml", buffer: Buffer.from(first) },
  ]);
  await page
    .getByRole("button", { name: "Choose line colour for Valley trail" })
    .click();
  await page.getByRole("button", { name: "Use #c35d68", exact: true }).click();
  await page.getByLabel("Hex colour", { exact: true }).fill("#3264aa");
  await page.getByRole("button", { name: "Apply colour", exact: true }).click();
  await expect(page.locator(".input-track-colour")).toHaveCSS(
    "background-color",
    "rgb(50, 100, 170)",
  );
  await trimBefore(page, 2);
  await trimAfter(page, 3);
  await page.evaluate(() => {
    delete (window as any).showSaveFilePicker;
  });
  await page.locator("#add-route").click();
  await confirmPlanWithoutTerrain(page);
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save Route", exact: true }).click();
  const download = await pending;
  const xml = await fs.readFile((await download.path())!, "utf8");
  await expect(page.locator(".input-track-colour")).toHaveCSS(
    "background-color",
    "rgb(50, 100, 170)",
  );
  expect(xml.match(/<trkpt /g)).toHaveLength(3);
  expect(xml).not.toContain('lat="56"');
});

test("imported tracks and the full branded header remain clear on small phones", async ({
  page,
}) => {
  await importTracks(page, [
    {
      name: "valley.gpx",
      mimeType: "application/gpx+xml",
      buffer: Buffer.from(first),
    },
    {
      name: "upper.gpx",
      mimeType: "application/gpx+xml",
      buffer: Buffer.from(second),
    },
  ]);
  await expect(page.locator(".brand-title")).toHaveText(
    "BareGPS Route Planner",
  );
  await expect(page).toHaveTitle("BareGPS Route Planner");
  await expect(page.locator(".brand-subtitle")).toHaveText(
    "GPX Creator and Editor",
  );
  await expect(page.locator("#track-list")).toContainText("Valley trail");
  await expect(page.locator("#track-list")).toContainText("Upper trail");
  await expect(page.locator("#save-state")).toContainText("Saved on device");
  await expect(page.locator("#save-state svg")).toHaveCount(0);
  for (const width of [320, 360, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.locator(".brand-title")).toBeVisible();
    await expect(page.locator("#save-state .save-short")).toHaveText("Saved");
    const brand = await page.locator(".brand").boundingBox(),
      status = await page.locator(".header-right").boundingBox();
    expect(brand!.x + brand!.width).toBeLessThanOrEqual(status!.x);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});

test("empty Edit offers GPX import lower in the map without a sample loader", async ({
  page,
}) => {
  await expect(page.locator("#demo")).toHaveCount(0);
  await expect(page.locator("#source-count")).toHaveText("0");
  const button = page.getByRole("button", {
    name: "Open GPX file(s)",
    exact: true,
  });
  await expect(button).toBeVisible();
  const map = (await page.locator("#map").boundingBox())!;
  const bounds = (await button.boundingBox())!;
  expect(bounds.y + bounds.height / 2).toBeGreaterThan(map.y + map.height / 2);
  await page.getByRole("tab", { name: "Create New", exact: true }).click();
  await page.getByRole("tab", { name: "Edit Existing", exact: true }).click();
  await expect(button).toBeVisible();
  await expect(page.locator("#source-count")).toHaveText("0");
  await page.reload();
  await page.getByRole("tab", { name: "Edit Existing", exact: true }).click();
  await expect(page.locator("#demo")).toHaveCount(0);
  await expect(button).toBeVisible();
});
