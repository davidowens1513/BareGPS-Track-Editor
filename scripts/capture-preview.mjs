import { chromium } from "@playwright/test";
const browser = await chromium.launch({
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const page = await browser.newPage({
  viewport: { width: 1280, height: 1200 },
  deviceScaleFactor: 1,
});
await page.goto("http://127.0.0.1:5173");
await page.getByRole("button", { name: /Explore with sample/ }).click();
await page
  .getByRole("button", { name: "Start joined route with section" })
  .click();
await page
  .getByRole("button", { name: /Spinc ridge/ })
  .first()
  .click();
await page.getByRole("button", { name: "Append section to route" }).click();
await page.getByRole("button", { name: "Dismiss message" }).click();
await page.waitForTimeout(2000);
await page.screenshot({ path: "/tmp/baregps-desktop.png", fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });
await page.getByRole("button", { name: "Fit tracks to map" }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: "/tmp/baregps-mobile.png" });
await page.locator("#section-controls").scrollIntoViewIfNeeded();
await page.screenshot({ path: "/tmp/baregps-mobile-edit.png" });
await browser.close();
