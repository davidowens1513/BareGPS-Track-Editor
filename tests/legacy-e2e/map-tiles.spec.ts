import { test, expect } from "@playwright/test";
const pixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);
test("map warning clears when failed tiles leave the view, while healthy tiles do not hide a real failure", async ({
  page,
}) => {
  let failedUrl: string | undefined;
  await page.route("**/*.tile.opentopomap.org/**", async (route) => {
    failedUrl ??= route.request().url();
    if (route.request().url() === failedUrl) await route.abort();
    else await route.fulfill({ contentType: "image/png", body: pixel });
  });
  await page.goto("/");
  await expect(
    page.locator("#create-map .leaflet-tile-loaded").first(),
  ).toBeVisible();
  await expect(page.locator("#create-map-error")).toBeVisible();
  await page
    .locator("#create-map")
    .getByRole("button", { name: "Zoom out", exact: true })
    .click();
  await expect(page.locator("#create-map-error")).toBeHidden();
  await page.locator("#create-name").fill("Renamed");
  await page.locator("#create-name").press("Enter");
  await expect(page.locator("#create-map-error")).toBeHidden();
});
test("Retry and restored connectivity clear recovered map warnings in Create and Edit", async ({
  page,
}) => {
  let failing = true;
  await page.route("**/*.tile.opentopomap.org/**", (route) =>
    failing
      ? route.abort()
      : route.fulfill({ contentType: "image/png", body: pixel }),
  );
  await page.goto("/");
  await expect(page.locator("#create-map-error")).toBeVisible();
  failing = false;
  await page.locator("#retry-create-map").click();
  await expect(page.locator("#create-map-error")).toBeHidden();
  await expect(
    page.locator("#create-map .leaflet-tile-loaded").first(),
  ).toBeVisible();
  failing = true;
  await page.locator("#edit-tab").click();
  await page
    .locator("#map")
    .getByRole("button", { name: "Zoom out", exact: true })
    .click();
  await expect(page.locator("#map-error")).toBeVisible();
  failing = false;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.locator("#map-error")).toBeHidden();
  await expect(page.locator("#map .leaflet-tile-loaded").first()).toBeVisible();
  await page.locator("#create-tab").click();
  await expect(page.locator("#create-map-error")).toBeHidden();
});

test("map warning dismissal is reachable beside position and stays dismissed during editing", async ({
  page,
}) => {
  await page.route("**/*.tile.opentopomap.org/**", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator("#create-map-error")).toBeVisible();
  const warning = (await page.locator("#create-map-error").boundingBox())!,
    position = (await page.locator("#create-locate").boundingBox())!;
  expect(warning.x + warning.width).toBeLessThanOrEqual(position.x);
  await page.locator("#dismiss-create-map").click();
  await expect(page.locator("#create-map-error")).toBeHidden();
  await page.locator("#create-map").click({ position: { x: 75, y: 180 } });
  await expect(page.locator("#create-map-error")).toBeHidden();
  await page.locator("#edit-tab").click();
  await expect(page.locator("#map-error")).toBeVisible();
  await page.locator("#dismiss-map").click();
  await expect(page.locator("#map-error")).toBeHidden();
  await page.locator("#create-tab").click();
  await page.locator("#edit-tab").click();
  await expect(page.locator("#map-error")).toBeHidden();
});
