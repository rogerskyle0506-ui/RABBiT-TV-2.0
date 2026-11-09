// lib/adblocker.ts

// List of ad, tracking, and popup domains used by video embed providers
const AD_DOMAINS = [
  "doubleclick.net",
  "googleadservices.com",
  "googlesyndication.com",
  "popads.net",
  "popcash.net",
  "adcash.com",
  "juicyads.com",
  "exoclick.com",
  "propellerads.com",
  "bet365",
  "1xbet",
  "creative.display",
  "banner",
  "popunder",
];

/**
 * Validates if an outgoing navigation request is allowed to leave the app.
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

  // 4. GitHub Release, Raw APKs, and custom updates folder
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
    return false;
  }

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

/**
 * Self-contained ad-blocking interceptor suite for lib/adblocker.ts.
 * Blocks window.open, fetch/XHR ad domain requests, and script injection.
 */
export function initAdBlockerGlobalInterceptors(): () => void {
  if (typeof window === "undefined") return () => {};

  // 1. Block window.open popup breakouts
  const originalOpen = window.open;
  window.open = function (url?: string | URL, target?: string, features?: string) {
    const targetStr = url ? url.toString() : "";
    if (!shouldAllowExternalNavigation(targetStr)) {
      console.warn("[AdBlocker] Neutralized window.open popup:", targetStr);
      return null;
    }
    return originalOpen.call(window, url, target, features);
  };

  // 2. Block fetch requests to known ad network hosts
  const originalFetch = window.fetch;
  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
    const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (AD_DOMAINS.some((domain) => urlStr.toLowerCase().includes(domain))) {
      console.warn("[AdBlocker] Blocked ad fetch network request:", urlStr);
      return new Response("", { status: 200, statusText: "OK" });
    }
    return originalFetch.call(window, input, init);
  };

  // 3. Block XMLHttpRequest (XHR) to known ad network hosts
  const originalXhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...args: any[]) {
    const urlStr = url.toString();
    if (AD_DOMAINS.some((domain) => urlStr.toLowerCase().includes(domain))) {
      console.warn("[AdBlocker] Blocked ad XHR network request:", urlStr);
      // Point blocked ad XHR calls to an empty local data URI to prevent broken execution errors
      return originalXhrOpen.call(this, method, "data:text/plain,", ...args);
    }
    return originalXhrOpen.call(this, method, url, ...args);
  };

  // Cleanup function to restore original prototypes if unmounted
  return () => {
    window.open = originalOpen;
    window.fetch = originalFetch;
    XMLHttpRequest.prototype.open = originalXhrOpen;
  };
}
