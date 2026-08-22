import type { AppData } from "./types";
const DB = "coa-mapas-analiticos";
const STORE = "state";
const KEY = "app";
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 4);
    req.onupgradeneeded = (event) => {
      const store = req.result.objectStoreNames.contains(STORE)
        ? req.transaction!.objectStore(STORE)
        : req.result.createObjectStore(STORE);
      if ((event as IDBVersionChangeEvent).oldVersion < 4) store.clear();
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function loadData(): Promise<AppData | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(KEY);
    req.onsuccess = () =>
      resolve(
        req.result
          ? {
              ...req.result,
              printItems: req.result.printItems ?? [],
              presets: req.result.presets ?? [],
            }
          : null,
      );
    req.onerror = () => reject(req.error);
  });
}
export async function saveData(data: AppData) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(data, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
