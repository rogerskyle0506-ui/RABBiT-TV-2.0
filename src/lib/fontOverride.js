// src/lib/fontOverride.js
// Safe Web / Capacitor DOM font controller (replaces legacy react-native Text.render patch)
import { FONT_STACKS, getResolvedFontStack } from "./fonts";

/**
 * Applies RABBiT TV font CSS custom properties to documentElement while
 * automatically honoring Senior Easy Mode & XL Text accessibility settings.
 */
export function applyDocumentFontOverrides() {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return;
  }

  const root = document.documentElement;
  const seniorMode =
    localStorage.getItem("rabtv_senior_easy_mode") === "true" ||
    root.getAttribute("data-text-scale") === "xl";

  root.style.setProperty(
    "--rabtv-font-header",
    getResolvedFontStack("header", seniorMode)
  );
  root.style.setProperty(
    "--rabtv-font-body",
    getResolvedFontStack("body", seniorMode)
  );
  root.style.setProperty(
    "--rabtv-font-media",
    getResolvedFontStack("media", seniorMode)
  );
  root.style.setProperty("--rabtv-font-accessible", FONT_STACKS.accessible);
}

// Keep font variables synced if settings change dynamically
if (typeof window !== "undefined") {
  applyDocumentFontOverrides();
  window.addEventListener("rabtv_settings_updated", applyDocumentFontOverrides);
}
