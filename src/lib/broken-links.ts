const BROKEN_LINKS_STORAGE_KEY = "rabtv_broken_links";

export interface BrokenLinkEntry {
  id: string; // clean ID or media ID (e.g., "movie-123" or "123")
  cleanId: string;
  clickCount: number; // 1 = 14 days, 2 = 30 days, 3+ = permanent
  hiddenUntil: number | null; // Timestamp (ms) or null if permanent
}

export function getBrokenLinksMap(): Record<string, BrokenLinkEntry> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(BROKEN_LINKS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.error("Error reading broken links map", err);
    return {};
  }
}

export function saveBrokenLinksMap(map: Record<string, BrokenLinkEntry>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(BROKEN_LINKS_STORAGE_KEY, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent("rabtv_broken_links_updated"));
  } catch (err) {
    console.error("Error saving broken links map", err);
  }
}

export function reportBrokenLink(id: string): { clickCount: number; message: string } {
  const map = getBrokenLinksMap();
  const cleanId = String(id).replace(/^(movie|tv)-/, "");
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
    message = "Reported as broken 3 times. Title permanently removed from catalogs.";
  }

  map[cleanId] = {
    id: String(id),
    cleanId,
    clickCount: nextCount,
    hiddenUntil,
  };

  saveBrokenLinksMap(map);
  return { clickCount: nextCount, message };
}

export function isTitleBroken(id: string | number): boolean {
  if (!id) return false;
  const cleanId = String(id).replace(/^(movie|tv)-/, "");
  const map = getBrokenLinksMap();
  const entry = map[cleanId];

  if (!entry) return false;

  // Permanent removal
  if (entry.clickCount >= 3 || entry.hiddenUntil === null) {
    return true;
  }

  // Temporary removal check
  if (Date.now() < entry.hiddenUntil) {
    return true;
  }

  return false;
}
