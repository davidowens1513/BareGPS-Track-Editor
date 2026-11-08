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
  await page
    .getByRole("button", { name: "Dismiss message", exact: true })
    .click();
});
test("stage sections, reorder clickable rows, recover the plan and confirm before the Route Card changes", async ({
  page,
}) => {
  await page
    .getByRole("slider", { name: "Section start point", exact: true })
    .fill("1");
  await page
    .getByRole("button", { name: "Add to Route Plan", exact: true })
    .click();
  await expect(page.locator(".plan-grid tbody tr")).toHaveCount(1);
  await expect(page.locator(".plan-grid")).toContainText("First · points 2–4");
  await expect(page.locator("#route-card")).toBeHidden();
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
  await expect(page.locator("#route-card")).toBeHidden();
  await page
    .getByRole("button", { name: "Confirm Route", exact: true })
    .click();
  await expect(page.locator("#card-source-note")).toHaveText(
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
  await page
    .getByRole("button", { name: "Confirm Route", exact: true })
    .click();
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
  await expect(
    page.getByRole("button", { name: "Confirm Route", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Keep adding", exact: true }).click();
  await page
    .getByRole("button", { name: "Add to Route Plan", exact: true })
    .click();
  await page.getByRole("button", { name: "Keep adding", exact: true }).click();
  await page.getByRole("button", { name: "Remove First", exact: true }).click();
  await page
    .getByRole("button", { name: "Remove Second", exact: true })
    .click();
  await page.getByRole("button", { name: "Route Plan", exact: true }).click();
  await expect(page.locator(".plan-grid")).toContainText("First · points 1–4");
  await page
    .getByRole("button", { name: "Confirm Route", exact: true })
    .click();
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
  await page
    .getByRole("button", { name: "Confirm Route", exact: true })
    .click();
  await expect(page.locator("#route-card")).toBeVisible();
});
