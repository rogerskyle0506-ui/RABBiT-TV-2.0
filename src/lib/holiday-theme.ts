// src/lib/holiday-theme.ts

export type Holiday = "halloween" | "christmas" | "valentines" | "newyear" | null;
export type ActiveHolidayKey = Exclude<Holiday, null>;
export type HolidayOverrideMode = "auto" | "off" | ActiveHolidayKey;

export interface HolidayThemeMeta {
  id: ActiveHolidayKey;
  name: string;
  icon: string;
  greeting: string;
  shortBadge: string;
  recommendedAppTheme: "red" | "amber" | "cyan" | "violet";
  radioCategory: string;
  accentGradient: string;
  borderClass: string;
  badgeClass: string;
  dateWindowLabel: string;
}

export interface UpcomingHolidayInfo {
  holiday: ActiveHolidayKey;
  meta: HolidayThemeMeta;
  daysUntil: number;
  startsOn: Date;
}

const HOLIDAY_ENABLED_KEY = "rabtv_holiday_effects_enabled_v1";
const HOLIDAY_OVERRIDE_KEY = "rabtv_holiday_preview_override_v1";

const VALID_OVERRIDES = new Set<HolidayOverrideMode>([
  "auto",
  "off",
  "halloween",
  "christmas",
  "valentines",
  "newyear",
]);

// Fast in-memory cache to avoid repeated localStorage reads on 1–2GB sticks
let enabledCache: boolean | null = null;
let overrideCache: HolidayOverrideMode | null = null;

function invalidateHolidayCache() {
  enabledCache = null;
  overrideCache = null;
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (
      !e.key ||
      e.key === HOLIDAY_ENABLED_KEY ||
      e.key === HOLIDAY_OVERRIDE_KEY
    ) {
      invalidateHolidayCache();
    }
  });
}

export const HOLIDAY_THEMES: Record<ActiveHolidayKey, HolidayThemeMeta> = {
  halloween: {
    id: "halloween",
    name: "Halloween Edition",
    icon: "🎃",
    greeting: "Spooky Cinema Nights",
    shortBadge: "🎃 Spooky Mode",
    recommendedAppTheme: "amber",
    radioCategory: "Halloween",
    accentGradient: "from-amber-500 via-orange-600 to-purple-700",
    borderClass: "border-orange-500/45",
    badgeClass: "bg-orange-950/80 border-orange-400/40 text-amber-300",
    dateWindowLabel: "Oct 17 – Nov 1",
  },
  christmas: {
    id: "christmas",
    name: "Winter Crystal Edition",
    icon: "❄️",
    greeting: "Happy Holidays on RABBiT TV",
    shortBadge: "❄️ Holiday Mode",
    recommendedAppTheme: "cyan",
    radioCategory: "Christmas",
    accentGradient: "from-sky-400 via-cyan-300 to-red-500",
    borderClass: "border-sky-400/45",
    badgeClass: "bg-sky-950/80 border-sky-400/40 text-sky-200",
    dateWindowLabel: "Dec 10 – Dec 28",
  },
  newyear: {
    id: "newyear",
    name: "Champagne Gala Edition",
    icon: "✨",
    greeting: "Happy New Year!",
    shortBadge: "✨ New Year Gala",
    recommendedAppTheme: "amber",
    radioCategory: "2000s",
    accentGradient: "from-yellow-300 via-amber-400 to-orange-500",
    borderClass: "border-amber-400/50",
    badgeClass: "bg-amber-950/80 border-amber-400/45 text-amber-200",
    dateWindowLabel: "Dec 30 – Jan 2",
  },
  valentines: {
    id: "valentines",
    name: "Ruby Velvet Edition",
    icon: "💎",
    greeting: "Date Night Cinema",
    shortBadge: "💎 Valentine Mode",
    recommendedAppTheme: "red",
    radioCategory: "Valentine's",
    accentGradient: "from-rose-400 via-pink-500 to-red-600",
    borderClass: "border-rose-400/45",
    badgeClass: "bg-rose-950/80 border-rose-400/40 text-rose-200",
    dateWindowLabel: "Feb 7 – Feb 16",
  },
};

function notifyHolidayChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("rabtv_holiday_updated"));
  window.dispatchEvent(new Event("rabtv_settings_updated"));
}

/**
 * Returns whether seasonal holiday overlays are enabled by the user (default: true).
 */
export function getHolidayEffectsEnabled(): boolean {
  if (typeof window === "undefined") return true;
  if (enabledCache !== null) return enabledCache;
  try {
    const saved = localStorage.getItem(HOLIDAY_ENABLED_KEY);
    enabledCache = saved !== "false";
    return enabledCache;
  } catch {
    return true;
  }
}

/**
 * Enables or disables seasonal overlays cleanly across the app.
 */
export function setHolidayEffectsEnabled(enabled: boolean): void {
  enabledCache = Boolean(enabled);
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(HOLIDAY_ENABLED_KEY, enabledCache ? "true" : "false");
  } catch {
    // ignore storage quota errors
  }
  notifyHolidayChange();
}

/**
 * Reads any manual holiday preview override ("auto" | "off" | specific holiday).
 */
export function getHolidayPreviewOverride(): HolidayOverrideMode {
  if (typeof window === "undefined") return "auto";
  if (overrideCache !== null) return overrideCache;
  try {
    const raw = (
      localStorage.getItem(HOLIDAY_OVERRIDE_KEY) || "auto"
    ).trim() as HolidayOverrideMode;
    overrideCache = VALID_OVERRIDES.has(raw) ? raw : "auto";
    return overrideCache;
  } catch {
    return "auto";
  }
}

/**
 * Sets a manual holiday preview mode (useful for testing 3D overlays any day of the year).
 */
export function setHolidayPreviewOverride(mode: HolidayOverrideMode): void {
  const safeMode: HolidayOverrideMode = VALID_OVERRIDES.has(mode)
    ? mode
    : "auto";
  overrideCache = safeMode;
  if (typeof window === "undefined") return;
  try {
    if (safeMode === "auto") {
      localStorage.removeItem(HOLIDAY_OVERRIDE_KEY);
    } else {
      localStorage.setItem(HOLIDAY_OVERRIDE_KEY, safeMode);
    }
  } catch {
    // ignore storage quota errors
  }
  notifyHolidayChange();
}

/**
 * Pure calendar check (ignores user toggle/override) aligned with seasonal lobby radio.
 */
export function getCalendarHoliday(date: Date = new Date()): Holiday {
  const month = date.getMonth() + 1; // 1–12
  const day = date.getDate();

  // New Year's Gala: Dec 30 – Jan 2
  if ((month === 12 && day >= 30) || (month === 1 && day <= 2)) {
    return "newyear";
  }

  // Valentine's: Feb 7 – Feb 16
  if (month === 2 && day >= 7 && day <= 16) {
    return "valentines";
  }

  // Halloween: Oct 17 – Nov 1
  if ((month === 10 && day >= 17 && day <= 31) || (month === 11 && day === 1)) {
    return "halloween";
  }

  // Christmas: Dec 10 – Dec 28
  if (month === 12 && day >= 10 && day <= 28) {
    return "christmas";
  }

  return null;
}

/**
 * Returns the active holiday, respecting user enable toggle and preview overrides.
 */
export function getActiveHoliday(date: Date = new Date()): Holiday {
  const override = getHolidayPreviewOverride();
  if (override === "off") return null;
  if (override !== "auto") return override;

  if (!getHolidayEffectsEnabled()) return null;
  return getCalendarHoliday(date);
}

/**
 * Checks whether a specific holiday window is currently active.
 */
export function isHolidayWindowActive(
  holiday: ActiveHolidayKey,
  date: Date = new Date()
): boolean {
  return getActiveHoliday(date) === holiday;
}

/**
 * Returns rich visual & radio metadata for the active (or specified) holiday.
 */
export function getHolidayMeta(holiday: Holiday): HolidayThemeMeta | null {
  if (!holiday) return null;
  return HOLIDAY_THEMES[holiday] || null;
}

/**
 * Returns the next upcoming holiday and days remaining (great for banners & screensaver).
 */
export function getNextUpcomingHoliday(
  fromDate: Date = new Date()
): UpcomingHolidayInfo {
  const year = fromDate.getFullYear();
  const todayMidnight = new Date(
    year,
    fromDate.getMonth(),
    fromDate.getDate()
  ).getTime();

  const schedule: { holiday: ActiveHolidayKey; month: number; day: number }[] = [
    { holiday: "valentines", month: 2, day: 7 },
    { holiday: "halloween", month: 10, day: 17 },
    { holiday: "christmas", month: 12, day: 10 },
    { holiday: "newyear", month: 12, day: 30 },
  ];

  let best: UpcomingHolidayInfo | null = null;

  for (const item of schedule) {
    let target = new Date(year, item.month - 1, item.day);
    if (target.getTime() < todayMidnight) {
      target = new Date(year + 1, item.month - 1, item.day);
    }
    const diffDays = Math.ceil(
      (target.getTime() - todayMidnight) / (24 * 60 * 60 * 1000)
    );
    if (!best || diffDays < best.daysUntil) {
      best = {
        holiday: item.holiday,
        meta: HOLIDAY_THEMES[item.holiday],
        daysUntil: Math.max(0, diffDays),
        startsOn: target,
      };
    }
  }

  return best!;
}

/**
 * List of selectable options for future Sidebar / Admin preview pickers.
 */
export function getAllHolidayOptions(): {
  id: HolidayOverrideMode;
  label: string;
}[] {
  return [
    { id: "auto", label: "✨ Auto (Calendar)" },
    { id: "off", label: "🚫 Off" },
    { id: "christmas", label: "❄️ Christmas" },
    { id: "newyear", label: "🥂 New Year's" },
    { id: "valentines", label: "💎 Valentine's" },
    { id: "halloween", label: "🎃 Halloween" },
  ];
}
