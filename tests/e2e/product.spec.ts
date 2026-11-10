import { test, expect } from "@playwright/test";
const gpx = (count: number) =>
  "<gpx><trk><name>Original</name><trkseg>" +
  Array.from(
    { length: count },
    (_, i) =>
      `<trkpt lat="${53 + i * 0.00001}" lon="-6"><ele>100</ele></trkpt>`,
  ).join("") +
  "</trkseg></trk></gpx>";
test.beforeEach(async ({ page }) => {
  await page.route("**/*.tile.opentopomap.org/**", (r) => r.abort());
  await page.addInitScript(() =>
    Object.defineProperty(window, "showSaveFilePicker", {
      value: undefined,
      configurable: true,
    }),
  );
  await page.goto("/");
});
test("standalone Editor imports, confirms and saves without a Create mode", async ({
  page,
}) => {
  await expect(page).toHaveTitle("BareGPS Track Editor");
  await expect(page.getByRole("tab")).toHaveCount(0);
  await expect(page.locator("#create-map")).toBeHidden();
  await expect(page.locator(".edit-workflow")).toBeVisible();
  const chooser = page.waitForEvent("filechooser");
  await page.locator("#empty-import").click();
  await (
    await chooser
  ).setFiles({
    name: "test.gpx",
    mimeType: "text/xml",
    buffer: Buffer.from(gpx(3)),
  });
  await page.locator("#add-route").click();
  await page.locator("#confirm-route-plan").click();
  await expect(page.locator("#dialog")).not.toBeVisible();
  await expect(page.locator("#waypoint-count")).toHaveText("3");
  await expect(
    page.getByRole("img", { name: "In Route Plan", exact: true }),
  ).toBeVisible();
  await page.locator("#settings").click();
  await expect(
    page.getByRole("heading", { name: "Route Colour", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Input Track Editing", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.locator("#help").click();
  await expect(page.locator("#about-create")).toHaveCount(0);
  await expect(page.locator("#about-edit")).toBeVisible();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  const pending = page.waitForEvent("download");
  await page.locator("#create-save").click();
  const fs = await import("node:fs/promises");
  const xml = await fs.readFile((await (await pending).path())!, "utf8");
  expect(xml).toContain('creator="BareGPS Track Editor"');
  expect(xml.match(/<trkpt /g)).toHaveLength(3);
});
test("dense originals survive simplification preview, cancellation and accepted copy", async ({
  page,
}) => {
  const chooser = page.waitForEvent("filechooser");
  await page.locator("#empty-import").click();
  await (
    await chooser
  ).setFiles({
    name: "dense.gpx",
    mimeType: "text/xml",
    buffer: Buffer.from(gpx(7001)),
  });
  await page.locator("#simplify-input").click();
  await expect(page.locator(".simplify-counts")).toContainText("7,001");
  await page.locator("#cancel-simplify").click();
  await expect(page.locator("#source-count")).toHaveText("1");
  await page.locator("#simplify-input").click();
  await page.locator("#accept-simplify").click();
  await expect(page.locator("#source-count")).toHaveText("2");
  await expect(page.locator("#save-state")).toContainText("Saved on device");
  await page.reload();
  await expect(page.locator("#source-count")).toHaveText("2");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
