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
  await expect(page.locator("#create-share")).toBeDisabled();
  const map = page.locator("#create-map");
  await map.click({ position: { x: 110, y: 130 } });
  await map.click({ position: { x: 210, y: 210 } });
  const name = page.getByRole("textbox", {
    name: "Name for point 1 (optional)",
    exact: true,
  });
  await name.fill("Old stone bridge");
  await name.press("Enter");
  await page.locator("#undo").click();
  await expect(name).toHaveValue("");
  await page.locator("#redo").click();
  await expect(name).toHaveValue("Old stone bridge");
  await expect(page.locator("#save-state")).toHaveAttribute(
    "aria-label",
    "Saved on device",
  );
  await page.reload();
  await expect(name).toHaveValue("Old stone bridge");
  await page
    .getByRole("button", { name: "Share Routecard", exact: true })
    .click();
  await expect(page.locator("#routecard-text")).toContainText(
    "Old stone bridge",
  );
  await expect(page.locator("#routecard-text")).toContainText("Leg:");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.locator("#coordinate-system")).toBeVisible();
});
