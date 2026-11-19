// src/lib/fonts.js
export const FONTS = {
  aresink: "Aresink", // Headers, titles, buttons
  dancingmajesty: "Dancing-Majesty", // Sidebar menu & decorative default
  cayu: "Cayu", // Media details
};

export const READABLE_SANS_STACK =
  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export const FONT_STACKS = {
  header: `"${FONTS.aresink}", ${READABLE_SANS_STACK}`,
  body: `"${FONTS.dancingmajesty}", ${READABLE_SANS_STACK}`,
  media: `"${FONTS.cayu}", ${READABLE_SANS_STACK}`,
  accessible: READABLE_SANS_STACK,
};

/**
 * Resolves the best CSS font stack, automatically switching to ultra-legible
 * sans-serif when Senior Easy Mode or XL Text Scale is active.
 */
export function getResolvedFontStack(role = "body", preferAccessible = false) {
  if (preferAccessible) return FONT_STACKS.accessible;
  if (role === "header") return FONT_STACKS.header;
  if (role === "media") return FONT_STACKS.media;
  return FONT_STACKS.body;
}
