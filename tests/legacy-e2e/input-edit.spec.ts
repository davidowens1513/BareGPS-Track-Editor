import { confirmPlanWithoutTerrain } from "./input-helpers";
import { exportGPX } from "../../src/model";
import { handleSpacing, savedWorkspace } from "./input-helpers";
import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs/promises";
const gpx = (count = 61) =>
  `<gpx version="1.1"><trk><name>Dense input</name><trkseg>${Array.from({ length: count }, (_, i) => `<trkpt lat="${53 + i * 0.0001}" lon="-6"><ele>${100 + i}</ele><time>2026-01-01T10:00:00Z</time></trkpt>`).join("")}</trkseg></trk></gpx>`;
async function load(page: Page, count = 61) {
  await page.route("**/*.tile.opentopomap.org/**", (r) => r.abort());
  await page.goto("/");
  await page.locator("#edit-tab").click();
  const chooser = page.waitForEvent("filechooser");
  await page.locator("#import").click();
  await (
    await chooser
  ).setFiles({
    name: "dense.gpx",
    mimeType: "text/xml",
    buffer: Buffer.from(gpx(count)),
  });
  await expect(page.locator("#notice")).toBeHidden();
}
async function xml(page: Page) {
  return exportGPX((await savedWorkspace(page)).tracks[0]);
}

test("input point tools retain dense geometry, support Undo and leave confirmed output isolated", async ({
  page,
}) => {
  await load(page);
  await page.locator("#add-route").click();
  await confirmPlanWithoutTerrain(page);
  await expect(page.locator("#notice")).toBeHidden();
  await expect(page.locator("#input-points-mode")).toHaveCount(0);
  const originalCard = await page.locator("#waypoint-rows").textContent();
  await page
    .locator(".track-select")
    .filter({ hasText: "Dense input" })
    .click();
  await expect(page.locator(".input-handle")).toHaveCount(4);
  await expect(page.locator("#point-count")).toHaveText("61 points");
  await expect(page.locator("#input-terrain")).toBeDisabled();
  await handleSpacing(page, 10);
  await expect(page.locator(".input-handle")).toHaveCount(7);
  const before = await xml(page);
  await page.locator("#expand").click();
  const marker = page.locator('.input-handle[title^="Input point 21 "]');
  await marker.click();
  await expect(page.locator("#input-delete")).toBeEnabled();

  const box = (await marker.boundingBox())!;
  await page.mouse.move(box.x + 16, box.y + 16);
  await page.mouse.down();
  await page.mouse.move(box.x + 66, box.y + 16, { steps: 10 });
  await page.mouse.up();
  await page.locator("#expand").click();
  await expect(page.locator("#input-terrain")).toBeEnabled();
  const moved = await xml(page);
  expect(moved.match(/<trkpt /g)).toHaveLength(61);
  expect(moved).not.toBe(before);
  expect(moved).toContain("<b:terrainPending>true");
  await expect(page.locator("#waypoint-rows")).toHaveText(originalCard!);
  await page.locator("#undo").click();
  expect(await xml(page)).toBe(before);
  await page.locator("#redo").click();
  await page.locator("#open-route-plan").click();
  await page.locator("#plan-replace").click();
  await expect(page.locator("#waypoint-rows")).toHaveText(originalCard!);
  await confirmPlanWithoutTerrain(page);
  await expect(page.locator("#waypoint-rows")).not.toHaveText(originalCard!);
  await expect(page.locator("#input-point-tools")).toBeVisible();
  await expect(page.locator("#input-add")).toBeDisabled();
  await expect(page.locator("#create-terrain")).toBeHidden();
});
test("add, delete, close, terrain confirmation and interval recovery work on inputs", async ({
  page,
}) => {
  await load(page);
  await page.locator("#input-add").click();
  await page.locator("#map").click({ position: { x: 75, y: 100 } });
  await expect(page.locator("#point-count")).toHaveText("62 points");
  await expect(page.locator("#input-delete")).toBeEnabled();
  await page.locator("#input-delete").click();
  await page.locator("#confirm-delete").click();
  await expect(page.locator("#point-count")).toHaveText("61 points");
  await page.locator("#input-close").click();
  await expect(page.locator("#point-count")).toHaveText("62 points");
  await expect(page.locator("#input-close")).toBeDisabled();
  let fetches = 0;
  await page.route("**/terrain/v1/**", (r) => {
    fetches++;
    return r.fulfill({
      json: {
        status: "OK",
        results: new URL(r.request().url()).searchParams
          .get("locations")!
          .split("|")
          .map(() => ({ elevation: 123 })),
      },
    });
  });
  await page.locator("#input-terrain").click();
  await expect(page.locator("#dialog h2")).toHaveText("Fetch Input Terrain");
  expect(fetches).toBe(0);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(fetches).toBe(0);
  await page.locator("#input-terrain").click();
  await page.locator("#confirm-input-terrain").click();
  await expect(page.locator("#dialog")).not.toBeVisible();
  expect(fetches).toBeGreaterThan(0);
  await expect(page.locator("#input-terrain")).toBeDisabled();
  const saved = await xml(page);
  expect(saved).not.toContain("terrainPending");
  expect(saved).not.toContain("inputOriginalIndex");
  expect(saved).not.toContain("gapBefore");
  await handleSpacing(page, 15);
  await expect(page.locator("#save-state")).toContainText("Saved on device");
  await page.reload();
  await page.locator("#edit-tab").click();
  await page.locator(".track-select").first().click();
  await page.locator("#settings").click();
  await expect(page.locator("#settings-handle-interval")).toHaveValue("15");
});
test("large inputs cap visible handles without dropping points and phone controls fit", async ({
  page,
}) => {
  await load(page, 2001);
  await handleSpacing(page, 1);
  await expect(page.locator("#point-count")).toHaveText("2,001 points");
  expect(await page.locator(".input-handle").count()).toBeLessThanOrEqual(200);
  expect((await xml(page)).match(/<trkpt /g)).toHaveLength(2001);
  await page.setViewportSize({ width: 320, height: 740 });
  await expect(page.locator("#input-point-tools")).toBeVisible();
  expect(
    await page
      .locator("#app")
      .evaluate((el) => el.scrollWidth <= window.innerWidth),
  ).toBe(true);
  await page.locator("#expand").click();
  await expect(page.locator("#input-delete")).toBeInViewport();
  await expect(page.locator("#map")).toBeInViewport();
  await page.screenshot({ path: "/tmp/baregps-input-editor-phone.png" });
});

test("tap the line reveals an existing handle and Insert adds a new point", async ({
  page,
}) => {
  await load(page);
  await page.locator("#expand").click();
  let last = "",
    stableSince = 0;
  await expect
    .poll(async () => {
      const positions = await page
        .locator(".input-handle")
        .evaluateAll((nodes) =>
          JSON.stringify(
            nodes.map((n) => {
              const b = n.getBoundingClientRect();
              return [n.getAttribute("title"), b.x, b.y];
            }),
          ),
        );
      if (positions !== last) {
        last = positions;
        stableSince = Date.now();
      }
      return Date.now() - stableSince > 150;
    })
    .toBe(true);
  const a = (await page
    .locator('.input-handle[title^="Input point 21 "]')
    .boundingBox())!;
  const b = (await page
    .locator('.input-handle[title^="Input point 41 "]')
    .boundingBox())!;
  const x = (a.x + b.x) / 2 + 16,
    y = (a.y + b.y) / 2 + 36;
  await page.mouse.click(x, y);
  await expect(page.locator(".input-handle")).toHaveCount(5);
  await expect(page.locator("#point-count")).toHaveText("61 points");
  await expect(page.locator("#input-delete")).toBeEnabled();
  await page.locator("#input-insert").click();
  await page.mouse.click(x + 22, y + 12);
  await expect(page.locator("#point-count")).toHaveText("62 points");
  await expect(page.locator("#input-move")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.locator("#expand").click();
  const saved = await xml(page);
  expect(saved.match(/<trkpt /g)).toHaveLength(62);
  expect(saved).toContain('<trkpt lat="53.002" lon="-6"><ele>120</ele>');
});

test("Settings saves input handle spacing and updates the open editor", async ({
  page,
}) => {
  await load(page);
  await expect(page.locator(".input-handle")).toHaveCount(4);
  await page.locator("#settings").click();
  await expect(
    page.getByRole("heading", { name: "Input Track Editing", exact: true }),
  ).toBeVisible();
  await page.locator("#settings-handle-interval").fill("0");
  await expect(page.locator("#settings-apply-handles")).toBeDisabled();
  await page.locator("#settings-handle-interval").fill("10");
  await page.locator("#settings-apply-handles").click();
  await expect(page.locator("#settings-handle-status")).toContainText(
    "saved on this device",
  );
  await page
    .locator("#dialog")
    .getByRole("button", { name: "Done", exact: true })
    .click();
  await expect(page.locator(".input-handle")).toHaveCount(7);
  await expect(page.locator("#input-points-mode")).toHaveCount(0);
  await expect(page.locator("#point-count")).toHaveText("61 points");
  await page.reload();
  await page.locator("#settings").click();
  await expect(page.locator("#settings-handle-interval")).toHaveValue("10");
});
