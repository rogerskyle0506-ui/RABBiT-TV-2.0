// lib/adblocker.ts

/**
 * Ad / tracking / popup hosts.
 * Prefer exact host or subdomain matching.
 */
const AD_DOMAINS = [
  "doubleclick.net",
  "googleadservices.com",
  "googlesyndication.com",
  "google-analytics.com",
  "googletagmanager.com",
  "popads.net",
  "popcash.net",
  "adcash.com",
  "juicyads.com",
  "exoclick.com",
  "propellerads.com",
  "propellerclick.com",
  "monetag.com",
  "adnxs.com",
  "adsrvr.org",
  "advertising.com",
  "adform.net",
  "outbrain.com",
  "taboola.com",
  "revcontent.com",
  "mgid.com",
  "zedo.com",
  "adblade.com",
  "adsterra.com",
  "clickadu.com",
  "hilltopads.com",
  "trafficjunky.com",
  "pushnami.com",
  "pushengage.com",
  "onesignal.com",
];

/**
 * Keywords that almost always indicate an ad when they appear in the hostname.
 */
const AD_HOST_KEYWORDS = [
  "bet365",
  "1xbet",
  "popunder",
  "popads",
  "adcash",
  "juicyads",
  "exoclick",
  "propeller",
  "banner",
  "popup",
  "clickunder",
  "monetag",
  "adsterra",
  "hilltopads",
  "trafficjunky",
];

/**
 * Scam / fake-captcha / reward-bait phrases.
 * Used both for URL checks and for parent-page text scanning.
 */
const SCAM_TEXT_PATTERNS = [
  /confirm\s+(you'?re|you\s+are)\s+not\s+a\s+robot/i,
  /i'?m\s+not\s+a\s+robot/i,
  /verify\s+you\s+are\s+(human|a\s+human)/i,
  /collect\s+your\s+(reward|prize|gift|bonus|free)/i,
  /claim\s+your\s+(reward|prize|gift|bonus)/i,
  /you\s+have\s+won/i,
  /congratulations.*won/i,
  /prove\s+you\s+are\s+(human|not\s+a\s+robot)/i,
];

/**
 * Robust check – prefers host matching, falls back carefully.
 */
function isAdUrl(urlStr: string): boolean {
  if (!urlStr) return false;

  try {
    const url = new URL(
      urlStr,
      typeof window !== "undefined" ? window.location.origin : undefined
    );
    const host = url.hostname.toLowerCase();

    // 1. Exact / subdomain host match
    if (AD_DOMAINS.some((domain) => host === domain || host.endsWith("." + domain))) {
      return true;
    }

    // 2. Keyword match only on the host (safer than path matching)
    if (AD_HOST_KEYWORDS.some((kw) => host.includes(kw))) {
      return true;
    }

    return false;
  } catch {
    // Very defensive fallback
    const lower = urlStr.toLowerCase();
    return (
      AD_DOMAINS.some((d) => lower.includes(d)) ||
      AD_HOST_KEYWORDS.some((kw) => lower.includes(kw))
    );
  }
}

/**
 * Quick text scan – useful if the ad ever injects content into the parent
 * or if a second overlay is created outside the iframe.
 */
function pageContainsScamText(): boolean {
  if (typeof document === "undefined") return false;
  const text = document.body?.innerText || "";
  return SCAM_TEXT_PATTERNS.some((re) => re.test(text));
}

/**
 * Validates if an outgoing navigation request is allowed to leave the app.
 * (Same public signature as original)
 */
export function shouldAllowExternalNavigation(url: string): boolean {
  if (!url) return false;

  const lowerUrl = url.toLowerCase();

  // Allowed protocols / apps
  if (lowerUrl.startsWith("tel:") || lowerUrl.startsWith("sms:")) return true;

  if (
    lowerUrl.includes("whatsapp://") ||
    lowerUrl.includes("wa.me") ||
    lowerUrl.includes("api.whatsapp.com") ||
    lowerUrl.includes("://whatsapp.com")
  ) {
    return true;
  }

  // GitHub releases / raw / your own repo
  if (
    (lowerUrl.includes("github.com") || lowerUrl.includes("githubusercontent.com")) &&
    (lowerUrl.includes("/releases/download/") ||
      lowerUrl.includes("/releases/latest") ||
      lowerUrl.includes("raw.githubusercontent.com") ||
      lowerUrl.includes("/rogerskyle0506-ui/rabbit-tv-2.0/"))
  ) {
    return true;
  }

  // On the details/player page we are extremely strict
  // (same behaviour as your original)
  const currentPath =
    typeof window !== "undefined" ? window.location.pathname : "";
  if (currentPath.includes("/details")) {
    return false;
  }

  // Explicit ad / scam block
  if (isAdUrl(url)) {
    return false;
  }

  return true;
}

/**
 * Intercepts link click or window opening intents.
 * (Same public signature as original)
 */
export function handleExternalUrlIntent(
  targetUrl: string,
  event?: Event
): boolean {
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
 * Self-contained ad-blocking interceptor suite.
 * (Same public signature as original – returns a cleanup function)
 */
export function initAdBlockerGlobalInterceptors(): () => void {
  if (typeof window === "undefined") return () => {};

  // 1. Block window.open
  const originalOpen = window.open;
  window.open = function (
    url?: string | URL,
    target?: string,
    features?: string
  ) {
    const targetStr = url ? url.toString() : "";
    if (!shouldAllowExternalNavigation(targetStr)) {
      console.warn("[AdBlocker] Neutralized window.open:", targetStr);
      return null;
    }
    return originalOpen.call(window, url, target, features);
  };

  // 2. Capture-phase click interceptor (catches injected <a> tags)
  const handleDocumentClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    const anchor = target.closest("a");
    if (anchor && anchor.href) {
      if (!shouldAllowExternalNavigation(anchor.href)) {
        console.warn("[AdBlocker] Blocked malicious link click:", anchor.href);
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
    }
  };
  document.addEventListener("click", handleDocumentClick, true);

  // 3. Block fetch to ad hosts
  const originalFetch = window.fetch;
  window.fetch = async function (
    input: RequestInfo | URL,
    init?: RequestInit
  ) {
    const urlStr =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    if (isAdUrl(urlStr)) {
      console.warn("[AdBlocker] Blocked ad fetch:", urlStr);
      return new Response("", { status: 200, statusText: "OK" });
    }
    return originalFetch.call(window, input, init);
  };

  // 4. Block XHR to ad hosts
  const originalXhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    ...args: any[]
  ) {
    const urlStr = url.toString();
    if (isAdUrl(urlStr)) {
      console.warn("[AdBlocker] Blocked ad XHR:", urlStr);
      return originalXhrOpen.call(this, method, "data:text/plain,", ...args);
    }
    return originalXhrOpen.call(this, method, url, ...args);
  };

  // 5. Soft protection against scripts that create <a target="_blank">
  const originalCreateElement = document.createElement.bind(document);
  document.createElement = function (
    tagName: string,
    options?: ElementCreationOptions
  ) {
    const el = originalCreateElement(tagName, options);
    if (tagName.toLowerCase() === "a") {
      const originalSetAttribute = el.setAttribute.bind(el);
      el.setAttribute = function (name: string, value: string) {
        if (name.toLowerCase() === "target" && value === "_blank") {
          console.debug("[AdBlocker] Script tried to set target=_blank");
        }
        return originalSetAttribute(name, value);
      };
    }
    return el;
  };

  // 6. Watch for scam text that leaks onto the parent page
  const observer = new MutationObserver(() => {
    if (pageContainsScamText()) {
      console.warn(
        "[AdBlocker] Scam text detected on parent page – hard block mode active"
      );
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  // Cleanup function (same contract as original)
  return () => {
    window.open = originalOpen;
    document.removeEventListener("click", handleDocumentClick, true);
    window.fetch = originalFetch;
    XMLHttpRequest.prototype.open = originalXhrOpen;
    document.createElement = originalCreateElement;
    observer.disconnect();
  };
}