// src/components/AppWallpaper.tsx
import React, { useState, useEffect } from "react";
import { AppTheme, getSavedTheme } from "@/lib/settings";

const DEFAULT_WALLPAPER_URL = "https://i.postimg.cc/y6r1Fv8k/grok-image-1793587579614.jpg";

interface AppWallpaperProps {
  backdropUrl?: string | null;
}

export function AppWallpaper({ backdropUrl }: AppWallpaperProps) {
  const [appTheme, setAppTheme] = useState<AppTheme>("violet");
  const activeWallpaper = backdropUrl || DEFAULT_WALLPAPER_URL;

  useEffect(() => {
    const loadTheme = () => {
      setAppTheme(getSavedTheme());
    };
    loadTheme();
    window.addEventListener("storage", loadTheme);
    window.addEventListener("rabtv_settings_updated" as any, loadTheme);
    return () => {
      window.removeEventListener("storage", loadTheme);
      window.removeEventListener("rabtv_settings_updated" as any, loadTheme);
    };
  }, []);

  const getThemeOverlay = (theme: AppTheme) => {
    switch (theme) {
      case "red":
        return "bg-zinc-950/60 via-red-950/20 to-black/70";
      case "midnight":
        return "bg-slate-950/60 via-blue-950/20 to-slate-950/70";
      case "emerald":
        return "bg-slate-950/60 via-emerald-950/20 to-slate-950/70";
      case "amber":
        return "bg-stone-950/60 via-yellow-950/20 to-neutral-950/70";
      case "cyan":
        return "bg-slate-950/60 via-cyan-950/20 to-slate-950/70";
      case "violet":
      default:
        return "bg-slate-950/60 via-purple-950/20 to-slate-950/70";
    }
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <img
        src={activeWallpaper}
        alt=""
        className={`h-full w-full object-cover transition-all duration-500 ${
          backdropUrl ? "opacity-65 filter blur-[1px] scale-105" : "opacity-45"
        }`}
      />
      <div className={`absolute inset-0 bg-gradient-to-br ${getThemeOverlay(appTheme)}`} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_55%)]" />
    </div>
  );
}
