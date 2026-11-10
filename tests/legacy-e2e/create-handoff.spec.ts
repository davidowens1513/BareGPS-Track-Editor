import { test, expect } from "@playwright/test";
import { savedWorkspace } from "./input-helpers";

for (const terrain of [false, true]) {
  test(`Open in Edit preserves an independent Create draft ${terrain ? "with" : "without"} terrain`, async ({
    page,
  }) => {
    let requests = 0;
    await page.route("**/*.tile.opentopomap.org/**", (r) => r.abort());
    await page.route("**/terrain/**", (r) => {
      requests++;
      const locations = new URL(r.request().url()).searchParams
        .get("locations")!
        .split("|");
      return r.fulfill({
        json: {
          status: "OK",
          results: locations.map(() => ({ elevation: 123 })),
        },
      });
    });
    await page.goto("/");
    await expect(page.locator("#open-in-edit")).toBeDisabled();
    await page.locator("#create-map").click({ position: { x: 90, y: 120 } });
    await page.locator("#create-map").click({ position: { x: 190, y: 190 } });
    await page.locator("#create-name").fill("Hill walk");
    if (terrain) {
      await page.locator("#create-terrain").click();
      await page.locator("#confirm-create-terrain").click();
      await expect(page.locator("#elevation-note")).toContainText(
        "Terrain up to date",
      );
    }
    const before = await savedWorkspace(page);
    const requestCount = requests;
    await page.locator("#open-in-edit").click();
    await expect(
      page.getByRole("tab", { name: "Edit Existing", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(page.locator(".track-row.active strong")).toHaveText(
      "Hill walk",
    );
    await expect(page.locator(".input-handle").first()).toBeVisible();
    await expect(page.locator("#notice")).toContainText(
      "Copied to Edit. Your Create draft is unchanged.",
    );
    const after = await savedWorkspace(page);
    expect(after.created).toEqual(before.created);
    expect(after.createdTerrain).toEqual(before.createdTerrain);
    expect(after.tracks[0].id).not.toBe(before.created.id);
    expect(after.tracks[0].points).toEqual(
      (before.createdTerrain ?? before.created).points,
    );
    expect(after.routePlan ?? []).toEqual([]);
    expect(after.route).toBeNull();
    expect(requests).toBe(requestCount);
    await page.locator("#reverse").click();
    await page.getByRole("tab", { name: "Create New", exact: true }).click();
    await expect(page.locator("#create-name")).toHaveValue("Hill walk");
    const edited = await savedWorkspace(page);
    expect(edited.created).toEqual(before.created);
    expect(edited.createdTerrain).toEqual(before.createdTerrain);
  });
}
