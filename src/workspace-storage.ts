import { get, setMany } from "idb-keyval";
import { validateWorkspace, type Workspace } from "./model";

export const WORKSPACE_KEY = "baregps-track-editor-workspace-v1";
export const PREVIOUS_KEY = WORKSPACE_KEY + "-previous";
export const RECOVERY_KEY = WORKSPACE_KEY + "-recovery";
export interface StorageBackend {
  read(key: string): Promise<unknown>;
  write(entries: [string, unknown][]): Promise<void>;
}
// Related writes commit in one IndexedDB transaction, including quarantine.
export class WorkspaceStorage {
  private ready = false;
  private good: Workspace | undefined;
  constructor(
    private backend: StorageBackend = { read: get, write: setMany },
  ) {}
  async load(): Promise<Workspace | undefined> {
    const raw = await this.backend.read(WORKSPACE_KEY);
    if (raw !== undefined && raw !== null && !validateWorkspace(raw)) {
      // Never permit a later save unless the unreadable record is preserved.
      await this.backend.write([
        [
          RECOVERY_KEY + "-" + crypto.randomUUID(),
          { date: new Date().toISOString(), raw },
        ],
        [RECOVERY_KEY, { date: new Date().toISOString(), raw }],
      ]);
      this.ready = true;
      return undefined;
    }
    this.good = raw ? structuredClone(raw as Workspace) : undefined;
    this.ready = true;
    return this.good && structuredClone(this.good);
  }
  async save(workspace: Workspace): Promise<void> {
    if (!this.ready)
      throw new Error(
        "Workspace recovery is unavailable; the saved copy has been kept.",
      );
    if (!validateWorkspace(workspace))
      throw new Error(
        "This workspace cannot be saved safely. Export your tracks.",
      );
    if (this.good && JSON.stringify(workspace) === JSON.stringify(this.good))
      return;
    const next = structuredClone(workspace);
    const entries: [string, unknown][] = [[WORKSPACE_KEY, next]];
    if (this.good) entries.push([PREVIOUS_KEY, this.good]);
    await this.backend.write(entries);
    this.good = next;
  }
  async forget(): Promise<void> {
    if (!this.ready)
      throw new Error(
        "Workspace recovery is unavailable; the saved copy has been kept.",
      );
    await this.backend.write([
      [WORKSPACE_KEY, undefined],
      [PREVIOUS_KEY, undefined],
    ]);
    this.good = undefined;
  }
  async previous(): Promise<Workspace | undefined> {
    const raw = await this.backend.read(PREVIOUS_KEY);
    return validateWorkspace(raw) ? raw : undefined;
  }
  async recovery(): Promise<unknown> {
    return this.backend.read(RECOVERY_KEY);
  }
}
