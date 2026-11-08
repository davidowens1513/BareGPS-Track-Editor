import { expect, type Page } from "@playwright/test";
export async function handleSpacing(page: Page, interval: number) {
  await page.locator("#settings").click();
  await page.locator("#settings-handle-interval").fill(String(interval));
  await page.locator("#settings-apply-handles").click();
  await expect(page.locator("#settings-handle-status")).toContainText(
    "saved on this device",
  );
  await page
    .locator("#dialog")
    .getByRole("button", { name: "Done", exact: true })
    .click();
}
export async function selectInputPoint(page: Page, point: number) {
  await handleSpacing(page, 1);
  await page.getByRole("button", { name: "Expand map", exact: true }).click();
  await page.locator("#fit").click();
  let last = "",
    stableSince = 0;
  await expect
    .poll(async () => {
      const positions = await page
        .locator(".input-handle")
        .evaluateAll((nodes) =>
          JSON.stringify(
            nodes.map((n) => {
              const b = n.getBoundingClientRect();
              return [n.getAttribute("title"), b.x, b.y];
            }),
          ),
        );
      if (positions !== last) {
        last = positions;
        stableSince = Date.now();
      }
      return Date.now() - stableSince > 150;
    })
    .toBe(true);
  await page.locator(`.input-handle[title^="Input point ${point} "]`).click();
  await page.getByRole("button", { name: "Collapse map", exact: true }).click();
  await expect(page.locator("#input-selected-point")).toHaveText(
    `Point ${point} selected`,
  );
}
export async function trimBefore(page: Page, point: number) {
  await selectInputPoint(page, point);
  await page.locator("#trim-before").click();
}
export async function trimAfter(page: Page, point: number) {
  await selectInputPoint(page, point);
  await page.locator("#trim-after").click();
}

export async function savedWorkspace(page: Page): Promise<any> {
  await expect(page.locator("#save-state")).toContainText("Saved on device");
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open("keyval-store");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const request = db
            .transaction("keyval")
            .objectStore("keyval")
            .get("baregps-workspace-v1");
          request.onsuccess = () => {
            resolve(request.result);
            db.close();
          };
          request.onerror = () => {
            reject(request.error);
            db.close();
          };
        };
      }),
  );
}

// Non-terrain suites explicitly use the offline confirmation path to retain
// deterministic point counts and avoid a dependency on the external service.
export async function confirmPlanWithoutTerrain(page: Page) {
  await page.route("**/terrain/**", (route) =>
    route.fulfill({ status: 503, body: "Offline test" }),
  );
  await page.locator("#confirm-route-plan").click();
  await expect
    .poll(async () => {
      if (await page.locator("#confirm-without-terrain").isVisible())
        await page.locator("#confirm-without-terrain").click();
      return !(await page.locator("#dialog").isVisible());
    })
    .toBe(true);
}
