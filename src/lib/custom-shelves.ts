// src/lib/custom-shelves.ts
import { purgeOldTmdbCaches } from "@/lib/settings";

export const CUSTOM_SHELVES_STORAGE_KEY = "rabtv_custom_shelves_v1";
export const CUSTOM_SHELVES_EVENT = "rabtv_custom_shelves_updated";

export const MAX_CUSTOM_SHELVES = 12;
export const MAX_ITEMS_PER_SHELF = 80;
export const MAX_SHELF_NAME_LENGTH = 36;

export const SHELF_ICON_PRESETS = [
  "🎬",
  "🎃",
  "😂",
  "🚀",
  "❤️",
  "🔥",
  "🍿",
  "👨‍👩‍👧",
  "🌙",
  "🏆",
] as const;

export const SHELF_TEMPLATE_SUGGESTIONS: { name: string; icon: string }[] = [
  { name: "Comfort Shows", icon: "🌙" },
  { name: "Weekend Sci-Fi", icon: "🚀" },
  { name: "Halloween Marathon", icon: "🎃" },
  { name: "Family Movie Night", icon: "👨‍👩‍👧" },
];

export interface ShelfMediaItem {
  id: string;
  mediaId: string;
  title: string;
  description?: string;
  image: string;
  href: string;
  genre?: string;
  year?: string;
  rating?: string;
  mediaType: "movie" | "tv";
  addedAt: number;
}

export interface CustomShelf {
  id: string;
  name: string;
  icon: string;
  createdAt: number;
  updatedAt: number;
  items: ShelfMediaItem[];
}

function sanitizeText(raw: string, maxLen: number): string {
  return String(raw || "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

function sanitizeImageUrl(raw: string): string {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/")) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return trimmed;
    }
  } catch {
    // ignore invalid url
  }
  return "";
}

export function normalizeShelfItemId(
  rawId: string,
  mediaType?: "movie" | "tv"
): string {
  const str = String(rawId || "").trim();
  if (!str) return "";
  const lower = str.toLowerCase();
  if (lower.startsWith("movie-") || lower.startsWith("tv-")) {
    return lower;
  }
  const clean = str.replace(/^(movie|tv)-/i, "");
  return `${mediaType === "tv" ? "tv" : "movie"}-${clean}`;
}

function extractCleanMediaId(rawId: string): string {
  return String(rawId || "")
    .trim()
    .replace(/^(movie|tv)-/i, "");
}

function dispatchShelvesUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CUSTOM_SHELVES_EVENT));
  window.dispatchEvent(new Event("rabtv_catalog_updated"));
}

function persistShelves(shelves: CustomShelf[]): boolean {
  if (typeof window === "undefined") return false;
  const serialized = JSON.stringify(shelves);
  try {
    localStorage.setItem(CUSTOM_SHELVES_STORAGE_KEY, serialized);
    dispatchShelvesUpdated();
    return true;
  } catch {
    try {
      purgeOldTmdbCaches();
      localStorage.setItem(CUSTOM_SHELVES_STORAGE_KEY, serialized);
      dispatchShelvesUpdated();
      return true;
    } catch {
      return false;
    }
  }
}

export function getCustomShelves(): CustomShelf[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOM_SHELVES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const valid: CustomShelf[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") continue;
      const id = sanitizeText(String(entry.id || ""), 48);
      const name = sanitizeText(String(entry.name || ""), MAX_SHELF_NAME_LENGTH);
      if (!id || !name) continue;

      const items: ShelfMediaItem[] = Array.isArray(entry.items)
        ? entry.items
            .filter((it: any) => it && typeof it === "object" && it.title)
            .slice(0, MAX_ITEMS_PER_SHELF)
            .map((it: any) => {
              const mediaType: "movie" | "tv" =
                it.mediaType === "tv" ||
                String(it.id || "").toLowerCase().startsWith("tv-")
                  ? "tv"
                  : "movie";
              const cleanMediaId = extractCleanMediaId(
                String(it.mediaId || it.id || "")
              );
              return {
                id: normalizeShelfItemId(String(it.id || cleanMediaId), mediaType),
                mediaId: cleanMediaId,
                title: sanitizeText(String(it.title), 140),
                description: sanitizeText(String(it.description || ""), 360),
                image: sanitizeImageUrl(String(it.image || "")),
                href: `/details?id=${encodeURIComponent(cleanMediaId)}&type=${mediaType}`,
                genre: sanitizeText(String(it.genre || ""), 60) || undefined,
                year: sanitizeText(String(it.year || ""), 10) || undefined,
                rating: sanitizeText(String(it.rating || ""), 10) || undefined,
                mediaType,
                addedAt: Number(it.addedAt) || Date.now(),
              };
            })
        : [];

      valid.push({
        id,
        name,
        icon: sanitizeText(String(entry.icon || "🎬"), 8) || "🎬",
        createdAt: Number(entry.createdAt) || Date.now(),
        updatedAt: Number(entry.updatedAt) || Date.now(),
        items,
      });

      if (valid.length >= MAX_CUSTOM_SHELVES) break;
    }

    return valid;
  } catch {
    return [];
  }
}

export function createCustomShelf(
  name: string,
  icon = "🎬"
): { ok: boolean; shelf?: CustomShelf; error?: string } {
  const cleanName = sanitizeText(name, MAX_SHELF_NAME_LENGTH);
  if (cleanName.length < 2) {
    return { ok: false, error: "Shelf name needs at least 2 characters." };
  }

  const shelves = getCustomShelves();
  if (shelves.length >= MAX_CUSTOM_SHELVES) {
    return {
      ok: false,
      error: `Limit reached (${MAX_CUSTOM_SHELVES} custom shelves max).`,
    };
  }

  const dup = shelves.find(
    (s) => s.name.toLowerCase() === cleanName.toLowerCase()
  );
  if (dup) {
    return { ok: false, error: `A shelf named "${dup.name}" already exists.` };
  }

  const now = Date.now();
  const safeIcon = sanitizeText(icon, 8) || "🎬";
  const newShelf: CustomShelf = {
    id: `shelf-${now}-${Math.random().toString(36).slice(2, 7)}`,
    name: cleanName,
    icon: safeIcon,
    createdAt: now,
    updatedAt: now,
    items: [],
  };

  const saved = persistShelves([newShelf, ...shelves]);
  if (!saved) {
    return { ok: false, error: "Device storage is full. Try clearing caches." };
  }
  return { ok: true, shelf: newShelf };
}

export function renameCustomShelf(
  shelfId: string,
  newName: string,
  newIcon?: string
): { ok: boolean; error?: string } {
  const cleanName = sanitizeText(newName, MAX_SHELF_NAME_LENGTH);
  if (cleanName.length < 2) {
    return { ok: false, error: "Shelf name needs at least 2 characters." };
  }

  const shelves = getCustomShelves();
  const target = shelves.find((s) => s.id === shelfId);
  if (!target) {
    return { ok: false, error: "Shelf not found." };
  }

  const dup = shelves.find(
    (s) =>
      s.id !== shelfId && s.name.toLowerCase() === cleanName.toLowerCase()
  );
  if (dup) {
    return { ok: false, error: `A shelf named "${dup.name}" already exists.` };
  }

  const updated = shelves.map((s) =>
    s.id === shelfId
      ? {
          ...s,
          name: cleanName,
          icon: newIcon ? sanitizeText(newIcon, 8) || s.icon : s.icon,
          updatedAt: Date.now(),
        }
      : s
  );

  const saved = persistShelves(updated);
  return saved ? { ok: true } : { ok: false, error: "Could not save rename." };
}

export function deleteCustomShelf(shelfId: string): boolean {
  const shelves = getCustomShelves();
  const next = shelves.filter((s) => s.id !== shelfId);
  if (next.length === shelves.length) return false;
  return persistShelves(next);
}

export function isItemInShelf(
  shelfId: string,
  rawItemId: string,
  mediaType?: "movie" | "tv"
): boolean {
  const norm = normalizeShelfItemId(rawItemId, mediaType);
  const clean = extractCleanMediaId(rawItemId);
  const shelf = getCustomShelves().find((s) => s.id === shelfId);
  if (!shelf) return false;
  return shelf.items.some(
    (it) => it.id === norm || (clean && it.mediaId === clean && (!mediaType || it.mediaType === mediaType))
  );
}

export function getShelfIdsForItem(
  rawItemId: string,
  mediaType?: "movie" | "tv"
): string[] {
  const norm = normalizeShelfItemId(rawItemId, mediaType);
  const clean = extractCleanMediaId(rawItemId);
  return getCustomShelves()
    .filter((shelf) =>
      shelf.items.some(
        (it) =>
          it.id === norm ||
          (clean && it.mediaId === clean && (!mediaType || it.mediaType === mediaType))
      )
    )
    .map((shelf) => shelf.id);
}

export function toggleItemInShelf(
  shelfId: string,
  rawItem: Omit<ShelfMediaItem, "addedAt">
): { added: boolean; error?: string } {
  const shelves = getCustomShelves();
  const target = shelves.find((s) => s.id === shelfId);
  if (!target) return { added: false, error: "Shelf not found." };

  const mediaType: "movie" | "tv" = rawItem.mediaType === "tv" ? "tv" : "movie";
  const cleanMediaId = extractCleanMediaId(rawItem.mediaId || rawItem.id);
  const normId = normalizeShelfItemId(rawItem.id || cleanMediaId, mediaType);

  const exists = target.items.some(
    (it) => it.id === normId || (cleanMediaId && it.mediaId === cleanMediaId && it.mediaType === mediaType)
  );

  if (exists) {
    const updated = shelves.map((s) =>
      s.id === shelfId
        ? {
            ...s,
            updatedAt: Date.now(),
            items: s.items.filter(
              (it) =>
                !(
                  it.id === normId ||
                  (cleanMediaId && it.mediaId === cleanMediaId && it.mediaType === mediaType)
                )
            ),
          }
        : s
    );
    persistShelves(updated);
    return { added: false };
  }

  if (target.items.length >= MAX_ITEMS_PER_SHELF) {
    return {
      added: false,
      error: `This shelf is full (${MAX_ITEMS_PER_SHELF} titles max).`,
    };
  }

  const nextItem: ShelfMediaItem = {
    id: normId,
    mediaId: cleanMediaId,
    title: sanitizeText(rawItem.title || "Untitled", 140),
    description: sanitizeText(rawItem.description || "", 360),
    image: sanitizeImageUrl(rawItem.image || ""),
    href: `/details?id=${encodeURIComponent(cleanMediaId)}&type=${mediaType}`,
    genre: sanitizeText(rawItem.genre || "", 60) || undefined,
    year: sanitizeText(rawItem.year || "", 10) || undefined,
    rating: sanitizeText(rawItem.rating || "", 10) || undefined,
    mediaType,
    addedAt: Date.now(),
  };

  const updated = shelves.map((s) =>
    s.id === shelfId
      ? {
          ...s,
          updatedAt: Date.now(),
          items: [nextItem, ...s.items],
        }
      : s
  );

  const saved = persistShelves(updated);
  if (!saved) {
    return { added: false, error: "Storage full — clear caches to save more." };
  }
  return { added: true };
}

export function removeItemFromShelf(
  shelfId: string,
  rawItemId: string,
  mediaType?: "movie" | "tv"
): boolean {
  const shelves = getCustomShelves();
  const norm = normalizeShelfItemId(rawItemId, mediaType);
  const clean = extractCleanMediaId(rawItemId);
  let changed = false;

  const updated = shelves.map((s) => {
    if (s.id !== shelfId) return s;
    const filtered = s.items.filter((it) => {
      const match =
        it.id === norm ||
        (clean && it.mediaId === clean && (!mediaType || it.mediaType === mediaType));
      if (match) changed = true;
      return !match;
    });
    return changed ? { ...s, updatedAt: Date.now(), items: filtered } : s;
  });

  if (!changed) return false;
  return persistShelves(updated);
}