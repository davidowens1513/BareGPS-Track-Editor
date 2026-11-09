import { confirmPlanWithoutTerrain } from "./input-helpers";
import { trimBefore, trimAfter } from "./input-helpers";
import { test, expect } from "@playwright/test";
const gpx = (name: string, lat: number) =>
  `<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>${name}</name><trkseg>${Array.from({ length: 8 }, (_, i) => `<trkpt lat="${lat + i * 0.001}" lon="-6"><ele>${100 + i * 10}</ele><name>P${i + 1}</name></trkpt>`).join("")}</trkseg></trk></gpx>`;
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "showSaveFilePicker", {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(navigator, "share", {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(navigator, "canShare", {
      value: () => false,
      configurable: true,
    });
  });
  await page.route("**/*.tile.opentopomap.org/**", (r) => r.abort());
  await page.goto("/");
  await page.getByRole("tab", { name: "Edit Existing", exact: true }).click();
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Open GPX file(s)", exact: true })
    .click();
  await (
    await chooser
  ).setFiles([
    {
      name: "first.gpx",
      mimeType: "text/xml",
      buffer: Buffer.from(gpx("First track", 53)),
    },
    {
      name: "second.gpx",
      mimeType: "text/xml",
      buffer: Buffer.from(gpx("Second track", 54)),
    },
  ]);
  await expect(page.locator("#notice")).toBeHidden();
});
test("Edit card stays empty during input editing and exports only the confirmed route", async ({
  page,
}) => {
  await expect(page.locator("#waypoint-count")).toHaveText("0");
  await expect(page.locator("#waypoint-rows [data-card-row]")).toHaveCount(0);
  await expect(page.locator("#create-save")).toBeDisabled();
  await expect(page.locator("#create-save")).toHaveText("Save Route");
  await trimBefore(page, 3);
  await trimAfter(page, 4);
  await expect(page.locator("#point-count")).toHaveText("4 points");
  await expect(page.locator("#waypoint-count")).toHaveText("0");
  await expect(page.locator("#profile svg")).toBeVisible();
  await page
    .getByRole("button", { name: "Add to Route Plan", exact: true })
    .click();
  await expect(page.locator("#waypoint-count")).toHaveText("0");
  await confirmPlanWithoutTerrain(page);
  await expect(page.locator("#waypoint-rows tr")).toHaveCount(4);
  await expect(page.locator("#create-name")).toHaveValue("Edited Route");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save Route", exact: true }).click();
  const fs = await import("node:fs/promises");
  const xml = await fs.readFile((await (await download).path())!, "utf8");
  expect((xml.match(/<trkpt /g) || []).length).toBe(4);
  expect(xml).toContain('lat="53.002"');
  await expect(page.locator("#notice")).toBeHidden();
  await page
    .getByRole("button", { name: "Expand Route Card", exact: true })
    .click();
  await expect(page.locator("#dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Share Text", exact: true }).click();
  await expect(page.locator("#routecard-text")).toContainText("Edited Route");
  await expect(page.locator("#routecard-text")).toContainText("Point 1");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page
    .getByRole("button", { name: "Collapse Route Card", exact: true })
    .click();
  await page.getByRole("tab", { name: "Create New", exact: true }).click();
  await expect(page.locator("#waypoint-count")).toHaveText("0");
  await expect(page.locator("#create-name")).toHaveValue("Created Route");
});
test("Joined route takes precedence and remains whole while source sections change", async ({
  page,
}) => {
  await trimBefore(page, 3);
  await page
    .getByRole("button", {
      name: "Add to Route Plan",
      exact: true,
    })
    .click();
  await confirmPlanWithoutTerrain(page);
  await expect(page.locator("#card-source-note")).toContainText(
    "Whole joined route · 6 points",
  );
  await page
    .getByRole("button", { name: /Second track/ })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Add to Route Plan", exact: true })
    .click();
  await confirmPlanWithoutTerrain(page);
  await expect(page.locator("#card-source-note")).toContainText(
    "Whole joined route · 14 points",
  );
  await page
    .locator(".track-select")
    .filter({ hasText: "Second track" })
    .click();
  await trimAfter(page, 4);
  await expect(page.locator("#waypoint-count")).toHaveText("14");
  const scroll = page.locator("#create-card .waypoint-scroll");
  await expect
    .poll(() => scroll.evaluate((el) => el.scrollHeight > el.clientHeight))
    .toBe(true);
  await page
    .getByRole("button", { name: "Expand Route Card", exact: true })
    .click();
  await scroll.evaluate((el) => (el.scrollTop = el.scrollHeight));
  const share = await page.locator("#create-share").boundingBox();
  expect(share!.y + share!.height).toBeLessThanOrEqual(
    page.viewportSize()!.height,
  );
  const pdf = page.waitForEvent("download");
  await page.locator("#create-pdf").click();
  expect((await pdf).suggestedFilename()).toMatch(/\.pdf$/);
});
test("Confirmed-route point names use Edit undo and focus the selected route point", async ({
  page,
}) => {
  await trimBefore(page, 3);
  await page
    .getByRole("button", { name: "Add to Route Plan", exact: true })
    .click();
  await confirmPlanWithoutTerrain(page);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("switch", { name: "Allow Point Naming", exact: true })
    .click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  const name = page.getByRole("textbox", {
    name: "Name for point 1 (optional)",
    exact: true,
  });
  await expect(name).toHaveValue("P3");
  await name.fill("Gate");
  await name.press("Enter");
  await page.locator("#undo").click();
  await expect(name).toHaveValue("P3");
  await page.locator("#redo").click();
  await expect(name).toHaveValue("Gate");
  await page
    .getByRole("button", { name: "Show point 1 on map", exact: true })
    .click();
  await expect(page.locator("#edit-coordinates")).toContainText("53.002");
});

test("large Edit cards scroll through all points without rendering the entire track", async ({
  page,
}) => {
  const xml = `<gpx><trk><name>Large track</name><trkseg>${Array.from({ length: 2000 }, (_, i) => `<trkpt lat="${53 + i * 0.00001}" lon="-6"><ele>100</ele></trkpt>`).join("")}</trkseg></trk></gpx>`;
  const chooser = page.waitForEvent("filechooser");
  await page.locator("#import").click();
  await (
    await chooser
  ).setFiles({
    name: "large.gpx",
    mimeType: "text/xml",
    buffer: Buffer.from(xml),
  });
  await expect(page.locator("#waypoint-count")).toHaveText("0");
  await page
    .getByRole("button", { name: "Add to Route Plan", exact: true })
    .click();
  await confirmPlanWithoutTerrain(page);
  await expect(page.locator("#waypoint-count")).toHaveText("2000");
  await expect(page.locator("#notice")).toBeHidden();
  expect(
    await page.locator("#waypoint-rows tr[data-card-row]").count(),
  ).toBeLessThanOrEqual(100);
  const scroll = page.locator("#create-card .waypoint-scroll");
  await scroll.evaluate((el) => (el.scrollTop = el.scrollHeight));
  await expect(
    page.getByRole("button", { name: "Show point 2000 on map", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Expand Route Card", exact: true })
    .click();
  await scroll.evaluate((el) => (el.scrollTop = el.scrollHeight));
  await expect(
    page.getByRole("button", { name: "Show point 2000 on map", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Collapse Route Card", exact: true })
    .click();
  const pending = page.waitForEvent("download");
  await page.locator("#create-save").click();
  const fs = await import("node:fs/promises");
  const saved = await fs.readFile((await (await pending).path())!, "utf8");
  expect((saved.match(/<trkpt /g) || []).length).toBe(2000);
});

test("Edit Clear and Save are equal; clearing is undoable and keeps imported tracks", async ({
  page,
}) => {
  const sizes = await page
    .locator(".create-buttons .button:visible")
    .evaluateAll((buttons) =>
      buttons.map((button) => ({
        width: button.getBoundingClientRect().width,
        y: button.getBoundingClientRect().y,
      })),
    );
  expect(sizes).toHaveLength(2);
  await expect(page.locator("#create-terrain")).toBeHidden();
  expect(Math.abs(sizes[0].width - sizes[1].width)).toBeLessThan(1);
  expect(sizes[0].y).toBe(sizes[1].y);
  await expect(page.locator("#create-clear")).toBeDisabled();
  await expect(page.locator("#create-save")).toBeDisabled();
  await page
    .getByRole("button", { name: "Add to Route Plan", exact: true })
    .click();
  await confirmPlanWithoutTerrain(page);
  await expect(page.locator("#card-source-note")).toContainText(
    "Whole joined route",
  );
  await page.locator("#create-clear").click();
  await page.locator("#confirm-clear-edit").click();
  await expect(page.locator("#waypoint-count")).toHaveText("0");
  await expect(page.locator("#source-count")).toHaveText("2");
  await page.locator("#undo").click();
  await expect(page.locator("#card-source-note")).toContainText(
    "Whole joined route",
  );
});

test("preview closes back to the selected input", async ({ page }) => {
  await page
    .getByRole("button", { name: "Add to Route Plan", exact: true })
    .click();
  await confirmPlanWithoutTerrain(page);
  await page.locator(".track-select").first().click();
  const selectedName = await page
    .locator(".track-row.active strong")
    .textContent();
  await page.locator("#preview-route").click();
  await expect(page.locator("#exit-preview")).toBeVisible();
  await expect(page.locator("#reverse")).toBeDisabled();
  await page.locator("#exit-preview").click();
  await expect(page.locator("#exit-preview")).toBeHidden();
  await expect(page.locator("#reverse")).toBeEnabled();
  await expect(page.locator(".track-row.active strong")).toHaveText(
    selectedName!,
  );
});
