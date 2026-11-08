import { test, expect } from "@playwright/test";
test("Create point names persist, undo and appear in the message routecard", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      value: undefined,
      configurable: true,
    });
  });
  await page.route("**/*.tile.opentopomap.org/**", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator("#create-share")).toBeHidden();
  const map = page.locator("#create-map");
  await map.click({ position: { x: 110, y: 130 } });
  await map.click({ position: { x: 210, y: 210 } });
  const name = page.getByRole("textbox", {
    name: "Name for point 1 (optional)",
    exact: true,
  });
  await name.fill("Old bridge");
  await name.press("Enter");
  await page.locator("#undo").click();
  await expect(name).toHaveValue("");
  await page.locator("#redo").click();
  await expect(name).toHaveValue("Old bridge");
  await expect(page.locator("#save-state")).toHaveAttribute(
    "aria-label",
    "Saved on device",
  );
  await page.reload();
  await expect(name).toHaveValue("Old bridge");
  await page
    .getByRole("button", { name: "Expand Route Card", exact: true })
    .click();
  await page.getByRole("button", { name: "Share Text", exact: true }).click();
  await expect(page.locator("#routecard-text")).toContainText("Old bridge");
  await expect(page.locator("#routecard-text")).toContainText("Leg:");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.locator("#coordinate-system")).toBeVisible();
});

test("centred main card supports deletion; expanded card shares PDF and Settings changes colour", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "canShare", {
      value: () => false,
      configurable: true,
    }),
  );
  await page.route("**/*.tile.opentopomap.org/**", (route) => route.abort());
  await page.goto("/");
  await page.locator("#create-map").click({ position: { x: 95, y: 120 } });
  await page.locator("#create-map").click({ position: { x: 175, y: 190 } });
  await expect(page.locator(".waypoint-table thead th:visible")).toHaveCount(5);
  await page
    .getByRole("button", { name: "Remove point 1", exact: true })
    .click();
  await expect(page.locator("#waypoint-rows tr")).toHaveCount(1);
  await page.locator("#undo").click();
  await expect(page.locator("#waypoint-rows tr")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Expand Route Card", exact: true })
    .click();
  await expect(page.locator(".waypoint-table thead th:visible")).toHaveCount(8);
  await expect(
    page.getByRole("button", { name: "Remove point 1", exact: true }),
  ).toBeHidden();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Share PDF", exact: true }).click();
  const pdf = await download;
  expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);
  const fs = await import("node:fs/promises");
  expect(
    (await fs.readFile((await pdf.path())!)).subarray(0, 5).toString(),
  ).toBe("%PDF-");
  await page
    .getByRole("button", { name: "Collapse Route Card", exact: true })
    .click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Created Route Colour", exact: true }),
  ).toBeVisible();
  await page.locator("#colour-hex").fill("#a02030");
  await page.getByRole("button", { name: "Apply colour", exact: true }).click();
  await expect(page.locator("#colour-status")).toContainText("applied");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.locator("#colour-hex")).toHaveValue("#A02030");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page
    .getByRole("button", { name: "About and keyboard shortcuts", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "About", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Grid references", exact: true }),
  ).toBeVisible();
});
