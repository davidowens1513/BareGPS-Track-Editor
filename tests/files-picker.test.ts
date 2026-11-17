import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => false },
  registerPlugin: () => ({}),
}));
import { pickFiles } from "../src/files";
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
const input = () =>
  document.querySelector<HTMLInputElement>('input[type="file"]')!;
it("releases the picker when focus returns without a cancel event, then permits another import", async () => {
  const first = pickFiles();
  expect(input().isConnected).toBe(true);
  window.dispatchEvent(new Event("focus"));
  await vi.advanceTimersByTimeAsync(1000);
  expect(await first).toEqual([]);
  expect(input()).toBeNull();
  const second = pickFiles();
  input().dispatchEvent(new Event("cancel"));
  expect(await second).toEqual([]);
  expect(input()).toBeNull();
});
it("reads the selected file if focus returns without a change event", async () => {
  const pending = pickFiles();
  Object.defineProperty(input(), "files", {
    value: [{ name: "walk.gpx", size: 3, text: async () => "gpx" }],
  });
  window.dispatchEvent(new Event("focus"));
  await vi.advanceTimersByTimeAsync(1000);
  expect(await pending).toEqual([{ name: "walk.gpx", text: "gpx" }]);
  expect(input()).toBeNull();
});
it("does not mistake a slow file read for cancellation", async () => {
  const pending = pickFiles();
  let complete!: (text: string) => void;
  Object.defineProperty(input(), "files", {
    value: [
      {
        name: "walk.gpx",
        size: 3,
        text: () =>
          new Promise<string>((resolve) => {
            complete = resolve;
          }),
      },
    ],
  });
  window.dispatchEvent(new Event("focus"));
  input().dispatchEvent(new Event("change"));
  await vi.advanceTimersByTimeAsync(2000);
  expect(input()).not.toBeNull();
  complete("gpx");
  expect(await pending).toEqual([{ name: "walk.gpx", text: "gpx" }]);
  expect(input()).toBeNull();
});
it("rejects a file picker opening failure and removes its input", async () => {
  vi.mocked(HTMLInputElement.prototype.click).mockImplementationOnce(() => {
    throw new Error("Picker failed");
  });
  await expect(pickFiles()).rejects.toThrow("Picker failed");
  expect(input()).toBeNull();
});
it("rejects invalid file selections and cleans up", async () => {
  const pending = pickFiles();
  const check = expect(pending).rejects.toThrow("over 15 MB");
  Object.defineProperty(input(), "files", {
    value: [{ name: "big.gpx", size: 16 * 1024 * 1024 }],
  });
  input().dispatchEvent(new Event("change"));
  await check;
  expect(input()).toBeNull();
});
