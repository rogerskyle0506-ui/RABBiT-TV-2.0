import React from "react";

const APP_WALLPAPER_URL = "https://i.postimg.cc/y6r1Fv8k/grok-image-1793587579614.jpg";

export function AppWallpaper() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <img
        src={APP_WALLPAPER_URL}
        alt=""
        className="h-full w-full object-cover opacity-45"
      />
      <div className="absolute inset-0 bg-slate-950/35" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_55%)]" />
    </div>
  );
}
