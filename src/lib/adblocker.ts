// lib/adblocker.ts

/**
 * Validates if an outgoing navigation request is allowed to leave the app.
 * Keeps video streams untouched while permitting trusted actions (WhatsApp, phone, updates).
 */
export function shouldAllowExternalNavigation(url: string): boolean {
  if (!url) return false;

  const lowerUrl = url.toLowerCase();

  // 1. Phone dialer
  if (lowerUrl.startsWith("tel:")) return true;

  // 2. SMS messaging
  if (lowerUrl.startsWith("sms:")) return true;

  // 3. WhatsApp protocol & direct web links
  if (
    lowerUrl.includes("whatsapp://") ||
    lowerUrl.includes("wa.me") ||
    lowerUrl.includes("api.whatsapp.com")
  ) {
    return true;
  }

  // 4. GitHub Release Update Downloads (APKs)
  if (
    lowerUrl.includes("github.com") &&
    (lowerUrl.includes("/releases/download/") || lowerUrl.includes("/releases/latest"))
  ) {
    return true;
  }

  // Block all other unapproved external breakouts
  return false;
}

/**
 * Intercepts link click or window opening intents.
 */
export function handleExternalUrlIntent(targetUrl: string, event?: Event): boolean {
  if (shouldAllowExternalNavigation(targetUrl)) {
    return true;
  }

  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  return false;
}
