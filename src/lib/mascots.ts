// src/lib/mascots.ts
import {
  getProfileMascot as getLegacyEmojiMascot,
  setProfileMascot as setLegacyEmojiMascot,
  PROFILE_MASCOT_OPTIONS,
} from "@/lib/settings";

export const MASCOT_BADGE_STORAGE_KEY = "rabtv_profile_mascot_badge_v1";
export const MASCOT_UPDATED_EVENT = "rabtv_mascot_updated";

const GITHUB_MASCOT_BASE_URL =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/mascots/";
const LOCAL_MASCOT_BASE_PATH = "/assets/mascots/";

export type MascotCategory = "custom" | "emoji";

export interface MascotBadgeOption {
  id: string;
  label: string;
  category: MascotCategory;
  filename?: string;
  imageUrl?: string;
  localUrl?: string;
  emojiFallback: string;
}

/**
 * Exact custom mascot badge files committed in RABBiT-TV-2.0/assets/mascots/
 * To add more badges later, just append the filename to this array.
 */
const CUSTOM_MASCOT_FILENAMES: readonly string[] = [
  "1795157415422.jpg",
  "1795157420589.jpg",
  "1795157426107.jpg",
  "1795157430755.jpg",
  "1795157435196.jpg",
  "1795157439106.jpg",
  "1795157444300.jpg",
  "1795157447473.jpg",
  "1795157451595.jpg",
  "1795157455329.jpg",
  "1795158385829.png",
  "1795158416414.png",
  "1795158458124.png",
];

function isSafeFilename(name: string): boolean {
  return /^[a-zA-Z0-9._-]+\.(png|jpg|jpeg|webp)$/i.test(name);
}

export const CUSTOM_MASCOT_BADGES: MascotBadgeOption[] =
  CUSTOM_MASCOT_FILENAMES.filter(isSafeFilename).map((filename, idx) => ({
    id: `badge:${filename}`,
    label: `Mascot Badge #${idx + 1}`,
    category: "custom",
    filename,
    imageUrl: `${GITHUB_MASCOT_BASE_URL}${encodeURIComponent(filename)}`,
    localUrl: `${LOCAL_MASCOT_BASE_PATH}${encodeURIComponent(filename)}`,
    emojiFallback: "🐰",
  }));

export const EMOJI_MASCOT_BADGES: MascotBadgeOption[] =
  PROFILE_MASCOT_OPTIONS.map((m) => ({
    id: m.id,
    label: m.label,
    category: "emoji",
    emojiFallback: m.id,
  }));

export const ALL_MASCOT_BADGES: MascotBadgeOption[] = [
  ...CUSTOM_MASCOT_BADGES,
  ...EMOJI_MASCOT_BADGES,
];

export const DEFAULT_MASCOT_ID: string =
  CUSTOM_MASCOT_BADGES[0]?.id || "🐰";

/**
 * Sanitizes any mascot identifier (either "badge:<filename>" or short emoji).
 */
export function sanitizeMascotId(raw: unknown): string {
  const str = String(raw || "").trim();
  if (!str) return DEFAULT_MASCOT_ID;

  if (str.startsWith("badge:")) {
    const fname = str.slice(6).trim();
    if (isSafeFilename(fname)) {
      return `badge:${fname}`;
    }
    return DEFAULT_MASCOT_ID;
  }

  // Allow direct raw filename reference
  if (isSafeFilename(str)) {
    return `badge:${str}`;
  }

  // Otherwise treat as classic emoji mascot
  return str.slice(0, 8) || "🐰";
}

/**
 * Resolves a stored mascot string into a full MascotBadgeOption with image URLs.
 */
export function resolveMascotBadge(rawId?: string | null): MascotBadgeOption {
  const safeId = sanitizeMascotId(rawId);

  const exactMatch = ALL_MASCOT_BADGES.find((b) => b.id === safeId);
  if (exactMatch) return exactMatch;

  if (safeId.startsWith("badge:")) {
    const filename = safeId.slice(6);
    if (isSafeFilename(filename)) {
      return {
        id: safeId,
        label: "Custom Badge",
        category: "custom",
        filename,
        imageUrl: `${GITHUB_MASCOT_BASE_URL}${encodeURIComponent(filename)}`,
        localUrl: `${LOCAL_MASCOT_BASE_PATH}${encodeURIComponent(filename)}`,
        emojiFallback: "🐰",
      };
    }
  }

  return {
    id: safeId || "🐰",
    label: "Classic Mascot",
    category: "emoji",
    emojiFallback: safeId || "🐰",
  };
}

export function isCustomImageMascot(rawId?: string | null): boolean {
  return resolveMascotBadge(rawId).category === "custom";
}

/**
 * Reads the active profile's mascot badge (prefers custom badge storage,
 * falls back seamlessly to legacy settings.ts emoji).
 */
export function getActiveMascotBadge(): string {
  if (typeof window === "undefined") return DEFAULT_MASCOT_ID;
  try {
    const stored = localStorage.getItem(MASCOT_BADGE_STORAGE_KEY);
    if (stored && stored.trim()) {
      return sanitizeMascotId(stored);
    }
  } catch {
    // ignore storage errors
  }

  const legacy = getLegacyEmojiMascot();
  if (legacy && legacy.trim()) {
    return sanitizeMascotId(legacy);
  }
  return DEFAULT_MASCOT_ID;
}

/**
 * Persists the active mascot badge and broadcasts updates across the app.
 */
export function setActiveMascotBadge(mascotId: string): string {
  const safeId = sanitizeMascotId(mascotId);
  if (typeof window === "undefined") return safeId;

  try {
    localStorage.setItem(MASCOT_BADGE_STORAGE_KEY, safeId);
  } catch {
    // ignore storage quota errors
  }

  // Keep legacy emoji setting synced if user picked a classic emoji
  if (!safeId.startsWith("badge:")) {
    try {
      setLegacyEmojiMascot(safeId);
    } catch {
      // ignore
    }
  }

  window.dispatchEvent(new Event(MASCOT_UPDATED_EVENT));
  window.dispatchEvent(new Event("rabtv_settings_updated"));
  return safeId;
}