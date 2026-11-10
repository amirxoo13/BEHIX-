/**
 * فایل‌های خروجی فیلم در OPFS (حافظهٔ خصوصی مرورگر روی دیسک): MP4 تکه‌تکه روی دیسک نوشته می‌شود،
 * نه یک‌جا در RAM. فایل برگشتی یک File است که از دیسک خوانده می‌شود.
 * Export files in the Origin Private File System so long films never sit whole in memory.
 */
import type { StreamTargetChunk } from "mediabunny";

export const EXPORT_DIR = "behix-exports";
/** Newest earlier films kept when a new export starts (the dialog may still offer the previous one). */
const KEEP = 1;
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

type SyncAccessHandle = {
  write(data: AllowSharedBufferSource, options: { at: number }): number;
  flush(): void;
  close(): void;
};
type WithSync = FileSystemFileHandle & { createSyncAccessHandle?: () => Promise<SyncAccessHandle> };
type Listable = FileSystemDirectoryHandle & { entries(): AsyncIterableIterator<[string, FileSystemHandle]> };

export type ExportSink = {
  name: string;
  writable: WritableStream<StreamTargetChunk>;
  /** Flush and close; the file is complete afterwards. */
  finish(): Promise<void>;
  /** Close and delete a partial file (cancel/error). */
  discard(): Promise<void>;
};

export async function exportDir(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const storage = (globalThis.navigator as Navigator | undefined)?.storage;
    if (!storage || typeof storage.getDirectory !== "function") return null;
    const root = await storage.getDirectory();
    return await root.getDirectoryHandle(EXPORT_DIR, { create: true });
  } catch {
    return null;
  }
}

export const newExportName = () =>
  `film-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}.mp4`;

/** Delete old export files: everything older than 6 h and all but the newest `KEEP`. Never throws. */
export async function cleanExports(dir: FileSystemDirectoryHandle, keep = KEEP): Promise<void> {
  try {
    const files: { name: string; at: number }[] = [];
    for await (const [name, handle] of (dir as Listable).entries()) {
      if (handle.kind !== "file") continue;
      let at = 0;
      try {
        at = (await (handle as FileSystemFileHandle).getFile()).lastModified;
      } catch {
        /* locked or broken: treat as oldest */
      }
      files.push({ name, at });
    }
    files.sort((a, b) => b.at - a.at);
    const now = Date.now();
    for (const [i, f] of files.entries()) {
      if (i >= keep || now - f.at > MAX_AGE_MS) await dir.removeEntry(f.name).catch(() => undefined);
    }
  } catch {
    /* listing unsupported */
  }
}

/**
 * Open a positional writer for mediabunny's StreamTarget. Workers use the synchronous access handle
 * (fast, no swap file); the main thread uses createWritable. Returns null when OPFS writing is unavailable.
 */
export async function openSink(dir: FileSystemDirectoryHandle, name = newExportName()): Promise<ExportSink | null> {
  let handle: WithSync;
  try {
    handle = (await dir.getFileHandle(name, { create: true })) as WithSync;
  } catch {
    return null;
  }
  const remove = () => dir.removeEntry(name).catch(() => undefined);
  try {
    if (typeof document === "undefined" && typeof handle.createSyncAccessHandle === "function") {
      const sync = await handle.createSyncAccessHandle();
      let open = true;
      const close = () => {
        if (!open) return;
        open = false;
        try {
          sync.flush();
        } finally {
          sync.close();
        }
      };
      return {
        name,
        writable: new WritableStream<StreamTargetChunk>({
          write(chunk) {
            sync.write(chunk.data, { at: chunk.position });
          },
        }),
        finish: async () => close(),
        discard: async () => {
          try {
            close();
          } catch {
            /* already broken */
          }
          await remove();
        },
      };
    }
    if (typeof handle.createWritable === "function") {
      const file = await handle.createWritable();
      return {
        name,
        writable: new WritableStream<StreamTargetChunk>({
          write(chunk) {
            return file.write({ type: "write", position: chunk.position, data: chunk.data });
          },
        }),
        finish: () => file.close(),
        discard: async () => {
          await file.abort().catch(() => undefined);
          await remove();
        },
      };
    }
  } catch {
    /* fall through */
  }
  await remove();
  return null;
}

/** The finished film as a disk-backed File. */
export async function readExport(name: string): Promise<File> {
  const dir = await exportDir();
  if (!dir) throw new Error("فایل فیلم در حافظهٔ مرورگر پیدا نشد.");
  const file = await (await dir.getFileHandle(name)).getFile();
  // Re-wrap with the right MIME type; Blob composition references the disk data, it does not copy it.
  return new File([file], name, { type: "video/mp4" });
}
