import { test, expect } from "@playwright/test";

test("separate screens recover a shared-screen drawing, terrain, imported track and joined route", async ({
  page,
}) => {
  await page.route("**/*.tile.opentopomap.org/**", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator("#create-name")).toBeVisible();
  await page.evaluate(async () => {
    const points = Array.from({ length: 5 }, (_, i) => ({
      lat: 53 + i * 0.001,
      lon: -6,
      ele: 100 + i * 10,
    }));
    const drawing = {
      id: "drawing",
      name: "Recovered drawing",
      source: "Created in BareGPS",
      kind: "route",
      color: "#16724d",
      points,
    };
    const imported = {
      ...drawing,
      id: "imported",
      name: "Imported track",
      source: "imported.gpx",
      kind: "track",
      color: "#d32f2f",
      points: points.slice(0, 3),
    };
    const joined = {
      ...drawing,
      id: "joined",
      name: "Joined route",
      source: "Joined in BareGPS",
      points: points.slice(0, 4),
    };
    const workspace = {
      version: 1,
      tool: "edit",
      created: drawing,
      createdTerrain: { ...drawing, id: "terrain" },
      tracks: [imported],
      route: joined,
      activeId: "drawing",
      selection: { start: 1, end: 3 },
    };
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("keyval-store");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("keyval", "readwrite");
        tx.objectStore("keyval").put(workspace, "baregps-workspace-v1");
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  });
  await page.reload();
  await expect(page.locator("#create-name")).toHaveValue("Recovered drawing");
  await expect(page.locator("#waypoint-count")).toHaveText("5");
  await expect(page.locator("#create-terrain")).toBeVisible();
  await expect(page.locator("#create-terrain")).toBeDisabled();
  await expect(page.locator("#ascent")).toContainText("40");
  await page.getByRole("tab", { name: "Edit", exact: true }).click();
  await expect(page.locator("#edit-map-view")).toBeVisible();
  await expect(page.locator("#create-map-view")).toBeHidden();
  await expect(page.locator("#source-count")).toHaveText("1");
  await expect(page.locator("#waypoint-count")).toHaveText("4");
  await expect(page.locator("#create-name")).toHaveValue("Joined route");
  await page
    .getByRole("button", { name: /Imported track/ })
    .first()
    .click();
  await expect(page.locator("#point-count")).toHaveText("3 points");
  await page.getByRole("tab", { name: "Create", exact: true }).click();
  await expect(page.locator("#create-name")).toHaveValue("Recovered drawing");
  await expect(page.locator("#waypoint-count")).toHaveText("5");
});
