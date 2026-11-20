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
const GITHUB_MASCOT_API_URL =
  "https://api.github.com/repos/rogerskyle0506-ui/RABBiT-TV-2.0/contents/assets/mascots";
const REMOTE_MASCOT_CACHE_KEY = "rabtv_remote_mascots_cache_v1";
const REMOTE_MASCOT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_EMOJI = "\u{1F430}";

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

function isSafeFilename(name: string): boolean {
  return /^[a-zA-Z0-9._-]+\.(png|jpg|jpeg|webp|gif)$/i.test(name);
}

function extractFilename(filePath: string): string {
  const parts = String(filePath || "").split("/");
  return parts[parts.length - 1] || "";
}

function formatFriendlyLabel(filename: string, index: number): string {
  const base = filename.replace(/\.[^.]+$/, "");
  // Pure numeric timestamps (e.g. 1795157415422.jpg) get clean numbered labels
  if (/^\d+$/.test(base)) {
    return `Mascot Badge #${index + 1}`;
  }
  const readable = base
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
  return readable || `Mascot Badge #${index + 1}`;
}

/**
 * Vite Build-Time Auto-Import:
 * Automatically discovers and bundles EVERY image placed inside /assets/mascots/
 * (or /src/assets/mascots/). Drop new .png / .jpg / .jpeg / .webp files into the
 * folder and rebuild — no filename list to maintain, and 100% offline-ready in the APK.
 */
const BUNDLED_MASCOT_GLOB = import.meta.glob(
  [
    "/assets/mascots/*.{png,jpg,jpeg,webp,gif,PNG,JPG,JPEG,WEBP,GIF}",
    "/src/assets/mascots/*.{png,jpg,jpeg,webp,gif,PNG,JPG,JPEG,WEBP,GIF}",
  ],
  {
    eager: true,
    query: "?url",
    import: "default",
  }
) as Record<string, string>;

function buildBundledMascots(): MascotBadgeOption[] {
  const seenFilenames = new Set<string>();
  const entries = Object.entries(BUNDLED_MASCOT_GLOB).sort(([a], [b]) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
  );

  const list: MascotBadgeOption[] = [];
  for (const [filePath, resolvedAssetUrl] of entries) {
    const filename = extractFilename(filePath);
    if (!isSafeFilename(filename) || seenFilenames.has(filename)) continue;
    seenFilenames.add(filename);

    const encoded = encodeURIComponent(filename);
    const bundledUrl = typeof resolvedAssetUrl === "string" ? resolvedAssetUrl : "";
    const githubFallbackUrl = `${GITHUB_MASCOT_BASE_URL}${encoded}`;

    list.push({
      id: `badge:${filename}`,
      label: formatFriendlyLabel(filename, list.length),
      category: "custom",
      filename,
      // Primary: bundled inside the Vite/Capacitor build (instant + works offline)
      imageUrl: bundledUrl || githubFallbackUrl,
      // Secondary fallback: GitHub raw URL
      localUrl: githubFallbackUrl,
      emojiFallback: DEFAULT_EMOJI,
    });
  }

  return list;
}

export const CUSTOM_MASCOT_BADGES: MascotBadgeOption[] = buildBundledMascots();

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
  CUSTOM_MASCOT_BADGES[0]?.id || DEFAULT_EMOJI;

/**
 * Reads any cached remote filenames discovered from GitHub (for badges added
 * after the APK was built) and merges them with Vite-bundled badges.
 */
function readCachedRemoteFilenames(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(REMOTE_MASCOT_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.filenames)) return [];
    return parsed.filenames.filter(
      (f: unknown): f is string => typeof f === "string" && isSafeFilename(f)
    );
  } catch {
    return [];
  }
}

/**
 * Returns all currently known custom badges (Vite-bundled + any cached remote additions).
 */
export function getAllCustomMascotBadges(): MascotBadgeOption[] {
  const merged = [...CUSTOM_MASCOT_BADGES];
  const seen = new Set(merged.map((b) => b.filename));

  for (const filename of readCachedRemoteFilenames()) {
    if (seen.has(filename)) continue;
    seen.add(filename);
    const encoded = encodeURIComponent(filename);
    merged.push({
      id: `badge:${filename}`,
      label: formatFriendlyLabel(filename, merged.length),
      category: "custom",
      filename,
      imageUrl: `${GITHUB_MASCOT_BASE_URL}${encoded}`,
      localUrl: `/assets/mascots/${encoded}`,
      emojiFallback: DEFAULT_EMOJI,
    });
  }

  return merged;
}

/**
 * Optional 24-hour cached background check against GitHub's assets/mascots folder
 * so newly committed badges can even appear before your next APK rebuild.
 */
export async function syncRemoteMascotBadges(
  signal?: AbortSignal
): Promise<MascotBadgeOption[]> {
  if (typeof window === "undefined") return CUSTOM_MASCOT_BADGES;

  try {
    const rawCache = localStorage.getItem(REMOTE_MASCOT_CACHE_KEY);
    if (rawCache) {
      const parsed = JSON.parse(rawCache);
      if (
        parsed?.checkedAt &&
        Date.now() - Number(parsed.checkedAt) < REMOTE_MASCOT_TTL_MS
      ) {
        return getAllCustomMascotBadges();
      }
    }
  } catch {
    // ignore malformed cache
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return getAllCustomMascotBadges();
  }

  const controller = new AbortController();
  const onParentAbort = () => controller.abort();
  signal?.addEventListener("abort", onParentAbort, { once: true });
  const timer = window.setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(GITHUB_MASCOT_API_URL, {
      headers: { Accept: "application/vnd.github+json" },
      signal: controller.signal,
    });
    if (!res.ok) return getAllCustomMascotBadges();
    const items = await res.json();
    if (!Array.isArray(items)) return getAllCustomMascotBadges();

    const filenames = items
      .filter(
        (entry: any) =>
          entry?.type === "file" &&
          typeof entry?.name === "string" &&
          isSafeFilename(entry.name)
      )
      .map((entry: any) => String(entry.name))
      .sort((a: string, b: string) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
      );

    try {
      localStorage.setItem(
        REMOTE_MASCOT_CACHE_KEY,
        JSON.stringify({ checkedAt: Date.now(), filenames })
      );
    } catch {
      // ignore storage quota errors
    }

    window.dispatchEvent(new Event(MASCOT_UPDATED_EVENT));
  } catch {
    // Offline or rate-limited — bundled Vite badges still work 100%
  } finally {
    signal?.removeEventListener("abort", onParentAbort);
    window.clearTimeout(timer);
  }

  return getAllCustomMascotBadges();
}

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

  if (isSafeFilename(str)) {
    return `badge:${str}`;
  }

  return str.slice(0, 8) || DEFAULT_EMOJI;
}

/**
 * Resolves a stored mascot string into a full MascotBadgeOption with image URLs.
 */
export function resolveMascotBadge(rawId?: string | null): MascotBadgeOption {
  const safeId = sanitizeMascotId(rawId);

  const exactMatch =
    getAllCustomMascotBadges().find((b) => b.id === safeId) ||
    EMOJI_MASCOT_BADGES.find((b) => b.id === safeId);
  if (exactMatch) return exactMatch;

  if (safeId.startsWith("badge:")) {
    const filename = safeId.slice(6);
    if (isSafeFilename(filename)) {
      const encoded = encodeURIComponent(filename);
      return {
        id: safeId,
        label: formatFriendlyLabel(filename, 0),
        category: "custom",
        filename,
        imageUrl: `${GITHUB_MASCOT_BASE_URL}${encoded}`,
        localUrl: `/assets/mascots/${encoded}`,
        emojiFallback: DEFAULT_EMOJI,
      };
    }
  }

  return {
    id: safeId || DEFAULT_EMOJI,
    label: "Classic Mascot",
    category: "emoji",
    emojiFallback: safeId || DEFAULT_EMOJI,
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