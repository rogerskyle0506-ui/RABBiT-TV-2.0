// lib/adblocker.ts

/**
 * Validates if an outgoing navigation request is allowed to leave the app.
 * - Allows trusted actions globally (WhatsApp, phone, SMS, GitHub APK releases).
 * - Restricts rogue browser breakouts ONLY when the user is actively on the details player page (stopping vid.src ad pop-ups).
 * - Permits standard browser navigation everywhere else in the app (enabling update checks and general links).
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

  // 4. GitHub Release, Raw APKs, and your custom updates folder
  if (
    lowerUrl.includes("github.com") &&
    (lowerUrl.includes("/releases/download/") ||
     lowerUrl.includes("/releases/latest") ||
     lowerUrl.includes("/raw.githubusercontent.com/") ||
     lowerUrl.includes("/rogerskyle0506-ui/rabbit-tv-2.0/"))
  ) {
    return true;
  }

  // 5. Check if the user is currently on the details player page
  const isDetailsPlayerPage = 
    typeof window !== "undefined" && 
    window.location.pathname.includes("/details");

  if (isDetailsPlayerPage) {
    // Block rogue web browser redirects/pop-ups triggered by the vid.src iframe player
    return false;
  }

  // Allow standard browser navigation everywhere else in the app (e.g. settings, manual updates, etc.)
  return true;
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
