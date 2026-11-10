import {
  importProject,
  projectJson,
  newProject,
  type StoryProject,
  type LibraryCharacter,
} from "./project.ts";
const NAME = "behix-story-projects";
export function openProjects(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(NAME, 2);
    let blocked = false;
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of ["projects", "characters", "exports"])
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "id" });
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
    };
    request.onsuccess = () => {
      if (blocked) {
        request.result.close();
        return;
      }
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      blocked = true;
      reject(new Error("ذخیره‌سازی در تب دیگری باز است؛ تب دیگر را ببندید."));
    };
  });
}
async function transact<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openProjects();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(store, mode);
      let request: IDBRequest<T>;
      try {
        request = run(tx.objectStore(store));
      } catch (error) {
        tx.abort();
        reject(error);
        return;
      }
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = () => reject(tx.error ?? request.error ?? new Error("ذخیره‌سازی لغو شد."));
      tx.onerror = () => reject(tx.error ?? request.error);
    });
  } finally {
    db.close();
  }
}
export const listProjects = () =>
  transact<StoryProject[]>("projects", "readonly", (s) => s.getAll());
export async function saveProject(p: StoryProject) {
  const validated = importProject(projectJson(p));
  await transact("projects", "readwrite", (s) => s.put(validated));
}
export const deleteProject = (id: string) => transact("projects", "readwrite", (s) => s.delete(id));
export const listCharacters = () =>
  transact<LibraryCharacter[]>("characters", "readonly", (s) => s.getAll());
export const saveCharacter = (c: LibraryCharacter) =>
  transact("characters", "readwrite", (s) => s.put(c));
export const deleteCharacter = (id: string) =>
  transact("characters", "readwrite", (s) => s.delete(id));
export async function migrateLegacy(sample: string): Promise<StoryProject[]> {
  // One transaction prevents duplicate migrations if two tabs open together.
  const db = await openProjects();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["projects", "meta"], "readwrite");
      const marker = tx.objectStore("meta").get("legacy-v1");
      marker.onsuccess = () => {
        if (marker.result) return;
        let text = sample;
        try {
          text = localStorage.getItem("behix-story-v1") ?? sample;
        } catch {
          /* keep the supplied sample */
        }
        const existing = tx.objectStore("projects").count();
        existing.onsuccess = () => {
          // Dashboard may already have created a document before the first editor visit.
          // Import real legacy text, but do not create an extra empty project.
          if (text.trim() || existing.result === 0) {
            const p = newProject(text.slice(0, 20000), "داستان نخست");
            tx.objectStore("projects").put(p);
          }
          tx.objectStore("meta").put(true, "legacy-v1");
        };
      };
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
  return listProjects();
}

export type ExportArtifact = { id: string; name: string; blob: Blob };
export const saveArtifact = (a: ExportArtifact) =>
  transact("exports", "readwrite", (s) => s.put(a));
export const readArtifact = (id: string) =>
  transact<ExportArtifact | undefined>("exports", "readonly", (s) => s.get(id));
export const removeArtifact = (id: string) => transact("exports", "readwrite", (s) => s.delete(id));
export const listArtifacts = () =>
  transact<ExportArtifact[]>("exports", "readonly", (s) => s.getAll());
