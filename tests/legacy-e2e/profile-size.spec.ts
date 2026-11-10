import { test, expect } from "@playwright/test";

test("elevation graph retains its height and status leaves no reserved blank space", async ({
  page,
}) => {
  await page.route("**/*.tile.opentopomap.org/**", (route) => route.abort());
  await page.route("**/terrain/**", async (route) => {
    const locations = new URL(route.request().url()).searchParams
      .get("locations")!
      .split("|");
    await route.fulfill({
      json: {
        status: "OK",
        results: locations.map((_, i) => ({ elevation: 100 + i * 10 })),
      },
    });
  });
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const profile = page.locator(".profile-card");
    await expect(page.locator("#profile")).toBeVisible();
    const height = (await page.locator("#profile").boundingBox())!.height;
    expect((await page.locator("#profile").boundingBox())!.height).toBeCloseTo(
      (width <= 640 ? 61 : 78) * 0.67 + 24,
      1,
    );
    await page.locator("#create-map").click({ position: { x: 80, y: 120 } });
    await page.locator("#create-map").click({ position: { x: 210, y: 210 } });
    await expect(page.locator("#elevation-note")).toBeVisible();
    expect((await page.locator("#profile").boundingBox())!.height).toBe(height);
    const cardBounds = (await profile.boundingBox())!;
    const noteBounds = (await page.locator("#elevation-note").boundingBox())!;
    expect(
      cardBounds.y + cardBounds.height - noteBounds.y - noteBounds.height,
    ).toBeLessThan(14);
    await page.locator("#create-terrain").click();
    await page.locator("#confirm-create-terrain").click();
    await expect(page.locator("#profile svg")).toBeVisible();
    expect((await page.locator("#profile").boundingBox())!.height).toBe(height);
    await page.getByRole("tab", { name: "Edit Existing", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: /^Input Tracks/ }),
    ).toBeVisible();
    expect((await page.locator("#profile").boundingBox())!.height).toBe(height);
    // Start the next viewport with no saved draft, so the initial state is truly empty.
    await page.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const request = indexedDB.open("keyval-store");
          request.onsuccess = () => {
            const db = request.result,
              tx = db.transaction("keyval", "readwrite");
            tx.objectStore("keyval").delete("baregps-workspace-v1");
            tx.oncomplete = () => {
              db.close();
              resolve();
            };
            tx.onerror = () => reject(tx.error);
          };
          request.onerror = () => reject(request.error);
        }),
    );
  }
});
