import { useEffect, useState } from "react";
import { getSavedWallpaperUrl, saveWallpaperUrl } from "@/lib/settings";

const FALLBACK_WALLPAPER = "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1600&q=80";

export function AppWallpaper() {
  const [wallpaperUrl, setWallpaperUrl] = useState<string>(getSavedWallpaperUrl());

  useEffect(() => {
    const syncWallpaper = () => {
      setWallpaperUrl(getSavedWallpaperUrl());
    };

    syncWallpaper();
    window.addEventListener("rabtv_settings_updated", syncWallpaper);
    return () => window.removeEventListener("rabtv_settings_updated", syncWallpaper);
  }, []);

  const resolvedUrl = wallpaperUrl || FALLBACK_WALLPAPER;

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <img
        src={resolvedUrl}
        alt=""
        className="h-full w-full object-cover opacity-50"
        loading="eager"
        decoding="async"
        onError={(event) => {
          event.currentTarget.src = FALLBACK_WALLPAPER;
          saveWallpaperUrl(FALLBACK_WALLPAPER);
        }}
      />
      <div className="absolute inset-0 bg-black/45" />
    </div>
  );
}
