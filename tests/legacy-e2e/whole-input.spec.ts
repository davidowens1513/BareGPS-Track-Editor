import { confirmPlanWithoutTerrain } from "./input-helpers";
import { exportGPX } from "../../src/model";
import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { trimBefore, trimAfter, savedWorkspace } from "./input-helpers";
test("whole input editing trims both sides, preserves metadata and protects existing plans", async ({
  page,
}) => {
  await page.route("**/*.tile.opentopomap.org/**", (r) => r.abort());
  await page.goto("/");
  await page.locator("#edit-tab").click();
  const chooser = page.waitForEvent("filechooser");
  await page.locator("#import").click();
  await (
    await chooser
  ).setFiles({
    name: "whole.gpx",
    mimeType: "text/xml",
    buffer: Buffer.from(
      `<gpx><trk><name>Whole input</name><trkseg>${Array.from({ length: 6 }, (_, i) => `<trkpt lat="${53 + i * 0.001}" lon="-6"><ele>${100 + i}</ele><name>P${i + 1}</name><time>2026-01-01T10:00:00Z</time></trkpt>`).join("")}</trkseg></trk></gpx>`,
    ),
  });
  await expect(page.locator("#notice")).toBeHidden();
  await expect(
    page.locator(
      "#range-start,#range-end,#input-points-mode,#input-section-mode,#input-done,#split",
    ),
  ).toHaveCount(0);
  await expect(page.locator("#input-point-tools")).toBeVisible();
  await expect(page.locator("#input-plan-controls button")).toHaveText([
    "Add to Route Plan",
  ]);
  await expect(page.locator("#route-plan-controls button")).toHaveText([
    "Route Plan 0",
  ]);
  await expect(page.locator("#save-input")).toHaveCount(0);
  const originalViewport = page.viewportSize()!;
  await page.setViewportSize({ width: 320, height: 740 });
  const sizes = await page
    .locator("#input-extra-tools .drawing-modes button")
    .evaluateAll((buttons) =>
      buttons.map((button) => {
        const b = button.getBoundingClientRect();
        return {
          x: b.x,
          y: b.y,
          width: b.width,
          height: b.height,
          fits: button.scrollWidth <= button.clientWidth,
        };
      }),
    );
  expect(sizes).toHaveLength(4);
  for (const size of sizes) {
    expect(size.width).toBeCloseTo(sizes[0].width, 0);
    expect(size.y).toBe(sizes[0].y);
    expect(size.height).toBe(sizes[0].height);
    expect(size.fits).toBe(true);
  }
  await page.setViewportSize(originalViewport);

  await expect(page.locator("#trim-before")).toBeDisabled();
  await expect(page.locator("#trim-after")).toBeDisabled();
  await page.locator("#add-route").click();
  await expect(page.locator(".plan-grid tbody tr")).toContainText("6");
  await page.getByRole("button", { name: "Keep adding", exact: true }).click();
  await page.locator(".track-select").first().click();
  await trimBefore(page, 3);
  await expect(page.locator("#point-count")).toHaveText("4 points");
  await expect(page.locator("#input-selected-point")).toHaveText(
    "Point 1 selected",
  );
  await expect(page.locator("#trim-before")).toBeDisabled();
  await expect(page.locator("#trim-after")).toBeDisabled();
  await trimAfter(page, 3);
  await expect(page.locator("#point-count")).toHaveText("3 points");
  await expect(page.locator("#input-selected-point")).toHaveText(
    "Point 3 selected",
  );
  await expect(page.locator("#trim-after")).toBeDisabled();
  await expect(page.locator("#waypoint-count")).toHaveText("0");
  const xml = exportGPX((await savedWorkspace(page)).tracks[0]);
  expect(xml.match(/<trkpt /g)).toHaveLength(3);
  expect(xml).toContain('<trkpt lat="53.002" lon="-6"><ele>102</ele>');
  expect(xml).toContain("<name>P3</name>");
  expect(xml).toContain("2026-01-01T10:00:00Z");
  expect(xml).not.toContain("<name>P6</name>");
  await page.locator("#undo").click();
  await expect(page.locator("#point-count")).toHaveText("4 points");
  await page.locator("#undo").click();
  await expect(page.locator("#point-count")).toHaveText("6 points");
  await page.locator("#redo").click();
  await page.locator("#redo").click();
  await expect(page.locator("#point-count")).toHaveText("3 points");
  await page.locator("#input-extra-tools").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `/tmp/baregps-whole-input-${test.info().project.name}.png`,
  });
  await page.locator("#open-route-plan").click();
  await expect(page.locator(".plan-grid tbody tr")).toContainText("6");
  await confirmPlanWithoutTerrain(page);
  await expect(page.locator("#waypoint-count")).toHaveText("6");
  await expect(page.locator("#input-add")).toBeDisabled();
  await expect(page.locator("#trim-before")).toBeDisabled();
  await page.locator(".track-select").first().click();
  await page.locator("#open-route-plan").click();
  await page.locator("#plan-replace").click();
  await expect(page.locator("#waypoint-count")).toHaveText("6");
  await confirmPlanWithoutTerrain(page);
  await expect(page.locator("#waypoint-count")).toHaveText("3");
});
