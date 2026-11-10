import { test, expect } from "@playwright/test";

test("About keeps Overview visible and groups guidance in accessible expandable headings", async ({
  page,
}) => {
  await page.route("**/*.tile.opentopomap.org/**", (r) => r.abort());
  await page.goto("/");
  await page
    .getByRole("button", { name: "About and keyboard shortcuts", exact: true })
    .click();
  const dialog = page.locator("#dialog");
  await expect(dialog).toHaveClass(/about-dialog/);
  await expect(
    dialog.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  const overview = dialog.locator(".about-overview");
  await expect(overview).toContainText(
    "Live navigation, turn-by-turn guidance, activity recording and emergency assistance are outside",
  );
  await expect(overview).toContainText(
    "there is no downloadable offline map pack",
  );
  await expect(overview.locator("details")).toHaveCount(0);
  const sections = dialog.locator("details.about-section");
  expect(await sections.count()).toBeGreaterThan(8);
  await expect(dialog.locator("details[open]")).toHaveCount(0);
  await dialog.locator("#about-create summary").click();
  await expect(
    dialog.locator("#about-create .about-section-content"),
  ).toBeVisible();
  await expect(dialog.locator("#about-create")).toContainText(
    "Open in Edit copies",
  );
  await dialog.locator("#about-create summary").click();
  await expect(
    dialog.locator("#about-create .about-section-content"),
  ).toBeHidden();
  for (let i = 0; i < (await sections.count()); i++) {
    const section = sections.nth(i);
    await section.locator("summary").focus();
    await page.keyboard.press("Enter");
    await expect(section).toHaveAttribute("open", "");
    await expect(section.locator(".about-section-content")).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(section.locator(".about-section-content")).toBeHidden();
  }
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(dialog).not.toHaveClass(/about-dialog/);
  await expect(
    page.getByRole("switch", { name: "Allow Point Naming", exact: true }),
  ).toBeVisible();
});

test("expanded cards show only the two sharing actions in web and app layouts", async ({
  page,
}) => {
  await page.route("**/*.tile.opentopomap.org/**", (r) => r.abort());
  await page.goto("/");
  for (const web of [true, false]) {
    await page.evaluate(
      (web) => document.body.classList.toggle("web-route-card", web),
      web,
    );
    await page.locator("#expand-card").click();
    await expect(page.locator("#create-card .create-buttons")).toBeHidden();
    await expect(page.locator("#preview-route")).toBeHidden();
    await expect(
      page.locator("#create-card .card-share-actions button:visible"),
    ).toHaveText(["Share Text", "Share PDF"]);
    await page.locator("#expand-card").click();
    await expect(page.locator("#create-card .create-buttons")).toBeVisible();
  }
});
