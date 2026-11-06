import { Capacitor, registerPlugin } from "@capacitor/core";
import { MAX_BYTES, exportGPX, type Track } from "./model";
export interface ImportFile {
  name: string;
  text: string;
}
export interface NativeFile {
  name: string;
  data: string;
}
export const NativeFiles = registerPlugin<{
  pick(): Promise<{ files: NativeFile[] }>;
  save(options: { name: string; data: string }): Promise<{ saved: boolean }>;
  pending(): Promise<{ files: NativeFile[]; errors?: string[] }>;
  addListener(
    event: "filesOpened",
    listener: () => void,
  ): Promise<{ remove(): Promise<void> }>;
}>("BareFiles");
export async function pickFiles(): Promise<ImportFile[]> {
  if (Capacitor.isNativePlatform()) {
    const { files } = await NativeFiles.pick();
    return files.map((f) => ({ name: f.name, text: decode(f.data) }));
  }
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".gpx,application/gpx+xml,application/xml,text/xml";
    input.multiple = true;
    input.addEventListener("cancel", () => resolve([]));
    input.addEventListener("change", async () => {
      try {
        const files = Array.from(input.files ?? []);
        if (
          files.reduce((total, file) => total + file.size, 0) >
          30 * 1024 * 1024
        )
          throw new Error("Choose up to 30 MB of files at a time.");
        if (files.length > 20)
          throw new Error("Choose up to 20 GPX files at a time.");
        resolve(
          await Promise.all(
            files.map(async (file) => {
              if (file.size > MAX_BYTES)
                throw new Error(
                  `${file.name} is over 15 MB. Choose a smaller GPX file.`,
                );
              return { name: file.name, text: await file.text() };
            }),
          ),
        );
      } catch (e) {
        reject(e);
      }
    });
    input.click();
  });
}
export function decode(data: string): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(
    Uint8Array.from(atob(data), (c) => c.charCodeAt(0)),
  );
}
export async function saveTrack(track: Track) {
  const name =
    (track.name
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
      .trim()
      .slice(0, 90) || "BareGPS track") + ".gpx";
  const xml = exportGPX(track);
  if (Capacitor.isNativePlatform()) {
    const bytes = new TextEncoder().encode(xml);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192)
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return (await NativeFiles.save({ name, data: btoa(binary) })).saved;
  }
  const blob = new Blob([xml], { type: "application/gpx+xml" });
  if (typeof (window as any).showSaveFilePicker === "function") {
    const handle = await (
      window as unknown as {
        showSaveFilePicker(o: unknown): Promise<{
          createWritable(): Promise<{
            write(b: Blob): Promise<void>;
            close(): Promise<void>;
          }>;
        }>;
      }
    ).showSaveFilePicker({
      suggestedName: name,
      types: [
        {
          description: "GPX track",
          accept: { "application/gpx+xml": [".gpx"] },
        },
      ],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
  } else {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  }
  return true;
}
export function isCancelled(error: unknown) {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (!!error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "CANCELLED")
  );
}
