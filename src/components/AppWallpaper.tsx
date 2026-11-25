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
import {
  ADMIN_STORE_UPDATED_EVENT,
  getCachedBrandingConfig,
  isSafeHttpsUrl,
} from "@/lib/admin-store";

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

interface WallpaperThemeTokens {
  overlayGradient: string;
  radialTint: string;
}

function getWallpaperThemeTokens(theme: AppTheme): WallpaperThemeTokens {
  switch (theme) {
    case "red":
      return {
        overlayGradient: "from-zinc-950/70 via-red-950/30 to-black/85",
        radialTint:
          "radial-gradient(circle at top, rgba(239, 68, 68, 0.14), transparent 58%)",
      };
    case "midnight":
      return {
        overlayGradient: "from-slate-950/70 via-blue-950/30 to-black/85",
        radialTint:
          "radial-gradient(circle at top, rgba(59, 130, 246, 0.14), transparent 58%)",
      };
    case "emerald":
      return {
        overlayGradient: "from-neutral-950/70 via-emerald-950/30 to-black/85",
        radialTint:
          "radial-gradient(circle at top, rgba(16, 185, 129, 0.14), transparent 58%)",
      };
    case "amber":
      return {
        overlayGradient: "from-stone-950/70 via-yellow-950/30 to-black/85",
        radialTint:
          "radial-gradient(circle at top, rgba(245, 158, 11, 0.14), transparent 58%)",
      };
    case "cyan":
      return {
        overlayGradient: "from-slate-950/70 via-cyan-950/30 to-black/85",
        radialTint:
          "radial-gradient(circle at top, rgba(6, 182, 212, 0.14), transparent 58%)",
      };
    case "violet":
    default:
      return {
        overlayGradient: "from-slate-950/70 via-purple-950/30 to-black/85",
        radialTint:
          "radial-gradient(circle at top, rgba(139, 92, 246, 0.14), transparent 58%)",
      };
  }
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
  const [customWallpaperUrl, setCustomWallpaperUrl] = useState<string>(() => {
    const url = getCachedBrandingConfig().customWallpaperUrl || "";
    return isSafeHttpsUrl(url) ? url : "";
  });
  const [imgFailed, setImgFailed] = useState<boolean>(false);
  const [customFailed, setCustomFailed] = useState<boolean>(false);

  // Reset image error states whenever backdropUrl or OTA wallpaper changes
  useEffect(() => {
    setImgFailed(false);
  }, [backdropUrl]);

  useEffect(() => {
    setCustomFailed(false);
  }, [customWallpaperUrl]);

  useEffect(() => {
    const syncWallpaperSettings = () => {
      setAppTheme(getSavedTheme());
      setIsLowRam(getHardwareLimits().effectiveMode === "low");
      setReducedMotion(getReducedMotion());
      setWarmEyeCare(getWarmEyeCare());
      setGlowOff(getGlowIntensity() === "off");
      const otaUrl = getCachedBrandingConfig().customWallpaperUrl || "";
      setCustomWallpaperUrl(isSafeHttpsUrl(otaUrl) ? otaUrl : "");
    };

    syncWallpaperSettings();
    window.addEventListener("storage", syncWallpaperSettings);
    window.addEventListener("rabtv_settings_updated", syncWallpaperSettings);
    window.addEventListener("rabtv_ram_mode_updated", syncWallpaperSettings);
    window.addEventListener(ADMIN_STORE_UPDATED_EVENT, syncWallpaperSettings);

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
      window.removeEventListener(
        ADMIN_STORE_UPDATED_EVENT,
        syncWallpaperSettings
      );
    };
  }, []);

  const activeWallpaper = useMemo(() => {
    if (backdropUrl && !imgFailed) {
      return optimizeBackdropUrl(backdropUrl, isLowRam);
    }
    if (customWallpaperUrl && !customFailed) {
      return customWallpaperUrl;
    }
    return DEFAULT_WALLPAPER_URL;
  }, [backdropUrl, imgFailed, customWallpaperUrl, customFailed, isLowRam]);

  const themeTokens = useMemo(
    () => getWallpaperThemeTokens(appTheme),
    [appTheme]
  );

  return (
    <div
      className="rabtv-vidsrc-protected pointer-events-none fixed inset-0 w-full h-[100dvh] z-0 overflow-hidden select-none"
      aria-hidden="true"
    >
      <img
        src={activeWallpaper}
        alt=""
        decoding="async"
        onError={() => {
          if (backdropUrl && !imgFailed) {
            setImgFailed(true);
          } else if (customWallpaperUrl && !customFailed) {
            setCustomFailed(true);
          }
        }}
        className={`h-full w-full object-cover object-center ${
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
        className={`absolute inset-0 bg-gradient-to-br ${themeTokens.overlayGradient}`}
      />
      {!glowOff && !isLowRam && (
        <div
          className="absolute inset-0"
          style={{ background: themeTokens.radialTint }}
        />
      )}
      {/* Functional warm night-time eye-care filter */}
      {warmEyeCare && <div className="absolute inset-0 bg-amber-900/15" />}
    </div>
  );
});

AppWallpaper.displayName = "AppWallpaper";