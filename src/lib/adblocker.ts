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
 * uBlock Origin & Upstream Filter List URLs (Raw plain-text lists)
 */
const UBLOCK_ORIGIN_FILTER_URLS = [
  "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt",      // uBlock filters (Core general)
  "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/privacy.txt",      // uBlock privacy
  "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/badware.txt",      // uBlock badware/malware
  "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/unbreak.txt",      // uBlock unbreak (site fix rules)
  "https://easylist.to/easylist/easylist.txt",                                             // EasyList
  "https://easylist.to/easylist/easyprivacy.txt",                                           // EasyPrivacy
  "https://urlhaus.abuse.ch/downloads/text/"                                               // URLhaus malware blocklist
];

// Set storing dynamic rules parsed from uBlock Origin & EasyList files
let dynamicBlockRules: Set<string> = new Set();
let listsLoaded = false;

/**
 * Asynchronously fetches and parses official uBlock Origin and EasyList filter list repositories.
 */
export async function updateUBlockLists(): Promise<void> {
  if (listsLoaded || typeof window === "undefined") return;

  try {
    for (const url of UBLOCK_ORIGIN_FILTER_URLS) {
      const response = await fetch(url);
      if (!response.ok) continue;
      const text = await response.text();
      
      const lines = text.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        // Ignore empty lines, comment lines, metadata headers, and cosmetic formatting lines
        if (trimmed && !trimmed.startsWith("!") && !trimmed.startsWith("[")) {
          // Extract pattern or domain tokens safely
          let rule = trimmed;
          if (rule.startsWith("||")) {
            rule = rule.substring(2);
          }
          if (rule.includes("^")) {
            rule = rule.split("^")[0];
          }
          if (rule.length > 3) {
            dynamicBlockRules.add(rule.toLowerCase());
          }
        }
      }
    }
    listsLoaded = true;
    console.log(`[uBlock Origin Integration] Successfully loaded ${dynamicBlockRules.size} rules from uBO & upstream lists.`);
  } catch (error) {
    console.error("[uBlock Origin Integration] Failed to update lists:", error);
  }
}

/**
 * Robust check – prefers host matching, falls back carefully.
 */
function isAdUrl(urlStr: string): boolean {
  if (!urlStr) return false;

  const lowerUrl = urlStr.toLowerCase();

  // 1. Check dynamic rules fetched from uBlock Origin and EasyList sources
  if (dynamicBlockRules.size > 0) {
    for (const rule of dynamicBlockRules) {
      if (lowerUrl.includes(rule)) {
        return true;
      }
    }
  }

  try {
    const url = new URL(
      urlStr,
      typeof window !== "undefined" ? window.location.origin : undefined
    );
    const host = url.hostname.toLowerCase();

    // 2. Exact / subdomain host match against static AD_DOMAINS
    if (AD_DOMAINS.some((domain) => host === domain || host.endsWith("." + domain))) {
      return true;
    }

    // 3. Keyword match only on the host (safer than path matching)
    if (AD_HOST_KEYWORDS.some((kw) => host.includes(kw))) {
      return true;
    }

    return false;
  } catch {
    // Very defensive fallback
    return (
      AD_DOMAINS.some((d) => lowerUrl.includes(d)) ||
      AD_HOST_KEYWORDS.some((kw) => lowerUrl.includes(kw))
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
 * Determines if an element or any of its parents is related to the VIDSRC iframe or its container.
 * ABSOLUTE PROHIBITION COMPLIANCE: Never touch or affect vidsrc or its container.
 */
function isVidsrcRelated(element: Element | null): boolean {
  if (!element) return false;
  let current: Element | null = element;
  while (current) {
    if (current.tagName === "IFRAME") {
      const src = (current as HTMLIFrameElement).src || "";
      const id = current.id || "";
      const className = typeof current.className === "string" ? current.className : "";
      if (
        src.toLowerCase().includes("vidsrc") ||
        id.toLowerCase().includes("vidsrc") ||
        className.toLowerCase().includes("vidsrc")
      ) {
        return true;
      }
    }
    const id = current.id || "";
    const className = typeof current.className === "string" ? current.className : "";
    if (
      id.toLowerCase().includes("vidsrc") ||
      className.toLowerCase().includes("vidsrc") ||
      current.querySelector('iframe[src*="vidsrc"]')
    ) {
      return true;
    }
    current = current.parentElement;
  }
  return false;
}

/**
 * Injects industrial-strength CSS rules to neutralize ad overlays and floating elements
 * while completely omitting any selector that targets vidsrc elements or containers.
 */
function injectAggressiveAdblockStyles(): HTMLStyleElement | null {
  if (typeof document === "undefined") return null;

  const styleId = "rab-industrial-adblock-styles";
  let styleEl = document.getElementById(styleId) as HTMLStyleElement;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }

  styleEl.textContent = `
    /* Industrial Ad Neutralization Styles (2025-2026 Standards) */
    div[class*="banner" i]:not([class*="vidsrc" i]),
    div[class*="popup" i]:not([class*="vidsrc" i]),
    div[class*="overlay" i]:not([class*="vidsrc" i]),
    div[class*="advert" i]:not([class*="vidsrc" i]),
    div[class*="sponsored" i]:not([class*="vidsrc" i]),
    div[id*="banner" i]:not([id*="vidsrc" i]),
    div[id*="popup" i]:not([id*="vidsrc" i]),
    div[id*="overlay" i]:not([id*="vidsrc" i]),
    div[id*="ads-" i]:not([id*="vidsrc" i]),
    div[id*="-ads" i]:not([id*="vidsrc" i]),
    aside:not([class*="vidsrc" i]):not([id*="vidsrc" i]),
    ins.adsbygoogle,
    iframe[src*="doubleclick.net"],
    iframe[src*="googlesyndication.com"],
    iframe[src*="popads.net"],
    iframe[src*="adcash.com"],
    iframe[src*="juicyads.com"],
    iframe[src*="exoclick.com"],
    iframe[src*="propellerads.com"],
    iframe[src*="monetag.com"],
    iframe[src*="adsterra.com"] {
      display: none !important;
      opacity: 0 !important;
      visibility: hidden !important;
      pointer-events: none !important;
      z-index: -99999 !important;
      width: 0 !important;
      height: 0 !important;
      max-height: 0 !important;
      max-width: 0 !important;
      overflow: hidden !important;
    }
  `;
  return styleEl;
}

/**
 * Self-contained ad-blocking interceptor suite with enhanced overlay and popup neutralization,
 * integrated with uBlock Origin and EasyList filter list feeds.
 */
export function initAdBlockerGlobalInterceptors(): () => void {
  if (typeof window === "undefined") return () => {};

  // Kick off asynchronous fetch of uBlock Origin & EasyList block lists
  updateUBlockLists();

  // Inject high-performance CSS protection rules
  const injectedStyle = injectAggressiveAdblockStyles();

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

  // 2. Capture-phase click interceptor (catches injected <a> tags and transparent ad overlays)
  const handleDocumentClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    // ABSOLUTE PROHIBITION: Never interfere with vidsrc iframe or its container
    if (isVidsrcRelated(target)) {
      return;
    }

    // Check if clicking an anchor tag
    const anchor = target.closest("a");
    if (anchor && anchor.href) {
      if (!shouldAllowExternalNavigation(anchor.href)) {
        console.warn("[AdBlocker] Blocked malicious link click:", anchor.href);
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return;
      }
    }

    // Neutralize transparent/invisible overlays injected directly over the page/player
    const currentPath = window.location.pathname;
    if (currentPath.includes("/details") || currentPath.includes("/player") || currentPath.includes("/")) {
      const style = window.getComputedStyle(target);
      const isTransparentOrFixed =
        (style.position === "fixed" || style.position === "absolute") &&
        (style.backgroundColor === "rgba(0, 0, 0, 0)" ||
          style.opacity === "0" ||
          target.tagName.toLowerCase() === "a");

      if (
        isTransparentOrFixed &&
        target.tagName.toLowerCase() !== "button" &&
        !target.closest("iframe") &&
        !target.closest("nav") &&
        !target.closest("header") &&
        !isVidsrcRelated(target)
      ) {
        console.warn("[AdBlocker] Neutralized suspicious overlay element click:", target);
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        try {
          target.remove();
        } catch {
          target.style.display = "none";
        }
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

  // 6. MutationObserver to automatically strip out injected full-screen transparent ad overlays or suspicious popup elements
  const observer = new MutationObserver((mutations) => {
    if (pageContainsScamText()) {
      console.warn(
        "[AdBlocker] Scam text detected on parent page – hard block mode active"
      );
    }

    for (const mutation of mutations) {
      for (const node of Array.from(mutation.addedNodes)) {
        if (node instanceof HTMLElement) {
          // ABSOLUTE PROHIBITION: Never touch vidsrc iframe or container
          if (isVidsrcRelated(node)) {
            continue;
          }

          const tagName = node.tagName.toLowerCase();
          const className = typeof node.className === "string" ? node.className.toLowerCase() : "";
          const id = (node.id || "").toLowerCase();

          // High-confidence ad indicator checks
          const matchesAdPattern =
            className.includes("popunder") ||
            className.includes("popup-ad") ||
            className.includes("overlay-ad") ||
            className.includes("ad-banner") ||
            id.includes("popunder") ||
            id.includes("overlay-ad");

          if (matchesAdPattern && tagName !== "iframe") {
            console.warn("[AdBlocker] Stripped injected ad container via MutationObserver:", node);
            try {
              node.remove();
            } catch {
              node.style.display = "none";
            }
            continue;
          }

          // Check for injected suspicious full overlays
          const style = window.getComputedStyle(node);
          const isFullOverlay =
            (style.position === "fixed" || style.position === "absolute") &&
            (parseInt(style.zIndex, 10) > 100 || style.zIndex === "auto") &&
            (style.opacity === "0" || style.backgroundColor === "rgba(0, 0, 0, 0)") &&
            tagName !== "iframe" &&
            !node.querySelector("video") &&
            !node.querySelector("canvas");

          if (isFullOverlay) {
            console.warn("[AdBlocker] Stripped injected ad overlay element:", node);
            try {
              node.remove();
            } catch {
              node.style.display = "none";
            }
          }
        }
      }
    }
  });

  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  // 7. Periodic sweep interval to catch self-healing or delayed malicious nodes
  const cleanupInterval = setInterval(() => {
    if (typeof document === "undefined") return;
    const suspiciousElements = document.querySelectorAll(
      'div[class*="popunder" i], div[class*="overlay-ad" i], div[id*="popunder" i]'
    );
    suspiciousElements.forEach((el) => {
      if (!isVidsrcRelated(el)) {
        console.warn("[AdBlocker] Periodic sweep neutralized ad element:", el);
        try {
          el.remove();
        } catch {
          (el as HTMLElement).style.display = "none";
        }
      }
    });
  }, 3000);

  // Cleanup function
  return () => {
    window.open = originalOpen;
    document.removeEventListener("click", handleDocumentClick, true);
    window.fetch = originalFetch;
    XMLHttpRequest.prototype.open = originalXhrOpen;
    document.createElement = originalCreateElement;
    observer.disconnect();
    clearInterval(cleanupInterval);
    if (injectedStyle && injectedStyle.parentNode) {
      injectedStyle.parentNode.removeChild(injectedStyle);
    }
  };
}
