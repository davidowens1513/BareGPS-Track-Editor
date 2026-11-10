import { test, expect } from "@playwright/test";
import { savedWorkspace } from "./input-helpers";
const xml =
  "<gpx><trk><name>Dense original</name><trkseg>" +
  Array.from(
    { length: 7001 },
    (_, i) =>
      `<trkpt lat="${53 + i * 0.00001}" lon="-6"><ele>100</ele>${i === 41 ? "<name>Gate</name>" : ""}</trkpt>`,
  ).join("") +
  "</trkseg></trk></gpx>";
test.beforeEach(async ({ page }) => {
  await page.route("**/*.tile.opentopomap.org/**", (r) => r.abort());
  await page.goto("/");
  await page.locator("#edit-tab").click();
  const chooser = page.waitForEvent("filechooser");
  await page.locator("#empty-import").click();
  await (
    await chooser
  ).setFiles({
    name: "dense.gpx",
    mimeType: "text/xml",
    buffer: Buffer.from(xml),
  });
  await expect(page.locator("#source-count")).toHaveText("1");
  await expect(page.locator("#point-count")).toHaveText("7,001 points");
});
test("preview cancellation keeps the original; acceptance creates an undoable persistent copy with one handle per point", async ({
  page,
}) => {
  await page.locator("#simplify-input").click();
  await expect(
    page.getByRole("heading", { name: "Preview Simplified Track" }),
  ).toBeVisible();
  await expect(page.locator(".simplify-counts")).toContainText("7,001");
  await page.locator("#simplify-show-original").uncheck();
  await page.locator("#simplify-show-original").check();
  await page.locator("#cancel-simplify").click();
  await expect(page.locator("#source-count")).toHaveText("1");
  await expect(page.locator("#point-count")).toHaveText("7,001 points");
  await page.locator("#simplify-input").click();
  await page.keyboard.press("Escape");
  await expect(page.locator("#dialog")).not.toBeVisible();
  await page.locator("#simplify-input").click();
  await page.locator("#accept-simplify").click();
  await expect(page.locator("#dialog")).not.toBeVisible();
  await expect(page.locator("#source-count")).toHaveText("2");
  await expect(page.locator("#save-state")).toContainText("Saved on device");
  const w: any = await savedWorkspace(page);
  expect(w.tracks[0].points).toHaveLength(7001);
  expect(w.tracks[0].points[41].name).toBe("Gate");
  const copy = w.tracks[1];
  expect(copy.simplified).toBe(true);
  expect(copy.points.length).toBeLessThan(90);
  expect(copy.points.some((p: any) => p.name === "Gate")).toBe(true);
  expect(w.routePlan ?? []).toHaveLength(0);
  expect(w.route).toBeNull();
  await expect(page.locator(".input-handle")).toHaveCount(copy.points.length);
  await page.locator("#undo").click();
  await expect(page.locator("#source-count")).toHaveText("1");
  await page.locator("#redo").click();
  await expect(page.locator("#source-count")).toHaveText("2");
  await expect(page.locator("#save-state")).toContainText("Saved on device");
  await page.reload();
  await page.locator("#edit-tab").click();
  await expect(page.locator("#source-count")).toHaveText("2");
  await page
    .locator(".track-select")
    .filter({ hasText: "(simplified)" })
    .click();
  await expect(page.locator(".input-handle")).toHaveCount(copy.points.length);
});
