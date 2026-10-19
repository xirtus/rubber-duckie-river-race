const KEY = "rubberduck-river-v1";
export function loadProgress() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY));
    return {
      races: [],
      book: {},
      wildlife: [],
      trails: [],
      ribbons: [],
      stamps: 0,
      ghosts: {},
      ...p,
    };
  } catch {
    return {
      races: [],
      book: {},
      wildlife: [],
      trails: [],
      ribbons: [],
      stamps: 0,
      ghosts: {},
    };
  }
}
export function saveProgress(p) {
  localStorage.setItem(KEY, JSON.stringify(p));
}
let dbPromise;
function db() {
  return (dbPromise ??= new Promise((resolve, reject) => {
    const r = indexedDB.open("river-album", 1);
    r.onupgradeneeded = () =>
      r.result.createObjectStore("photos", { keyPath: "id" });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  }));
}
export async function savePhoto(photo) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction("photos", "readwrite");
    t.objectStore("photos").put(photo);
    t.oncomplete = resolve;
    t.onerror = () => reject(t.error);
  });
}
export async function allPhotos() {
  const d = await db();
  return new Promise((resolve, reject) => {
    const r = d.transaction("photos").objectStore("photos").getAll();
    r.onsuccess = () => resolve(r.result.sort((a, b) => b.created - a.created));
    r.onerror = () => reject(r.error);
  });
}
