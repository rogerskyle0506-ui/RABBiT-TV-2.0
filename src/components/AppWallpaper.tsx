// src/components/AppWallpaper.tsx
import React from "react";

const DEFAULT_WALLPAPER_URL = "https://i.postimg.cc/y6r1Fv8k/grok-image-1793587579614.jpg";

interface AppWallpaperProps {
  backdropUrl?: string | null;
}

export function AppWallpaper({ backdropUrl }: AppWallpaperProps) {
  const activeWallpaper = backdropUrl || DEFAULT_WALLPAPER_URL;

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <img
        src={activeWallpaper}
        alt=""
        className={`h-full w-full object-cover transition-all duration-500 ${
          backdropUrl ? "opacity-30 filter blur-[1px] scale-105" : "opacity-45"
        }`}
      />
      <div className="absolute inset-0 bg-slate-950/75" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_55%)]" />
    </div>
  );
}
