import { confirmPlanWithoutTerrain } from "./input-helpers";
import { trimBefore } from "./input-helpers";
import { test, expect } from "@playwright/test";
const gpx = (name: string, latitude: number) =>
  `<gpx version="1.1"><trk><name>${name}</name><trkseg>${Array.from({ length: 4 }, (_, i) => `<trkpt lat="${latitude + i * 0.001}" lon="-6"><ele>${100 + i * 10}</ele></trkpt>`).join("")}</trkseg></trk></gpx>`;
test.beforeEach(async ({ page }) => {
  await page.route("**/*.tile.opentopomap.org/**", (r) => r.abort());
  await page.goto("/");
  await page.getByRole("tab", { name: "Edit Existing", exact: true }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.locator("#import").click();
  await (
    await chooser
  ).setFiles(
    ["First", "Second"].map((name, i) => ({
      name: name + ".gpx",
      mimeType: "text/xml",
      buffer: Buffer.from(gpx(name, 53 + i)),
    })),
  );
  await expect(page.locator("#notice")).toBeHidden();
});
test("stage sections, reorder clickable rows, recover the plan and confirm before the Route Card changes", async ({
  page,
}) => {
  await trimBefore(page, 2);
  await page
    .getByRole("button", { name: "Add to Route Plan", exact: true })
    .click();
  await expect(page.locator(".plan-grid tbody tr")).toHaveCount(1);
  await expect(page.locator(".plan-grid")).toContainText("First");
  await expect(page.locator("#route-card")).toHaveCount(0);
  await expect(page.locator("#create-name")).toHaveValue("");
  await expect(page.locator("#waypoint-rows [data-card-row]")).toHaveCount(0);
  await page.getByRole("button", { name: "Keep adding", exact: true }).click();
  await page.locator(".track-select").filter({ hasText: "Second" }).click();
  await page
    .getByRole("button", { name: "Add to Route Plan", exact: true })
    .click();
  await expect(page.locator(".plan-grid tbody tr")).toHaveCount(2);
  await page.getByRole("button", { name: "Move up", exact: true }).click();
  await expect(page.locator(".plan-grid tbody tr").first()).toContainText(
    "Second",
  );
  await page.locator(".plan-grid tbody tr").last().click();
  await expect(
    page.getByRole("button", { name: "Move down", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Keep adding", exact: true }).click();
  await expect(page.locator("#save-state")).toContainText("Saved on device");
  await page.reload();
  await page.getByRole("tab", { name: "Edit Existing", exact: true }).click();
  await page.getByRole("button", { name: "Route Plan", exact: true }).click();
  await expect(page.locator(".plan-grid tbody tr").first()).toContainText(
    "Second",
  );
  await expect(page.locator("#route-card")).toHaveCount(0);
  await confirmPlanWithoutTerrain(page);
  await expect(page.locator("#card-source-note")).toContainText(
    "Whole joined route · 7 points",
  );
  await expect(page.locator(".grid-reference").first()).toHaveAttribute(
    "title",
    /54\.000/,
  );
  const confirmed = await page.locator("#waypoint-rows").textContent();
  await page.getByRole("button", { name: "Route Plan", exact: true }).click();
  await page.locator(".plan-grid tbody tr").first().click();
  await page.getByRole("button", { name: "Move down", exact: true }).click();
  await expect(page.locator("#waypoint-rows")).toHaveText(confirmed!);
  await page.getByRole("button", { name: "Keep adding", exact: true }).click();
  await page.locator("#undo").click();
  await page.getByRole("button", { name: "Route Plan", exact: true }).click();
  await expect(page.locator(".plan-grid tbody tr").first()).toContainText(
    "Second",
  );
  await page.locator(".plan-grid tbody tr").first().click();
  await page.getByRole("button", { name: "Move down", exact: true }).click();
  await confirmPlanWithoutTerrain(page);
  await expect(page.locator(".grid-reference").first()).toHaveAttribute(
    "title",
    /53\.001/,
  );
});
test("remove staged sections and build after the source track has been removed", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Add to Route Plan", exact: true })
    .click();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await page.locator("#confirm-delete").click();
  await expect(
    page.getByRole("button", { name: "Confirm Plan", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Keep adding", exact: true }).click();
  await page
    .getByRole("button", { name: "Add to Route Plan", exact: true })
    .click();
  await page.getByRole("button", { name: "Keep adding", exact: true }).click();
  await page.getByRole("button", { name: "Remove First", exact: true }).click();
  await page.locator("#confirm-delete").click();
  await page
    .getByRole("button", { name: "Remove Second", exact: true })
    .click();
  await page.locator("#confirm-delete").click();
  await page.getByRole("button", { name: "Route Plan", exact: true }).click();
  await expect(page.locator(".plan-grid")).toContainText("First");
  await confirmPlanWithoutTerrain(page);
  await expect(page.locator("#waypoint-count")).toHaveText("4");
});

test("long plans scroll while ordering and confirmation controls remain visible on a short phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  for (let i = 0; i < 10; i++) {
    await page
      .getByRole("button", { name: "Add to Route Plan", exact: true })
      .click();
    if (i < 9)
      await page
        .getByRole("button", { name: "Keep adding", exact: true })
        .click();
  }
  const scroll = page.locator(".plan-scroll");
  expect(await scroll.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(
    true,
  );
  await scroll.evaluate((el) => (el.scrollTop = el.scrollHeight));
  const confirm = (await page.locator("#confirm-route-plan").boundingBox())!;
  expect(confirm.y + confirm.height).toBeLessThanOrEqual(568);
  const dialog = page.locator("#dialog");
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await page.locator(".plan-grid tbody tr").last().click();
  await expect(page.locator("#plan-up")).toBeEnabled();
  await page.locator("#plan-up").click();
  await confirmPlanWithoutTerrain(page);
  await expect(page.locator("#waypoint-count")).not.toHaveText("0");
});

test("one editable route name and Preview live in the Route Card and survive reconfirmation", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Add to Route Plan", exact: true })
    .click();
  await confirmPlanWithoutTerrain(page);
  await expect(page.locator("#route-card")).toHaveCount(0);
  await expect(page.locator("#create-name")).toHaveValue("Edited Route");
  await expect(page.locator("#create-name")).toBeEditable();
  await expect(page.locator("#create-card #preview-route")).toBeVisible();
  await expect(page.locator("#rename-route")).toHaveCount(0);
  await page.locator("#create-name").fill("My ridge walk");
  await page.locator("#create-name").blur();
  await page.locator("#undo").click();
  await expect(page.locator("#create-name")).toHaveValue("Edited Route");
  await page.locator("#redo").click();
  await expect(page.locator("#create-name")).toHaveValue("My ridge walk");
  await page.locator(".track-select").filter({ hasText: "Second" }).click();
  await page.locator("#preview-route").click();
  await expect(page.locator("#point-count")).toHaveText("4 points");
  await expect(page.locator("#section-controls #rename")).toHaveCount(0);
  await page.locator(".track-select").filter({ hasText: "Second" }).click();
  await page
    .getByRole("button", { name: "Add to Route Plan", exact: true })
    .click();
  await confirmPlanWithoutTerrain(page);
  await expect(page.locator("#create-name")).toHaveValue("My ridge walk");
});

test("Edit Input Track clears when all inputs have contributed, and Undo restores the selection", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Add to Route Plan", exact: true })
    .click();
  await page.getByRole("button", { name: "Keep adding", exact: true }).click();
  await expect(page.locator("#input-add")).toBeEnabled();
  await page.locator(".track-select").filter({ hasText: "Second" }).click();
  await page
    .getByRole("button", { name: "Add to Route Plan", exact: true })
    .click();
  await page.getByRole("button", { name: "Keep adding", exact: true }).click();
  await expect(page.locator("#section-controls #rename")).toHaveCount(0);
  await expect(page.locator("#input-add")).toBeDisabled();
  await expect(page.locator("#source-count")).toHaveText("2");
  await expect(page.locator("#waypoint-count")).toHaveText("0");
  await page.locator("#undo").click();
  await expect(page.locator(".track-select[aria-pressed=true]")).toContainText(
    "Second",
  );
  await expect(page.locator("#input-add")).toBeEnabled();
  await page
    .getByRole("button", { name: "Add to Route Plan", exact: true })
    .click();
  await page.getByRole("button", { name: "Keep adding", exact: true }).click();
  await page.locator(".track-select").filter({ hasText: "First" }).click();
  await expect(page.locator("#input-add")).toBeEnabled();
});

test("input pencil renames independently of selection and plan snapshots, with Cancel and Undo", async ({
  page,
}) => {
  await page.locator("#add-route").click();
  await page.getByRole("button", { name: "Keep adding", exact: true }).click();
  await page.locator(".track-select").filter({ hasText: "Second" }).click();
  await page.getByRole("button", { name: "Rename First", exact: true }).click();
  await expect(page.locator("#track-name")).toHaveValue("First");
  await page.locator("#track-name").fill("First renamed");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Rename First", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Rename First", exact: true }).click();
  await page.locator("#track-name").fill("First renamed");
  await page.getByRole("button", { name: "Save name", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Rename First renamed", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".track-row.active strong")).toHaveText("Second");
  await page.locator("#open-route-plan").click();
  await expect(page.locator(".plan-grid")).toContainText("First");
  await expect(page.locator(".plan-grid")).not.toContainText("First renamed");
  await page.getByRole("button", { name: "Keep adding", exact: true }).click();
  await page.locator("#undo").click();
  await expect(
    page.getByRole("button", { name: "Rename First", exact: true }),
  ).toBeVisible();
  await page.locator("#redo").click();
  await expect(
    page.getByRole("button", { name: "Rename First renamed", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#save-state")).toHaveAttribute(
    "aria-label",
    "Saved on device",
  );
  await page.reload();
  await page.getByRole("tab", { name: "Edit Existing", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Rename First renamed", exact: true }),
  ).toBeVisible();
});

test("input plan ticks sit between colour and bin and follow plan membership", async ({
  page,
}) => {
  const first = page.locator(".track-row").filter({
    has: page.locator(".track-select strong", { hasText: "First" }),
  });
  const second = page.locator(".track-row").filter({
    has: page.locator(".track-select strong", { hasText: "Second" }),
  });
  await expect(
    page.getByRole("img", { name: "In Route Plan", exact: true }),
  ).toHaveCount(0);
  await page.locator("#add-route").click();
  await page.getByRole("button", { name: "Keep adding", exact: true }).click();
  await expect(
    first.getByRole("img", { name: "In Route Plan", exact: true }),
  ).toBeVisible();
  await expect(
    second.getByRole("img", { name: "In Route Plan", exact: true }),
  ).toHaveCount(0);
  expect(
    await first
      .locator(".input-track-colour + .input-plan-status + .delete-track")
      .count(),
  ).toBe(1);
  await second.locator(".track-select").click();
  await expect(
    first.getByRole("img", { name: "In Route Plan", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#save-state")).toContainText("Saved on device");
  await page.reload();
  await page.getByRole("tab", { name: "Edit Existing", exact: true }).click();
  await expect(
    first.getByRole("img", { name: "In Route Plan", exact: true }),
  ).toBeVisible();
  await page.locator("#open-route-plan").click();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await page.locator("#confirm-delete").click();
  await page.getByRole("button", { name: "Keep adding", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "In Route Plan", exact: true }),
  ).toHaveCount(0);
  await page.locator("#undo").click();
  await expect(
    first.getByRole("img", { name: "In Route Plan", exact: true }),
  ).toBeVisible();
});
