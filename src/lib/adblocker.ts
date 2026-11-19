// src/lib/adblocker.ts
import { getHardwareLimits, purgeOldTmdbCaches } from "./settings";

/**
 * Ad / tracking / popup / popunder hosts.
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
  // Streaming / vidsrc popunder & overlay ad networks
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
  "admaven.com",
  "adspyglass.com",
  "clickaine.com",
  "trafficstars.com",
  "popmyads.com",
  "plugrush.com",
  "pushhouse.com",
  "kadam.net",
  "zeropark.com",
  "wpadmngr.com",
  "highperformanceformat.com",
  "topcreativeformat.com",
  "profitablegate.com",
  "effectivegatecpm.com",
  "alwingulla.com",
  "al5sm.com",
  "fpyf8.com",
  "bvtpk.com",
  "dolohen.com",
  "goomaphy.com",
  "thaudray.com",
  "inpagepush.com",
  "pushub.net",
  "a-ads.com",
  "exdynsrv.com",
  "bet365.com",
  "1xbet.com",
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
  "admaven",
  "adspyglass",
  "clickaine",
  "trafficstars",
  "inpagepush",
  "wpadmngr",
  "profitablegate",
  "effectivegate",
  "casino",
  "slots",
];

/**
 * Scam / fake-captcha / reward-bait / fake-player overlay phrases.
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
  /click\s+allow\s+to\s+(watch|verify|continue|play)/i,
  /vpn\s+required\s+to\s+stream/i,
  /disable\s+adblock\s+to\s+continue/i,
];

/**
 * Inline script signatures used by popunder and overlay injectors.
 */
const MALICIOUS_SCRIPT_SIGNATURES = [
  "aclib.runpop",
  "aclib.runauto",
  "aclib.runinpagepush",
  "aclib.runbanner",
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
  "betterjspop",
  "admaven",
  "hilltopads",
  "inpagepush",
  "wpadmngr",
  "__htapop",
];

/**
 * uBlock Origin Scriptlet Globals (abort-on-property-read / write targets).
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
  "AdMaven",
  "am_pop",
  "PuJs",
  "popMagic",
  "popUnder",
  "_wm_pop",
  "wpadmngr",
  "zfgloadedpopup",
  "zfgloadedpush",
];

/**
 * uBlock Origin & Upstream Filter List URLs (CORS-friendly raw mirrors).
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

// Uses rabtv_cache_ prefix so settings.ts purgeOldTmdbCaches() can safely reclaim space on 1-2GB sticks
const UBLOCK_CACHE_STORAGE_KEY = "rabtv_cache_ublock_rules_v2";
const UBLOCK_CACHE_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours
const UBLOCK_FETCH_TIMEOUT_MS = 6500;

export interface AdBlockerStats {
  blockedOverlays: number;
  blockedPopups: number;
  blockedNetwork: number;
  blockedScripts: number;
  blockedForms: number;
  totalBlocked: number;
  loadedNetworkRules: number;
  loadedCosmeticRules: number;
}

const sessionStats = {
  blockedOverlays: 0,
  blockedPopups: 0,
  blockedNetwork: 0,
  blockedScripts: 0,
  blockedForms: 0,
};

let lastStatsEmitAt = 0;

function recordBlock(
  category:
    | "blockedOverlays"
    | "blockedPopups"
    | "blockedNetwork"
    | "blockedScripts"
    | "blockedForms"
): void {
  sessionStats[category]++;
  if (typeof window !== "undefined") {
    const now = Date.now();
    if (now - lastStatsEmitAt > 600) {
      lastStatsEmitAt = now;
      window.dispatchEvent(
        new CustomEvent("rabtv_adblock_stats_updated", {
          detail: getAdBlockerStats(),
        })
      );
    }
  }
}

export function getAdBlockerStats(): AdBlockerStats {
  const totalBlocked =
    sessionStats.blockedOverlays +
    sessionStats.blockedPopups +
    sessionStats.blockedNetwork +
    sessionStats.blockedScripts +
    sessionStats.blockedForms;

  return {
    ...sessionStats,
    totalBlocked,
    loadedNetworkRules: dynamicBlockRules.size,
    loadedCosmeticRules: dynamicCosmeticSelectors.size,
  };
}

let dynamicBlockRules: Set<string> = new Set();
let dynamicCosmeticSelectors: Set<string> = new Set();
let listsLoaded = false;
let listsLoadingPromise: Promise<void> | null = null;

// Track all pierced ShadowRoots so our sweep & cleanup handle them cleanly
const trackedShadowRoots = new Set<ShadowRoot>();
const shadowObservers = new Map<ShadowRoot, MutationObserver>();

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
 * Saves parsed uBlock rules to localStorage (RAM & quota safe for 1-2GB sticks).
 */
function persistUBlockRulesToCache(): void {
  if (typeof window === "undefined") return;
  const isLowRam = getHardwareLimits().effectiveMode === "low";
  const maxNet = isLowRam ? 8000 : 15000;
  const maxCosmetic = isLowRam ? 1500 : 3000;

  const serialized = JSON.stringify({
    timestamp: Date.now(),
    networkRules: Array.from(dynamicBlockRules).slice(0, maxNet),
    cosmeticSelectors: Array.from(dynamicCosmeticSelectors).slice(
      0,
      maxCosmetic
    ),
  });

  try {
    localStorage.setItem(UBLOCK_CACHE_STORAGE_KEY, serialized);
  } catch {
    try {
      purgeOldTmdbCaches();
      localStorage.setItem(UBLOCK_CACHE_STORAGE_KEY, serialized);
    } catch {
      // Fall back to in-memory rules only
    }
  }
}

function buildCosmeticCssText(): string {
  if (dynamicCosmeticSelectors.size === 0) return "";
  const isLowRam = getHardwareLimits().effectiveMode === "low";
  const safeSelectors = Array.from(dynamicCosmeticSelectors).slice(
    0,
    isLowRam ? 1200 : 2500
  );
  const chunkedCss: string[] = [];
  const chunkSize = 250;

  for (let i = 0; i < safeSelectors.length; i += chunkSize) {
    const slice = safeSelectors.slice(i, i + chunkSize);
    chunkedCss.push(
      `${slice.join(",\n")} {\n  display: none !important;\n  visibility: hidden !important;\n  opacity: 0 !important;\n  pointer-events: none !important;\n}`
    );
  }
  return chunkedCss.join("\n\n");
}

/**
 * Injects parsed uBlock Origin `##selector` cosmetic rules into document.head
 * and any tracked ShadowRoots while strictly excluding vidsrc and protected RABBiT TV nodes.
 */
function injectDynamicUBlockCosmeticStyles(): void {
  if (typeof document === "undefined" || dynamicCosmeticSelectors.size === 0) {
    return;
  }

  const cssText = buildCosmeticCssText();
  const styleId = "rab-ublock-cosmetic-styles";
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = styleId;
    styleEl.className = "rabtv-vidsrc-protected";
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = cssText;

  // Also keep pierced ShadowRoots updated
  trackedShadowRoots.forEach((root) => {
    try {
      let s = root.getElementById(styleId) as HTMLStyleElement | null;
      if (!s) {
        s = document.createElement("style");
        s.id = styleId;
        root.appendChild(s);
      }
      s.textContent = cssText;
    } catch {
      // Ignore detached shadow roots
    }
  });
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
        dynamicCosmeticSelectors.add(
          `${selector}:not(.rabtv-vidsrc-protected):not([class*="vidsrc" i]):not([id*="vidsrc" i])`
        );
      }
      continue;
    }

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

    if (rule.includes("^")) rule = rule.split("^")[0];
    if (rule.includes("$")) rule = rule.split("$")[0];
    if (rule.includes("/")) rule = rule.split("/")[0];

    if (
      rule.length > 4 &&
      rule.includes(".") &&
      !rule.includes("*") &&
      !rule.includes("vidsrc") &&
      !rule.includes("themoviedb") &&
      !rule.includes("tmdb") &&
      !rule.includes("youtube") &&
      !rule.includes("github") &&
      !rule.includes("mjh.nz")
    ) {
      dynamicBlockRules.add(rule.toLowerCase());
    }
  }
}

/**
 * Asynchronously fetches and parses official uBlock Origin and EasyList filter lists
 * with strict per-request AbortController timeouts so slow TV Wi-Fi never stalls boot.
 */
export async function updateUBlockLists(): Promise<void> {
  if (typeof window === "undefined") return;

  if (hydrateCachedUBlockRules()) {
    return;
  }

  if (listsLoaded) return;
  if (listsLoadingPromise) return listsLoadingPromise;

  listsLoadingPromise = (async () => {
    try {
      const fetchPromises = UBLOCK_ORIGIN_FILTER_URLS.map(async (url) => {
        const controller = new AbortController();
        const timer = window.setTimeout(
          () => controller.abort(),
          UBLOCK_FETCH_TIMEOUT_MS
        );
        try {
          const response = await fetch(url, { signal: controller.signal });
          if (!response.ok) return "";
          return await response.text();
        } finally {
          window.clearTimeout(timer);
        }
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
 * uBlock Origin Scriptlet Engine:
 * Traps global variables used by popunder/overlay scripts so calls silently no-op.
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

      const inertProxy: any = new Proxy(() => inertProxy, {
        get: () => inertProxy,
        set: () => true,
        apply: () => inertProxy,
        construct: () => inertProxy,
      });

      Object.defineProperty(window, prop, {
        configurable: true,
        get() {
          recordBlock("blockedScripts");
          return inertProxy;
        },
        set() {
          recordBlock("blockedScripts");
          return true;
        },
      });
    } catch {
      // Ignore if property is already locked
    }
  }
}

/**
 * Robust ad URL matcher – O(1) uBlock domain lookup + static lists + host keywords.
 */
export function isAdUrl(urlStr: string): boolean {
  if (!urlStr) return false;

  const lowerUrl = urlStr.toLowerCase().trim();

  // Never block vidsrc, TMDB, YouTube, GitHub assets, or live TV feeds
  if (
    lowerUrl.includes("vidsrc") ||
    lowerUrl.includes("themoviedb.org") ||
    lowerUrl.includes("tmdb.org") ||
    lowerUrl.includes("youtube.com") ||
    lowerUrl.includes("youtube-nocookie.com") ||
    lowerUrl.includes("githubusercontent.com") ||
    lowerUrl.includes("api.github.com") ||
    lowerUrl.includes("mjh.nz")
  ) {
    return false;
  }

  if (lowerUrl.startsWith("javascript:")) {
    return true;
  }

  if (dynamicBlockRules.size > 0) {
    try {
      const parsed = new URL(
        urlStr,
        typeof window !== "undefined"
          ? window.location.origin
          : "https://localhost"
      );
      const host = parsed.hostname.toLowerCase();
      if (dynamicBlockRules.has(host)) return true;
      const parts = host.split(".");
      for (let i = 1; i < parts.length - 1; i++) {
        if (dynamicBlockRules.has(parts.slice(i).join("."))) {
          return true;
        }
      }
    } catch {
      // Fallback below
    }
  }

  try {
    const url = new URL(
      urlStr,
      typeof window !== "undefined" ? window.location.origin : undefined
    );
    const host = url.hostname.toLowerCase();

    if (
      AD_DOMAINS.some(
        (domain) => host === domain || host.endsWith("." + domain)
      )
    ) {
      return true;
    }

    if (AD_HOST_KEYWORDS.some((kw) => host.includes(kw))) {
      return true;
    }

    return false;
  } catch {
    return (
      AD_DOMAINS.some((d) => lowerUrl.includes(d)) ||
      AD_HOST_KEYWORDS.some((kw) => lowerUrl.includes(kw))
    );
  }
}

/**
 * Validates if an outgoing navigation request is allowed to leave the app.
 */
export function shouldAllowExternalNavigation(url: string): boolean {
  if (!url) return false;

  const lowerUrl = url.toLowerCase().trim();

  if (
    lowerUrl === "about:blank" ||
    lowerUrl.startsWith("javascript:") ||
    lowerUrl.startsWith("blob:") ||
    lowerUrl.startsWith("data:")
  ) {
    return false;
  }

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
    (lowerUrl.includes("github.com") ||
      lowerUrl.includes("githubusercontent.com")) &&
    (lowerUrl.includes("/releases/download/") ||
      lowerUrl.includes("/releases/latest") ||
      lowerUrl.includes("raw.githubusercontent.com") ||
      lowerUrl.includes("/rogerskyle0506-ui/rabbit-tv-2.0/"))
  ) {
    return true;
  }

  // Official IMDb links intentionally clicked by the user
  if (
    lowerUrl.includes("imdb.com/title/") ||
    lowerUrl.includes("imdb.com/find")
  ) {
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

  // Strict lock on /details and /player pages against any other external redirect
  const currentPath =
    typeof window !== "undefined" ? window.location.pathname : "";
  if (currentPath.includes("/details") || currentPath.includes("/player")) {
    return false;
  }

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

  recordBlock("blockedPopups");
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
 * Checks if a DOM node was genuinely rendered by React (via React 18+ Fiber keys).
 * Foreign ad overlays injected into #root or <body> NEVER possess React Fiber keys.
 */
function hasReactFiberSignature(element: Element | null): boolean {
  if (!element) return false;
  const keys = Object.keys(element);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (
      k.startsWith("__reactFiber$") ||
      k.startsWith("__reactProps$") ||
      k.startsWith("__reactContainer$") ||
      k.startsWith("__reactInternalInstance$")
    ) {
      return true;
    }
  }
  return false;
}

/**
 * ABSOLUTE PROHIBITION COMPLIANCE:
 * Determines if an element IS the VIDSRC iframe, its direct wrapper container,
 * or an ancestor containing the VIDSRC iframe. Never touch or modify vidsrc.
 */
function isVidsrcRelated(element: Element | null): boolean {
  if (!element) return false;

  if (
    element.querySelector &&
    element.querySelector('iframe[src*="vidsrc"], iframe[src*="youtube"]')
  ) {
    return true;
  }

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
 * Strictly verifies whether an element is part of RABBiT TV's legitimate React UI.
 * Closes the #root loophole by requiring React Fiber keys or explicit rabtv-vidsrc-protected tagging.
 */
function isLegitimateAppElement(element: Element | null): boolean {
  if (!element) return false;
  if (isVidsrcRelated(element)) return true;

  if (
    element === document.body ||
    element === document.documentElement ||
    element.id === "root" ||
    element.id === "app" ||
    element.classList.contains("player-view-wrapper") ||
    element.classList.contains("video-player-container") ||
    element.classList.contains("rabtv-vidsrc-protected") ||
    Boolean(element.closest(".rabtv-vidsrc-protected"))
  ) {
    return true;
  }

  const tag = element.tagName.toLowerCase();
  if (tag === "ins") return false;
  if (tag === "iframe" && !isVidsrcRelated(element)) return false;

  if (tag === "a") {
    const href =
      element.getAttribute("href") || (element as HTMLAnchorElement).href || "";
    if (href && !shouldAllowExternalNavigation(href)) {
      return false;
    }
  }

  // Genuine React-owned DOM elements carry internal React Fiber keys
  if (hasReactFiberSignature(element)) {
    return true;
  }

  // Core semantic layout tags & our own injected style tags
  if (
    tag === "header" ||
    tag === "main" ||
    tag === "nav" ||
    tag === "footer" ||
    (tag === "style" &&
      (element.id === "rab-industrial-adblock-styles" ||
        element.id === "rab-ublock-cosmetic-styles"))
  ) {
    return true;
  }

  return false;
}

/**
 * Fast, targeted scam-text check on a single foreign node (never triggers full-page reflows).
 */
function nodeContainsScamText(node: HTMLElement): boolean {
  const txt = (node.textContent || "").trim();
  if (txt.length < 10 || txt.length > 1500) return false;
  return SCAM_TEXT_PATTERNS.some((re) => re.test(txt));
}

const ADBLOCK_CSS_RULES = `
  /* Industrial Ad & Clickjacking Neutralization Styles (Protects vidsrc & RABBiT TV UI) */
  div[class*="banner" i]:not(.rabtv-vidsrc-protected):not([class*="vidsrc" i]),
  div[class*="popup" i]:not(.rabtv-vidsrc-protected):not([class*="vidsrc" i]),
  div[class*="popunder" i]:not(.rabtv-vidsrc-protected):not([class*="vidsrc" i]),
  div[class*="overlay-ad" i]:not(.rabtv-vidsrc-protected):not([class*="vidsrc" i]),
  div[class*="ad-overlay" i]:not(.rabtv-vidsrc-protected):not([class*="vidsrc" i]),
  div[class*="advert" i]:not(.rabtv-vidsrc-protected):not([class*="vidsrc" i]),
  div[class*="sponsored" i]:not(.rabtv-vidsrc-protected):not([class*="vidsrc" i]),
  div[id*="banner" i]:not(.rabtv-vidsrc-protected):not([id*="vidsrc" i]),
  div[id*="popup" i]:not(.rabtv-vidsrc-protected):not([id*="vidsrc" i]),
  div[id*="popunder" i]:not(.rabtv-vidsrc-protected):not([id*="vidsrc" i]),
  div[id*="overlay-ad" i]:not(.rabtv-vidsrc-protected):not([id*="vidsrc" i]),
  div[id*="ad-overlay" i]:not(.rabtv-vidsrc-protected):not([id*="vidsrc" i]),
  div[id*="ads-" i]:not(.rabtv-vidsrc-protected):not([id*="vidsrc" i]),
  div[id*="-ads" i]:not(.rabtv-vidsrc-protected):not([id*="vidsrc" i]),
  ins.adsbygoogle,
  a[target="_blank"]:not(.rabtv-vidsrc-protected):not([href*="imdb.com"]):not([href*="github.com"]):not([href*="whatsapp.com"]):not([href*="wa.me"]),
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
  iframe[src*="admaven.com"],
  iframe[src*="hilltopads.com"],
  iframe[src="about:blank"]:not(.rabtv-vidsrc-protected):not([class*="vidsrc" i]):not([id*="vidsrc" i]) {
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

function injectAggressiveAdblockStyles(): HTMLStyleElement | null {
  if (typeof document === "undefined") return null;

  const styleId = "rab-industrial-adblock-styles";
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = styleId;
    styleEl.className = "rabtv-vidsrc-protected";
    document.head.appendChild(styleEl);
  }

  styleEl.textContent = ADBLOCK_CSS_RULES;
  return styleEl;
}

/**
 * Completely neutralizes and removes a malicious foreign DOM node.
 */
function killDomElement(el: HTMLElement): void {
  if (!el || isVidsrcRelated(el)) return;
  try {
    recordBlock("blockedOverlays");
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
 * Inspects a single DOM element (or Shadow DOM element) to detect ad overlays,
 * invisible clickjacking traps, rogue iframes, fake forms, scam prompts, or ad scripts.
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
        src.startsWith("javascript:") ||
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

  // 4. Hidden popup <form target="_blank" action="ad-host">
  if (tagName === "form") {
    const action = node.getAttribute("action") || "";
    const target = (node.getAttribute("target") || "").toLowerCase();
    if (
      (action && !shouldAllowExternalNavigation(action)) ||
      (target === "_blank" && !isLegitimateAppElement(node))
    ) {
      return true;
    }
  }

  // If verified as a genuine React / protected RABBiT TV UI element, stop here
  if (isLegitimateAppElement(node)) {
    return false;
  }

  // 5. High-confidence class/id ad patterns
  if (
    className.includes("popunder") ||
    className.includes("popup-ad") ||
    className.includes("overlay-ad") ||
    className.includes("ad-overlay") ||
    className.includes("ad-banner") ||
    className.includes("clickunder") ||
    className.includes("adblock-overlay") ||
    id.includes("popunder") ||
    id.includes("overlay-ad") ||
    id.includes("ad-overlay")
  ) {
    return true;
  }

  // 6. Scam / fake-captcha / fake-player text injected into foreign node
  if (nodeContainsScamText(node)) {
    return true;
  }

  // 7. Direct foreign children of <body> outside #root
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

  // 8. Foreign high-z-index, invisible, or viewport/player-overlapping clickjackers
  // Catches <div>, <a>, <canvas>, <svg>, <label>, <section> overlays even inside #root!
  try {
    const style = window.getComputedStyle(node);
    const zIndex = parseInt(style.zIndex, 10);
    const isPositioned =
      style.position === "fixed" ||
      style.position === "absolute" ||
      style.position === "sticky";

    if (isPositioned) {
      const rect = node.getBoundingClientRect();
      const coversSignificantArea =
        rect.width >= window.innerWidth * 0.2 &&
        rect.height >= window.innerHeight * 0.2;
      const isTransparentShield =
        style.opacity === "0" ||
        parseFloat(style.opacity) < 0.08 ||
        style.backgroundColor === "rgba(0, 0, 0, 0)" ||
        style.backgroundColor === "transparent";
      const hasSuspiciousCursor =
        style.cursor === "pointer" && coversSignificantArea;

      if (
        (!isNaN(zIndex) && zIndex >= 900) ||
        (coversSignificantArea && (isTransparentShield || hasSuspiciousCursor)) ||
        (tagName === "a" && rect.width > 120 && rect.height > 120)
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
 * Inspects a single hit element (and pierces into its open ShadowRoot if present).
 */
function inspectHitStackAtPoint(
  elements: Element[],
  x: number,
  y: number,
  playerContainer: Element
): void {
  for (const el of elements) {
    if (
      el.tagName === "IFRAME" &&
      ((el as HTMLIFrameElement).src || "").toLowerCase().includes("vidsrc")
    ) {
      break;
    }
    if (el === playerContainer) {
      break;
    }

    // If this element hosts an open Shadow DOM, pierce inside it recursively
    if (el.shadowRoot && typeof el.shadowRoot.elementsFromPoint === "function") {
      try {
        const shadowHits = el.shadowRoot.elementsFromPoint(x, y);
        for (const sEl of shadowHits) {
          if (
            sEl instanceof HTMLElement &&
            sEl !== el &&
            !isLegitimateAppElement(sEl)
          ) {
            killDomElement(sEl);
          }
        }
      } catch {
        // ignore shadow hit-test errors
      }
    }

    // Foreign element sitting ABOVE the vidsrc iframe in the visual z-stack
    if (el instanceof HTMLElement && !isLegitimateAppElement(el)) {
      console.warn(
        "[AdBlocker 13-Point Radar] Destroyed overlay sitting above player:",
        el
      );
      killDomElement(el);
    }
  }
}

/**
 * DOM Attack #1: 13-Point Geometric Bounding-Box Hit-Testing Radar (with Shadow DOM piercing).
 * Samples 13 coordinates across the player container and destroys any foreign element floating above it.
 */
function scanAndDestroyPlayerOverlays(): void {
  if (typeof document === "undefined" || typeof window === "undefined") return;

  const playerContainer = document.querySelector(".video-player-container");
  if (!playerContainer) return;

  const rect = playerContainer.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  const samplePoints: [number, number][] = [
    // Center + Inner Play-Button Ring (most common clickjacking zone!)
    [rect.left + rect.width * 0.5, rect.top + rect.height * 0.5],
    [rect.left + rect.width * 0.42, rect.top + rect.height * 0.5],
    [rect.left + rect.width * 0.58, rect.top + rect.height * 0.5],
    [rect.left + rect.width * 0.5, rect.top + rect.height * 0.38],
    [rect.left + rect.width * 0.5, rect.top + rect.height * 0.62],
    // Quadrants
    [rect.left + rect.width * 0.2, rect.top + rect.height * 0.2],
    [rect.left + rect.width * 0.8, rect.top + rect.height * 0.2],
    [rect.left + rect.width * 0.2, rect.top + rect.height * 0.8],
    [rect.left + rect.width * 0.8, rect.top + rect.height * 0.8],
    // Perimeter Edges (catches close-button & control-bar overlays)
    [rect.left + rect.width * 0.5, rect.top + 14],
    [rect.left + rect.width * 0.5, rect.bottom - 14],
    [rect.left + 14, rect.top + rect.height * 0.5],
    [rect.right - 14, rect.top + rect.height * 0.5],
  ];

  for (const [x, y] of samplePoints) {
    if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) {
      continue;
    }
    const hitElements = document.elementsFromPoint(x, y);
    inspectHitStackAtPoint(hitElements, x, y, playerContainer);
  }
}

/**
 * Deeply sweeps a DOM container (document or ShadowRoot) for foreign overlays & rogue nodes.
 */
function sweepRootForOverlays(root: Document | ShadowRoot): void {
  const suspiciousElements = root.querySelectorAll(
    'div[class*="popunder" i], div[class*="overlay-ad" i], div[class*="ad-overlay" i], div[id*="popunder" i], iframe:not([src*="vidsrc"]):not([src*="youtube"]), ins.adsbygoogle, form[target="_blank"], a[target="_blank"]:not(.rabtv-vidsrc-protected)'
  );

  suspiciousElements.forEach((el) => {
    if (
      el instanceof HTMLElement &&
      !isVidsrcRelated(el) &&
      isSuspiciousDomOverlay(el)
    ) {
      killDomElement(el);
    }
  });
}

/**
 * Public on-demand sweep trigger (can be called manually if needed).
 */
export function forceDomOverlaySweep(): void {
  if (typeof document === "undefined") return;
  scanAndDestroyPlayerOverlays();
  sweepRootForOverlays(document);
  trackedShadowRoots.forEach((sr) => sweepRootForOverlays(sr));

  if (document.body) {
    Array.from(document.body.children).forEach((child) => {
      if (
        child instanceof HTMLElement &&
        !isLegitimateAppElement(child) &&
        isSuspiciousDomOverlay(child)
      ) {
        killDomElement(child);
      }
    });
  }
}

/**
 * Checks raw HTML strings passed to insertAdjacentHTML / document.write for ad payloads.
 */
function isSuspiciousHtmlString(html: string): boolean {
  if (!html || typeof html !== "string") return false;
  const lower = html.toLowerCase();
  if (lower.includes("vidsrc") || lower.includes("rabtv-vidsrc-protected")) {
    return false;
  }
  if (MALICIOUS_SCRIPT_SIGNATURES.some((sig) => lower.includes(sig))) {
    return true;
  }
  if (SCAM_TEXT_PATTERNS.some((re) => re.test(html))) {
    return true;
  }
  // Check embedded URLs inside raw HTML tags
  const urlMatches = html.match(/https?:\/\/[^\s"'<>]+/gi);
  if (urlMatches && urlMatches.some((u) => isAdUrl(u))) {
    return true;
  }
  return false;
}

/**
 * Self-contained multi-layer ad-blocking interceptor suite.
 * Hardened against popunders, invisible clickjacking shields, Shadow DOM overlays,
 * form-submit redirects, synthetic click events, and rogue scripts — while strictly
 * leaving the vidsrc <iframe> 100% untouched.
 */
export function initAdBlockerGlobalInterceptors(): () => void {
  if (typeof window === "undefined") return () => {};

  // 0. Install uBlock Origin Scriptlet Traps (+js property defusers)
  installUBlockScriptletTraps();
  void updateUBlockLists();

  // Inject CSS protection rules
  const injectedStyle = injectAggressiveAdblockStyles();
  injectDynamicUBlockCosmeticStyles();

  // 1. Hard-Lock window.open
  const originalOpen = window.open;
  const lockedWindowOpen = function (
    url?: string | URL,
    target?: string,
    features?: string
  ): WindowProxy | null {
    const targetStr = url ? url.toString() : "";
    if (!shouldAllowExternalNavigation(targetStr)) {
      recordBlock("blockedPopups");
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

  // 1b. Defuse Notification.requestPermission ("Allow notifications to watch" scam overlays)
  const originalNotificationRequest =
    typeof Notification !== "undefined" && Notification.requestPermission
      ? Notification.requestPermission.bind(Notification)
      : null;
  if (originalNotificationRequest) {
    try {
      Notification.requestPermission = async () => {
        recordBlock("blockedPopups");
        return "denied";
      };
    } catch {
      // Ignore if read-only on WebView
    }
  }

  // 1c. uBlock Scriptlet setTimeout & setInterval defusers
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
      recordBlock("blockedScripts");
      return 0;
    }
    return originalSetTimeout.call(window, handler, timeout, ...args);
  } as typeof window.setTimeout;

  const originalSetInterval = window.setInterval;
  window.setInterval = function (
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
      recordBlock("blockedScripts");
      return 0;
    }
    return originalSetInterval.call(window, handler, timeout, ...args);
  } as typeof window.setInterval;

  // 2. Multi-Event Capture-Phase Shield (mouse, pointer, touch, click, auxclick, contextmenu)
  const handlePointerAndClickCapture = (event: Event) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    // Allow direct interaction with the vidsrc iframe
    if (
      target.tagName === "IFRAME" &&
      ((target as HTMLIFrameElement).src || "").toLowerCase().includes("vidsrc")
    ) {
      return;
    }

    // Check anchor clicks (including composedPath for Shadow DOM links)
    const composedPath =
      typeof event.composedPath === "function" ? event.composedPath() : [target];
    for (const pathNode of composedPath) {
      if (!(pathNode instanceof HTMLElement)) continue;

      if (pathNode.tagName === "A") {
        const href =
          pathNode.getAttribute("href") ||
          (pathNode as HTMLAnchorElement).href ||
          "";
        const targetAttr = (
          pathNode.getAttribute("target") || ""
        ).toLowerCase();
        if (
          !shouldAllowExternalNavigation(href) ||
          (targetAttr === "_blank" && !shouldAllowExternalNavigation(href))
        ) {
          recordBlock("blockedPopups");
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          if (!isLegitimateAppElement(pathNode)) {
            killDomElement(pathNode);
          }
          return;
        }
      }

      if (isSuspiciousDomOverlay(pathNode)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        killDomElement(pathNode);
        return;
      }
    }

    // Extra transparent-overlay check on direct target
    if (!isLegitimateAppElement(target)) {
      try {
        const style = window.getComputedStyle(target);
        const isTransparentOrFixed =
          (style.position === "fixed" || style.position === "absolute") &&
          (style.backgroundColor === "rgba(0, 0, 0, 0)" ||
            style.backgroundColor === "transparent" ||
            style.opacity === "0" ||
            parseFloat(style.opacity) < 0.08 ||
            target.tagName.toLowerCase() === "a");

        if (
          isTransparentOrFixed &&
          target.tagName.toLowerCase() !== "button" &&
          !target.closest("iframe")
        ) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          killDomElement(target);
        }
      } catch {
        // ignore
      }
    }
  };

  const INTERCEPTED_EVENTS = [
    "pointerdown",
    "pointerup",
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

  // 3. Iframe Focus-Steal / Popunder Trap + Malicious postMessage Blocker
  const handleWindowBlur = () => {
    originalSetTimeout.call(window, () => {
      forceDomOverlaySweep();
    }, 60);
  };
  window.addEventListener("blur", handleWindowBlur);

  const handleMessageCapture = (event: MessageEvent) => {
    if (typeof event.data === "string") {
      const lower = event.data.toLowerCase();
      if (
        (lower.includes("open") || lower.includes("redirect")) &&
        (isAdUrl(event.data) ||
          MALICIOUS_SCRIPT_SIGNATURES.some((s) => lower.includes(s)))
      ) {
        recordBlock("blockedPopups");
        event.stopImmediatePropagation();
      }
    }
  };
  window.addEventListener("message", handleMessageCapture, true);

  // 4. Network Shields: fetch, XHR, sendBeacon
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
      recordBlock("blockedNetwork");
      return new Response("", { status: 200, statusText: "OK" });
    }
    return originalFetch.call(window, input, init);
  };

  const originalXhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    ...args: any[]
  ) {
    const urlStr = url ? url.toString() : "";
    if (isAdUrl(urlStr)) {
      recordBlock("blockedNetwork");
      return originalXhrOpen.call(this, method, "data:text/plain,", ...args);
    }
    return originalXhrOpen.call(this, method, url, ...args);
  };

  const originalSendBeacon =
    typeof navigator !== "undefined" && navigator.sendBeacon
      ? navigator.sendBeacon.bind(navigator)
      : null;
  if (originalSendBeacon) {
    navigator.sendBeacon = function (
      url: string | URL,
      data?: BodyInit | null
    ) {
      if (isAdUrl(url.toString())) {
        recordBlock("blockedNetwork");
        return true;
      }
      return originalSendBeacon(url, data);
    };
  }

  // 5. Programmatic Popup Defusers: Form.submit, Anchor.click, dispatchEvent
  const originalFormSubmit = HTMLFormElement.prototype.submit;
  HTMLFormElement.prototype.submit = function () {
    const action = this.getAttribute("action") || this.action || "";
    const target = (this.getAttribute("target") || this.target || "").toLowerCase();
    if (
      (action && !shouldAllowExternalNavigation(action)) ||
      (target === "_blank" && !isLegitimateAppElement(this))
    ) {
      recordBlock("blockedForms");
      console.warn("[AdBlocker] Blocked hidden form popup redirect:", action);
      return;
    }
    return originalFormSubmit.call(this);
  };

  const originalAnchorClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    const href = this.getAttribute("href") || this.href || "";
    if (!shouldAllowExternalNavigation(href)) {
      recordBlock("blockedPopups");
      console.warn("[AdBlocker] Blocked programmatic anchor .click():", href);
      return;
    }
    return originalAnchorClick.call(this);
  };

  const originalDispatchEvent = EventTarget.prototype.dispatchEvent;
  EventTarget.prototype.dispatchEvent = function (event: Event): boolean {
    if (
      this instanceof HTMLAnchorElement &&
      (event.type === "click" || event.type === "mousedown")
    ) {
      const href = this.getAttribute("href") || this.href || "";
      if (!shouldAllowExternalNavigation(href)) {
        recordBlock("blockedPopups");
        return false;
      }
    }
    return originalDispatchEvent.call(this, event);
  };

  // 6. Deep DOM Creation, Insertion & Shadow DOM Firewall
  const originalCreateElement = document.createElement.bind(document);
  document.createElement = function (
    tagName: string,
    options?: ElementCreationOptions
  ) {
    const el = originalCreateElement(tagName, options);
    const lowerTag = tagName.toLowerCase();

    if (lowerTag === "a") {
      const originalSetAttr = el.setAttribute.bind(el);
      el.setAttribute = function (name: string, value: string) {
        if (
          name.toLowerCase() === "href" &&
          value &&
          isAdUrl(value)
        ) {
          recordBlock("blockedPopups");
          return;
        }
        return originalSetAttr(name, value);
      };
    }

    return el;
  };

  // Pierce Shadow DOMs: force open mode, inject CSS, and attach live MutationObserver
  const originalAttachShadow = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function (init: ShadowRootInit): ShadowRoot {
    const shadowRoot = originalAttachShadow.call(this, {
      ...init,
      mode: "open",
    });
    trackedShadowRoots.add(shadowRoot);

    try {
      const style = originalCreateElement("style");
      style.id = "rab-industrial-adblock-styles";
      style.textContent = ADBLOCK_CSS_RULES;
      shadowRoot.appendChild(style);

      const cosmeticText = buildCosmeticCssText();
      if (cosmeticText) {
        const cStyle = originalCreateElement("style");
        cStyle.id = "rab-ublock-cosmetic-styles";
        cStyle.textContent = cosmeticText;
        shadowRoot.appendChild(cStyle);
      }

      const srObserver = new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const n of Array.from(m.addedNodes)) {
            if (n instanceof HTMLElement && isSuspiciousDomOverlay(n)) {
              killDomElement(n);
            }
          }
        }
      });
      srObserver.observe(shadowRoot, { childList: true, subtree: true });
      shadowObservers.set(shadowRoot, srObserver);
    } catch {
      // Ignore if shadow style/observer fails
    }
    return shadowRoot;
  };

  // Helper to filter single or variadic DOM insertions
  const filterSafeNodes = (nodes: (Node | string)[]): (Node | string)[] => {
    const safe: (Node | string)[] = [];
    for (const item of nodes) {
      if (item instanceof HTMLElement && isSuspiciousDomOverlay(item)) {
        recordBlock("blockedOverlays");
        continue;
      }
      if (typeof item === "string" && isSuspiciousHtmlString(item)) {
        recordBlock("blockedScripts");
        continue;
      }
      safe.push(item);
    }
    return safe;
  };

  const originalAppendChild = Node.prototype.appendChild;
  Node.prototype.appendChild = function <T extends Node>(newChild: T): T {
    if (newChild instanceof HTMLElement && isSuspiciousDomOverlay(newChild)) {
      recordBlock("blockedOverlays");
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
      recordBlock("blockedOverlays");
      const dummy = originalCreateElement("span");
      dummy.style.display = "none";
      return dummy as unknown as T;
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };

  const originalAppend = Element.prototype.append;
  if (typeof originalAppend === "function") {
    Element.prototype.append = function (...nodes: (Node | string)[]) {
      return originalAppend.apply(this, filterSafeNodes(nodes));
    };
  }

  const originalPrepend = Element.prototype.prepend;
  if (typeof originalPrepend === "function") {
    Element.prototype.prepend = function (...nodes: (Node | string)[]) {
      return originalPrepend.apply(this, filterSafeNodes(nodes));
    };
  }

  const originalAfter = Element.prototype.after;
  if (typeof originalAfter === "function") {
    Element.prototype.after = function (...nodes: (Node | string)[]) {
      return originalAfter.apply(this, filterSafeNodes(nodes));
    };
  }

  const originalBefore = Element.prototype.before;
  if (typeof originalBefore === "function") {
    Element.prototype.before = function (...nodes: (Node | string)[]) {
      return originalBefore.apply(this, filterSafeNodes(nodes));
    };
  }

  const originalInsertAdjacentElement = Element.prototype.insertAdjacentElement;
  if (typeof originalInsertAdjacentElement === "function") {
    Element.prototype.insertAdjacentElement = function (
      where: InsertPosition,
      element: Element
    ): Element | null {
      if (element instanceof HTMLElement && isSuspiciousDomOverlay(element)) {
        recordBlock("blockedOverlays");
        return null;
      }
      return originalInsertAdjacentElement.call(this, where, element);
    };
  }

  const originalInsertAdjacentHTML = Element.prototype.insertAdjacentHTML;
  if (typeof originalInsertAdjacentHTML === "function") {
    Element.prototype.insertAdjacentHTML = function (
      where: InsertPosition,
      html: string
    ): void {
      if (isSuspiciousHtmlString(html)) {
        recordBlock("blockedScripts");
        return;
      }
      return originalInsertAdjacentHTML.call(this, where, html);
    };
  }

  const originalDocWrite = document.write?.bind(document);
  const originalDocWriteln = document.writeln?.bind(document);
  try {
    if (originalDocWrite) {
      document.write = (...args: string[]) => {
        if (args.some((a) => isSuspiciousHtmlString(String(a)))) {
          recordBlock("blockedScripts");
          return;
        }
        originalDocWrite(...args);
      };
    }
    if (originalDocWriteln) {
      document.writeln = (...args: string[]) => {
        if (args.some((a) => isSuspiciousHtmlString(String(a)))) {
          recordBlock("blockedScripts");
          return;
        }
        originalDocWriteln(...args);
      };
    }
  } catch {
    // Ignore if document.write is non-writable
  }

  // 7. MutationObserver (Zero full-page innerText reflows; inspects only new/mutated nodes)
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (
        mutation.type === "attributes" &&
        mutation.target instanceof HTMLElement
      ) {
        const targetEl = mutation.target;
        if (!isVidsrcRelated(targetEl) && isSuspiciousDomOverlay(targetEl)) {
          killDomElement(targetEl);
        }
        continue;
      }

      for (const node of Array.from(mutation.addedNodes)) {
        if (!(node instanceof HTMLElement)) continue;
        if (isVidsrcRelated(node)) continue;

        if (isSuspiciousDomOverlay(node)) {
          killDomElement(node);
          continue;
        }

        // Deep scan children of newly injected wrapper nodes
        const nestedSuspects = node.querySelectorAll(
          'iframe:not([src*="vidsrc"]):not([src*="youtube"]), script, ins, form[target="_blank"], a[target="_blank"], div[style*="fixed"], div[style*="z-index"], div[style*="absolute"]'
        );
        nestedSuspects.forEach((child) => {
          if (child instanceof HTMLElement && isSuspiciousDomOverlay(child)) {
            killDomElement(child);
          }
        });
      }
    }
  });

  if (document.documentElement) {
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class", "src", "href", "target"],
    });
  }

  // 8. Hardware-Aware Periodic Radar & DOM Sweep
  const sweepMs = getHardwareLimits().effectiveMode === "low" ? 1100 : 750;
  const cleanupInterval = originalSetInterval.call(
    window,
    () => {
      if (typeof document === "undefined" || document.hidden) return;
      forceDomOverlaySweep();
    },
    sweepMs
  );

  // Full Clean Teardown
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

    if (originalNotificationRequest) {
      try {
        Notification.requestPermission = originalNotificationRequest;
      } catch {
        // ignore
      }
    }

    window.setTimeout = originalSetTimeout;
    window.setInterval = originalSetInterval;

    for (const evtName of INTERCEPTED_EVENTS) {
      window.removeEventListener(evtName, handlePointerAndClickCapture, true);
    }
    window.removeEventListener("blur", handleWindowBlur);
    window.removeEventListener("message", handleMessageCapture, true);

    window.fetch = originalFetch;
    XMLHttpRequest.prototype.open = originalXhrOpen;
    if (originalSendBeacon) {
      navigator.sendBeacon = originalSendBeacon;
    }

    HTMLFormElement.prototype.submit = originalFormSubmit;
    HTMLAnchorElement.prototype.click = originalAnchorClick;
    EventTarget.prototype.dispatchEvent = originalDispatchEvent;

    document.createElement = originalCreateElement;
    Element.prototype.attachShadow = originalAttachShadow;
    Node.prototype.appendChild = originalAppendChild;
    Node.prototype.insertBefore = originalInsertBefore;
    if (typeof originalAppend === "function") {
      Element.prototype.append = originalAppend;
    }
    if (typeof originalPrepend === "function") {
      Element.prototype.prepend = originalPrepend;
    }
    if (typeof originalAfter === "function") {
      Element.prototype.after = originalAfter;
    }
    if (typeof originalBefore === "function") {
      Element.prototype.before = originalBefore;
    }
    if (typeof originalInsertAdjacentElement === "function") {
      Element.prototype.insertAdjacentElement = originalInsertAdjacentElement;
    }
    if (typeof originalInsertAdjacentHTML === "function") {
      Element.prototype.insertAdjacentHTML = originalInsertAdjacentHTML;
    }
    try {
      if (originalDocWrite) document.write = originalDocWrite;
      if (originalDocWriteln) document.writeln = originalDocWriteln;
    } catch {
      // ignore
    }

    observer.disconnect();
    shadowObservers.forEach((obs) => obs.disconnect());
    shadowObservers.clear();
    trackedShadowRoots.clear();

    clearInterval(cleanupInterval);
    if (injectedStyle && injectedStyle.parentNode) {
      injectedStyle.parentNode.removeChild(injectedStyle);
    }
    const cosmeticStyleEl = document.getElementById(
      "rab-ublock-cosmetic-styles"
    );
    if (cosmeticStyleEl && cosmeticStyleEl.parentNode) {
      cosmeticStyleEl.parentNode.removeChild(cosmeticStyleEl);
    }
  };
}
