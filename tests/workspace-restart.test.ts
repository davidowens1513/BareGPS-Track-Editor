import { beforeEach, afterEach, expect, it, vi } from "vitest";
const picker = vi.hoisted(() => ({
  files: [] as { name: string; text: string }[],
}));
vi.mock("idb-keyval", () => ({
  get: async () => undefined,
  set: async () => {},
  setMany: async () => {},
}));
vi.mock("../src/files", () => ({
  pickFiles: async () => picker.files,
  saveTrack: async () => true,
  isCancelled: () => false,
  NativeFiles: {},
  decode: () => "",
  shareRoutecard: async () => true,
  sharePDF: async () => {},
  saveData: async () => true,
}));
vi.mock("../src/input-map", () => ({
  InputMap: class {
    inputId = null;
    map = {
      on() {},
      getCenter: () => ({ wrap: () => ({ lat: 53, lng: -6 }) }),
      getContainer: () => document.getElementById("map")!,
      invalidateSize() {},
      getZoom: () => 13,
    };
    resetSelection() {}
    render() {}
    fit() {}
    home() {}
    hasTileError() {
      return false;
    }
    setBaseLayer() {}
  },
}));
const click = (id: string) =>
  (document.getElementById(id) as HTMLButtonElement).click();
const file = {
  name: "test.gpx",
  text: '<gpx><trk><name>Test</name><trkseg><trkpt lat="53" lon="-6"><ele>100</ele></trkpt><trkpt lat="53.01" lon="-6"><ele>120</ele></trkpt></trkseg></trk></gpx>',
};
beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
    },
  );
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  HTMLElement.prototype.scrollIntoView = function () {};
  document.body.innerHTML = '<div id="app"></div>';
  picker.files = [file];
  await import("../src/main");
  await vi.advanceTimersByTimeAsync(0);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("can start again after deleting the final input and clearing a previewed route", async () => {
  click("empty-import");
  await vi.advanceTimersByTimeAsync(0);
  click("add-route");
  click("confirm-route-plan");
  await vi.advanceTimersByTimeAsync(0);
  click("preview-route");
  (document.querySelector(".delete-track") as HTMLButtonElement).click();
  click("confirm-delete");
  click("create-clear");
  click("confirm-clear-edit");
  expect(document.getElementById("exit-preview")!.hidden).toBe(true);
  expect((document.getElementById("dialog") as HTMLDialogElement).open).toBe(
    false,
  );
  expect(
    (document.getElementById("empty-import") as HTMLButtonElement).disabled,
  ).toBe(false);
  expect(document.getElementById("map-empty")!.hidden).toBe(false);
  click("empty-import");
  await vi.advanceTimersByTimeAsync(0);
  expect(document.getElementById("source-count")!.textContent).toBe("1");
  expect(document.getElementById("current-input-name")!.textContent).toContain(
    "Test",
  );
});
it("can import after removing the last input without a route", async () => {
  click("empty-import");
  await vi.advanceTimersByTimeAsync(0);
  (document.querySelector(".delete-track") as HTMLButtonElement).click();
  click("confirm-delete");
  expect(document.getElementById("map-empty")!.hidden).toBe(false);
  click("empty-import");
  await vi.advanceTimersByTimeAsync(0);
  expect(document.getElementById("source-count")!.textContent).toBe("1");
});
