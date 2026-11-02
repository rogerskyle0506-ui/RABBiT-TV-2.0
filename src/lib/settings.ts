export type AppTheme = "violet" | "red" | "midnight" | "emerald" | "amber" | "cyan";

export const DISCLAIMER_ACCEPTED_KEY = "rabtv_disclaimer_accepted";
export const CARD_SIZE_KEY = "rabtv_card_size";
export const STREAM_QUALITY_KEY = "rabtv_stream_quality";
export const THEME_KEY = "rabtv_app_theme";
export const HELPFUL_MOUSE_KEY = "rabtv_helpful_mouse";
export const WALLPAPER_URL_KEY = "rabtv_wallpaper_url";
export const DEFAULT_WALLPAPER_URL = "https://i.postimg.cc/y6r1Fv8k/grok-image-1793587579614.jpg";

export const THEME_PRESETS: Record<
  AppTheme,
  {
    background: string;
    panel: string;
    accent: string;
    primaryButton: string;
    glow: string;
  }
> = {
  violet: {
    background: "#050b16",
    panel: "#090e1f",
    accent: "#a855f7",
    primaryButton: "bg-violet-600 hover:bg-violet-500 shadow-violet-600/40",
    glow: "shadow-violet-600/30",
  },
  red: {
    background: "#120202",
    panel: "#160404",
    accent: "#f87171",
    primaryButton: "bg-red-600 hover:bg-red-500 shadow-red-600/40",
    glow: "shadow-red-600/30",
  },
  midnight: {
    background: "#020617",
    panel: "#03091e",
    accent: "#60a5fa",
    primaryButton: "bg-blue-600 hover:bg-blue-500 shadow-blue-600/40",
    glow: "shadow-blue-600/30",
  },
  emerald: {
    background: "#02140d",
    panel: "#031b13",
    accent: "#34d399",
    primaryButton: "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/40",
    glow: "shadow-emerald-600/30",
  },
  amber: {
    background: "#1b1204",
    panel: "#221507",
    accent: "#fbbf24",
    primaryButton: "bg-amber-500 hover:bg-amber-400 shadow-amber-600/40",
    glow: "shadow-amber-600/30",
  },
  cyan: {
    background: "#021417",
    panel: "#031d20",
    accent: "#67e8f9",
    primaryButton: "bg-cyan-600 hover:bg-cyan-500 shadow-cyan-600/40",
    glow: "shadow-cyan-600/30",
  },
};

export function getSavedCardSize(): CardSize {
  if (typeof window === "undefined") return "large";
  const saved = localStorage.getItem(CARD_SIZE_KEY) as CardSize | null;
  return saved && ["small", "medium", "large"].includes(saved) ? saved : "large";
}

export function saveCardSize(size: CardSize) {
  if (typeof window !== "undefined") {
    localStorage.setItem(CARD_SIZE_KEY, size);
  }
}

export function getSavedStreamQuality(): StreamQuality {
  if (typeof window === "undefined") return "1080p";
  const saved = localStorage.getItem(STREAM_QUALITY_KEY) as StreamQuality | null;
  return saved && ["1080p", "720p", "480p", "auto"].includes(saved) ? saved : "1080p";
}

export function saveStreamQuality(quality: StreamQuality) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STREAM_QUALITY_KEY, quality);
  }
}

export function getSavedTheme(): AppTheme {
  if (typeof window === "undefined") return "violet";
  const saved = localStorage.getItem(THEME_KEY) as AppTheme | null;
  return saved && THEME_PRESETS[saved] ? saved : "violet";
}

export function saveTheme(theme: AppTheme) {
  if (typeof window !== "undefined") {
    localStorage.setItem(THEME_KEY, theme);
  }
}

export function getSavedWallpaperUrl(): string {
  if (typeof window === "undefined") return DEFAULT_WALLPAPER_URL;

  const saved = localStorage.getItem(WALLPAPER_URL_KEY)?.trim();
  if (!saved) return DEFAULT_WALLPAPER_URL;

  if (/^(https?:|data:|\/)/i.test(saved)) {
    return saved;
  }

  return DEFAULT_WALLPAPER_URL;
}

export function saveWallpaperUrl(url: string) {
  if (typeof window === "undefined") return;

  const next = url.trim();
  const finalUrl = /^(https?:|data:|\/)/i.test(next) ? next : DEFAULT_WALLPAPER_URL;
  localStorage.setItem(WALLPAPER_URL_KEY, finalUrl);
  window.dispatchEvent(new Event("rabtv_settings_updated"));
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
