// src/lib/settings.ts

// ==========================================
// CORE & EXTENDED TYPES
// ==========================================

export type CardSize = "small" | "medium" | "large";
export type AppTheme = "violet" | "red" | "midnight" | "emerald" | "amber" | "cyan";
export type StreamQuality = "1080p" | "720p" | "480p" | "auto";
export type HistoryScale = "off" | "20%" | "50%" | "80%";

// Hardware & Performance Types
export type RamMode = "auto" | "low" | "high";
export type GlowIntensity = "off" | "subtle" | "full";

// Senior, TV & Accessibility Types
export type TextScale = "normal" | "large" | "xl";
export type CursorStyle = "white" | "yellow" | "cyan" | "pink";
export type SleepTimerMinutes = 0 | 30 | 60 | 90 | 120;
export type TvOverscanPercent = 0 | 2 | 4 | 6;
export type ClockFormat = "12h" | "24h";
export type SubtitleSize = "normal" | "large" | "xl";
export type SubtitleColor = "white" | "yellow" | "cyan";
export type SubtitleBgOpacity = "none" | "medium" | "solid";

export interface SubtitleSettings {
  size: SubtitleSize;
  color: SubtitleColor;
  bgOpacity: SubtitleBgOpacity;
}

// Poster Customization & Info Layout Types
export type PosterShape = "sharp" | "rounded" | "extra";
export type PosterCardStyle =
  | "crystal-glass"
  | "neon-frame"
  | "cinema-minimal"
  | "theater-marquee"
  | "collector-showcase";
export type PosterInfoLayout =
  | "overlay-bottom"
  | "below-card"
  | "hover-reveal"
  | "clean-poster"
  | "detailed-badges";

export interface PosterAppearanceClasses {
  shape: PosterShape;
  cardStyle: PosterCardStyle;
  infoLayout: PosterInfoLayout;
  showBadges: boolean;
  radiusClass: string;
  innerRadiusClass: string;
  cardFrameClass: string;
  showLaserBar: boolean;
}

// Personalization Types
export type GreetingStyle = "time-of-day" | "rabbit" | "cinema" | "cozy" | "classic";
export type StartupTab =
  | "Home"
  | "Live TV"
  | "Movies"
  | "TV Shows"
  | "My List"
  | "Watch History";

export interface HardwareLimits {
  effectiveMode: "low" | "high";
  hlsMaxBufferSizeBytes: number;
  hlsMaxBufferLengthSec: number;
  hlsBackBufferLengthSec: number;
  liveChannelsPerPage: number;
  tmdbPosterSize: "w342" | "w500";
  enableHeavyBlur: boolean;
  maxCachedHistoryItems: number;
}

export interface StorageHealthReport {
  usedKB: number;
  maxEstimatedKB: number;
  percentUsed: number;
  cacheEntriesCount: number;
  status: "healthy" | "moderate" | "high";
}

export interface PinLockoutState {
  isLocked: boolean;
  remainingSeconds: number;
  failedAttempts: number;
  attemptsLeft: number;
}

// ==========================================
// STORAGE KEYS
// ==========================================

export const DISCLAIMER_ACCEPTED_KEY = "rabtv_disclaimer_accepted";
export const CARD_SIZE_KEY = "rabtv_card_size";
export const THEME_KEY = "rabtv_app_theme";
export const HELPFUL_MOUSE_KEY = "rabtv_helpful_mouse";
export const STREAM_QUALITY_KEY = "rabtv_stream_quality";
export const USER_AGE_KEY = "rabtv_user_age";
export const HISTORY_OVERSCALE_KEY = "rabtv_history_overscale";
export const LARGE_BUTTONS_KEY = "rabtv_large_buttons";
export const SCREENSAVER_TIMEOUT_KEY = "rabtv_screensaver_timeout_ms";

// Security & Device Keys
export const AGE_LOCK_PIN_KEY = "rabtv_age_passcode";
export const AGE_LOCK_PIN_HASH_KEY = "rabtv_age_passcode_hash";
export const AGE_LOCK_PIN_SUFFIX_KEY = "rabtv_age_pin_suffix";
export const PIN_LOCKOUT_UNTIL_KEY = "rabtv_pin_lockout_until";
export const PIN_FAILED_COUNT_KEY = "rabtv_pin_failed_attempts";
export const DEVICE_ID_KEY = "rabtv_device_id";
export const KIDS_MODE_LOCKED_KEY = "rabtv_kids_mode_locked";

// Performance & Hardware Keys
export const RAM_MODE_KEY = "rabtv_ram_mode";
export const DATA_SAVER_KEY = "rabtv_data_saver";
export const AUTOPLAY_NEXT_KEY = "rabtv_autoplay_next";
export const SLEEP_TIMER_KEY = "rabtv_sleep_timer_minutes";
export const GLOW_INTENSITY_KEY = "rabtv_glow_intensity";

// Senior, TV & Accessibility Keys
export const TEXT_SCALE_KEY = "rabtv_text_scale";
export const HIGH_CONTRAST_FOCUS_KEY = "rabtv_high_contrast_focus";
export const REDUCED_MOTION_KEY = "rabtv_reduced_motion";
export const UI_CLICK_SOUNDS_KEY = "rabtv_ui_click_sounds";
export const SENIOR_EASY_MODE_KEY = "rabtv_senior_easy_mode";
export const CURSOR_STYLE_KEY = "rabtv_cursor_style";
export const TV_OVERSCAN_KEY = "rabtv_tv_overscan";
export const CLOCK_FORMAT_KEY = "rabtv_clock_format";
export const SUBTITLE_SETTINGS_KEY = "rabtv_subtitle_settings";

// Poster Customization & Personalization Keys
export const POSTER_SHAPE_KEY = "rabtv_poster_shape";
export const POSTER_CARD_STYLE_KEY = "rabtv_poster_card_style";
export const POSTER_INFO_LAYOUT_KEY = "rabtv_poster_info_layout";
export const SHOW_POSTER_BADGES_KEY = "rabtv_show_poster_badges";
export const FAVORITE_CHANNELS_KEY = "rabtv_favorite_live_channels";
export const DEFAULT_PLAYER_VOLUME_KEY = "rabtv_default_player_volume";
export const GREETING_STYLE_KEY = "rabtv_greeting_style";
export const PROFILE_MASCOT_KEY = "rabtv_profile_mascot";
export const WARM_EYE_CARE_KEY = "rabtv_warm_eye_care";
export const STARTUP_TAB_KEY = "rabtv_startup_tab";
export const SHOW_CORNER_CLOCK_KEY = "rabtv_show_corner_clock";

// ==========================================
// PRESET LISTS & THEME STYLES
// ==========================================

export const DEFAULT_SCREENSAVER_TIMEOUT = 2.5 * 60 * 60 * 1000; // 2.5 hours
export const MAX_FAVORITE_CHANNELS = 12;

export const SCREENSAVER_TIMEOUT_OPTIONS = [
  { label: "3 Hours", value: 3 * 60 * 60 * 1000 },
  { label: "2.5 Hours (Default)", value: 2.5 * 60 * 60 * 1000 },
  { label: "2 Hours", value: 2 * 60 * 60 * 1000 },
  { label: "1 Hour", value: 1 * 60 * 60 * 1000 },
  { label: "30 Minutes", value: 30 * 60 * 1000 },
  { label: "20 Minutes", value: 20 * 60 * 1000 },
  { label: "5 Minutes", value: 5 * 60 * 1000 },
];

export const SLEEP_TIMER_OPTIONS: { label: string; value: SleepTimerMinutes }[] = [
  { label: "Off", value: 0 },
  { label: "30 Min", value: 30 },
  { label: "1 Hour", value: 60 },
  { label: "1.5 Hours", value: 90 },
  { label: "2 Hours", value: 120 },
];

export const TV_OVERSCAN_OPTIONS: { label: string; value: TvOverscanPercent }[] = [
  { label: "0% (Full Edge)", value: 0 },
  { label: "2% (Slight Safe)", value: 2 },
  { label: "4% (TV Safe)", value: 4 },
  { label: "6% (Projector Safe)", value: 6 },
];

export const GLOW_INTENSITY_OPTIONS: { id: GlowIntensity; label: string }[] = [
  { id: "off", label: "Off (Fastest)" },
  { id: "subtle", label: "Subtle" },
  { id: "full", label: "Full Neon" },
];

export const POSTER_SHAPE_OPTIONS: { id: PosterShape; label: string }[] = [
  { id: "sharp", label: "▭ Sharp Cinema" },
  { id: "rounded", label: "▢ Modern Glass" },
  { id: "extra", label: "⬭ Soft Rounded" },
];

export const POSTER_CARD_STYLE_OPTIONS: {
  id: PosterCardStyle;
  label: string;
  desc: string;
}[] = [
  {
    id: "crystal-glass",
    label: "💎 Crystal Glass",
    desc: "Translucent border with soft theme hover glow",
  },
  {
    id: "neon-frame",
    label: "⚡ Neon Frame",
    desc: "Bold neon edge with vibrant outer aura",
  },
  {
    id: "cinema-minimal",
    label: "🎬 Cinema Minimal",
    desc: "Clean frameless edge-to-edge poster art",
  },
  {
    id: "theater-marquee",
    label: "✨ Theater Marquee",
    desc: "Elevated cinema shadow with bottom laser line",
  },
  {
    id: "collector-showcase",
    label: "🖼️ Collector Frame",
    desc: "Sleek padded dark glass mat around poster",
  },
];

export const POSTER_INFO_LAYOUT_OPTIONS: {
  id: PosterInfoLayout;
  label: string;
  desc: string;
}[] = [
  {
    id: "overlay-bottom",
    label: "🌅 Overlay Bottom",
    desc: "Title & year blended at the bottom of the poster",
  },
  {
    id: "below-card",
    label: "📋 Below Poster",
    desc: "Unobstructed art with a clean glass info footer",
  },
  {
    id: "hover-reveal",
    label: "👆 Hover / Focus Reveal",
    desc: "Pure art at rest; details slide up on focus",
  },
  {
    id: "clean-poster",
    label: "🖼️ Pure Poster Wall",
    desc: "Artwork only with zero text overlay",
  },
  {
    id: "detailed-badges",
    label: "🏷️ Full Detail Card",
    desc: "Title, year, rating pill & Movie/TV badge",
  },
];

export const PROFILE_MASCOT_OPTIONS = [
  { id: "🐰", label: "Rabbit" },
  { id: "🍿", label: "Popcorn" },
  { id: "🎬", label: "Cinema" },
  { id: "🐶", label: "Pup" },
  { id: "🦊", label: "Fox" },
  { id: "🐱", label: "Cat" },
  { id: "🦉", label: "Night Owl" },
  { id: "👑", label: "VIP Crown" },
  { id: "🌙", label: "Moon" },
  { id: "⚡", label: "Bolt" },
] as const;

export const GREETING_STYLE_OPTIONS: {
  id: GreetingStyle;
  label: string;
  sample: string;
}[] = [
  { id: "time-of-day", label: "☀️ Time of Day", sample: "Good evening, Name" },
  { id: "rabbit", label: "🐰 Rabbit Style", sample: "Hop on in, Name!" },
  { id: "cinema", label: "🎬 Cinema", sample: "Now Showing for Name" },
  { id: "cozy", label: "☕ Cozy Lounge", sample: "Kick back & relax, Name" },
  { id: "classic", label: "✨ Classic", sample: "Welcome back, Name" },
];

export const CURSOR_STYLE_OPTIONS: { id: CursorStyle; label: string; hex: string }[] = [
  { id: "white", label: "⚪ Classic White", hex: "#ffffff" },
  { id: "yellow", label: "🟡 High-Vis Yellow", hex: "#facc15" },
  { id: "cyan", label: "🔵 Neon Cyan", hex: "#22d3ee" },
  { id: "pink", label: "🩷 Rabbit Pink", hex: "#f472b6" },
];

export const STARTUP_TAB_OPTIONS: StartupTab[] = [
  "Home",
  "Live TV",
  "Movies",
  "TV Shows",
  "My List",
  "Watch History",
];

export const THEME_OPTIONS: AppTheme[] = [
  "violet",
  "red",
  "midnight",
  "emerald",
  "amber",
  "cyan",
];

export const APP_THEME_STYLES: Record<
  AppTheme,
  {
    bg: string;
    card: string;
    accent: string;
    border: string;
    glow: string;
  }
> = {
  violet: {
    bg: "bg-gradient-to-br from-slate-950 via-violet-950/40 to-slate-950",
    card: "from-violet-950/80 via-slate-900 to-indigo-950/80",
    accent: "text-violet-300",
    border: "border-violet-500/30",
    glow: "shadow-violet-600/30",
  },
  red: {
    bg: "bg-gradient-to-br from-zinc-950 via-red-950/40 to-black",
    card: "from-red-950/80 via-zinc-900 to-neutral-950",
    accent: "text-red-400",
    border: "border-red-500/30",
    glow: "shadow-red-600/30",
  },
  midnight: {
    bg: "bg-gradient-to-br from-slate-950 via-blue-950/40 to-slate-950",
    card: "from-blue-950/80 via-slate-900 to-sky-950/80",
    accent: "text-sky-300",
    border: "border-blue-500/30",
    glow: "shadow-blue-600/30",
  },
  emerald: {
    bg: "bg-gradient-to-br from-slate-950 via-emerald-950/40 to-slate-950",
    card: "from-emerald-950/80 via-slate-900 to-teal-950/80",
    accent: "text-emerald-300",
    border: "border-emerald-500/30",
    glow: "shadow-emerald-600/30",
  },
  amber: {
    bg: "bg-gradient-to-br from-stone-950 via-yellow-950/40 to-neutral-950",
    card: "from-yellow-950/80 via-stone-900 to-amber-950/80",
    accent: "text-amber-300",
    border: "border-amber-500/30",
    glow: "shadow-amber-600/30",
  },
  cyan: {
    bg: "bg-gradient-to-br from-slate-950 via-cyan-950/40 to-slate-950",
    card: "from-cyan-950/80 via-slate-900 to-blue-950/80",
    accent: "text-cyan-300",
    border: "border-cyan-500/30",
    glow: "shadow-cyan-600/30",
  },
};

// ==========================================
// FAST IN-MEMORY CACHE & BATCHED WRITER
// ==========================================

const memoryCache = new Map<string, string | null>();
let batchDepth = 0;
let batchDirty = false;

function readSetting(key: string): string | null {
  if (typeof window === "undefined") return null;
  if (memoryCache.has(key)) {
    return memoryCache.get(key) ?? null;
  }
  try {
    const val = localStorage.getItem(key);
    memoryCache.set(key, val);
    return val;
  } catch {
    return null;
  }
}

function writeSetting(key: string, value: string, emitEvent = true): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value);
    memoryCache.set(key, value);
  } catch {
    // Ignore storage quota exceptions on low-storage sticks
  }
  if (batchDepth > 0) {
    if (emitEvent) batchDirty = true;
    return;
  }
  if (emitEvent) {
    window.dispatchEvent(new Event("rabtv_settings_updated"));
  }
}

/**
 * Runs multiple setting updates in a single batch, applying DOM flags and firing
 * `rabtv_settings_updated` only ONCE to prevent layout thrashing on 1-2GB sticks.
 */
export function saveSettingsBatch(fn: () => void): void {
  batchDepth++;
  try {
    fn();
  } finally {
    batchDepth = Math.max(0, batchDepth - 1);
    if (batchDepth === 0 && batchDirty) {
      batchDirty = false;
      applyAllSettingsToDocument();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("rabtv_settings_updated"));
      }
    }
  }
}

export function clearSettingsMemoryCache(): void {
  memoryCache.clear();
}

// Keep memory cache in sync if another tab updates localStorage
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key) {
      memoryCache.set(e.key, e.newValue);
    } else {
      memoryCache.clear();
    }
  });
}

// ==========================================
// STORAGE METER & SAFE CACHE CLEANER
// ==========================================

export function getStorageUsageKB(): number {
  if (typeof window === "undefined") return 0;
  try {
    let totalBytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const v = localStorage.getItem(k) || "";
      totalBytes += (k.length + v.length) * 2; // UTF-16 bytes
    }
    return Math.round((totalBytes / 1024) * 10) / 10;
  } catch {
    return 0;
  }
}

export function getStorageHealth(): StorageHealthReport {
  const usedKB = getStorageUsageKB();
  const maxEstimatedKB = 5120; // ~5 MB standard Android WebView cap
  const percentUsed = Math.min(100, Math.round((usedKB / maxEstimatedKB) * 100));
  let cacheEntriesCount = 0;

  if (typeof window !== "undefined") {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (
          k &&
          (k.startsWith("rabtv_cache_") ||
            k.startsWith("rabtv_fast_live_health") ||
            k.startsWith("rabtv_ublock_cached"))
        ) {
          cacheEntriesCount++;
        }
      }
    } catch {
      // ignore
    }
  }

  const status =
    percentUsed >= 80 ? "high" : percentUsed >= 50 ? "moderate" : "healthy";

  return {
    usedKB,
    maxEstimatedKB,
    percentUsed,
    cacheEntriesCount,
    status,
  };
}

/**
 * Safely deletes temporary TMDB / stream health caches without touching
 * License, PIN, Profile, My List, Favorites, or Watch History.
 */
export function purgeOldTmdbCaches(): number {
  if (typeof window === "undefined") return 0;
  let removed = 0;
  try {
    const keysToDelete: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (
        k &&
        (k.startsWith("rabtv_cache_") ||
          k.startsWith("rabtv_fast_live_health") ||
          k.startsWith("rabtv_ublock_cached"))
      ) {
        keysToDelete.push(k);
      }
    }
    for (const k of keysToDelete) {
      localStorage.removeItem(k);
      memoryCache.delete(k);
      removed++;
    }
  } catch {
    // ignore
  }
  return removed;
}

// ==========================================
// SECURITY: DEVICE ID, HASHED PIN & LOCKOUT
// ==========================================

export function getOrCreateDeviceId(): string {
  const existing = readSetting(DEVICE_ID_KEY);
  if (existing && existing.length >= 8) return existing;

  let generated = "";
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    generated = `rab_${window.crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  } else {
    const rand = Math.random().toString(36).slice(2, 10);
    const ts = Date.now().toString(36);
    generated = `rab_${ts}_${rand}`;
  }

  writeSetting(DEVICE_ID_KEY, generated, false);
  return generated;
}

export function isValidAgeLockPin(pin: string): boolean {
  return /^\d{4,6}$/.test(String(pin || "").trim());
}

/**
 * Hashes a 4-6 digit PIN using Web Crypto SHA-256 (with a deterministic salted
 * fallback for non-HTTPS LAN WebViews where `crypto.subtle` is unavailable).
 */
export async function hashPinSha256(pin: string): Promise<string> {
  const clean = String(pin || "").trim();
  const salted = `rabtv_v2_pin_salt::${clean}`;

  if (
    typeof window !== "undefined" &&
    window.crypto &&
    window.crypto.subtle &&
    typeof TextEncoder !== "undefined"
  ) {
    try {
      const bytes = new TextEncoder().encode(salted);
      const digest = await window.crypto.subtle.digest("SHA-256", bytes);
      const hex = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      return `sha256:${hex}`;
    } catch {
      // Fall through to deterministic fallback below
    }
  }

  // Deterministic 64-bit FNV-1a fallback when running on plain HTTP LAN
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < salted.length; i++) {
    const c = salted.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ (c + i), 0x85ebca6b);
  }
  return `fbhash:${(h1 >>> 0).toString(16).padStart(8, "0")}${(h2 >>> 0)
    .toString(16)
    .padStart(8, "0")}`;
}

export function getAgeLockCode(): string {
  return readSetting(AGE_LOCK_PIN_KEY) || "";
}

export function getAgeLockPinSuffix(): string {
  const explicitSuffix = readSetting(AGE_LOCK_PIN_SUFFIX_KEY);
  if (explicitSuffix) return explicitSuffix;
  const legacy = readSetting(AGE_LOCK_PIN_KEY);
  return legacy ? legacy.slice(-4) : "0000";
}

/**
 * Backwards-compatible synchronous PIN saver that also kicks off a SHA-256 hash update.
 */
export function saveAgeLockCode(pin: string): boolean {
  const clean = String(pin || "").trim();
  if (!isValidAgeLockPin(clean)) return false;
  writeSetting(AGE_LOCK_PIN_KEY, clean, false);
  writeSetting(AGE_LOCK_PIN_SUFFIX_KEY, clean.slice(-4), false);
  void hashPinSha256(clean).then((hashed) => {
    writeSetting(AGE_LOCK_PIN_HASH_KEY, hashed, false);
  });
  return true;
}

/**
 * Saves the PIN securely as a SHA-256 hash. Pass `scrubLegacyPlaintext = true`
 * once all callers use `verifyAgeLockPin()` to remove plain-text storage completely.
 */
export async function saveAgeLockPinSecure(
  pin: string,
  scrubLegacyPlaintext = false
): Promise<boolean> {
  const clean = String(pin || "").trim();
  if (!isValidAgeLockPin(clean)) return false;

  const hashed = await hashPinSha256(clean);
  writeSetting(AGE_LOCK_PIN_HASH_KEY, hashed, false);
  writeSetting(AGE_LOCK_PIN_SUFFIX_KEY, clean.slice(-4), false);

  if (scrubLegacyPlaintext && typeof window !== "undefined") {
    localStorage.removeItem(AGE_LOCK_PIN_KEY);
    memoryCache.delete(AGE_LOCK_PIN_KEY);
  } else {
    writeSetting(AGE_LOCK_PIN_KEY, clean, false);
  }
  return true;
}

/**
 * Verifies a 4-6 digit PIN against the stored SHA-256 hash (and auto-migrates
 * legacy plain-text PINs into hashed storage upon successful match).
 */
export async function verifyAgeLockPin(inputPin: string): Promise<boolean> {
  const clean = String(inputPin || "").trim();
  if (!isValidAgeLockPin(clean)) return false;

  const storedHash = readSetting(AGE_LOCK_PIN_HASH_KEY);
  if (storedHash) {
    const computed = await hashPinSha256(clean);
    if (computed === storedHash) return true;
  }

  // Fallback for legacy plain-text PINs & automatic hash upgrade
  const legacyPlain = readSetting(AGE_LOCK_PIN_KEY);
  if (legacyPlain && clean === legacyPlain.trim()) {
    const upgradedHash = await hashPinSha256(clean);
    writeSetting(AGE_LOCK_PIN_HASH_KEY, upgradedHash, false);
    writeSetting(AGE_LOCK_PIN_SUFFIX_KEY, clean.slice(-4), false);
    return true;
  }

  return false;
}

const MAX_PIN_ATTEMPTS = 3;
const PIN_LOCKOUT_DURATION_MS = 30 * 1000;

export function getPinLockoutState(): PinLockoutState {
  if (typeof window === "undefined") {
    return {
      isLocked: false,
      remainingSeconds: 0,
      failedAttempts: 0,
      attemptsLeft: MAX_PIN_ATTEMPTS,
    };
  }
  const until = Number(sessionStorage.getItem(PIN_LOCKOUT_UNTIL_KEY) || 0);
  const failed = Number(sessionStorage.getItem(PIN_FAILED_COUNT_KEY) || 0);
  const now = Date.now();

  if (until > now) {
    return {
      isLocked: true,
      remainingSeconds: Math.ceil((until - now) / 1000),
      failedAttempts: failed,
      attemptsLeft: 0,
    };
  }

  if (until > 0 && until <= now) {
    sessionStorage.removeItem(PIN_LOCKOUT_UNTIL_KEY);
    sessionStorage.setItem(PIN_FAILED_COUNT_KEY, "0");
    return {
      isLocked: false,
      remainingSeconds: 0,
      failedAttempts: 0,
      attemptsLeft: MAX_PIN_ATTEMPTS,
    };
  }

  return {
    isLocked: false,
    remainingSeconds: 0,
    failedAttempts: failed,
    attemptsLeft: Math.max(0, MAX_PIN_ATTEMPTS - failed),
  };
}

export function recordPinFailure(): PinLockoutState {
  if (typeof window === "undefined") return getPinLockoutState();
  const nextFailed =
    Number(sessionStorage.getItem(PIN_FAILED_COUNT_KEY) || 0) + 1;
  sessionStorage.setItem(PIN_FAILED_COUNT_KEY, String(nextFailed));

  if (nextFailed >= MAX_PIN_ATTEMPTS) {
    sessionStorage.setItem(
      PIN_LOCKOUT_UNTIL_KEY,
      String(Date.now() + PIN_LOCKOUT_DURATION_MS)
    );
  }
  return getPinLockoutState();
}

export function resetPinFailures(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(PIN_FAILED_COUNT_KEY);
  sessionStorage.removeItem(PIN_LOCKOUT_UNTIL_KEY);
}

export function getKidsModeLocked(): boolean {
  return readSetting(KIDS_MODE_LOCKED_KEY) === "true";
}

export function setKidsModeLocked(locked: boolean): void {
  writeSetting(KIDS_MODE_LOCKED_KEY, String(locked), true);
  applyAllSettingsToDocument();
}

// ==========================================
// CORE APPEARANCE & PLAYBACK SETTINGS
// ==========================================

export function getSavedCardSize(): CardSize {
  const val = readSetting(CARD_SIZE_KEY);
  return val === "small" || val === "medium" || val === "large" ? val : "large";
}

export function saveCardSize(size: CardSize): void {
  writeSetting(CARD_SIZE_KEY, size, false);
}

export function getSavedTheme(): AppTheme {
  const saved = readSetting(THEME_KEY) as AppTheme | null;
  return saved && THEME_OPTIONS.includes(saved) ? saved : "violet";
}

export function applyThemeToDocument(theme: AppTheme): void {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", theme);
  }
}

export function saveTheme(theme: AppTheme): void {
  const safeTheme = THEME_OPTIONS.includes(theme) ? theme : "violet";
  writeSetting(THEME_KEY, safeTheme, false);
  applyThemeToDocument(safeTheme);
}

export function getThemeStyles(theme: AppTheme = "violet") {
  return APP_THEME_STYLES[theme] ?? APP_THEME_STYLES.violet;
}

export function getSavedStreamQuality(): StreamQuality {
  const val = readSetting(STREAM_QUALITY_KEY);
  if (val === "1080p" || val === "720p" || val === "480p" || val === "auto") {
    return val;
  }
  return "1080p";
}

export function saveStreamQuality(quality: StreamQuality): void {
  writeSetting(STREAM_QUALITY_KEY, quality, false);
}

export function getHelpfulMouse(): boolean {
  return readSetting(HELPFUL_MOUSE_KEY) === "true";
}

export function setHelpfulMouse(enabled: boolean): void {
  writeSetting(HELPFUL_MOUSE_KEY, String(enabled), true);
}

export function getHistoryOverscale(): HistoryScale {
  const val = readSetting(HISTORY_OVERSCALE_KEY);
  if (val === "off" || val === "20%" || val === "50%" || val === "80%") {
    return val;
  }
  return "off";
}

export function setHistoryOverscale(scale: HistoryScale): void {
  writeSetting(HISTORY_OVERSCALE_KEY, scale, true);
}

export function getLargeButtons(): boolean {
  return readSetting(LARGE_BUTTONS_KEY) === "true";
}

export function setLargeButtons(enabled: boolean): void {
  writeSetting(LARGE_BUTTONS_KEY, enabled ? "true" : "false", true);
}

export function getGlowIntensity(): GlowIntensity {
  const val = readSetting(GLOW_INTENSITY_KEY);
  if (val === "off" || val === "subtle" || val === "full") return val;
  return getHardwareLimits().effectiveMode === "low" ? "subtle" : "full";
}

export function setGlowIntensity(intensity: GlowIntensity): void {
  writeSetting(GLOW_INTENSITY_KEY, intensity, true);
  applyAllSettingsToDocument();
}

export function getDefaultPlayerVolume(): number {
  const raw = readSetting(DEFAULT_PLAYER_VOLUME_KEY);
  if (raw === null) return 0.85;
  const parsed = parseFloat(raw);
  if (isNaN(parsed)) return 0.85;
  return Math.max(0, Math.min(1, parsed));
}

export function setDefaultPlayerVolume(vol: number): void {
  const clamped = Math.max(0, Math.min(1, Math.round(vol * 100) / 100));
  writeSetting(DEFAULT_PLAYER_VOLUME_KEY, String(clamped), true);
}

// ==========================================
// POSTER CORNER, STYLE & INFO LAYOUT ENGINE
// ==========================================

export function getPosterShape(): PosterShape {
  const val = readSetting(POSTER_SHAPE_KEY);
  if (val === "sharp" || val === "rounded" || val === "extra") return val;
  return "rounded";
}

export function setPosterShape(shape: PosterShape): void {
  writeSetting(POSTER_SHAPE_KEY, shape, true);
  applyAllSettingsToDocument();
}

export function getPosterCardStyle(): PosterCardStyle {
  const val = readSetting(POSTER_CARD_STYLE_KEY);
  if (
    val === "crystal-glass" ||
    val === "neon-frame" ||
    val === "cinema-minimal" ||
    val === "theater-marquee" ||
    val === "collector-showcase"
  ) {
    return val;
  }
  return "crystal-glass";
}

export function setPosterCardStyle(style: PosterCardStyle): void {
  writeSetting(POSTER_CARD_STYLE_KEY, style, true);
  applyAllSettingsToDocument();
}

export function getPosterInfoLayout(): PosterInfoLayout {
  const val = readSetting(POSTER_INFO_LAYOUT_KEY);
  if (
    val === "overlay-bottom" ||
    val === "below-card" ||
    val === "hover-reveal" ||
    val === "clean-poster" ||
    val === "detailed-badges"
  ) {
    return val;
  }
  return "overlay-bottom";
}

export function setPosterInfoLayout(layout: PosterInfoLayout): void {
  writeSetting(POSTER_INFO_LAYOUT_KEY, layout, true);
  applyAllSettingsToDocument();
}

export function getShowPosterBadges(): boolean {
  const val = readSetting(SHOW_POSTER_BADGES_KEY);
  return val === null ? true : val === "true";
}

export function setShowPosterBadges(show: boolean): void {
  writeSetting(SHOW_POSTER_BADGES_KEY, String(show), true);
}

/**
 * Returns pre-computed Tailwind classes and layout flags for MediaCard components
 * based on the user's chosen Poster Corner Shape, Frame Style, Info Layout, and Theme.
 */
export function getPosterAppearanceClasses(
  theme: AppTheme = getSavedTheme()
): PosterAppearanceClasses {
  const shape = getPosterShape();
  const cardStyle = getPosterCardStyle();
  const infoLayout = getPosterInfoLayout();
  const showBadges = getShowPosterBadges();
  const glow = getGlowIntensity();

  const radiusClass =
    shape === "sharp"
      ? "rounded-sm"
      : shape === "extra"
        ? "rounded-3xl"
        : "rounded-2xl";

  const innerRadiusClass =
    shape === "sharp"
      ? "rounded-[2px]"
      : shape === "extra"
        ? "rounded-2xl"
        : "rounded-xl";

  const themeNeonMap: Record<AppTheme, string> = {
    violet:
      "border-violet-400/60 hover:border-cyan-400 shadow-[0_0_20px_rgba(139,92,246,0.35)] hover:shadow-[0_0_30px_rgba(56,189,248,0.55)]",
    red: "border-red-500/60 hover:border-amber-400 shadow-[0_0_20px_rgba(239,68,68,0.35)] hover:shadow-[0_0_30px_rgba(239,68,68,0.55)]",
    midnight:
      "border-sky-400/60 hover:border-cyan-300 shadow-[0_0_20px_rgba(56,189,248,0.35)] hover:shadow-[0_0_30px_rgba(56,189,248,0.55)]",
    emerald:
      "border-emerald-400/60 hover:border-teal-300 shadow-[0_0_20px_rgba(16,185,129,0.35)] hover:shadow-[0_0_30px_rgba(16,185,129,0.55)]",
    amber:
      "border-amber-400/60 hover:border-yellow-300 shadow-[0_0_20px_rgba(245,158,11,0.35)] hover:shadow-[0_0_30px_rgba(245,158,11,0.55)]",
    cyan: "border-cyan-400/60 hover:border-sky-300 shadow-[0_0_20px_rgba(34,211,238,0.35)] hover:shadow-[0_0_30px_rgba(34,211,238,0.55)]",
  };

  let cardFrameClass = "";
  switch (cardStyle) {
    case "neon-frame":
      cardFrameClass = `border-2 bg-slate-950/90 ${
        glow === "off"
          ? "border-white/30"
          : themeNeonMap[theme] || themeNeonMap.violet
      }`;
      break;
    case "cinema-minimal":
      cardFrameClass =
        "border border-transparent hover:border-white/25 bg-black shadow-lg";
      break;
    case "theater-marquee":
      cardFrameClass =
        "border border-white/15 hover:border-white/35 bg-slate-950/95 shadow-[0_14px_34px_rgba(0,0,0,0.85)]";
      break;
    case "collector-showcase":
      cardFrameClass =
        "p-1.5 border border-white/20 hover:border-white/45 bg-slate-950/85 backdrop-blur-md shadow-xl";
      break;
    case "crystal-glass":
    default:
      cardFrameClass =
        "border border-white/15 hover:border-white/40 bg-slate-950/80 backdrop-blur-md shadow-xl";
      break;
  }

  return {
    shape,
    cardStyle,
    infoLayout,
    showBadges,
    radiusClass,
    innerRadiusClass,
    cardFrameClass,
    showLaserBar: cardStyle === "theater-marquee",
  };
}

// ==========================================
// SCREENSAVER, SLEEP TIMER & CLOCK FORMAT
// ==========================================

export function getSavedScreensaverTimeout(): number {
  const val = readSetting(SCREENSAVER_TIMEOUT_KEY);
  const parsed = val ? Number(val) : NaN;
  return !isNaN(parsed) && parsed > 0 ? parsed : DEFAULT_SCREENSAVER_TIMEOUT;
}

export function saveScreensaverTimeout(timeoutMs: number): void {
  writeSetting(SCREENSAVER_TIMEOUT_KEY, String(timeoutMs), true);
}

export function getSleepTimerMinutes(): SleepTimerMinutes {
  const val = Number(readSetting(SLEEP_TIMER_KEY) || 0);
  if (val === 30 || val === 60 || val === 90 || val === 120) return val;
  return 0;
}

export function setSleepTimerMinutes(minutes: SleepTimerMinutes): void {
  writeSetting(SLEEP_TIMER_KEY, String(minutes), true);
}

export function getClockFormat(): ClockFormat {
  const val = readSetting(CLOCK_FORMAT_KEY);
  return val === "24h" ? "24h" : "12h";
}

export function setClockFormat(format: ClockFormat): void {
  writeSetting(CLOCK_FORMAT_KEY, format, true);
}

/**
 * Formats any timestamp/Date according to the user's 12h or 24h clock preference.
 */
export function formatAppTime(
  dateInput: Date | number = new Date(),
  format: ClockFormat = getClockFormat()
): string {
  const dateObj =
    dateInput instanceof Date ? dateInput : new Date(dateInput);
  return dateObj.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: format === "12h",
  });
}

// ==========================================
// HARDWARE RAM & PERFORMANCE ENGINE
// ==========================================

export function detectIsLowRamDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const devMem = (navigator as any).deviceMemory;
  if (typeof devMem === "number" && devMem <= 2) return true;

  const ua = (navigator.userAgent || "").toLowerCase();
  if (
    ua.includes("aft") || // Amazon Fire TV Stick models
    ua.includes("firetv") ||
    ua.includes("silk") ||
    ua.includes("android tv") ||
    ua.includes("nero")
  ) {
    return true;
  }
  return false;
}

export function getRamMode(): RamMode {
  const val = readSetting(RAM_MODE_KEY);
  if (val === "low" || val === "high" || val === "auto") return val;
  return detectIsLowRamDevice() ? "low" : "auto";
}

export function setRamMode(mode: RamMode): void {
  writeSetting(RAM_MODE_KEY, mode, true);
  if (typeof document !== "undefined") {
    const resolved =
      mode === "auto" ? (detectIsLowRamDevice() ? "low" : "high") : mode;
    document.documentElement.setAttribute("data-ram-mode", resolved);
    window.dispatchEvent(
      new CustomEvent("rabtv_ram_mode_updated", { detail: resolved })
    );
  }
}

export function getDataSaverMode(): boolean {
  return readSetting(DATA_SAVER_KEY) === "true";
}

export function setDataSaverMode(enabled: boolean): void {
  writeSetting(DATA_SAVER_KEY, String(enabled), true);
}

export function getAutoPlayNext(): boolean {
  const val = readSetting(AUTOPLAY_NEXT_KEY);
  return val === null ? true : val === "true";
}

export function setAutoPlayNext(enabled: boolean): void {
  writeSetting(AUTOPLAY_NEXT_KEY, String(enabled), true);
}

export function getHardwareLimits(): HardwareLimits {
  const mode = getRamMode();
  const isLow = mode === "low" || (mode === "auto" && detectIsLowRamDevice());
  const dataSaver = getDataSaverMode();

  if (isLow) {
    return {
      effectiveMode: "low",
      hlsMaxBufferSizeBytes: 15 * 1000 * 1000, // 15MB strict cap (anti-crash on 1-2GB sticks)
      hlsMaxBufferLengthSec: 6,
      hlsBackBufferLengthSec: 2,
      liveChannelsPerPage: 36,
      tmdbPosterSize: "w342", // ~45% less GPU texture RAM
      enableHeavyBlur: false,
      maxCachedHistoryItems: 35,
    };
  }

  return {
    effectiveMode: "high",
    hlsMaxBufferSizeBytes: 35 * 1000 * 1000, // 35MB smooth buffer
    hlsMaxBufferLengthSec: 15,
    hlsBackBufferLengthSec: 8,
    liveChannelsPerPage: 60,
    tmdbPosterSize: dataSaver ? "w342" : "w500",
    enableHeavyBlur: true,
    maxCachedHistoryItems: 60,
  };
}

export function getOptimalTmdbImageWidth(): "w342" | "w500" {
  return getHardwareLimits().tmdbPosterSize;
}

// ==========================================
// ELDER, TV, PROJECTOR & ACCESSIBILITY
// ==========================================

export function getTextScale(): TextScale {
  const val = readSetting(TEXT_SCALE_KEY);
  if (val === "normal" || val === "large" || val === "xl") return val;
  return "normal";
}

export function setTextScale(scale: TextScale): void {
  writeSetting(TEXT_SCALE_KEY, scale, true);
  applyAllSettingsToDocument();
}

export function getHighContrastFocus(): boolean {
  return readSetting(HIGH_CONTRAST_FOCUS_KEY) === "true";
}

export function setHighContrastFocus(enabled: boolean): void {
  writeSetting(HIGH_CONTRAST_FOCUS_KEY, String(enabled), true);
  applyAllSettingsToDocument();
}

export function getReducedMotion(): boolean {
  return readSetting(REDUCED_MOTION_KEY) === "true";
}

export function setReducedMotion(enabled: boolean): void {
  writeSetting(REDUCED_MOTION_KEY, String(enabled), true);
  applyAllSettingsToDocument();
}

export function getUiClickSounds(): boolean {
  return readSetting(UI_CLICK_SOUNDS_KEY) === "true";
}

export function setUiClickSounds(enabled: boolean): void {
  writeSetting(UI_CLICK_SOUNDS_KEY, String(enabled), true);
}

export function getCursorStyle(): CursorStyle {
  const val = readSetting(CURSOR_STYLE_KEY);
  if (val === "white" || val === "yellow" || val === "cyan" || val === "pink") {
    return val;
  }
  return "white";
}

export function setCursorStyle(style: CursorStyle): void {
  writeSetting(CURSOR_STYLE_KEY, style, true);
}

export function getCursorSvgDataUri(
  style: CursorStyle = getCursorStyle()
): string {
  const fillMap: Record<CursorStyle, string> = {
    white: "%23ffffff",
    yellow: "%23facc15",
    cyan: "%2322d3ee",
    pink: "%23f472b6",
  };
  const fill = fillMap[style] || "%23ffffff";
  return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='72' height='72' viewBox='0 0 24 24' fill='${fill}' stroke='%23000000' stroke-width='2'%3E%3Cpath d='M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z'/%3E%3C/svg%3E")`;
}

export function getTvOverscan(): TvOverscanPercent {
  const val = Number(readSetting(TV_OVERSCAN_KEY) || 0);
  if (val === 2 || val === 4 || val === 6) return val;
  return 0;
}

export function setTvOverscan(percent: TvOverscanPercent): void {
  writeSetting(TV_OVERSCAN_KEY, String(percent), true);
  applyAllSettingsToDocument();
}

export function getSubtitleSettings(): SubtitleSettings {
  const raw = readSetting(SUBTITLE_SETTINGS_KEY);
  const defaults: SubtitleSettings = {
    size: "normal",
    color: "white",
    bgOpacity: "medium",
  };
  if (!raw) return defaults;
  try {
    const parsed = JSON.parse(raw);
    return {
      size:
        parsed.size === "large" || parsed.size === "xl"
          ? parsed.size
          : "normal",
      color:
        parsed.color === "yellow" || parsed.color === "cyan"
          ? parsed.color
          : "white",
      bgOpacity:
        parsed.bgOpacity === "none" || parsed.bgOpacity === "solid"
          ? parsed.bgOpacity
          : "medium",
    };
  } catch {
    return defaults;
  }
}

export function saveSubtitleSettings(
  partial: Partial<SubtitleSettings>
): SubtitleSettings {
  const merged = { ...getSubtitleSettings(), ...partial };
  writeSetting(SUBTITLE_SETTINGS_KEY, JSON.stringify(merged), true);
  return merged;
}

export function getSeniorEasyMode(): boolean {
  return readSetting(SENIOR_EASY_MODE_KEY) === "true";
}

/**
 * One-tap Senior / Elder Easy Mode:
 * Uses `saveSettingsBatch` to enable large text, large buttons, high-visibility
 * yellow XL cursor, thick TV focus rings, steady reduced-motion UI, readable
 * below-poster layout, and gentle click sounds in a single redraw.
 */
export function applySeniorEasyPreset(enabled: boolean): void {
  saveSettingsBatch(() => {
    writeSetting(SENIOR_EASY_MODE_KEY, String(enabled), true);

    if (enabled) {
      writeSetting(TEXT_SCALE_KEY, "large", true);
      writeSetting(LARGE_BUTTONS_KEY, "true", true);
      writeSetting(HELPFUL_MOUSE_KEY, "true", true);
      writeSetting(CURSOR_STYLE_KEY, "yellow", true);
      writeSetting(HIGH_CONTRAST_FOCUS_KEY, "true", true);
      writeSetting(REDUCED_MOTION_KEY, "true", true);
      writeSetting(UI_CLICK_SOUNDS_KEY, "true", true);
      writeSetting(CARD_SIZE_KEY, "large", true);
      writeSetting(POSTER_INFO_LAYOUT_KEY, "below-card", true);
      saveSubtitleSettings({ size: "large", color: "yellow", bgOpacity: "solid" });
    } else {
      writeSetting(TEXT_SCALE_KEY, "normal", true);
      writeSetting(LARGE_BUTTONS_KEY, "false", true);
      writeSetting(HIGH_CONTRAST_FOCUS_KEY, "false", true);
      writeSetting(REDUCED_MOTION_KEY, "false", true);
    }
  });
}

// Zero-asset Web Audio gentle remote click feedback
let sharedAudioCtx: AudioContext | null = null;

export function playSoftUiClick(): void {
  if (typeof window === "undefined" || !getUiClickSounds()) return;
  try {
    const AudioCtx =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    if (!sharedAudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === "suspended") {
      void sharedAudioCtx.resume();
    }
    const osc = sharedAudioCtx.createOscillator();
    const gain = sharedAudioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(520, sharedAudioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(
      240,
      sharedAudioCtx.currentTime + 0.045
    );
    gain.gain.setValueAtTime(0.06, sharedAudioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      sharedAudioCtx.currentTime + 0.045
    );
    osc.connect(gain);
    gain.connect(sharedAudioCtx.destination);
    osc.start();
    osc.stop(sharedAudioCtx.currentTime + 0.05);
  } catch {
    // Ignore autoplay or Web Audio restrictions
  }
}

// ==========================================
// PINNED LIVE CHANNELS & PERSONALIZATIONS
// ==========================================

export function getFavoriteChannelIds(): string[] {
  const raw = readSetting(FAVORITE_CHANNELS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map((id) => String(id)).slice(0, MAX_FAVORITE_CHANNELS)
      : [];
  } catch {
    return [];
  }
}

export function isFavoriteChannel(channelId: string): boolean {
  if (!channelId) return false;
  return getFavoriteChannelIds().includes(String(channelId));
}

export function toggleFavoriteChannel(channelId: string): {
  favorites: string[];
  added: boolean;
  limitReached?: boolean;
} {
  const cleanId = String(channelId || "").trim();
  const current = getFavoriteChannelIds();
  if (!cleanId) return { favorites: current, added: false };

  if (current.includes(cleanId)) {
    const updated = current.filter((id) => id !== cleanId);
    writeSetting(FAVORITE_CHANNELS_KEY, JSON.stringify(updated), true);
    return { favorites: updated, added: false };
  }

  if (current.length >= MAX_FAVORITE_CHANNELS) {
    return { favorites: current, added: false, limitReached: true };
  }

  const updated = [cleanId, ...current];
  writeSetting(FAVORITE_CHANNELS_KEY, JSON.stringify(updated), true);
  return { favorites: updated, added: true };
}

export function getGreetingStyle(): GreetingStyle {
  const val = readSetting(GREETING_STYLE_KEY);
  if (
    val === "time-of-day" ||
    val === "rabbit" ||
    val === "cinema" ||
    val === "cozy" ||
    val === "classic"
  ) {
    return val;
  }
  return "time-of-day";
}

export function setGreetingStyle(style: GreetingStyle): void {
  writeSetting(GREETING_STYLE_KEY, style, true);
}

export function getPersonalizedGreeting(
  name: string,
  style: GreetingStyle = getGreetingStyle()
): string {
  const displayName = (name || "Friend").trim();
  switch (style) {
    case "rabbit":
      return `Hop on in, ${displayName}!`;
    case "cinema":
      return `Now Showing for ${displayName}`;
    case "cozy":
      return `Kick back & relax, ${displayName}`;
    case "classic":
      return `Welcome back, ${displayName}`;
    case "time-of-day":
    default: {
      const hour = new Date().getHours();
      if (hour < 12) return `Good morning, ${displayName}`;
      if (hour < 18) return `Good afternoon, ${displayName}`;
      return `Good evening, ${displayName}`;
    }
  }
}

export function getProfileMascot(): string {
  return readSetting(PROFILE_MASCOT_KEY) || "🐰";
}

export function setProfileMascot(emoji: string): void {
  writeSetting(PROFILE_MASCOT_KEY, emoji || "🐰", true);
}

export function getWarmEyeCare(): boolean {
  return readSetting(WARM_EYE_CARE_KEY) === "true";
}

export function setWarmEyeCare(enabled: boolean): void {
  writeSetting(WARM_EYE_CARE_KEY, String(enabled), true);
  applyAllSettingsToDocument();
}

export function getStartupTab(): StartupTab {
  const val = readSetting(STARTUP_TAB_KEY) as StartupTab | null;
  return val && STARTUP_TAB_OPTIONS.includes(val) ? val : "Home";
}

export function setStartupTab(tab: StartupTab): void {
  writeSetting(STARTUP_TAB_KEY, tab, true);
}

export function getShowCornerClock(): boolean {
  return readSetting(SHOW_CORNER_CLOCK_KEY) === "true";
}

export function setShowCornerClock(enabled: boolean): void {
  writeSetting(SHOW_CORNER_CLOCK_KEY, String(enabled), true);
}

/**
 * Applies all visual, poster, TV safe-zone, accessibility, and RAM flags
 * to `<html>` in a single DOM pass.
 */
export function applyAllSettingsToDocument(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const limits = getHardwareLimits();
  const overscan = getTvOverscan();

  root.setAttribute("data-theme", getSavedTheme());
  root.setAttribute("data-ram-mode", limits.effectiveMode);
  root.setAttribute("data-glow-intensity", getGlowIntensity());
  root.setAttribute("data-text-scale", getTextScale());
  root.setAttribute(
    "data-high-contrast-focus",
    getHighContrastFocus() ? "true" : "false"
  );
  root.setAttribute(
    "data-reduced-motion",
    getReducedMotion() ? "true" : "false"
  );
  root.setAttribute("data-eye-care", getWarmEyeCare() ? "true" : "false");
  root.setAttribute("data-tv-overscan", String(overscan));
  root.style.setProperty("--rabtv-overscan", `${overscan}%`);
  root.setAttribute("data-poster-shape", getPosterShape());
  root.setAttribute("data-poster-style", getPosterCardStyle());
  root.setAttribute("data-poster-layout", getPosterInfoLayout());
  root.setAttribute("data-kids-locked", getKidsModeLocked() ? "true" : "false");
}

// ==========================================
// AGE TIER & RATING VERIFICATION HELPERS
// ==========================================

export function getSavedUserAge(): number {
  const saved = readSetting(USER_AGE_KEY);
  if (!saved) return 18;
  const parsed = parseInt(saved, 10);
  return isNaN(parsed) ? 18 : parsed;
}

export function saveUserAge(age: number): void {
  const validAge = Math.max(1, Math.min(120, Math.floor(age)));
  writeSetting(USER_AGE_KEY, String(validAge), true);
}

export function sanitizeTMDBId(rawId: string | number): string {
  if (!rawId) return "";
  return String(rawId).replace(/^(movie|tv)-/i, "").trim();
}

export function isAllowedForAge(
  rating?: string | number | null,
  genreOrAge?: string | number | null,
  userAge?: number
): boolean {
  let resolvedGenre = "";
  let resolvedUserAge = userAge ?? getSavedUserAge();

  if (typeof genreOrAge === "number") {
    resolvedUserAge = genreOrAge;
  } else if (typeof genreOrAge === "string") {
    resolvedGenre = genreOrAge;
  }

  // If Kids Mode Lock is actively engaged, cap content at under-13 even for adult profiles
  if (getKidsModeLocked()) {
    resolvedUserAge = Math.min(resolvedUserAge, 12);
  }

  // Ages 16+ have full unlocked access to all media including Rated R
  if (resolvedUserAge >= 16) return true;

  if (typeof rating === "number") {
    return resolvedUserAge >= rating;
  }

  const cleanRating = (rating || "").trim().toUpperCase();
  const cleanGenre = resolvedGenre.trim().toLowerCase();

  // Explicit adult ratings are strictly blocked for under 16
  if (
    ["R", "NC-17", "TV-MA", "UNRATED", "NR", "18+"].includes(cleanRating) ||
    cleanRating.includes("18+") ||
    cleanRating.includes("NC-17") ||
    cleanRating.includes("TV-MA")
  ) {
    return false;
  }

  // If list summary lacks explicit MPAA rating, fallback to safe genre checks for kids
  if (!cleanRating) {
    if (resolvedUserAge < 9) {
      return (
        cleanGenre.includes("animation") ||
        cleanGenre.includes("family") ||
        cleanGenre.includes("kids")
      );
    }
    if (resolvedUserAge < 13) {
      return (
        !cleanGenre.includes("horror") &&
        !cleanGenre.includes("thriller") &&
        !cleanGenre.includes("crime")
      );
    }
    return true;
  }

  // Tier 1: Ages 0 - 8 (G, TV-Y, TV-G)
  if (resolvedUserAge < 9) {
    return ["G", "TV-Y", "TV-G"].includes(cleanRating);
  }

  // Tier 2: Ages 9 - 12 (G, PG, TV-Y, TV-Y7, TV-G, TV-PG)
  if (resolvedUserAge < 13) {
    return ["G", "PG", "TV-Y", "TV-Y7", "TV-G", "TV-PG"].includes(cleanRating);
  }

  // Tier 3: Ages 13 - 15 (G, PG, PG-13, TV-Y, TV-Y7, TV-G, TV-PG, TV-14)
  if (resolvedUserAge < 16) {
    return [
      "G",
      "PG",
      "PG-13",
      "TV-Y",
      "TV-Y7",
      "TV-G",
      "TV-PG",
      "TV-14",
    ].includes(cleanRating);
  }

  return false;
}

// ==========================================
// POSTER DIMENSIONS, SAFE RESET & BACKUPS
// ==========================================

export function getPosterDimensions(size: CardSize) {
  switch (size) {
    case "small":
      return {
        card: "w-[85px] min-w-[85px] h-[125px]",
        image: "w-full h-full object-cover",
        isSmall: true,
      };
    case "medium":
      return {
        card: "w-[160px] min-w-[160px] h-[240px]",
        image: "w-full h-[160px] object-cover",
        text: "text-xs",
        isSmall: false,
      };
    case "large":
    default:
      return {
        card: "w-[280px] min-w-[280px] h-[420px]",
        image: "w-full h-[300px] object-cover",
        text: "text-sm",
        isSmall: false,
      };
  }
}

/**
 * Resets ONLY visual, layout, and accessibility settings back to clean defaults.
 * Strictly preserves License status, Age-Lock PIN, User Age, Profile Name, and Watch History.
 */
export function resetVisualSettings(): void {
  saveSettingsBatch(() => {
    writeSetting(THEME_KEY, "violet", true);
    writeSetting(CARD_SIZE_KEY, "large", true);
    writeSetting(HISTORY_OVERSCALE_KEY, "off", true);
    writeSetting(LARGE_BUTTONS_KEY, "false", true);
    writeSetting(HELPFUL_MOUSE_KEY, "false", true);
    writeSetting(CURSOR_STYLE_KEY, "white", true);
    writeSetting(TEXT_SCALE_KEY, "normal", true);
    writeSetting(HIGH_CONTRAST_FOCUS_KEY, "false", true);
    writeSetting(REDUCED_MOTION_KEY, "false", true);
    writeSetting(SENIOR_EASY_MODE_KEY, "false", true);
    writeSetting(WARM_EYE_CARE_KEY, "false", true);
    writeSetting(TV_OVERSCAN_KEY, "0", true);
    writeSetting(GLOW_INTENSITY_KEY, "full", true);
    writeSetting(POSTER_SHAPE_KEY, "rounded", true);
    writeSetting(POSTER_CARD_STYLE_KEY, "crystal-glass", true);
    writeSetting(POSTER_INFO_LAYOUT_KEY, "overlay-bottom", true);
    writeSetting(SHOW_POSTER_BADGES_KEY, "true", true);
  });
}

/**
 * Exports a clean snapshot of all user preferences for backup JSON files.
 * Never exports sensitive PIN hashes or admin flags.
 */
export function exportAllSettingsSnapshot() {
  return {
    cardSize: getSavedCardSize(),
    streamQuality: getSavedStreamQuality(),
    appTheme: getSavedTheme(),
    helpfulMouse: getHelpfulMouse(),
    cursorStyle: getCursorStyle(),
    historyOverscale: getHistoryOverscale(),
    largeButtons: getLargeButtons(),
    screensaverTimeoutMs: getSavedScreensaverTimeout(),
    sleepTimerMinutes: getSleepTimerMinutes(),
    clockFormat: getClockFormat(),
    ramMode: getRamMode(),
    dataSaverMode: getDataSaverMode(),
    autoPlayNext: getAutoPlayNext(),
    glowIntensity: getGlowIntensity(),
    defaultPlayerVolume: getDefaultPlayerVolume(),
    textScale: getTextScale(),
    highContrastFocus: getHighContrastFocus(),
    reducedMotion: getReducedMotion(),
    uiClickSounds: getUiClickSounds(),
    seniorEasyMode: getSeniorEasyMode(),
    tvOverscan: getTvOverscan(),
    subtitles: getSubtitleSettings(),
    posterShape: getPosterShape(),
    posterCardStyle: getPosterCardStyle(),
    posterInfoLayout: getPosterInfoLayout(),
    showPosterBadges: getShowPosterBadges(),
    favoriteChannelIds: getFavoriteChannelIds(),
    greetingStyle: getGreetingStyle(),
    profileMascot: getProfileMascot(),
    warmEyeCare: getWarmEyeCare(),
    startupTab: getStartupTab(),
    showCornerClock: getShowCornerClock(),
    userAge: getSavedUserAge(),
  };
}

/**
 * Strictly validates and imports settings from a restored JSON backup.
 * Ignores unknown fields and blocks any attempt to inject admin or license flags.
 */
export function importSettingsSnapshot(
  raw: unknown
): { appliedCount: number; valid: boolean } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { appliedCount: 0, valid: false };
  }

  const data = raw as Record<string, unknown>;
  let appliedCount = 0;

  saveSettingsBatch(() => {
    if (
      data.cardSize === "small" ||
      data.cardSize === "medium" ||
      data.cardSize === "large"
    ) {
      writeSetting(CARD_SIZE_KEY, data.cardSize, true);
      appliedCount++;
    }

    if (
      data.streamQuality === "1080p" ||
      data.streamQuality === "720p" ||
      data.streamQuality === "480p" ||
      data.streamQuality === "auto"
    ) {
      writeSetting(STREAM_QUALITY_KEY, data.streamQuality, true);
      appliedCount++;
    }

    if (
      typeof data.appTheme === "string" &&
      THEME_OPTIONS.includes(data.appTheme as AppTheme)
    ) {
      writeSetting(THEME_KEY, data.appTheme, true);
      appliedCount++;
    }

    if (typeof data.helpfulMouse === "boolean") {
      writeSetting(HELPFUL_MOUSE_KEY, String(data.helpfulMouse), true);
      appliedCount++;
    }

    if (
      data.cursorStyle === "white" ||
      data.cursorStyle === "yellow" ||
      data.cursorStyle === "cyan" ||
      data.cursorStyle === "pink"
    ) {
      writeSetting(CURSOR_STYLE_KEY, data.cursorStyle, true);
      appliedCount++;
    }

    if (
      data.historyOverscale === "off" ||
      data.historyOverscale === "20%" ||
      data.historyOverscale === "50%" ||
      data.historyOverscale === "80%"
    ) {
      writeSetting(HISTORY_OVERSCALE_KEY, data.historyOverscale, true);
      appliedCount++;
    }

    if (typeof data.largeButtons === "boolean") {
      writeSetting(LARGE_BUTTONS_KEY, String(data.largeButtons), true);
      appliedCount++;
    }

    if (
      typeof data.screensaverTimeoutMs === "number" &&
      data.screensaverTimeoutMs >= 60_000 &&
      data.screensaverTimeoutMs <= 12 * 60 * 60 * 1000
    ) {
      writeSetting(
        SCREENSAVER_TIMEOUT_KEY,
        String(data.screensaverTimeoutMs),
        true
      );
      appliedCount++;
    }

    if (
      data.sleepTimerMinutes === 0 ||
      data.sleepTimerMinutes === 30 ||
      data.sleepTimerMinutes === 60 ||
      data.sleepTimerMinutes === 90 ||
      data.sleepTimerMinutes === 120
    ) {
      writeSetting(SLEEP_TIMER_KEY, String(data.sleepTimerMinutes), true);
      appliedCount++;
    }

    if (data.clockFormat === "12h" || data.clockFormat === "24h") {
      writeSetting(CLOCK_FORMAT_KEY, data.clockFormat, true);
      appliedCount++;
    }

    if (
      data.ramMode === "auto" ||
      data.ramMode === "low" ||
      data.ramMode === "high"
    ) {
      writeSetting(RAM_MODE_KEY, data.ramMode, true);
      appliedCount++;
    }

    if (typeof data.dataSaverMode === "boolean") {
      writeSetting(DATA_SAVER_KEY, String(data.dataSaverMode), true);
      appliedCount++;
    }

    if (typeof data.autoPlayNext === "boolean") {
      writeSetting(AUTOPLAY_NEXT_KEY, String(data.autoPlayNext), true);
      appliedCount++;
    }

    if (
      data.glowIntensity === "off" ||
      data.glowIntensity === "subtle" ||
      data.glowIntensity === "full"
    ) {
      writeSetting(GLOW_INTENSITY_KEY, data.glowIntensity, true);
      appliedCount++;
    }

    if (
      typeof data.defaultPlayerVolume === "number" &&
      data.defaultPlayerVolume >= 0 &&
      data.defaultPlayerVolume <= 1
    ) {
      writeSetting(
        DEFAULT_PLAYER_VOLUME_KEY,
        String(data.defaultPlayerVolume),
        true
      );
      appliedCount++;
    }

    if (
      data.textScale === "normal" ||
      data.textScale === "large" ||
      data.textScale === "xl"
    ) {
      writeSetting(TEXT_SCALE_KEY, data.textScale, true);
      appliedCount++;
    }

    if (typeof data.highContrastFocus === "boolean") {
      writeSetting(
        HIGH_CONTRAST_FOCUS_KEY,
        String(data.highContrastFocus),
        true
      );
      appliedCount++;
    }

    if (typeof data.reducedMotion === "boolean") {
      writeSetting(REDUCED_MOTION_KEY, String(data.reducedMotion), true);
      appliedCount++;
    }

    if (typeof data.uiClickSounds === "boolean") {
      writeSetting(UI_CLICK_SOUNDS_KEY, String(data.uiClickSounds), true);
      appliedCount++;
    }

    if (typeof data.seniorEasyMode === "boolean") {
      writeSetting(SENIOR_EASY_MODE_KEY, String(data.seniorEasyMode), true);
      appliedCount++;
    }

    if (
      data.tvOverscan === 0 ||
      data.tvOverscan === 2 ||
      data.tvOverscan === 4 ||
      data.tvOverscan === 6
    ) {
      writeSetting(TV_OVERSCAN_KEY, String(data.tvOverscan), true);
      appliedCount++;
    }

    if (data.subtitles && typeof data.subtitles === "object") {
      saveSubtitleSettings(data.subtitles as Partial<SubtitleSettings>);
      appliedCount++;
    }

    if (
      data.posterShape === "sharp" ||
      data.posterShape === "rounded" ||
      data.posterShape === "extra"
    ) {
      writeSetting(POSTER_SHAPE_KEY, data.posterShape, true);
      appliedCount++;
    }

    if (
      data.posterCardStyle === "crystal-glass" ||
      data.posterCardStyle === "neon-frame" ||
      data.posterCardStyle === "cinema-minimal" ||
      data.posterCardStyle === "theater-marquee" ||
      data.posterCardStyle === "collector-showcase"
    ) {
      writeSetting(POSTER_CARD_STYLE_KEY, data.posterCardStyle, true);
      appliedCount++;
    }

    if (
      data.posterInfoLayout === "overlay-bottom" ||
      data.posterInfoLayout === "below-card" ||
      data.posterInfoLayout === "hover-reveal" ||
      data.posterInfoLayout === "clean-poster" ||
      data.posterInfoLayout === "detailed-badges"
    ) {
      writeSetting(POSTER_INFO_LAYOUT_KEY, data.posterInfoLayout, true);
      appliedCount++;
    }

    if (typeof data.showPosterBadges === "boolean") {
      writeSetting(SHOW_POSTER_BADGES_KEY, String(data.showPosterBadges), true);
      appliedCount++;
    }

    if (Array.isArray(data.favoriteChannelIds)) {
      const safeIds = data.favoriteChannelIds
        .filter((x) => typeof x === "string" && x.trim().length > 0)
        .slice(0, MAX_FAVORITE_CHANNELS);
      writeSetting(FAVORITE_CHANNELS_KEY, JSON.stringify(safeIds), true);
      appliedCount++;
    }

    if (
      data.greetingStyle === "time-of-day" ||
      data.greetingStyle === "rabbit" ||
      data.greetingStyle === "cinema" ||
      data.greetingStyle === "cozy" ||
      data.greetingStyle === "classic"
    ) {
      writeSetting(GREETING_STYLE_KEY, data.greetingStyle, true);
      appliedCount++;
    }

    if (
      typeof data.profileMascot === "string" &&
      data.profileMascot.length <= 4
    ) {
      writeSetting(PROFILE_MASCOT_KEY, data.profileMascot, true);
      appliedCount++;
    }

    if (typeof data.warmEyeCare === "boolean") {
      writeSetting(WARM_EYE_CARE_KEY, String(data.warmEyeCare), true);
      appliedCount++;
    }

    if (
      typeof data.startupTab === "string" &&
      STARTUP_TAB_OPTIONS.includes(data.startupTab as StartupTab)
    ) {
      writeSetting(STARTUP_TAB_KEY, data.startupTab, true);
      appliedCount++;
    }

    if (typeof data.showCornerClock === "boolean") {
      writeSetting(SHOW_CORNER_CLOCK_KEY, String(data.showCornerClock), true);
      appliedCount++;
    }

    if (
      typeof data.userAge === "number" &&
      data.userAge >= 1 &&
      data.userAge <= 120
    ) {
      writeSetting(USER_AGE_KEY, String(Math.floor(data.userAge)), true);
      appliedCount++;
    }
  });

  return { appliedCount, valid: appliedCount > 0 };
}
