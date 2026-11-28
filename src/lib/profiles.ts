// src/lib/profiles.ts
import {
  type AppTheme,
  getSavedTheme,
  saveTheme,
  getSavedUserAge,
  saveUserAge,
  getKidsModeLocked,
  setKidsModeLocked,
  applyAllSettingsToDocument,
  purgeOldTmdbCaches,
  clearSettingsMemoryCache,
  saveSettingsBatch,
} from "@/lib/settings";
import { generateSecureId } from "@/lib/gist-client";
import {
  MASCOT_UPDATED_EVENT,
  sanitizeMascotId,
  getActiveMascotBadge,
  setActiveMascotBadge,
} from "@/lib/mascots";
import {
  CUSTOM_SHELVES_STORAGE_KEY,
  CUSTOM_SHELVES_EVENT,
} from "@/lib/custom-shelves";

export const PROFILES_STORAGE_KEY = "rabtv_household_profiles_v1";
export const ACTIVE_PROFILE_ID_KEY = "rabtv_active_profile_id_v1";
export const PROFILES_UPDATED_EVENT = "rabtv_profiles_updated";
export const OPEN_PROFILE_SWITCHER_EVENT = "rabtv_open_profile_switcher";

export const MAX_PROFILES = 6;
export const MAX_PROFILE_NAME_LENGTH = 24;

// Keys isolated per household profile (global license, PIN hash, admin & deviceId stay untouched)
const ISOLATED_STORAGE_KEYS = [
  "rabtv_my_list",
  "rabtv_favorites",
  "rabtv_watch_history",
  "rabtv_watch_history_v2",
  "rabtv_disliked_titles",
  "rabtv_recent_live_channels",
  "rabtv_favorite_live_channels",
  "rabtv_hidden_live_channels_v1",
  CUSTOM_SHELVES_STORAGE_KEY,
] as const;

export interface HouseholdProfile {
  id: string;
  name: string;
  mascot: string;
  theme: AppTheme;
  age: number;
  isKids: boolean;
  createdAt: number;
  lastUsedAt: number;
  data: Record<string, string | null>;
}

const VALID_THEMES: AppTheme[] = [
  "violet",
  "red",
  "midnight",
  "emerald",
  "amber",
  "cyan",
];

function sanitizeProfileName(raw: string): string {
  return String(raw || "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_PROFILE_NAME_LENGTH);
}

function sanitizeMascot(raw: string): string {
  return sanitizeMascotId(raw);
}

function sanitizeTheme(raw: unknown): AppTheme {
  return VALID_THEMES.includes(raw as AppTheme) ? (raw as AppTheme) : "violet";
}

function sanitizeAge(raw: unknown, isKids: boolean): number {
  const num = Number(raw);
  if (isKids) return isNaN(num) || num <= 0 ? 8 : Math.min(12, Math.max(1, Math.round(num)));
  if (isNaN(num) || num < 1 || num > 120) return 25;
  return Math.round(num);
}

function captureCurrentIsolatedData(): Record<string, string | null> {
  const snapshot: Record<string, string | null> = {};
  if (typeof window === "undefined") return snapshot;
  for (const key of ISOLATED_STORAGE_KEYS) {
    try {
      snapshot[key] = localStorage.getItem(key);
    } catch {
      snapshot[key] = null;
    }
  }
  return snapshot;
}

function applyIsolatedData(data: Record<string, string | null> | undefined): void {
  if (typeof window === "undefined") return;
  for (const key of ISOLATED_STORAGE_KEYS) {
    const val = data?.[key];
    try {
      if (typeof val === "string") {
        localStorage.setItem(key, val);
      } else {
        localStorage.removeItem(key);
      }
    } catch {
      try {
        purgeOldTmdbCaches();
        if (typeof val === "string") localStorage.setItem(key, val);
      } catch {
        // ignore if storage is critically full
      }
    }
  }
  // CRITICAL: flush settings.ts in-memory cache so pinned live channels update immediately!
  clearSettingsMemoryCache();
}

function persistProfiles(profiles: HouseholdProfile[]): boolean {
  if (typeof window === "undefined") return false;
  const serialized = JSON.stringify(profiles);
  try {
    localStorage.setItem(PROFILES_STORAGE_KEY, serialized);
    window.dispatchEvent(new Event(PROFILES_UPDATED_EVENT));
    return true;
  } catch {
    try {
      purgeOldTmdbCaches();
      localStorage.setItem(PROFILES_STORAGE_KEY, serialized);
      window.dispatchEvent(new Event(PROFILES_UPDATED_EVENT));
      return true;
    } catch {
      return false;
    }
  }
}

function broadcastProfileChange(): void {
  if (typeof window === "undefined") return;
  applyAllSettingsToDocument();
  window.dispatchEvent(new Event(PROFILES_UPDATED_EVENT));
  window.dispatchEvent(new Event(MASCOT_UPDATED_EVENT));
  window.dispatchEvent(new Event("rabtv_settings_updated"));
  window.dispatchEvent(new Event("rabtv_catalog_updated"));
  window.dispatchEvent(new Event("rabtv_watch_history_updated"));
  window.dispatchEvent(new Event("rabtv_disliked_updated"));
  window.dispatchEvent(new Event(CUSTOM_SHELVES_EVENT));
  window.dispatchEvent(new Event("rabtv_live_catalog_updated"));
}

/**
 * Ensures at least the primary profile exists, seeded from the user's current
 * live RABBiT TV profile & watch data so upgrading is 100% seamless.
 */
export function ensurePrimaryProfileInitialized(): HouseholdProfile[] {
  if (typeof window === "undefined") return [];
  const existing = getHouseholdProfilesRaw();
  if (existing.length > 0) {
    const activeId = localStorage.getItem(ACTIVE_PROFILE_ID_KEY);
    if (!activeId || !existing.some((p) => p.id === activeId)) {
      localStorage.setItem(ACTIVE_PROFILE_ID_KEY, existing[0].id);
    }
    return existing;
  }

  const currentName =
    sanitizeProfileName(localStorage.getItem("rabtv_profile_name") || "") ||
    "Main Profile";
  const isKids = getKidsModeLocked();
  const now = Date.now();

  const primary: HouseholdProfile = {
    id: `prof-${now}`,
    name: currentName,
    mascot: sanitizeMascot(getActiveMascotBadge()),
    theme: sanitizeTheme(getSavedTheme()),
    age: sanitizeAge(getSavedUserAge(), isKids),
    isKids,
    createdAt: now,
    lastUsedAt: now,
    data: captureCurrentIsolatedData(),
  };

  persistProfiles([primary]);
  localStorage.setItem(ACTIVE_PROFILE_ID_KEY, primary.id);
  return [primary];
}

function getHouseholdProfilesRaw(): HouseholdProfile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PROFILES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((p: any) => p && typeof p === "object" && p.id && p.name)
      .slice(0, MAX_PROFILES)
      .map((p: any) => {
        const isKids = Boolean(p.isKids);
        return {
          id: String(p.id).slice(0, 48),
          name: sanitizeProfileName(p.name) || "Profile",
          mascot: sanitizeMascot(p.mascot),
          theme: sanitizeTheme(p.theme),
          age: sanitizeAge(p.age, isKids),
          isKids,
          createdAt: Number(p.createdAt) || Date.now(),
          lastUsedAt: Number(p.lastUsedAt) || Date.now(),
          data: p.data && typeof p.data === "object" ? p.data : {},
        };
      });
  } catch {
    return [];
  }
}

export function getHouseholdProfiles(): HouseholdProfile[] {
  return ensurePrimaryProfileInitialized();
}

export function getActiveProfileId(): string {
  if (typeof window === "undefined") return "";
  const profiles = ensurePrimaryProfileInitialized();
  const saved = localStorage.getItem(ACTIVE_PROFILE_ID_KEY);
  if (saved && profiles.some((p) => p.id === saved)) return saved;
  return profiles[0]?.id || "";
}

export function getActiveProfile(): HouseholdProfile | null {
  const profiles = ensurePrimaryProfileInitialized();
  const activeId = getActiveProfileId();
  return profiles.find((p) => p.id === activeId) || profiles[0] || null;
}

/**
 * Snapshots the current active profile's live localStorage keys back into
 * its stored record so nothing is ever lost before switching profiles.
 */
export function snapshotActiveProfile(): HouseholdProfile[] {
  if (typeof window === "undefined") return [];
  const profiles = ensurePrimaryProfileInitialized();
  const activeId = getActiveProfileId();
  const liveName =
    sanitizeProfileName(localStorage.getItem("rabtv_profile_name") || "") ||
    undefined;

  const updated = profiles.map((p) =>
    p.id === activeId
      ? {
          ...p,
          name: liveName || p.name,
          mascot: sanitizeMascot(getActiveMascotBadge()),
          theme: sanitizeTheme(getSavedTheme()),
          age: sanitizeAge(getSavedUserAge(), getKidsModeLocked()),
          isKids: getKidsModeLocked(),
          lastUsedAt: Date.now(),
          data: captureCurrentIsolatedData(),
        }
      : p
  );

  persistProfiles(updated);
  return updated;
}

export function createHouseholdProfile(input: {
  name: string;
  mascot: string;
  theme: AppTheme;
  age: number;
  isKids: boolean;
}): { ok: boolean; profile?: HouseholdProfile; error?: string } {
  const cleanName = sanitizeProfileName(input.name);
  if (cleanName.length < 2) {
    return { ok: false, error: "Profile name needs at least 2 characters." };
  }

  const profiles = snapshotActiveProfile();
  if (profiles.length >= MAX_PROFILES) {
    return {
      ok: false,
      error: `Limit reached (${MAX_PROFILES} profiles max per device).`,
    };
  }

  const dup = profiles.find(
    (p) => p.name.toLowerCase() === cleanName.toLowerCase()
  );
  if (dup) {
    return { ok: false, error: `A profile named "${dup.name}" already exists.` };
  }

  const now = Date.now();
  const isKids = Boolean(input.isKids);
  const newProfile: HouseholdProfile = {
    id: generateSecureId("prof", 4),
    name: cleanName,
    mascot: sanitizeMascot(input.mascot),
    theme: sanitizeTheme(input.theme),
    age: sanitizeAge(input.age, isKids),
    isKids,
    createdAt: now,
    lastUsedAt: now,
    data: {},
  };

  const saved = persistProfiles([...profiles, newProfile]);
  if (!saved) {
    return { ok: false, error: "Storage full — clear caches first." };
  }
  return { ok: true, profile: newProfile };
}

export function switchHouseholdProfile(profileId: string): boolean {
  if (typeof window === "undefined") return false;
  const profiles = snapshotActiveProfile();
  const target = profiles.find((p) => p.id === profileId);
  if (!target) return false;

  // Apply target profile's isolated data & preferences atomically in 1 DOM pass
  applyIsolatedData(target.data);
  localStorage.setItem("rabtv_profile_name", target.name);
  localStorage.setItem(ACTIVE_PROFILE_ID_KEY, target.id);
  saveSettingsBatch(() => {
    saveTheme(target.theme);
    setActiveMascotBadge(target.mascot);
    saveUserAge(target.age);
    setKidsModeLocked(target.isKids);
  });

  const refreshed = profiles.map((p) =>
    p.id === target.id ? { ...p, lastUsedAt: Date.now() } : p
  );
  persistProfiles(refreshed);
  broadcastProfileChange();
  return true;
}

export function deleteHouseholdProfile(
  profileId: string
): { ok: boolean; error?: string } {
  const profiles = snapshotActiveProfile();
  if (profiles.length <= 1) {
    return { ok: false, error: "You must keep at least one profile." };
  }

  const remaining = profiles.filter((p) => p.id !== profileId);
  if (remaining.length === profiles.length) {
    return { ok: false, error: "Profile not found." };
  }

  const activeId = getActiveProfileId();
  persistProfiles(remaining);

  if (activeId === profileId && remaining[0]) {
    switchHouseholdProfile(remaining[0].id);
  }
  return { ok: true };
}

export function triggerOpenProfileSwitcher(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_PROFILE_SWITCHER_EVENT));
}