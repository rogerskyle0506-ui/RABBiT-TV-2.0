// src/lib/broken-links.ts
import { purgeOldTmdbCaches } from "./settings";

const BROKEN_LINKS_STORAGE_KEY = "rabtv_broken_links";

export interface BrokenLinkEntry {
  id: string; // original ID or prefixed ID (e.g., "movie-123" or "123")
  cleanId: string;
  clickCount: number; // 1 = 14 days, 2 = 30 days, 3+ = permanent
  hiddenUntil: number | null; // Timestamp (ms) or null if permanent
  title?: string;
  mediaType?: "movie" | "tv";
  reason?: string;
  reportedAt?: number;
}

// Fast in-memory cache (avoids parsing localStorage on every MediaCard render!)
let brokenLinksCache: Record<string, BrokenLinkEntry> | null = null;

function invalidateBrokenCache() {
  brokenLinksCache = null;
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (!e.key || e.key === BROKEN_LINKS_STORAGE_KEY) {
      invalidateBrokenCache();
    }
  });
}

function normalizeId(id: string | number): string {
  return String(id ?? "")
    .replace(/^(movie|tv)-/i, "")
    .trim();
}

function isEntryExpired(entry: BrokenLinkEntry, now: number): boolean {
  if (entry.clickCount >= 3 || entry.hiddenUntil === null) return false;
  return now >= entry.hiddenUntil;
}

export function getBrokenLinksMap(): Record<string, BrokenLinkEntry> {
  if (typeof window === "undefined") return {};
  if (brokenLinksCache) return brokenLinksCache;

  try {
    const raw = localStorage.getItem(BROKEN_LINKS_STORAGE_KEY);
    if (!raw) {
      brokenLinksCache = {};
      return brokenLinksCache;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      brokenLinksCache = {};
      return brokenLinksCache;
    }

    // Auto-prune expired temporary bans on load
    const now = Date.now();
    const pruned: Record<string, BrokenLinkEntry> = {};
    let hadExpired = false;

    for (const [key, entry] of Object.entries(
      parsed as Record<string, BrokenLinkEntry>
    )) {
      if (!entry || typeof entry !== "object") continue;
      if (isEntryExpired(entry, now)) {
        hadExpired = true;
        continue;
      }
      pruned[key] = entry;
    }

    brokenLinksCache = pruned;
    if (hadExpired) {
      saveBrokenLinksMap(pruned);
    }
    return brokenLinksCache;
  } catch (err) {
    console.error("Error reading broken links map", err);
    brokenLinksCache = {};
    return brokenLinksCache;
  }
}

export function saveBrokenLinksMap(map: Record<string, BrokenLinkEntry>): void {
  if (typeof window === "undefined") return;
  brokenLinksCache = { ...map };
  const serialized = JSON.stringify(brokenLinksCache);

  try {
    localStorage.setItem(BROKEN_LINKS_STORAGE_KEY, serialized);
  } catch {
    try {
      purgeOldTmdbCaches();
      localStorage.setItem(BROKEN_LINKS_STORAGE_KEY, serialized);
    } catch (err) {
      console.error("Error saving broken links map", err);
    }
  }

  window.dispatchEvent(new CustomEvent("rabtv_broken_links_updated"));
}

export function reportBrokenLink(
  id: string,
  meta?: { title?: string; mediaType?: "movie" | "tv"; reason?: string }
): { clickCount: number; message: string } {
  const map = { ...getBrokenLinksMap() };
  const cleanId = normalizeId(id);
  const now = Date.now();

  const existing = map[cleanId] || {
    id: String(id),
    cleanId,
    clickCount: 0,
    hiddenUntil: null,
  };

  const nextCount = existing.clickCount + 1;
  let hiddenUntil: number | null = null;
  let message = "";

  if (nextCount === 1) {
    hiddenUntil = now + 14 * 24 * 60 * 60 * 1000; // 14 days
    message = "Reported! Title removed from catalogs for 14 days.";
  } else if (nextCount === 2) {
    hiddenUntil = now + 30 * 24 * 60 * 60 * 1000; // 30 days
    message = "Reported again! Title removed from catalogs for 30 days.";
  } else {
    hiddenUntil = null; // Permanent
    message =
      "Reported as broken 3 times. Title permanently removed from catalogs.";
  }

  map[cleanId] = {
    id: String(id),
    cleanId,
    clickCount: nextCount,
    hiddenUntil,
    title: meta?.title?.replace(/[<>]/g, "").trim().slice(0, 100) || existing.title,
    mediaType: meta?.mediaType || existing.mediaType,
    reason: meta?.reason?.replace(/[<>]/g, "").trim().slice(0, 140) || existing.reason,
    reportedAt: now,
  };

  saveBrokenLinksMap(map);
  return { clickCount: nextCount, message };
}

export function isTitleBroken(id: string | number): boolean {
  if (!id) return false;
  const cleanId = normalizeId(id);
  const map = getBrokenLinksMap();
  const entry = map[cleanId];
  if (!entry) return false;

  if (entry.clickCount >= 3 || entry.hiddenUntil === null) {
    return true;
  }
  return Date.now() < entry.hiddenUntil;
}

/**
 * Returns all currently quarantined broken titles sorted newest first.
 */
export function getBrokenLinksList(): BrokenLinkEntry[] {
  const map = getBrokenLinksMap();
  return Object.values(map).sort(
    (a, b) => (b.reportedAt || 0) - (a.reportedAt || 0)
  );
}

/**
 * Fast active quarantine counter (works cleanly for AdminPanel badges).
 */
export function getBrokenLinksCount(): number {
  return Object.keys(getBrokenLinksMap()).length;
}

/**
 * Restores a single quarantined title back to all catalogs.
 */
export function restoreBrokenLink(id: string | number): boolean {
  const cleanId = normalizeId(id);
  const map = { ...getBrokenLinksMap() };
  if (!map[cleanId]) return false;
  delete map[cleanId];
  saveBrokenLinksMap(map);
  return true;
}

/**
 * Restores every quarantined title on this device.
 */
export function clearAllBrokenLinks(): void {
  saveBrokenLinksMap({});
}
