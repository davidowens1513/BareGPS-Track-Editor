import { it, expect } from "vitest";
import {
  WorkspaceStorage,
  WORKSPACE_KEY,
  PREVIOUS_KEY,
  RECOVERY_KEY,
} from "../src/workspace-storage";
import { emptyWorkspace } from "../src/model";
function backend() {
  const data = new Map<string, unknown>();
  let fail = false;
  return {
    data,
    set fail(value: boolean) {
      fail = value;
    },
    read: async (key: string) => structuredClone(data.get(key)),
    write: async (entries: [string, unknown][]) => {
      if (fail) throw new Error("quota");
      for (const [key, value] of entries) data.set(key, structuredClone(value));
    },
  };
}
it("preserves unreadable data across new work, saving and relaunch", async () => {
  const store = backend(),
    raw = { version: 999, precious: "old tracks" };
  store.data.set(WORKSPACE_KEY, raw);
  const storage = new WorkspaceStorage(store);
  expect(await storage.load()).toBeUndefined();
  await storage.save(emptyWorkspace());
  expect(((await storage.recovery()) as any).raw).toEqual(raw);
  const restarted = new WorkspaceStorage(store);
  expect(await restarted.load()).toEqual(emptyWorkspace());
  expect(((await restarted.recovery()) as any).raw).toEqual(raw);
});
it("blocks all writes if quarantine fails, leaving the original untouched", async () => {
  const store = backend(),
    raw = { broken: true };
  store.data.set(WORKSPACE_KEY, raw);
  store.fail = true;
  const storage = new WorkspaceStorage(store);
  await expect(storage.load()).rejects.toThrow("quota");
  store.fail = false;
  await expect(storage.save(emptyWorkspace())).rejects.toThrow("recovery");
  expect(store.data.get(WORKSPACE_KEY)).toEqual(raw);
});
it("retains the last successful snapshot after write failure and ignores duplicate flushes", async () => {
  const store = backend(),
    storage = new WorkspaceStorage(store);
  await storage.load();
  const first = emptyWorkspace(),
    second = { ...first, routePlan: [] };
  await storage.save(first);
  store.fail = true;
  await expect(storage.save(second)).rejects.toThrow("quota");
  expect(store.data.get(WORKSPACE_KEY)).toEqual(first);
  store.fail = false;
  await storage.save(second);
  await storage.save(second);
  expect(await storage.previous()).toEqual(first);
  expect(store.data.get(PREVIOUS_KEY)).toEqual(first);
  expect(store.data.has(RECOVERY_KEY)).toBe(false);
});
it("rejects malformed new snapshots and never replaces the good saved copy", async () => {
  const store = backend(),
    storage = new WorkspaceStorage(store);
  await storage.load();
  await storage.save(emptyWorkspace());
  await expect(storage.save({ version: 999 } as any)).rejects.toThrow("safely");
  expect(store.data.get(WORKSPACE_KEY)).toEqual(emptyWorkspace());
});
it("forgets saved and previous snapshots, then allows a new remembered session", async () => {
  const store = backend(),
    storage = new WorkspaceStorage(store);
  await storage.load();
  await storage.save(emptyWorkspace());
  await storage.save({ ...emptyWorkspace(), routePlan: [] });
  expect(await storage.previous()).toBeDefined();
  await storage.forget();
  expect(await storage.previous()).toBeUndefined();
  expect(await new WorkspaceStorage(store).load()).toBeUndefined();
  await storage.save(emptyWorkspace());
  expect(store.data.get(WORKSPACE_KEY)).toEqual(emptyWorkspace());
});
