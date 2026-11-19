// src/components/AppWallpaper.tsx
import React, { useState, useEffect, useMemo, memo } from "react";
import {
  AppTheme,
  getSavedTheme,
  getHardwareLimits,
  getReducedMotion,
  getWarmEyeCare,
  getGlowIntensity,
} from "@/lib/settings";

const DEFAULT_WALLPAPER_URL =
  "https://i.postimg.cc/y6r1Fv8k/grok-image-1793587579614.jpg";

interface AppWallpaperProps {
  backdropUrl?: string | null;
}

function optimizeBackdropUrl(url: string, isLowRam: boolean): string {
  if (!isLowRam) return url;
  // Downgrade massive 4K TMDB /original backdrops to /w780 on 1-2GB streaming sticks (~75% less VRAM)
  if (url.includes("image.tmdb.org/t/p/original/")) {
    return url.replace("image.tmdb.org/t/p/original/", "image.tmdb.org/t/p/w780/");
  }
  return url;
}

export const AppWallpaper = memo(function AppWallpaper({
  backdropUrl,
}: AppWallpaperProps) {
  const [appTheme, setAppTheme] = useState<AppTheme>(() => getSavedTheme());
  const [isLowRam, setIsLowRam] = useState<boolean>(
    () => getHardwareLimits().effectiveMode === "low"
  );
  const [reducedMotion, setReducedMotion] = useState<boolean>(() =>
    getReducedMotion()
  );
  const [warmEyeCare, setWarmEyeCare] = useState<boolean>(() =>
    getWarmEyeCare()
  );
  const [glowOff, setGlowOff] = useState<boolean>(
    () => getGlowIntensity() === "off"
  );
  const [imgFailed, setImgFailed] = useState<boolean>(false);

  // Reset image error state whenever backdropUrl changes
  useEffect(() => {
    setImgFailed(false);
  }, [backdropUrl]);

  useEffect(() => {
    const syncWallpaperSettings = () => {
      setAppTheme(getSavedTheme());
      setIsLowRam(getHardwareLimits().effectiveMode === "low");
      setReducedMotion(getReducedMotion());
      setWarmEyeCare(getWarmEyeCare());
      setGlowOff(getGlowIntensity() === "off");
    };

    syncWallpaperSettings();
    window.addEventListener("storage", syncWallpaperSettings);
    window.addEventListener("rabtv_settings_updated", syncWallpaperSettings);
    window.addEventListener("rabtv_ram_mode_updated", syncWallpaperSettings);

    return () => {
      window.removeEventListener("storage", syncWallpaperSettings);
      window.removeEventListener(
        "rabtv_settings_updated",
        syncWallpaperSettings
      );
      window.removeEventListener(
        "rabtv_ram_mode_updated",
        syncWallpaperSettings
      );
    };
  }, []);

  const activeWallpaper = useMemo(() => {
    if (!backdropUrl || imgFailed) return DEFAULT_WALLPAPER_URL;
    return optimizeBackdropUrl(backdropUrl, isLowRam);
  }, [backdropUrl, imgFailed, isLowRam]);

  const themeOverlay = useMemo(() => {
    switch (appTheme) {
      case "red":
        return "from-zinc-950/65 via-red-950/25 to-black/80";
      case "midnight":
        return "from-slate-950/65 via-blue-950/25 to-slate-950/80";
      case "emerald":
        return "from-slate-950/65 via-emerald-950/25 to-slate-950/80";
      case "amber":
        return "from-stone-950/65 via-yellow-950/25 to-neutral-950/80";
      case "cyan":
        return "from-slate-950/65 via-cyan-950/25 to-slate-950/80";
      case "violet":
      default:
        return "from-slate-950/65 via-purple-950/25 to-slate-950/80";
    }
  }, [appTheme]);

  return (
    <div
      className="rabtv-vidsrc-protected pointer-events-none fixed inset-0 z-0 overflow-hidden select-none"
      aria-hidden="true"
    >
      <img
        src={activeWallpaper}
        alt=""
        decoding="async"
        onError={() => {
          if (backdropUrl && !imgFailed) {
            setImgFailed(true);
          }
        }}
        className={`h-full w-full object-cover ${
          reducedMotion || isLowRam ? "" : "transition-opacity duration-500"
        } ${
          backdropUrl && !imgFailed
            ? isLowRam
              ? "opacity-55"
              : "opacity-65 filter blur-[1px] scale-105"
            : "opacity-45"
        }`}
      />
      <div
        className={`absolute inset-0 bg-gradient-to-br ${themeOverlay}`}
      />
      {!glowOff && !isLowRam && (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.09),transparent_55%)]" />
      )}
      {warmEyeCare && (
        <div className="absolute inset-0 bg-amber-900/15" />
      )}
    </div>
  );
});

AppWallpaper.displayName = "AppWallpaper";
