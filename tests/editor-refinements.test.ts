import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { emptyWorkspace, type Track } from "../src/model";
const state = vi.hoisted(() => ({
  store: new Map<string, unknown>(),
  picks: [] as { name: string; text: string }[],
  saveResult: Promise.resolve(true),
  maps: [] as any[],
  terrainJob: null as
    null | ((track: any, progress: any, signal: AbortSignal) => Promise<any>),
}));
vi.mock("idb-keyval", () => ({
  get: async (key: string) => structuredClone(state.store.get(key)),
  set: async (key: string, value: unknown) => {
    state.store.set(key, structuredClone(value));
  },
}));
vi.mock("../src/files", () => ({
  pickFiles: async () => state.picks,
  saveTrack: () => state.saveResult,
  shareRoutecard: vi.fn(async () => false),
  sharePDF: vi.fn(),
  decode: (s: string) => s,
  isCancelled: (error: any) => error?.name === "AbortError",
  NativeFiles: {},
}));
vi.mock("../src/terrain", () => ({
  enrichTerrain: (track: any, progress: any, signal: AbortSignal) =>
    state.terrainJob!(track, progress, signal),
}));
vi.mock("../src/input-map", () => ({
  InputMap: class {
    inputId = null;
    pointEditing = false;
    enabled = true;
    tool = "move";
    selectedIndex = null;
    map = {
      getContainer: () => document.getElementById("map")!,
      on: vi.fn(),
      getCenter: () => ({ wrap: () => ({ lat: 53, lng: -6 }) }),
      invalidateSize: vi.fn(),
      setView: vi.fn(),
      getZoom: () => 15,
    };
    callbacks: any;
    lastRender: any[] = [];
    constructor(...args: unknown[]) {
      this.callbacks = args[2];
      state.maps.push(this);
    }
    render(...args: unknown[]) {
      this.lastRender = args;
    }
    fit() {
      this.map.invalidateSize();
    }
    home() {}
    resetSelection() {}
    hasTileError() {
      return false;
    }
    retryTiles() {}
    showPosition() {}
  },
}));
const fixture = (): Track => ({
  id: "input-one",
  name: "Original",
  color: "#d32f2f",
  kind: "track",
  source: "test.gpx",
  points: [
    { lat: 53, lon: -6, ele: 100 },
    { lat: 53.001, lon: -6, ele: 110 },
    { lat: 53.002, lon: -6, ele: 120 },
  ],
});
const click = (id: string) =>
  (document.getElementById(id) as HTMLButtonElement).click();
const button = (id: string) => document.getElementById(id) as HTMLButtonElement;
beforeEach(() => {
  vi.resetModules();
  state.store.clear();
  state.maps = [];
  state.picks = [];
  state.terrainJob = null;
  state.saveResult = Promise.resolve(true);
  document.body.innerHTML = '<div id="app"></div>';
  document.body.className = "";
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
afterEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, 350));
  vi.unstubAllGlobals();
});
async function start(
  withInput = true,
  withOutput = false,
  missingTerrain = false,
  secondInput = false,
) {
  const w = emptyWorkspace();
  if (withInput) {
    w.tracks = [fixture()];
    if (secondInput)
      w.tracks.push({
        ...fixture(),
        id: "input-two",
        name: "Second track",
        color: "#16724d",
      });
    if (missingTerrain) w.tracks[0].points[1].ele = undefined;
    w.activeId = "input-one";
    w.selection = { start: 0, end: 2 };
  }
  if (withOutput) w.route = { ...fixture(), id: "output-one" };
  state.store.set("baregps-track-editor-workspace-v1", w);
  await import("../src/main");
  await vi.waitFor(() =>
    expect(document.getElementById("source-count")!.textContent).toBe(
      withInput ? (secondInput ? "2" : "1") : "0",
    ),
  );
}
it("Reset Track confirms, restores only the active input and supports Undo/Redo", async () => {
  await start();
  click("reverse");
  click("input-reset");
  expect(button("confirm-delete").textContent).toBe("Reset Track");
  click("cancel-delete");
  click("input-reset");
  click("confirm-delete");
  await vi.waitFor(() => {
    const saved: any = state.store.get("baregps-track-editor-workspace-v1");
    expect(saved.tracks[0].points[0].lat).toBe(53);
    expect(saved.inputOriginals[0].points[0].lat).toBe(53);
  });
  click("undo");
  await vi.waitFor(() =>
    expect(
      (state.store.get("baregps-track-editor-workspace-v1") as any).tracks[0]
        .points[0].lat,
    ).toBe(53.002),
  );
  click("redo");
  await vi.waitFor(() =>
    expect(
      (state.store.get("baregps-track-editor-workspace-v1") as any).tracks[0]
        .points[0].lat,
    ).toBe(53),
  );
});
it("pins Settings and About actions outside their scrolling content", async () => {
  await start();
  click("settings");
  expect(
    document.getElementById("dialog")!.classList.contains("settings-dialog"),
  ).toBe(true);
  expect(
    document.querySelector(".settings-dialog-body .settings-dialog-actions"),
  ).toBeNull();
  expect(
    document.querySelector(".settings-dialog-actions [data-close]")!
      .textContent,
  ).toBe("Done");
  (
    document.querySelector(
      ".settings-dialog-actions [data-close]",
    ) as HTMLButtonElement
  ).click();
  click("help");
  expect(
    document.querySelector(".about-guide .about-dialog-actions"),
  ).toBeNull();
  expect(
    document.querySelector(".about-dialog-actions [data-close]")!.textContent,
  ).toBe("Done");
  expect(document.getElementById("about-privacy-link")).toBeNull();
  expect(document.querySelectorAll(".about-control svg")).toHaveLength(6);
  const headings = [
    ...document.querySelectorAll(".about-section summary h3"),
  ].map((h) => h.textContent);
  expect(headings).toContain("Heights");
  expect(headings).toContain("Route Cards");
  expect(headings).toContain("Support");
  expect(headings).toContain("Credits");
  expect(
    document.querySelector(
      'a[href="https://mixolydian-flyingfish-56d.notion.site/BareGPS-Track-Editor-Support-4160e3f94c358006859fdefe0d71a662"]',
    ),
  ).not.toBeNull();
  expect(
    document.querySelector(
      'a[href="https://mixolydian-flyingfish-56d.notion.site/BareGPS-Track-Editor-Privacy-Policy-4160e3f94c35801d8ddbc7deb522cf22"]',
    ),
  ).not.toBeNull();
  expect(document.querySelector(".about-notices pre")!.textContent).toContain(
    "MIT License",
  );
  expect(document.querySelector("footer")).toBeNull();
});
it("offers 14 named colours and enables Apply only for a valid changed colour", async () => {
  await start();
  (document.querySelector(".input-track-colour") as HTMLButtonElement).click();
  expect(document.querySelectorAll(".colour-preset")).toHaveLength(14);
  expect(document.querySelector("hex-color-picker")).toBeNull();
  expect(button("apply-colour").disabled).toBe(true);
  const field = document.getElementById("colour-hex") as HTMLInputElement;
  field.value = "broken";
  field.dispatchEvent(new Event("input"));
  expect(button("apply-colour").disabled).toBe(true);
  field.value = "#D32F2F";
  field.dispatchEvent(new Event("input"));
  expect(button("apply-colour").disabled).toBe(true);
  field.value = "#0000FF";
  field.dispatchEvent(new Event("input"));
  expect(button("apply-colour").disabled).toBe(false);
  click("apply-colour");
  expect((document.getElementById("dialog") as HTMLDialogElement).open).toBe(
    false,
  );
  expect(button("apply-colour").disabled).toBe(true);
});
it("refreshes an empty map and disables Fit and Reset Track until inputs exist", async () => {
  await start(false);
  expect(button("fit").disabled).toBe(true);
  expect(button("input-reset").disabled).toBe(true);
  expect(state.maps[0].map.invalidateSize).toHaveBeenCalled();
});
it.each(["success", "cancel", "failure"])(
  "restores expansion controls after GPX save %s",
  async (outcome) => {
    await start(true, true);
    let finish!: (value: boolean) => void, reject!: (error: Error) => void;
    state.saveResult = new Promise((resolve, fail) => {
      finish = resolve;
      reject = fail;
    });
    click("create-save");
    expect(button("expand").disabled).toBe(true);
    expect(button("expand-card").disabled).toBe(true);
    if (outcome === "success") finish(true);
    else if (outcome === "cancel")
      reject(new DOMException("Cancelled", "AbortError"));
    else reject(new Error("Test save failed"));
    await vi.waitFor(() => expect(button("expand").disabled).toBe(false));
    expect(button("expand-card").disabled).toBe(false);
    expect(button("fit").disabled).toBe(false);
    expect(document.getElementById("card-expand-hint")!.textContent).toBe(
      "Expand to Share",
    );
  },
);

it.each(["success", "cancel", "failure"])(
  "restores expansion controls after terrain %s",
  async (outcome) => {
    await start(true, false, true);
    let finish!: (value: any) => void,
      reject!: (error: Error) => void,
      prepared: any;
    state.terrainJob = (track, _progress, signal) => {
      prepared = track;
      return new Promise((resolve, fail) => {
        finish = resolve;
        reject = fail;
        signal.addEventListener("abort", () =>
          fail(new DOMException("Cancelled", "AbortError")),
        );
      });
    };
    click("input-terrain");
    click("confirm-input-terrain");
    expect(button("expand").disabled).toBe(true);
    expect(button("expand-card").disabled).toBe(true);
    if (outcome === "success")
      finish({
        ...prepared,
        points: prepared.points.map((p: any) => ({ ...p, ele: p.ele ?? 115 })),
      });
    else if (outcome === "cancel") click("cancel-input-terrain");
    else reject(new Error("Test terrain failed"));
    await vi.waitFor(() => expect(button("expand").disabled).toBe(false));
    expect(button("expand-card").disabled).toBe(false);
    expect(button("input-reset").disabled).toBe(false);
  },
);

it("includes the palette in Settings and applies changes without closing Settings", async () => {
  await start();
  click("settings");
  expect(
    document.querySelector(".settings-dialog-body .product-colour-settings h3")!
      .textContent,
  ).toBe("Track Colour");
  expect(
    document.querySelectorAll(".settings-dialog-body .colour-preset"),
  ).toHaveLength(14);
  expect(
    document.querySelector(".settings-dialog-body")!.textContent,
  ).not.toContain("Input Track Editing");
  expect(button("apply-colour").disabled).toBe(true);
  (
    document.querySelector('[data-colour="#0000ff"]') as HTMLButtonElement
  ).click();
  expect(button("apply-colour").disabled).toBe(false);
  click("apply-colour");
  expect((document.getElementById("dialog") as HTMLDialogElement).open).toBe(
    true,
  );
  expect(button("apply-colour").disabled).toBe(true);
  expect(document.getElementById("colour-status")!.textContent).toBe(
    "Track colour applied.",
  );
  await vi.waitFor(() =>
    expect(
      (state.store.get("baregps-track-editor-workspace-v1") as any).tracks[0]
        .color,
    ).toBe("#0000ff"),
  );
  const field = document.getElementById("colour-hex") as HTMLInputElement;
  field.value = "#0000FF";
  field.dispatchEvent(new Event("input"));
  expect(button("apply-colour").disabled).toBe(true);
  field.value = "invalid";
  field.dispatchEvent(new Event("input"));
  expect(button("apply-colour").disabled).toBe(true);
});
it("chooses and saves a default colour before opening an input", async () => {
  await start(false);
  click("settings");
  const blue = document.querySelector(
    '[data-colour="#0000ff"]',
  ) as HTMLButtonElement;
  expect(blue.matches(":disabled")).toBe(false);
  blue.click();
  expect(
    (document.getElementById("colour-hex") as HTMLInputElement).value,
  ).toBe("#0000FF");
  expect(button("apply-colour").disabled).toBe(false);
  click("apply-colour");
  await vi.waitFor(() =>
    expect(state.store.get("baregps-track-editor-input-colour-v1")).toBe(
      "#0000ff",
    ),
  );
  expect(document.getElementById("colour-status")!.textContent).toContain(
    "new input tracks",
  );
  (
    document.querySelector(
      ".settings-dialog-actions [data-close]",
    ) as HTMLButtonElement
  ).click();
  state.picks = [
    {
      name: "test.gpx",
      text: '<gpx><trk><trkseg><trkpt lat="53" lon="-6"/><trkpt lat="53.01" lon="-6"/></trkseg></trk></gpx>',
    },
  ];
  click("empty-import");
  await vi.waitFor(() =>
    expect(document.getElementById("source-count")!.textContent).toBe("1"),
  );
  await vi.waitFor(() =>
    expect(
      (state.store.get("baregps-track-editor-workspace-v1") as any).tracks[0]
        .color,
    ).toBe("#0000ff"),
  );
});

it("applies the Settings colour only to the input chosen in its selector", async () => {
  await start(true, false, false, true);
  click("settings");
  const selector = document.getElementById(
    "settings-colour-track",
  ) as HTMLSelectElement;
  selector.value = "input-two";
  selector.dispatchEvent(new Event("change"));
  expect(
    (document.getElementById("colour-hex") as HTMLInputElement).value,
  ).toBe("#16724D");
  expect(button("apply-colour").disabled).toBe(true);
  (
    document.querySelector('[data-colour="#ff69b4"]') as HTMLButtonElement
  ).click();
  click("apply-colour");
  await vi.waitFor(() => {
    const saved: any = state.store.get("baregps-track-editor-workspace-v1");
    expect(saved.tracks[0].color).toBe("#d32f2f");
    expect(saved.tracks[1].color).toBe("#ff69b4");
  });
});

it("restores the default input colour when Settings is reopened after startup", async () => {
  state.store.set("baregps-track-editor-input-colour-v1", "#800080");
  await start(false);
  click("settings");
  expect(
    (document.getElementById("colour-hex") as HTMLInputElement).value,
  ).toBe("#800080");
  expect(
    document
      .querySelector('[data-colour="#800080"]')!
      .getAttribute("aria-pressed"),
  ).toBe("true");
  expect(button("apply-colour").disabled).toBe(true);
});

it("offers another import once and hides it even if its file picker is cancelled", async () => {
  await start(false);
  expect(document.getElementById("open-track-label")!.textContent).toBe(
    "Open Track",
  );
  expect(button("dismiss-another-track").hidden).toBe(true);
  const file = {
    name: "first.gpx",
    text: '<gpx><trk><trkseg><trkpt lat="53" lon="-6"/><trkpt lat="53.01" lon="-6"/></trkseg></trk></gpx>',
  };
  state.picks = [file];
  click("empty-import");
  await vi.waitFor(() =>
    expect(document.getElementById("source-count")!.textContent).toBe("1"),
  );
  expect(document.getElementById("map-empty")!.hidden).toBe(false);
  expect(document.getElementById("open-track-label")!.textContent).toBe(
    "Open another Track?",
  );
  expect(button("dismiss-another-track").hidden).toBe(false);
  state.picks = [];
  click("empty-import");
  expect(document.getElementById("map-empty")!.hidden).toBe(true);
  await vi.waitFor(() => expect(button("empty-import").disabled).toBe(false));
  expect(document.getElementById("map-empty")!.hidden).toBe(true);
  state.picks = [{ ...file, name: "second.gpx" }];
  click("import");
  await vi.waitFor(() =>
    expect(document.getElementById("source-count")!.textContent).toBe("2"),
  );
  expect(document.getElementById("map-empty")!.hidden).toBe(true);
  click("reverse");
  expect(document.getElementById("map-empty")!.hidden).toBe(true);
  expect(button("import").disabled).toBe(false);
});

it("dismisses the second-track prompt with its X without opening the picker", async () => {
  await start();
  expect(document.getElementById("map-empty")!.hidden).toBe(false);
  click("dismiss-another-track");
  expect(document.getElementById("map-empty")!.hidden).toBe(true);
  click("reverse");
  expect(document.getElementById("map-empty")!.hidden).toBe(true);
  expect(document.getElementById("source-count")!.textContent).toBe("1");
});

it("keeps inputs together and synchronizes the map label, current row and point editor", async () => {
  await start(true, false, false, true);
  const map = state.maps[0];
  expect(map.lastRender[0].map((t: Track) => t.id)).toEqual([
    "input-one",
    "input-two",
  ]);
  expect(map.lastRender[3]).toBe(true);
  expect(document.getElementById("current-input-name")!.textContent).toBe(
    "Current: Original",
  );
  map.callbacks.selectTrack("input-two");
  expect(map.inputId).toBe("input-two");
  expect(map.selectedIndex).toBe(null);
  expect(document.getElementById("current-input-name")!.textContent).toBe(
    "Current: Second track",
  );
  expect(
    document
      .querySelector(".track-row.active .track-select")!
      .getAttribute("data-id"),
  ).toBe("input-two");
  expect(
    document
      .getElementById("current-input")!
      .style.getPropertyValue("--current-track-colour"),
  ).toBe("#16724d");
  expect(
    (
      document.querySelector(".track-row.active .active-dot") as HTMLElement
    ).style.getPropertyValue("--current-track-colour"),
  ).toBe("#16724d");
  expect(map.lastRender[3]).toBe(true);
  (
    document.querySelector(
      '.track-select[data-id="input-one"]',
    ) as HTMLButtonElement
  ).click();
  expect(map.inputId).toBe("input-one");
  expect(document.getElementById("current-input-name")!.textContent).toBe(
    "Current: Original",
  );
  click("add-route");
  expect(map.inputId).toBe("input-one");
  expect(document.getElementById("current-input")!.hidden).toBe(false);
});

it("makes a newly imported track current while retaining previous inputs on the map", async () => {
  await start();
  state.picks = [
    {
      name: "new.gpx",
      text: '<gpx><trk><name>New track</name><trkseg><trkpt lat="53" lon="-6.01"/><trkpt lat="53.01" lon="-6.01"/></trkseg></trk></gpx>',
    },
  ];
  click("import");
  await vi.waitFor(() =>
    expect(document.getElementById("source-count")!.textContent).toBe("2"),
  );
  const map = state.maps[0];
  expect(map.lastRender[0]).toHaveLength(2);
  expect(map.lastRender[3]).toBe(true);
  expect(map.inputId).not.toBe("input-one");
  expect(document.getElementById("current-input-name")!.textContent).toContain(
    "New track",
  );
});
