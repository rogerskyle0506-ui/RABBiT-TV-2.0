// src/lib/fontOverride.js
// Safe Web / Capacitor DOM font controller (synced with styles.css & settings.ts)
import { FONT_STACKS, getResolvedFontStack } from "./fonts";

let isFontListenerAttached = false;

/**
 * Applies RABBiT TV font CSS custom properties to documentElement while
 * automatically honoring Senior Easy Mode & XL Text accessibility settings.
 */
export function applyDocumentFontOverrides() {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return;
  }

  const root = document.documentElement;
  let seniorMode = false;
  try {
    seniorMode =
      localStorage.getItem("rabtv_senior_easy_mode") === "true" ||
      root.getAttribute("data-senior-easy") === "true" ||
      root.getAttribute("data-text-scale") === "xl";
  } catch {
    seniorMode = root.getAttribute("data-text-scale") === "xl";
  }

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

// Keep font variables synced if settings change dynamically (HMR/double-import safe)
if (typeof window !== "undefined" && !isFontListenerAttached) {
  isFontListenerAttached = true;
  applyDocumentFontOverrides();
  window.addEventListener("rabtv_settings_updated", applyDocumentFontOverrides);
  window.addEventListener("rabtv_profiles_updated", applyDocumentFontOverrides);
}
