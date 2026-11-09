import { test, expect } from "@playwright/test";
import { savedWorkspace, selectInputPoint } from "./input-helpers";

test("delete confirmations keep data on Cancel or Escape and retain Undo", async ({
  page,
}) => {
  await page.route("**/*.tile.opentopomap.org/**", (r) => r.abort());
  await page.goto("/");
  for (const [x, y] of [
    [80, 120],
    [140, 160],
    [200, 210],
  ])
    await page.locator("#create-map").click({ position: { x, y } });
  const bin = page.getByRole("button", { name: "Remove point 1", exact: true });
  await bin.click();
  await expect(page.locator("#cancel-delete")).toBeFocused();
  await expect(page.locator("#waypoint-count")).toHaveText("3");
  await page.locator("#cancel-delete").click();
  await expect(page.locator("#waypoint-count")).toHaveText("3");
  await bin.click();
  await page.keyboard.press("Escape");
  await expect(page.locator("#waypoint-count")).toHaveText("3");
  await bin.click();
  await page.locator("#confirm-delete").click();
  await expect(page.locator("#waypoint-count")).toHaveText("2");
  await page.locator("#undo").click();
  await expect(page.locator("#waypoint-count")).toHaveText("3");
  await page.locator("#create-map .track-handle").first().click();
  await page.locator("#create-delete").click();
  await page.locator("#cancel-delete").click();
  await expect(page.locator("#waypoint-count")).toHaveText("3");
  await page.locator("#create-delete").click();
  await page.locator("#confirm-delete").click();
  await expect(page.locator("#waypoint-count")).toHaveText("2");
  await page.locator("#undo").click();
  await page.locator("#open-in-edit").click();
  await page
    .getByRole("button", { name: "Dismiss message", exact: true })
    .click();
  await selectInputPoint(page, 2);
  for (const action of ["input-delete", "trim-before", "trim-after"]) {
    await page.locator(`#${action}`).click();
    await page.locator("#cancel-delete").click();
    expect((await savedWorkspace(page)).tracks[0].points).toHaveLength(3);
    await page.locator(`#${action}`).click();
    await page.locator("#confirm-delete").click();
    expect((await savedWorkspace(page)).tracks[0].points).toHaveLength(2);
    await page.locator("#undo").click();
    await selectInputPoint(page, 2);
  }
  await page.locator("#add-route").click();
  await page.locator("#plan-remove").click();
  await page.keyboard.press("Escape");
  await expect(page.locator(".plan-grid tbody tr")).toHaveCount(1);
  await page.locator("#plan-remove").click();
  await page.locator("#cancel-delete").click();
  await expect(page.locator(".plan-grid tbody tr")).toHaveCount(1);
  await page.locator("#plan-remove").click();
  await page.locator("#confirm-delete").click();
  expect((await savedWorkspace(page)).routePlan).toHaveLength(0);
  await page.getByRole("button", { name: "Keep adding", exact: true }).click();
  await page.locator(".delete-track").click();
  await page.locator("#cancel-delete").click();
  await expect(page.locator(".track-row")).toHaveCount(1);
  await page.locator(".delete-track").click();
  await page.locator("#confirm-delete").click();
  await expect(page.locator(".track-row")).toHaveCount(0);
  await page.locator("#undo").click();
  await expect(page.locator(".track-row")).toHaveCount(1);
});
