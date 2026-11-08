import { test, expect } from "@playwright/test";

test("About distinguishes Create and Edit and navigation stays inside the guide", async ({
  page,
}) => {
  await page.route("**/*.tile.opentopomap.org/**", (route) => route.abort());
  await page.goto("/");
  await page
    .getByRole("button", { name: "About and keyboard shortcuts", exact: true })
    .click();
  const dialog = page.locator("#dialog");
  await expect(dialog).toHaveClass(/about-dialog/);
  await expect(
    page
      .locator("#about-create")
      .getByRole("heading", { name: "Create New", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator("#about-edit")
      .getByRole("heading", { name: "Edit Existing", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator("#about-create")
      .getByRole("heading", { name: "Fetch terrain", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator("#about-edit")
      .getByRole("heading", { name: "Build a Route Plan", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Edit Existing", exact: true }).click();
  const edit = await page.locator("#about-edit").boundingBox();
  const bounds = await dialog.boundingBox();
  expect(edit!.y).toBeGreaterThanOrEqual(bounds!.y);
  expect(edit!.y).toBeLessThan(bounds!.y + bounds!.height);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(dialog).not.toHaveClass(/about-dialog/);
  await expect(
    page.getByRole("switch", { name: "Allow Point Naming", exact: true }),
  ).toBeVisible();
});
