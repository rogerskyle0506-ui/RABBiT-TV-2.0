// src/lib/storage.ts
import type { MediaItem } from "./tmdb-scraper";
import { getHardwareLimits, purgeOldTmdbCaches } from "./settings";

const MY_LIST_KEY = "rabtv_my_list";
const FAVORITES_KEY = "rabtv_favorites";
const WATCH_HISTORY_KEY = "rabtv_watch_history";

function normalizeId(rawId: string | number): string {
  return String(rawId || "")
    .replace(/^(movie|tv)-/i, "")
    .trim();
}

function safeReadArray<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeWriteJson(key: string, data: unknown): boolean {
  if (typeof window === "undefined") return false;
  const serialized = JSON.stringify(data);
  try {
    localStorage.setItem(key, serialized);
    return true;
  } catch {
    // Storage quota hit on a 1-2GB stick: purge temporary TMDB caches and retry once
    try {
      purgeOldTmdbCaches();
      localStorage.setItem(key, serialized);
      return true;
    } catch (retryErr) {
      console.error(`Failed to write ${key} after cache purge:`, retryErr);
      return false;
    }
  }
}

// --- My List Helpers ---
export function getMyList(): MediaItem[] {
  return safeReadArray<MediaItem>(MY_LIST_KEY);
}

export function toggleMyList(item: MediaItem): boolean {
  const list = getMyList();
  const targetClean = normalizeId(item.id);
  const exists = list.some(
    (i) => i.id === item.id || normalizeId(i.id) === targetClean
  );

  const updated = exists
    ? list.filter(
        (i) => i.id !== item.id && normalizeId(i.id) !== targetClean
      )
    : [item, ...list];

  safeWriteJson(MY_LIST_KEY, updated);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("rabtv_catalog_updated"));
  }

  return !exists; // Returns true if added, false if removed
}

export function isInMyList(id: string): boolean {
  const targetClean = normalizeId(id);
  return getMyList().some(
    (item) => item.id === id || normalizeId(item.id) === targetClean
  );
}

// --- Favorites Helpers ---
export function getFavorites(): MediaItem[] {
  return safeReadArray<MediaItem>(FAVORITES_KEY);
}

export function toggleFavorite(item: MediaItem): boolean {
  const list = getFavorites();
  const targetClean = normalizeId(item.id);
  const exists = list.some(
    (i) => i.id === item.id || normalizeId(i.id) === targetClean
  );

  const updated = exists
    ? list.filter(
        (i) => i.id !== item.id && normalizeId(i.id) !== targetClean
      )
    : [item, ...list];

  safeWriteJson(FAVORITES_KEY, updated);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("rabtv_catalog_updated"));
  }

  return !exists;
}

export function isInFavorites(id: string): boolean {
  const targetClean = normalizeId(id);
  return getFavorites().some(
    (item) => item.id === id || normalizeId(item.id) === targetClean
  );
}

// --- Watch History Helpers ---
export function saveToWatchHistory(item: MediaItem): void {
  try {
    const history = getWatchHistory();
    const targetClean = normalizeId(item.id);
    const filtered = history.filter(
      (i) => i.id !== item.id && normalizeId(i.id) !== targetClean
    );
    const maxItems = getHardwareLimits().maxCachedHistoryItems || 35;
    const updated = [item, ...filtered].slice(0, maxItems);

    safeWriteJson(WATCH_HISTORY_KEY, updated);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("rabtv_watch_history_updated"));
    }
  } catch (e) {
    console.error("Could not save watch history", e);
  }
}

export function getWatchHistory(): MediaItem[] {
  return safeReadArray<MediaItem>(WATCH_HISTORY_KEY);
}

export function removeFromWatchHistory(id: string): void {
  const targetClean = normalizeId(id);
  const updated = getWatchHistory().filter(
    (i) => i.id !== id && normalizeId(i.id) !== targetClean
  );
  safeWriteJson(WATCH_HISTORY_KEY, updated);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("rabtv_watch_history_updated"));
  }
}

export function clearWatchHistory(): void {
  safeWriteJson(WATCH_HISTORY_KEY, []);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("rabtv_watch_history_updated"));
  }
}
