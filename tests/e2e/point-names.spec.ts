import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
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
});
async function confirmTerrain(page: import("@playwright/test").Page) {
  if (
    (await page.locator("#expand-card").getAttribute("aria-expanded")) ===
    "true"
  )
    await page.locator("#expand-card").click();
  await page.locator("#create-terrain").click();
  await page.locator("#confirm-create-terrain").click();
  await expect(page.locator("#dialog")).not.toBeVisible();
  await page.locator("#expand-card").click();
}
async function setPointNaming(
  page: import("@playwright/test").Page,
  enabled: boolean,
) {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const toggle = page.getByRole("switch", {
    name: "Allow Point Naming",
    exact: true,
  });
  if ((await toggle.getAttribute("aria-checked")) !== String(enabled))
    await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", String(enabled));
  await page.getByRole("button", { name: "Done", exact: true }).click();
}
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
  await setPointNaming(page, true);
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
  await confirmTerrain(page);
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
  await confirmTerrain(page);
  await expect(page.locator(".waypoint-table thead th:visible")).toHaveCount(7);
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

for (const outcome of ["success", "failure", "cancel"] as const) {
  test(`Route Card remains expandable after terrain ${outcome}`, async ({
    page,
  }) => {
    await page.route("**/*.tile.opentopomap.org/**", (route) => route.abort());
    let releaseRequest: (() => void) | undefined;
    const heldRequest = new Promise<void>((resolve) => {
      releaseRequest = resolve;
    });
    await page.route("**/terrain/**", async (route) => {
      if (outcome === "cancel") {
        await heldRequest;
        await route.abort().catch(() => {});
      } else if (outcome === "failure") {
        await route.fulfill({ status: 503, body: "Unavailable" });
      } else {
        const locations = new URL(route.request().url()).searchParams
          .get("locations")!
          .split("|");
        await route.fulfill({
          json: {
            status: "OK",
            results: locations.map((_, i) => ({ elevation: 100 + i * 10 })),
          },
        });
      }
    });
    await page.goto("/");
    await page.locator("#create-map").click({ position: { x: 95, y: 120 } });
    await page.locator("#create-map").click({ position: { x: 125, y: 150 } });
    await page.locator("#create-terrain").click();
    await expect(page.locator("#confirm-create-terrain")).toBeVisible();
    await page.locator("#confirm-create-terrain").click();
    if (outcome === "cancel") {
      await expect(page.locator("#expand-card")).toBeEnabled();
      await page.locator("#cancel-create-terrain").click();
      releaseRequest!();
    }
    await expect(page.locator("#dialog")).not.toBeVisible();
    if (outcome === "success") {
      await expect(page.locator("#create-terrain")).toBeDisabled();
      await expect(page.locator("#ascent")).not.toHaveText("0");
    }
    await expect(page.locator("#expand-card")).toBeEnabled();
    await page
      .getByRole("button", { name: "Expand Route Card", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Collapse Route Card", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Expand Route Card", exact: true })
      .click();
    await expect(page.locator("#expand-card")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expect(page.locator("#dialog")).not.toBeVisible();
    await page
      .getByRole("button", { name: "Collapse Route Card", exact: true })
      .click();
    await expect(page.locator("#expand-card")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
}

test("Create card expansion never prompts or fetches terrain", async ({
  page,
}) => {
  let requests = 0;
  page.on("request", (req) => {
    if (req.url().includes("/terrain/")) requests++;
  });
  await page.route("**/*.tile.opentopomap.org/**", (r) => r.abort());
  await page.goto("/");
  await page.locator("#create-map").click({ position: { x: 95, y: 120 } });
  await page.locator("#create-map").click({ position: { x: 125, y: 150 } });
  await page.locator("#expand-card").click();
  await expect(page.locator("#dialog")).not.toBeVisible();
  expect(requests).toBe(0);
  await expect(page.locator("#create-share")).toBeEnabled();
  await page.locator("#expand-card").click();
  await page.locator("#create-terrain").click();
  await expect(page.locator("#confirm-create-terrain")).toBeVisible();
  expect(requests).toBe(0);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
});

test("point naming defaults off, swaps Distance, persists and preserves existing names", async ({
  page,
}) => {
  await page.route("**/*.tile.opentopomap.org/**", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator("th.point-name-cell")).toBeHidden();
  await expect(page.locator("th.distance-cell")).toBeVisible();
  await page.locator("#create-map").click({ position: { x: 95, y: 120 } });
  await setPointNaming(page, true);
  await expect(page.locator("th.point-name-cell")).toBeVisible();
  await expect(page.locator("th.distance-cell")).toBeHidden();
  const name = page.getByRole("textbox", {
    name: "Name for point 1 (optional)",
    exact: true,
  });
  await name.fill("Gate");
  await expect(page.locator("#save-state")).toHaveAttribute(
    "aria-label",
    "Saved on device",
  );
  await page
    .getByRole("button", { name: "Expand Route Card", exact: true })
    .click();
  await expect(page.locator(".waypoint-table thead th:visible")).toHaveCount(8);
  await setPointNaming(page, false);
  await expect(name).toBeHidden();
  await expect(page.locator(".waypoint-table thead th:visible")).toHaveCount(7);
  const centred = await page.locator(".waypoint-table").evaluate((table) => {
    const t = table.getBoundingClientRect(),
      area = table.parentElement!.getBoundingClientRect();
    return Math.abs(t.x + t.width / 2 - (area.x + area.width / 2)) < 1;
  });
  expect(centred).toBe(true);
  await page
    .getByRole("button", { name: "Collapse Route Card", exact: true })
    .click();
  await expect(page.locator("th.distance-cell")).toBeVisible();
  await page.reload();
  await expect(name).toBeHidden();
  await setPointNaming(page, true);
  await expect(name).toHaveValue("Gate");
  await page.reload();
  await expect(name).toHaveValue("Gate");
});

test("long coordinate values fit on one line in both Route Card views", async ({
  page,
}) => {
  await page.route("**/*.tile.opentopomap.org/**", (route) => route.abort());
  await page.goto("/");
  await page.locator("#create-map").click({ position: { x: 95, y: 120 } });
  for (const system of [
    "latlon",
    "irish",
    "british",
    "itm",
    "mgrs",
    "utm",
    "usng",
  ]) {
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.locator("#coordinate-system").selectOption(system);
    await page.getByRole("button", { name: "Done", exact: true }).click();
    for (const expanded of [false, true]) {
      if (expanded)
        await page
          .getByRole("button", { name: "Expand Route Card", exact: true })
          .click();
      await expect
        .poll(() =>
          page
            .locator(".coordinate-value")
            .first()
            .evaluate((value) => {
              const cell = value.parentElement!;
              const style = getComputedStyle(cell);
              const available =
                cell.clientWidth -
                parseFloat(style.paddingLeft) -
                parseFloat(style.paddingRight);
              return value.getBoundingClientRect().width <= available + 0.5;
            }),
        )
        .toBe(true);
      const value = page.locator(".coordinate-value").first();
      await expect(value).toHaveCSS("white-space", "nowrap");
      expect(await value.textContent()).toBe(
        await value.locator("..").getAttribute("title"),
      );
      if (expanded)
        await page
          .getByRole("button", { name: "Collapse Route Card", exact: true })
          .click();
    }
  }
});
