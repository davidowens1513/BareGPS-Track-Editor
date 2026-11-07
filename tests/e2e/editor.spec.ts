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
  await expect(page.getByRole("tab", { name: "Create", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab").first()).toHaveText("Create");
  await page.getByRole("tab", { name: "Edit", exact: true }).click();
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
  await page.getByRole("slider", { name: "Section start point" }).fill("1");
  await expect(page.locator("#start-label")).toHaveText("Point 2");
  await expect(page.locator("#ascent")).toContainText("80");
  await page
    .getByRole("button", { name: "Start joined route with section" })
    .click();
  await page
    .getByRole("button", { name: /Upper trail/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Append section to route" }).click();
  await expect(page.locator("#route-card")).toContainText(
    "walking connections",
  );
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
  await page.getByRole("button", { name: "Save route", exact: true }).click();
  const download = await downloadPromise;
  const xml = await fs.readFile((await download.path())!, "utf8");
  expect(xml).toContain("<b:gapBefore>true</b:gapBefore>");
  expect(xml.match(/<trkpt /g)).toHaveLength(9);
  await expect(page.locator("#save-state")).toContainText("Saved on device");
  await page.reload();
  await expect(page.locator("#source-count")).toHaveText("2");
  await expect(page.locator("#route-card")).toContainText("2.56 km");
  await page.getByRole("button", { name: "Remove joined route" }).click();
  await expect(page.locator("#route-card")).toBeHidden();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator("#route-card")).toContainText("My joined route");
});
test("splits selected sections and reverses without destroying the source", async ({
  page,
}) => {
  await importTracks(page, [
    {
      name: "valley.gpx",
      mimeType: "application/gpx+xml",
      buffer: Buffer.from(first),
    },
  ]);
  await page.getByRole("button", { name: "Split", exact: true }).click();
  await page.getByRole("slider", { name: /Split at/ }).fill("2");
  await page.getByRole("button", { name: "Split into two tracks" }).click();
  await expect(page.locator("#source-count")).toHaveText("3");
  await expect(page.locator("#point-count")).toHaveText("3 points");
  await expect(page.locator("#ascent")).toContainText("50");
  await page.getByRole("button", { name: "Reverse", exact: true }).click();
  await expect(page.locator("#ascent")).toContainText("30");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator("#ascent")).toContainText("50");
  await expect(page.locator(".track-select").first()).toContainText(
    "Valley trail",
  );
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
  await page.getByRole("button", { name: /Explore with sample/ }).click();
  await expect(page.locator(".track-handle")).toHaveCount(2);
  await page.getByRole("button", { name: "Expand map", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Collapse map" }),
  ).toBeVisible();
  await expect(page.locator("#analytics")).toBeVisible();
  await expect(page.locator(".brand")).toBeVisible();
  const handles = page.locator(".track-handle");
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
  expect(
    await page
      .getByRole("slider", { name: "Section start point" })
      .inputValue(),
  ).not.toBe("0");
  // Mobile layout must never overflow horizontally.
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("terrain updates ascent atomically and reports failures without changing the route", async ({
  page,
}) => {
  await importTracks(page, [
    { name: "first.gpx", mimeType: "text/xml", buffer: Buffer.from(first) },
    { name: "second.gpx", mimeType: "text/xml", buffer: Buffer.from(second) },
  ]);
  await page
    .getByRole("button", { name: "Start joined route with section" })
    .click();
  await page
    .getByRole("button", { name: /Upper trail/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Append section to route" }).click();
  await page.route("**/terrain/**", (r) =>
    r.fulfill({ status: 503, body: "Unavailable" }),
  );
  const before = await page.locator("#route-card").innerText();
  await page.getByRole("button", { name: "Fetch gap terrain" }).click();
  await page.getByRole("button", { name: "Fetch terrain heights" }).click();
  await expect(page.getByRole("alert")).toContainText("unavailable");
  expect(await page.locator("#route-card").innerText()).toBe(before);
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
  await expect(
    page.getByRole("slider", { name: "Section start point" }),
  ).toHaveValue("0");
});

test("colour picker and selected-section export preserve the chosen colour", async ({
  page,
}) => {
  await importTracks(page, [
    { name: "colour.gpx", mimeType: "text/xml", buffer: Buffer.from(first) },
  ]);
  await page
    .getByRole("button", { name: "Use #c35d68 track colour", exact: true })
    .click();
  await expect(page.locator("#track-color")).toHaveValue("#c35d68");
  await page.locator("#track-color").evaluate((input: HTMLInputElement) => {
    input.value = "#3264aa";
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.locator("#track-color")).toHaveValue("#3264aa");
  await page.getByRole("slider", { name: "Section start point" }).fill("1");
  await page.getByRole("slider", { name: "Section end point" }).fill("3");
  await page.evaluate(() => {
    delete (window as any).showSaveFilePicker;
  });
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save section", exact: true }).click();
  const download = await pending;
  const xml = await fs.readFile((await download.path())!, "utf8");
  expect(xml).toContain("<b:color>#3264aa</b:color>");
  expect(xml.match(/<trkpt /g)).toHaveLength(3);
  expect(xml).not.toContain('lat="56"');
});

test("Irish samples and the full branded header remain clear on small phones", async ({
  page,
}) => {
  await page.getByRole("button", { name: /Explore with sample/ }).click();
  await expect(page.locator(".brand-title")).toHaveText(
    "BareGPS Route Planner",
  );
  await expect(page).toHaveTitle("BareGPS Route Planner");
  await expect(page.locator(".brand-subtitle")).toHaveText(
    "GPX Creator and Editor",
  );
  await expect(page.locator("#track-list")).toContainText(
    "Glendalough · Upper Lake",
  );
  await expect(page.locator("#track-list")).toContainText(
    "Glendalough · Spinc ridge",
  );
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
