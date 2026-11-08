import { test, expect } from "@playwright/test";
test("Create and input editing have identical toolbars and selected Create points can be deleted", async ({
  page,
}) => {
  await page.route("**/*.tile.opentopomap.org/**", (r) => r.abort());
  await page.goto("/");
  const toolbar = page.locator("#create-tools .drawing-modes");
  await expect(toolbar.locator("button:visible")).toHaveText([
    "Add points",
    "Insert point",
    "Delete point",
    "Close loop",
  ]);
  await page.locator("#create-map").click({ position: { x: 80, y: 180 } });
  await page.locator("#create-map").click({ position: { x: 180, y: 220 } });
  await page.locator("#create-map .track-handle").first().click();
  await expect(page.locator("#create-delete")).toBeEnabled();
  await page.locator("#create-delete").click();
  await expect(page.locator("#waypoint-count")).toHaveText("1");
  await expect(page.locator("#create-delete")).toBeDisabled();
  await page.locator("#undo").click();
  await expect(page.locator("#waypoint-count")).toHaveText("2");
  const createStyle = await toolbar.evaluate((el) => {
    const b = el.querySelector("button")!;
    const s = getComputedStyle(b);
    return {
      height: el.parentElement!.getBoundingClientRect().height,
      font: s.fontSize,
      padding: s.padding,
      border: s.borderRadius,
    };
  });
  await expect(page.locator("#create-tools button:visible").first()).toHaveCSS(
    "border-top-style",
    "solid",
  );
  await expect(page.locator("#create-tools button:visible").first()).toHaveCSS(
    "border-top-width",
    "1px",
  );
  await page.locator("#edit-tab").click();
  await expect(page.locator("#input-selection-strip")).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  expect(
    (await page.locator("#input-selection-strip").boundingBox())!.height,
  ).toBeLessThanOrEqual(16);
  await expect(
    page.getByRole("heading", { name: "Edit Input Track", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator("#input-plan-controls .button").first()).toHaveCSS(
    "min-height",
    "43px",
  );
  const chooser = page.waitForEvent("filechooser");
  await page.locator("#import").click();
  await (
    await chooser
  ).setFiles({
    name: "test.gpx",
    mimeType: "text/xml",
    buffer: Buffer.from(
      '<gpx><trk><name>Test</name><trkseg><trkpt lat="53" lon="-6"/><trkpt lat="53.001" lon="-6"/><trkpt lat="53.002" lon="-6"/></trkseg></trk></gpx>',
    ),
  });
  await expect(page.locator("#notice")).toBeHidden();
  await expect(page.locator("#input-point-tools")).toBeVisible();
  await expect(page.locator("#input-add")).toBeEnabled();
  await expect(page.locator("#input-selection-strip")).toHaveAttribute(
    "aria-disabled",
    "false",
  );
  await page.locator("#input-add").click();
  await expect(page.locator("#input-points-mode")).toHaveCount(0);
  const input = page.locator("#input-point-tools .drawing-modes");
  await expect(input.locator("button:visible")).toHaveText([
    "Add points",
    "Insert point",
    "Delete point",
    "Close loop",
  ]);
  const inputStyle = await input.evaluate((el) => {
    const b = el.querySelector("#input-add")!;
    const s = getComputedStyle(b);
    return {
      height: el.parentElement!.getBoundingClientRect().height,
      font: s.fontSize,
      padding: s.padding,
      border: s.borderRadius,
    };
  });
  expect(inputStyle).toEqual(createStyle);
  await page.locator("#map").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `/tmp/baregps-matching-tools-${test.info().project.name}.png`,
  });
});
