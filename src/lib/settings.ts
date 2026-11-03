export type CardSize = "small" | "medium" | "large";
export type StreamQuality = "1080p" | "720p" | "480p" | "auto";
export type AppTheme = "violet" | "red" | "midnight" | "emerald" | "amber" | "cyan";
export type HistoryScale = "off" | "20%" | "50%" | "80%";

export const DISCLAIMER_ACCEPTED_KEY = "rabtv_disclaimer_accepted";
export const CARD_SIZE_KEY = "rabtv_card_size";
export const STREAM_QUALITY_KEY = "rabtv_stream_quality";
export const THEME_KEY = "rabtv_app_theme";
export const HELPFUL_MOUSE_KEY = "rabtv_helpful_mouse";

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

export function getSavedCardSize(): CardSize {
  if (typeof window === "undefined") return "large";
  return (localStorage.getItem(CARD_SIZE_KEY) as CardSize) || "large";
}

export function saveCardSize(size: CardSize) {
  if (typeof window !== "undefined") {
    localStorage.setItem(CARD_SIZE_KEY, size);
  }
}

export function getSavedStreamQuality(): StreamQuality {
  if (typeof window === "undefined") return "1080p";
  return (localStorage.getItem(STREAM_QUALITY_KEY) as StreamQuality) || "1080p";
}

export function saveStreamQuality(quality: StreamQuality) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STREAM_QUALITY_KEY, quality);
  }
}

export function getSavedTheme(): AppTheme {
  if (typeof window === "undefined") return "violet";
  const saved = localStorage.getItem(THEME_KEY) as AppTheme | null;
  return THEME_OPTIONS.includes(saved as AppTheme) ? (saved as AppTheme) : "violet";
}

export function applyThemeToDocument(theme: AppTheme): void {
  if (typeof window !== "undefined") {
    document.documentElement.setAttribute("data-theme", theme);
  }
}

export function saveTheme(theme: AppTheme) {
  if (typeof window !== "undefined") {
    localStorage.setItem(THEME_KEY, theme);
    applyThemeToDocument(theme);
    window.dispatchEvent(new Event("rabtv_settings_updated"));
  }
}

export function getThemeStyles(theme: AppTheme = "violet") {
  return APP_THEME_STYLES[theme] ?? APP_THEME_STYLES.violet;
}

export function getHelpfulMouse(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(HELPFUL_MOUSE_KEY) === "true";
}

export function setHelpfulMouse(enabled: boolean) {
  if (typeof window !== "undefined") {
    localStorage.setItem(HELPFUL_MOUSE_KEY, String(enabled));
    window.dispatchEvent(new Event("rabtv_settings_updated"));
  }
}

export function getSavedUserAge(): number {
  if (typeof window === "undefined") return 0;
  const raw = localStorage.getItem("rabtv_user_age");
  return raw ? parseInt(raw, 10) || 0 : 0;
}

export function saveUserAge(age: number): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("rabtv_user_age", String(age));
  }
}

export function isAllowedForAge(contentAgeRating?: string | number, userAge?: number): boolean {
  const currentAge = userAge ?? getSavedUserAge();
  if (!currentAge || currentAge >= 18) return true;

  if (typeof contentAgeRating === "number") {
    return currentAge >= contentAgeRating;
  }

  if (typeof contentAgeRating === "string") {
    const cleanRating = contentAgeRating.toUpperCase().trim();
    if (cleanRating.includes("18+") || cleanRating.includes("NC-17") || cleanRating.includes("R")) {
      return currentAge >= 18;
    }
    if (cleanRating.includes("16+") || cleanRating.includes("TV-MA")) {
      return currentAge >= 16;
    }
    if (cleanRating.includes("13+") || cleanRating.includes("PG-13") || cleanRating.includes("TV-14")) {
      return currentAge >= 13;
    }
  }

  return true;
}

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

export function getHistoryOverscale(): HistoryScale {
  if (typeof window === "undefined") return "off";
  return (localStorage.getItem("rabtv_history_overscale") as HistoryScale) || "off";
}

export function setHistoryOverscale(scale: HistoryScale): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("rabtv_history_overscale", scale);
  }
}

export function getLargeButtons(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("rabtv_large_buttons") === "true";
}

export function setLargeButtons(enabled: boolean): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("rabtv_large_buttons", enabled ? "true" : "false");
  }
}
