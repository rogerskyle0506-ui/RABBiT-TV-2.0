import React from "react";

const APP_WALLPAPER_URL = "https://i.postimg.cc/y6r1Fv8k/grok-image-1793587579614.jpg";

export function AppWallpaper() {
  return (
    <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden">
      <img
        src={APP_WALLPAPER_URL}
        alt="App Wallpaper"
        className="w-full h-full object-cover opacity-45"
      />
      {/* subtle dark veil so text stays readable while the wallpaper still shows */}
      <div className="absolute inset-0 bg-black/40" />
    </div>
  );
}
