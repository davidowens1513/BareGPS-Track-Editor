import { beforeEach, afterEach, expect, it, vi } from "vitest";
const picker = vi.hoisted(() => ({
  files: [] as { name: string; text: string }[],
}));
const data = vi.hoisted(() => new Map<string, unknown>());
vi.mock("idb-keyval", () => ({
  get: async (key: string) => structuredClone(data.get(key)),
  set: async (key: string, value: unknown) => {
    data.set(key, structuredClone(value));
  },
  setMany: async (entries: [string, unknown][]) => {
    for (const [key, value] of entries) data.set(key, structuredClone(value));
  },
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
  data.clear();
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
const preferenceKey = "baregps-track-editor-remember-workspace-v1";
const workspaceKey = "baregps-track-editor-workspace-v1";
async function restart() {
  vi.clearAllTimers();
  vi.resetModules();
  document.body.innerHTML = '<div id="app"></div>';
  await import("../src/main");
  await vi.advanceTimersByTimeAsync(0);
}
it("defaults to remembering the workspace", async () => {
  click("settings");
  expect(
    document.getElementById("remember-workspace")!.getAttribute("aria-checked"),
  ).toBe("true");
  click("empty-import");
  await vi.advanceTimersByTimeAsync(500);
  expect((data.get(workspaceKey) as any).tracks).toHaveLength(1);
});
it("turning remembering off clears saved work, preserves this session and starts fresh next time", async () => {
  click("empty-import");
  await vi.advanceTimersByTimeAsync(500);
  click("settings");
  click("remember-workspace");
  await vi.advanceTimersByTimeAsync(0);
  expect(data.get(preferenceKey)).toBe(false);
  expect(document.getElementById("source-count")!.textContent).toBe("1");
  expect(document.getElementById("save-state")!.textContent).toContain(
    "Session only",
  );
  click("reverse");
  await vi.advanceTimersByTimeAsync(1000);
  expect((data.get(workspaceKey) as any)?.tracks ?? []).toHaveLength(0);
  await restart();
  expect(document.getElementById("source-count")!.textContent).toBe("0");
  click("settings");
  expect(
    document.getElementById("remember-workspace")!.getAttribute("aria-checked"),
  ).toBe("false");
});
it("turning remembering off cancels a pending autosave", async () => {
  click("empty-import");
  await vi.advanceTimersByTimeAsync(0);
  click("settings");
  click("remember-workspace");
  await vi.advanceTimersByTimeAsync(1000);
  expect((data.get(workspaceKey) as any)?.tracks ?? []).toHaveLength(0);
  expect(document.getElementById("source-count")!.textContent).toBe("1");
});
it("turning remembering back on saves the current session for reopening", async () => {
  click("settings");
  click("remember-workspace");
  await vi.advanceTimersByTimeAsync(0);
  click("empty-import");
  await vi.advanceTimersByTimeAsync(0);
  click("remember-workspace");
  await vi.advanceTimersByTimeAsync(500);
  expect(data.get(preferenceKey)).toBe(true);
  expect((data.get(workspaceKey) as any).tracks).toHaveLength(1);
  await restart();
  expect(document.getElementById("source-count")!.textContent).toBe("1");
});
it("does not restore an old saved workspace while remembering is disabled", async () => {
  click("empty-import");
  await vi.advanceTimersByTimeAsync(500);
  expect((data.get(workspaceKey) as any).tracks).toHaveLength(1);
  data.set(preferenceKey, false);
  await restart();
  expect(document.getElementById("source-count")!.textContent).toBe("0");
  expect(document.getElementById("save-state")!.textContent).toContain(
    "Session only",
  );
});
