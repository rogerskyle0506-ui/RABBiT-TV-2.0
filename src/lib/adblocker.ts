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
  // Additional streaming / popunder ad networks
  "acscdn.com",
  "onclasrv.com",
  "realsrv.com",
  "magsrv.com",
  "tsyndicate.com",
  "galaksion.com",
  "rollerads.com",
  "richads.com",
  "evadav.com",
  "adskeeper.com",
  "bidgear.com",
  "bidvertiser.com",
  "clksite.com",
  "trwl1.com",
  "notix.io",
  "pushwhy.com",
  "dtscout.com",
  "histats.com",
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
  "acscdn",
  "onclasrv",
  "realsrv",
  "magsrv",
  "tsyndicate",
  "galaksion",
  "rollerads",
  "evadav",
  "adskeeper",
  "adserver",
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
  /your\s+(device|phone|computer|system)\s+is\s+(infected|at\s+risk)/i,
  /update\s+your\s+(flash|video\s+player|browser|vpn)\s+to\s+continue/i,
  /allow\s+notifications\s+to\s+(watch|continue|play)/i,
];

/**
 * Inline script signatures used by popunder and overlay injectors.
 */
const MALICIOUS_SCRIPT_SIGNATURES = [
  "aclib.runpop",
  "aclib.runauto",
  "atoptions",
  "popunder",
  "clickunder",
  "openwindow",
  "adsterra",
  "monetag",
  "propellerads",
  "exoclick",
  "popads",
  "adcash",
  "_pop.push",
  "poperblocker",
];

/**
 * uBlock Origin Scriptlet Globals (abort-on-property-read / abort-on-property-write targets)
 * These are the exact global objects streaming ad networks use to spawn popunders and overlays.
 */
const UBLOCK_SCRIPTLET_TRAPS = [
  "aclib",
  "atOptions",
  "_pop",
  "popns",
  "BetterJsPop",
  "exoNoExternalUI38djdkj",
  "__htapop",
  "adcashMacros",
  "adsbyexoclick",
  "pClick",
  "popAds",
  "propellerads",
];

/**
 * uBlock Origin & Upstream Filter List URLs (CORS-friendly raw & GitHub Pages mirrors)
 */
const UBLOCK_ORIGIN_FILTER_URLS = [
  "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt",
  "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/privacy.txt",
  "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/badware.txt",
  "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/resource-abuse.txt",
  "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/unbreak.txt",
  "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/thirdparties/easylist/easylist.txt",
  "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/thirdparties/easylist/easyprivacy.txt",
  "https://easylist.to/easylist/easylist.txt",
  "https://easylist.to/easylist/easyprivacy.txt",
];

const UBLOCK_CACHE_STORAGE_KEY = "rabtv_ublock_cached_rules_v1";
const UBLOCK_CACHE_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

// Sets storing dynamic network rules and cosmetic DOM selectors parsed from uBlock Origin & EasyList files
let dynamicBlockRules: Set<string> = new Set();
let dynamicCosmeticSelectors: Set<string> = new Set();
let listsLoaded = false;
let listsLoadingPromise: Promise<void> | null = null;

/**
 * Hydrates cached uBlock rules from localStorage immediately (0ms delay on page load).
 */
function hydrateCachedUBlockRules(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(UBLOCK_CACHE_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed.timestamp !== "number" ||
      Date.now() - parsed.timestamp > UBLOCK_CACHE_TTL_MS
    ) {
      return false;
    }
    if (Array.isArray(parsed.networkRules)) {
      for (const r of parsed.networkRules) dynamicBlockRules.add(r);
    }
    if (Array.isArray(parsed.cosmeticSelectors)) {
      for (const s of parsed.cosmeticSelectors) dynamicCosmeticSelectors.add(s);
    }
    if (dynamicBlockRules.size > 0) {
      listsLoaded = true;
      injectDynamicUBlockCosmeticStyles();
      return true;
    }
  } catch {
    // Ignore storage read errors
  }
  return false;
}

/**
 * Saves parsed uBlock rules to localStorage (capped to prevent quota overflow).
 */
function persistUBlockRulesToCache(): void {
  if (typeof window === "undefined") return;
  try {
    const networkRules = Array.from(dynamicBlockRules).slice(0, 15000);
    const cosmeticSelectors = Array.from(dynamicCosmeticSelectors).slice(0, 3000);
    localStorage.setItem(
      UBLOCK_CACHE_STORAGE_KEY,
      JSON.stringify({
        timestamp: Date.now(),
        networkRules,
        cosmeticSelectors,
      })
    );
  } catch {
    // Ignore localStorage quota errors
  }
}

/**
 * Injects parsed uBlock Origin `##selector` cosmetic rules directly into a dedicated DOM <style> tag
 * while strictly excluding any selector that could touch vidsrc or iframes.
 */
function injectDynamicUBlockCosmeticStyles(): void {
  if (typeof document === "undefined" || dynamicCosmeticSelectors.size === 0) {
    return;
  }

  const styleId = "rab-ublock-cosmetic-styles";
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }

  // Batch up to 2,500 safe cosmetic selectors with :not([class*="vidsrc"]) protection
  const safeSelectors = Array.from(dynamicCosmeticSelectors).slice(0, 2500);
  const chunkedCss: string[] = [];
  const chunkSize = 250;

  for (let i = 0; i < safeSelectors.length; i += chunkSize) {
    const slice = safeSelectors.slice(i, i + chunkSize);
    chunkedCss.push(
      `${slice.join(",\n")} {\n  display: none !important;\n  visibility: hidden !important;\n  opacity: 0 !important;\n  pointer-events: none !important;\n}`
    );
  }

  styleEl.textContent = chunkedCss.join("\n\n");
}

/**
 * Parses a raw uBlock Origin / EasyList text file into network and cosmetic rule sets.
 */
function parseUBlockFilterText(text: string): void {
  const lines = text.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("!") || trimmed.startsWith("[")) {
      continue;
    }

    // 1. Capture generic cosmetic DOM hiding rules (##selector) safely
    if (trimmed.startsWith("##")) {
      const selector = trimmed.substring(2).trim();
      if (
        selector &&
        !selector.includes(":has") &&
        !selector.includes(":-abp-") &&
        !selector.includes(":style") &&
        !selector.includes(":matches") &&
        !selector.includes(":xpath") &&
        !selector.includes("vidsrc") &&
        !selector.includes("iframe") &&
        !selector.includes("video") &&
        !selector.includes("body") &&
        !selector.includes("html") &&
        selector.length > 2 &&
        selector.length < 75 &&
        /^[.#a-zA-Z0-9_\-[\]="*^$|~+> ]+$/.test(selector)
      ) {
        dynamicCosmeticSelectors.add(`${selector}:not([class*="vidsrc" i]):not([id*="vidsrc" i])`);
      }
      continue;
    }

    // Skip site-specific cosmetic rules, scriptlet lines, or exception rules
    if (
      trimmed.includes("##") ||
      trimmed.includes("#@#") ||
      trimmed.includes("#?#") ||
      trimmed.startsWith("@@")
    ) {
      continue;
    }

    // 2. Extract network domain rules (||domain.com^)
    let rule = trimmed;
    if (rule.startsWith("||")) {
      rule = rule.substring(2);
    } else if (rule.startsWith("|http://") || rule.startsWith("|https://")) {
      rule = rule.replace(/^\|https?:\/\//i, "");
    }

    if (rule.includes("^")) {
      rule = rule.split("^")[0];
    }
    if (rule.includes("$")) {
      rule = rule.split("$")[0];
    }
    if (rule.includes("/")) {
      rule = rule.split("/")[0];
    }

    // Store clean hostnames that won't false-positive
    if (
      rule.length > 4 &&
      rule.includes(".") &&
      !rule.includes("*") &&
      !rule.includes("vidsrc") &&
      !rule.includes("themoviedb") &&
      !rule.includes("youtube") &&
      !rule.includes("github")
    ) {
      dynamicBlockRules.add(rule.toLowerCase());
    }
  }
}

/**
 * Asynchronously fetches and parses official uBlock Origin and EasyList filter list repositories.
 * Uses Promise.allSettled so a single CORS failure never stops the other lists from loading.
 */
export async function updateUBlockLists(): Promise<void> {
  if (typeof window === "undefined") return;

  // Hydrate from localStorage cache immediately if available
  if (hydrateCachedUBlockRules()) {
    console.log(
      `[uBlock Origin Integration] Hydrated ${dynamicBlockRules.size} network rules and ${dynamicCosmeticSelectors.size} cosmetic selectors from cache.`
    );
    return;
  }

  if (listsLoaded) return;
  if (listsLoadingPromise) return listsLoadingPromise;

  listsLoadingPromise = (async () => {
    try {
      const fetchPromises = UBLOCK_ORIGIN_FILTER_URLS.map(async (url) => {
        const response = await fetch(url);
        if (!response.ok) return "";
        return await response.text();
      });

      const results = await Promise.allSettled(fetchPromises);
      for (const res of results) {
        if (res.status === "fulfilled" && res.value) {
          parseUBlockFilterText(res.value);
        }
      }

      if (dynamicBlockRules.size > 0 || dynamicCosmeticSelectors.size > 0) {
        listsLoaded = true;
        injectDynamicUBlockCosmeticStyles();
        persistUBlockRulesToCache();
        console.log(
          `[uBlock Origin Integration] Successfully loaded ${dynamicBlockRules.size} network rules and ${dynamicCosmeticSelectors.size} DOM cosmetic selectors.`
        );
      }
    } catch (error) {
      console.error("[uBlock Origin Integration] Failed to update lists:", error);
    } finally {
      listsLoadingPromise = null;
    }
  })();

  return listsLoadingPromise;
}

/**
 * uBlock Origin Scriptlet Engine (`+js(abort-on-property-read)` & `+js(abort-on-property-write)`):
 * Traps global variables used by popunder/overlay scripts so they throw or no-op upon access.
 */
function installUBlockScriptletTraps(): void {
  if (typeof window === "undefined") return;

  for (const prop of UBLOCK_SCRIPTLET_TRAPS) {
    try {
      if (prop in window) {
        try {
          delete (window as any)[prop];
        } catch {
          // Ignore if non-configurable
        }
      }

      // Create a harmless Proxy trap so any property call like `aclib.runPop()` silently no-ops
      const inertProxy: any = new Proxy(() => inertProxy, {
        get: () => inertProxy,
        set: () => true,
        apply: () => inertProxy,
        construct: () => inertProxy,
      });

      Object.defineProperty(window, prop, {
        configurable: true,
        get() {
          console.warn(`[uBlock Scriptlet] Neutralized access to ad global: window.${prop}`);
          return inertProxy;
        },
        set() {
          console.warn(`[uBlock Scriptlet] Blocked write to ad global: window.${prop}`);
          return true;
        },
      });
    } catch {
      // Ignore if property is already locked
    }
  }
}

/**
 * Robust check – prefers host matching, falls back carefully.
 */
function isAdUrl(urlStr: string): boolean {
  if (!urlStr) return false;

  const lowerUrl = urlStr.toLowerCase().trim();

  // Never block vidsrc or TMDB or YouTube or GitHub assets
  if (
    lowerUrl.includes("vidsrc") ||
    lowerUrl.includes("themoviedb.org") ||
    lowerUrl.includes("tmdb.org") ||
    lowerUrl.includes("youtube.com") ||
    lowerUrl.includes("youtube-nocookie.com") ||
    lowerUrl.includes("githubusercontent.com")
  ) {
    return false;
  }

  // Block javascript: or suspicious data: popups
  if (lowerUrl.startsWith("javascript:")) {
    return true;
  }

  // 1. Check dynamic rules fetched from uBlock Origin and EasyList sources (O(1) domain lookup)
  if (dynamicBlockRules.size > 0) {
    try {
      const parsed = new URL(
        urlStr,
        typeof window !== "undefined" ? window.location.origin : "https://localhost"
      );
      const host = parsed.hostname.toLowerCase();
      if (dynamicBlockRules.has(host)) {
        return true;
      }
      const parts = host.split(".");
      for (let i = 1; i < parts.length - 1; i++) {
        const sub = parts.slice(i).join(".");
        if (dynamicBlockRules.has(sub)) {
          return true;
        }
      }
    } catch {
      // Fallback if URL parsing fails
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

  const lowerUrl = url.toLowerCase().trim();

  // Block empty, about:blank, or javascript: popups
  if (
    lowerUrl === "about:blank" ||
    lowerUrl.startsWith("javascript:") ||
    lowerUrl.startsWith("blob:")
  ) {
    return false;
  }

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

  // Allow official IMDb listing links clicked intentionally by the user
  if (lowerUrl.includes("imdb.com/title/") || lowerUrl.includes("imdb.com/find")) {
    return true;
  }

  // Allow internal same-origin navigation
  if (typeof window !== "undefined") {
    try {
      const parsed = new URL(url, window.location.origin);
      if (parsed.origin === window.location.origin) {
        return true;
      }
    } catch {
      return false;
    }
  }

  // On the details/player page we are extremely strict against any other external navigation
  const currentPath =
    typeof window !== "undefined" ? window.location.pathname : "";
  if (currentPath.includes("/details") || currentPath.includes("/player")) {
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
    if (typeof (event as any).stopImmediatePropagation === "function") {
      (event as any).stopImmediatePropagation();
    }
  }
  return false;
}

/**
 * Determines if an element IS the VIDSRC iframe, its direct wrapper container,
 * or an ancestor that contains the VIDSRC iframe (so we never delete the page wrapper).
 * ABSOLUTE PROHIBITION COMPLIANCE: Never touch or affect vidsrc or its container.
 */
function isVidsrcRelated(element: Element | null): boolean {
  if (!element) return false;

  // 1. If this element ITSELF contains the vidsrc iframe (e.g., body, #root, .player-view-wrapper, .video-player-container),
  // protect it so we never delete an ancestor of the player.
  if (
    element.querySelector &&
    element.querySelector('iframe[src*="vidsrc"], iframe[src*="youtube"]')
  ) {
    return true;
  }

  // 2. Walk up the tree ONLY to check if this element is the vidsrc iframe itself
  // or has an explicit vidsrc id/class.
  let current: Element | null = element;
  while (current) {
    if (current.tagName === "IFRAME") {
      const src = ((current as HTMLIFrameElement).src || "").toLowerCase();
      const id = (current.id || "").toLowerCase();
      const className =
        typeof current.className === "string"
          ? current.className.toLowerCase()
          : "";
      if (
        src.includes("vidsrc") ||
        src.includes("youtube") ||
        id.includes("vidsrc") ||
        className.includes("vidsrc")
      ) {
        return true;
      }
    }
    const id = (current.id || "").toLowerCase();
    const className =
      typeof current.className === "string"
        ? current.className.toLowerCase()
        : "";
    if (id.includes("vidsrc") || className.includes("vidsrc")) {
      return true;
    }
    current = current.parentElement;
  }
  return false;
}

/**
 * Checks if an element is part of RABBiT TV's legitimate React UI
 * so aggressive DOM sweeps only destroy foreign injected ad overlays.
 */
function isLegitimateAppElement(element: Element | null): boolean {
  if (!element) return false;
  if (isVidsrcRelated(element)) return true;

  // Protect core root and player containers
  if (
    element === document.body ||
    element === document.documentElement ||
    element.id === "root" ||
    element.id === "app" ||
    element.classList.contains("player-view-wrapper") ||
    element.classList.contains("video-player-container")
  ) {
    return true;
  }

  // Protect legitimate app elements inside .player-view-wrapper or details view
  if (element.closest(".player-view-wrapper") || element.closest("#root")) {
    const tag = element.tagName.toLowerCase();
    if (tag === "ins") return false;
    if (tag === "iframe" && !isVidsrcRelated(element)) return false;
    if (tag === "a") {
      const href = (element as HTMLAnchorElement).href || "";
      if (href && !shouldAllowExternalNavigation(href)) {
        return false;
      }
    }
    return true;
  }

  return false;
}

const ADBLOCK_CSS_RULES = `
  /* Industrial Ad Neutralization Styles (2025-2026 Standards) */
  div[class*="banner" i]:not([class*="vidsrc" i]),
  div[class*="popup" i]:not([class*="vidsrc" i]),
  div[class*="popunder" i]:not([class*="vidsrc" i]),
  div[class*="overlay-ad" i]:not([class*="vidsrc" i]),
  div[class*="ad-overlay" i]:not([class*="vidsrc" i]),
  div[class*="advert" i]:not([class*="vidsrc" i]),
  div[class*="sponsored" i]:not([class*="vidsrc" i]),
  div[id*="banner" i]:not([id*="vidsrc" i]),
  div[id*="popup" i]:not([id*="vidsrc" i]),
  div[id*="popunder" i]:not([id*="vidsrc" i]),
  div[id*="overlay-ad" i]:not([id*="vidsrc" i]),
  div[id*="ad-overlay" i]:not([id*="vidsrc" i]),
  div[id*="ads-" i]:not([id*="vidsrc" i]),
  div[id*="-ads" i]:not([id*="vidsrc" i]),
  aside:not([class*="vidsrc" i]):not([id*="vidsrc" i]),
  ins.adsbygoogle,
  a[target="_blank"]:not([href*="imdb.com"]):not([href*="github.com"]):not([href*="whatsapp.com"]):not([href*="wa.me"]),
  iframe[src*="doubleclick.net"],
  iframe[src*="googlesyndication.com"],
  iframe[src*="popads.net"],
  iframe[src*="adcash.com"],
  iframe[src*="juicyads.com"],
  iframe[src*="exoclick.com"],
  iframe[src*="propellerads.com"],
  iframe[src*="monetag.com"],
  iframe[src*="adsterra.com"],
  iframe[src*="acscdn.com"],
  iframe[src*="onclasrv.com"],
  iframe[src*="realsrv.com"],
  iframe[src*="magsrv.com"],
  iframe[src="about:blank"]:not([class*="vidsrc" i]):not([id*="vidsrc" i]) {
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

  styleEl.textContent = ADBLOCK_CSS_RULES;
  return styleEl;
}

/**
 * DOM Attack #1: Geometric Bounding-Box Hit-Testing Radar.
 * Samples 9 coordinate points across the video player container using document.elementsFromPoint().
 * Any foreign overlay floating over the vidsrc player is immediately neutralized.
 */
function scanAndDestroyPlayerOverlays(): void {
  if (typeof document === "undefined" || typeof window === "undefined") return;

  const playerContainer = document.querySelector(".video-player-container");
  if (!playerContainer) return;

  const rect = playerContainer.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  // Sample 9 points (center, 4 corners, 4 midpoints) over the video player
  const samplePoints: [number, number][] = [
    [rect.left + rect.width * 0.5, rect.top + rect.height * 0.5],
    [rect.left + rect.width * 0.2, rect.top + rect.height * 0.2],
    [rect.left + rect.width * 0.8, rect.top + rect.height * 0.2],
    [rect.left + rect.width * 0.2, rect.top + rect.height * 0.8],
    [rect.left + rect.width * 0.8, rect.top + rect.height * 0.8],
    [rect.left + rect.width * 0.5, rect.top + 15],
    [rect.left + rect.width * 0.5, rect.bottom - 15],
    [rect.left + 15, rect.top + rect.height * 0.5],
    [rect.right - 15, rect.top + rect.height * 0.5],
  ];

  for (const [x, y] of samplePoints) {
    if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) {
      continue;
    }

    const hitElements = document.elementsFromPoint(x, y);
    for (const el of hitElements) {
      // Stop once we hit the legitimate vidsrc iframe or player container
      if (
        el.tagName === "IFRAME" &&
        ((el as HTMLIFrameElement).src || "").toLowerCase().includes("vidsrc")
      ) {
        break;
      }
      if (el === playerContainer) {
        break;
      }

      // If an element sits ABOVE the vidsrc iframe in the z-stack:
      if (!isLegitimateAppElement(el)) {
        console.warn("[AdBlocker DOM Radar] Destroyed overlay sitting above player:", el);
        killDomElement(el as HTMLElement);
      }
    }
  }
}

/**
 * Helper to completely neutralize and remove a malicious DOM node.
 */
function killDomElement(el: HTMLElement): void {
  if (!el || isVidsrcRelated(el)) return;
  try {
    el.style.setProperty("display", "none", "important");
    el.style.setProperty("pointer-events", "none", "important");
    el.style.setProperty("visibility", "hidden", "important");
    el.style.setProperty("opacity", "0", "important");
    el.style.setProperty("z-index", "-999999", "important");
    el.style.setProperty("width", "0px", "important");
    el.style.setProperty("height", "0px", "important");
    el.remove();
  } catch {
    // Fallback if removal is restricted
  }
}

/**
 * Inspects a single DOM element to see if it behaves like an ad overlay,
 * clickjacking layer, rogue iframe, or malicious script.
 */
function isSuspiciousDomOverlay(node: HTMLElement): boolean {
  if (!node || isVidsrcRelated(node)) return false;

  const tagName = node.tagName.toLowerCase();
  const className =
    typeof node.className === "string" ? node.className.toLowerCase() : "";
  const id = (node.id || "").toLowerCase();

  // 1. Rogue iframes (anything that is NOT vidsrc and NOT youtube)
  if (tagName === "iframe") {
    const src = ((node as HTMLIFrameElement).src || "").toLowerCase();
    const srcdoc = (node as HTMLIFrameElement).srcdoc || "";
    if (
      !src.includes("vidsrc") &&
      !src.includes("youtube") &&
      (src === "" ||
        src === "about:blank" ||
        srcdoc.length > 0 ||
        isAdUrl(src))
    ) {
      return true;
    }
  }

  // 2. Rogue scripts from ad domains or containing popunder signatures
  if (tagName === "script") {
    const src = ((node as HTMLScriptElement).src || "").toLowerCase();
    const inlineCode = (node.textContent || "").toLowerCase();
    if (
      (src && isAdUrl(src)) ||
      MALICIOUS_SCRIPT_SIGNATURES.some((sig) => inlineCode.includes(sig))
    ) {
      return true;
    }
  }

  // 3. Meta refresh hijackers
  if (
    tagName === "meta" &&
    (node.getAttribute("http-equiv") || "").toLowerCase() === "refresh"
  ) {
    return true;
  }

  // 4. High-confidence class/id ad patterns
  if (
    className.includes("popunder") ||
    className.includes("popup-ad") ||
    className.includes("overlay-ad") ||
    className.includes("ad-overlay") ||
    className.includes("ad-banner") ||
    className.includes("clickunder") ||
    id.includes("popunder") ||
    id.includes("overlay-ad") ||
    id.includes("ad-overlay")
  ) {
    return true;
  }

  // 5. Direct children of <body> injected outside #root (classic ad-script injection zone)
  if (
    node.parentElement === document.body &&
    node.id !== "root" &&
    node.id !== "app" &&
    tagName !== "script" &&
    tagName !== "style" &&
    tagName !== "link"
  ) {
    return true;
  }

  // 6. Computed style check for invisible / high-z-index full-screen clickjackers
  try {
    const style = window.getComputedStyle(node);
    const zIndex = parseInt(style.zIndex, 10);
    const isPositioned =
      style.position === "fixed" || style.position === "absolute";

    if (isPositioned && !isLegitimateAppElement(node)) {
      const rect = node.getBoundingClientRect();
      const coversLargeArea =
        rect.width >= window.innerWidth * 0.25 &&
        rect.height >= window.innerHeight * 0.25;
      const isInvisibleClickLayer =
        style.opacity === "0" ||
        parseFloat(style.opacity) < 0.05 ||
        style.backgroundColor === "rgba(0, 0, 0, 0)" ||
        style.backgroundColor === "transparent";

      if (
        (!isNaN(zIndex) && zIndex > 999) ||
        (coversLargeArea && isInvisibleClickLayer)
      ) {
        return true;
      }
    }
  } catch {
    // Ignore style computation errors
  }

  return false;
}

/**
 * Self-contained ad-blocking interceptor suite with enhanced overlay and popup neutralization,
 * integrated with uBlock Origin and EasyList filter list feeds + uBlock Scriptlet traps.
 */
export function initAdBlockerGlobalInterceptors(): () => void {
  if (typeof window === "undefined") return () => {};

  // 0. Install uBlock Origin Scriptlet Traps (+js property defusers)
  installUBlockScriptletTraps();

  // Kick off asynchronous fetch/hydration of uBlock Origin & EasyList block lists
  updateUBlockLists();

  // Inject high-performance CSS protection rules
  const injectedStyle = injectAggressiveAdblockStyles();
  injectDynamicUBlockCosmeticStyles();

  // 1. Hard-Lock window.open so ad scripts cannot overwrite or bypass it
  const originalOpen = window.open;
  const lockedWindowOpen = function (
    url?: string | URL,
    target?: string,
    features?: string
  ): WindowProxy | null {
    const targetStr = url ? url.toString() : "";
    if (!shouldAllowExternalNavigation(targetStr)) {
      console.warn("[AdBlocker] Neutralized window.open:", targetStr);
      return null;
    }
    return originalOpen.call(window, url, target, features);
  };

  try {
    Object.defineProperty(window, "open", {
      configurable: true,
      writable: false,
      value: lockedWindowOpen,
    });
  } catch {
    window.open = lockedWindowOpen;
  }

  // 1b. uBlock Origin `+js(nano-setTimeout-booster)` / `setTimeout-defuser`:
  // Neutralizes string-based eval timers and popunder timers scheduled by ad scripts.
  const originalSetTimeout = window.setTimeout;
  window.setTimeout = function (
    handler: TimerHandler,
    timeout?: number,
    ...args: any[]
  ): number {
    const handlerStr =
      typeof handler === "string"
        ? handler.toLowerCase()
        : typeof handler === "function"
          ? handler.toString().toLowerCase()
          : "";

    if (
      handlerStr &&
      MALICIOUS_SCRIPT_SIGNATURES.some((sig) => handlerStr.includes(sig))
    ) {
      console.warn("[uBlock Scriptlet] Defused malicious setTimeout popunder timer");
      return 0;
    }
    return originalSetTimeout.call(window, handler, timeout, ...args);
  } as typeof window.setTimeout;

  // 2. Multi-Event Capture-Phase Shield (pointerdown, mousedown, mouseup, touchstart, click, auxclick)
  const handlePointerAndClickCapture = (event: Event) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    // If the user clicked directly on the vidsrc iframe, allow the click into the player
    if (
      target.tagName === "IFRAME" &&
      ((target as HTMLIFrameElement).src || "").toLowerCase().includes("vidsrc")
    ) {
      return;
    }

    // Check if clicking an anchor tag (even if injected dynamically)
    const anchor = target.closest("a");
    if (anchor) {
      const href = anchor.getAttribute("href") || anchor.href || "";
      const targetAttr = (anchor.getAttribute("target") || "").toLowerCase();
      if (
        !shouldAllowExternalNavigation(href) ||
        (targetAttr === "_blank" && !shouldAllowExternalNavigation(href))
      ) {
        console.warn("[AdBlocker] Blocked malicious link interaction:", href);
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        if (!isLegitimateAppElement(anchor)) {
          killDomElement(anchor);
        }
        return;
      }
    }

    // Check if the clicked element is a suspicious overlay
    if (isSuspiciousDomOverlay(target)) {
      console.warn("[AdBlocker] Neutralized suspicious overlay interaction:", target);
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      killDomElement(target);
      return;
    }

    // Neutralize transparent/invisible overlays injected directly over the page/player
    const style = window.getComputedStyle(target);
    const isTransparentOrFixed =
      (style.position === "fixed" || style.position === "absolute") &&
      (style.backgroundColor === "rgba(0, 0, 0, 0)" ||
        style.opacity === "0" ||
        parseFloat(style.opacity) < 0.05 ||
        target.tagName.toLowerCase() === "a");

    if (
      isTransparentOrFixed &&
      target.tagName.toLowerCase() !== "button" &&
      !target.closest("iframe") &&
      !isLegitimateAppElement(target)
    ) {
      console.warn("[AdBlocker] Neutralized transparent overlay element click:", target);
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      killDomElement(target);
    }
  };

  const INTERCEPTED_EVENTS = [
    "pointerdown",
    "mousedown",
    "mouseup",
    "touchstart",
    "touchend",
    "click",
    "auxclick",
    "contextmenu",
  ];

  for (const evtName of INTERCEPTED_EVENTS) {
    window.addEventListener(evtName, handlePointerAndClickCapture, true);
  }

  // 3. Iframe Focus-Steal / Popunder Trap (window.blur)
  const handleWindowBlur = () => {
    setTimeout(() => {
      scanAndDestroyPlayerOverlays();
    }, 50);
  };
  window.addEventListener("blur", handleWindowBlur);

  // 4. Block fetch to ad hosts
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

  // 5. Block XHR to ad hosts
  const originalXhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    ...args: any[]
  ) {
    const urlStr = url ? url.toString() : "";
    if (isAdUrl(urlStr)) {
      console.warn("[AdBlocker] Blocked ad XHR:", urlStr);
      return originalXhrOpen.call(this, method, "data:text/plain,", ...args);
    }
    return originalXhrOpen.call(this, method, url, ...args);
  };

  // 6. Block navigator.sendBeacon to ad hosts
  const originalSendBeacon =
    typeof navigator !== "undefined" && navigator.sendBeacon
      ? navigator.sendBeacon.bind(navigator)
      : null;
  if (originalSendBeacon) {
    navigator.sendBeacon = function (url: string | URL, data?: BodyInit | null) {
      if (isAdUrl(url.toString())) {
        console.warn("[AdBlocker] Blocked ad beacon:", url.toString());
        return true;
      }
      return originalSendBeacon(url, data);
    };
  }

  // 7. DOM Creation & Insertion Firewall (createElement, appendChild, insertBefore, attachShadow)
  const originalCreateElement = document.createElement.bind(document);
  document.createElement = function (
    tagName: string,
    options?: ElementCreationOptions
  ) {
    const el = originalCreateElement(tagName, options);
    const lowerTag = tagName.toLowerCase();

    if (lowerTag === "a") {
      const originalSetAttribute = el.setAttribute.bind(el);
      el.setAttribute = function (name: string, value: string) {
        if (name.toLowerCase() === "target" && value === "_blank") {
          console.debug("[AdBlocker] Script tried to set target=_blank");
        }
        return originalSetAttribute(name, value);
      };
      const originalClick = el.click.bind(el);
      el.click = function () {
        const href = (el as HTMLAnchorElement).href || "";
        if (!shouldAllowExternalNavigation(href)) {
          console.warn("[AdBlocker] Blocked programmatic anchor .click() hijack:", href);
          return;
        }
        return originalClick();
      };
    }

    return el;
  };

  // Pierce Shadow DOMs created by modern ad scripts and inject our ad-killing stylesheet
  const originalAttachShadow = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function (init: ShadowRootInit): ShadowRoot {
    const shadowRoot = originalAttachShadow.call(this, {
      ...init,
      mode: "open",
    });
    try {
      const style = originalCreateElement("style");
      style.textContent = ADBLOCK_CSS_RULES;
      shadowRoot.appendChild(style);
    } catch {
      // Ignore if shadow style injection fails
    }
    return shadowRoot;
  };

  // Intercept appendChild & insertBefore to block ad <script> and rogue <iframe> nodes before execution
  const originalAppendChild = Node.prototype.appendChild;
  Node.prototype.appendChild = function <T extends Node>(newChild: T): T {
    if (newChild instanceof HTMLElement && isSuspiciousDomOverlay(newChild)) {
      console.warn("[AdBlocker Firewall] Blocked appendChild of malicious node:", newChild);
      const dummy = originalCreateElement("span");
      dummy.style.display = "none";
      return dummy as unknown as T;
    }
    return originalAppendChild.call(this, newChild) as T;
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(
    newNode: T,
    referenceNode: Node | null
  ): T {
    if (newNode instanceof HTMLElement && isSuspiciousDomOverlay(newNode)) {
      console.warn("[AdBlocker Firewall] Blocked insertBefore of malicious node:", newNode);
      const dummy = originalCreateElement("span");
      dummy.style.display = "none";
      return dummy as unknown as T;
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };

  // 8. MutationObserver to automatically strip out injected full-screen transparent ad overlays or suspicious popup elements
  const observer = new MutationObserver((mutations) => {
    if (pageContainsScamText()) {
      console.warn(
        "[AdBlocker] Scam text detected on parent page – hard block mode active"
      );
    }

    for (const mutation of mutations) {
      if (mutation.type === "attributes" && mutation.target instanceof HTMLElement) {
        const targetEl = mutation.target;
        if (!isVidsrcRelated(targetEl) && isSuspiciousDomOverlay(targetEl)) {
          console.warn("[AdBlocker] Stripped mutated ad element:", targetEl);
          killDomElement(targetEl);
        }
        continue;
      }

      for (const node of Array.from(mutation.addedNodes)) {
        if (node instanceof HTMLElement) {
          // ABSOLUTE PROHIBITION: Never touch vidsrc iframe or container
          if (isVidsrcRelated(node)) {
            continue;
          }

          if (isSuspiciousDomOverlay(node)) {
            console.warn("[AdBlocker] Stripped injected ad overlay via MutationObserver:", node);
            killDomElement(node);
            continue;
          }

          // Also scan children of newly added wrapper nodes
          const nestedSuspects = node.querySelectorAll(
            'iframe:not([src*="vidsrc"]):not([src*="youtube"]), script, ins, a[target="_blank"], div[style*="fixed"], div[style*="z-index"]'
          );
          nestedSuspects.forEach((child) => {
            if (child instanceof HTMLElement && isSuspiciousDomOverlay(child)) {
              console.warn("[AdBlocker] Stripped nested ad child:", child);
              killDomElement(child);
            }
          });
        }
      }
    }
  });

  if (document.documentElement) {
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class", "src", "href"],
    });
  }

  // 9. Periodic sweep interval (runs Geometric Radar + DOM selector sweep)
  const cleanupInterval = setInterval(() => {
    if (typeof document === "undefined") return;

    // Run geometric hit-box radar over the video player
    scanAndDestroyPlayerOverlays();

    // Sweep known ad selectors
    const suspiciousElements = document.querySelectorAll(
      'div[class*="popunder" i], div[class*="overlay-ad" i], div[id*="popunder" i], iframe[src="about:blank"], ins.adsbygoogle'
    );
    suspiciousElements.forEach((el) => {
      if (el instanceof HTMLElement && !isVidsrcRelated(el)) {
        console.warn("[AdBlocker] Periodic sweep neutralized ad element:", el);
        killDomElement(el);
      }
    });

    // Sweep any direct children appended to <body> outside #root
    Array.from(document.body.children).forEach((child) => {
      if (
        child instanceof HTMLElement &&
        !isLegitimateAppElement(child) &&
        isSuspiciousDomOverlay(child)
      ) {
        console.warn("[AdBlocker] Removed rogue body child:", child);
        killDomElement(child);
      }
    });
  }, 1200);

  // Cleanup function
  return () => {
    try {
      Object.defineProperty(window, "open", {
        configurable: true,
        writable: true,
        value: originalOpen,
      });
    } catch {
      window.open = originalOpen;
    }

    window.setTimeout = originalSetTimeout;

    for (const evtName of INTERCEPTED_EVENTS) {
      window.removeEventListener(evtName, handlePointerAndClickCapture, true);
    }
    window.removeEventListener("blur", handleWindowBlur);

    window.fetch = originalFetch;
    XMLHttpRequest.prototype.open = originalXhrOpen;
    if (originalSendBeacon) {
      navigator.sendBeacon = originalSendBeacon;
    }
    document.createElement = originalCreateElement;
    Element.prototype.attachShadow = originalAttachShadow;
    Node.prototype.appendChild = originalAppendChild;
    Node.prototype.insertBefore = originalInsertBefore;

    observer.disconnect();
    clearInterval(cleanupInterval);
    if (injectedStyle && injectedStyle.parentNode) {
      injectedStyle.parentNode.removeChild(injectedStyle);
    }
    const cosmeticStyleEl = document.getElementById("rab-ublock-cosmetic-styles");
    if (cosmeticStyleEl && cosmeticStyleEl.parentNode) {
      cosmeticStyleEl.parentNode.removeChild(cosmeticStyleEl);
    }
  };
}
