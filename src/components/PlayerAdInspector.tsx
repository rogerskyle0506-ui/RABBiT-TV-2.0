// src/components/PlayerAdInspector.tsx
// Admin-Only Live Player Page Inspection & Ad Source Debugging Tool
// Zero footprint for normal users: renders null unless verified admin mode is active.

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  getNativeInspectorBridge,
  addGlobalAdBlockDomain,
  submitAdInjectionTicket,
  logInspectorAuditEvent,
  normalizeBlockDomain,
  isDomainProtected,
  sanitizeAdminText,
} from "@/lib/admin-store";

export interface PlayerAdInspectorProps {
  mediaId: string;
  mediaType: "movie" | "tv";
  title: string;
  activeProviderId: string;
  activeProviderName?: string;
  activeProviderOrigin?: string;
  embedUrl: string;
  onReloadPlayer: () => void;
}

interface NativeNetworkEvent {
  id: number;
  ts: number;
  url: string;
  host: string;
  method: string;
  isMainFrame: boolean;
  isMedia: boolean;
  action: string;
  reason: string;
  source: "native" | "browser";
  transferSize?: number;
  durationMs?: number;
  isMinifiedHint?: boolean;
}

interface InspectedElementInfo {
  selector: string;
  tag: string;
  id: string;
  classes: string[];
  dataAttributes: [string, string][];
  rect: { x: number; y: number; width: number; height: number };
  computed: {
    position: string;
    zIndex: string;
    opacity: string;
    pointerEvents: string;
    display: string;
    visibility: string;
  };
  originType: string;
  inferredDomain: string;
  iframeSrc?: string;
  iframeSandbox?: string;
  iframeAllow?: string;
  parentIframeChain: string[];
  injectedAtMs?: number;
  injectionStack?: string;
  isSuspiciousOverlay: boolean;
  isTrackingPixel: boolean;
  isKnownAdDomain: boolean;
  isCrossOriginIframe: boolean;
}

interface RemovedElementRecord {
  id: string;
  selector: string;
  el: HTMLElement;
  prevDisplay: string;
}

const KNOWN_AD_HINTS = [
  "doubleclick",
  "googlesyndication",
  "popads",
  "popcash",
  "adcash",
  "adsterra",
  "propeller",
  "monetag",
  "exoclick",
  "exosrv",
  "juicyads",
  "hilltopads",
  "clickadu",
  "trafficjunky",
  "trafficstars",
  "acscdn",
  "magsrv",
  "realsrv",
  "tsyndicate",
  "galaksion",
  "rollerads",
  "adskeeper",
  "admaven",
  "inpagepush",
  "wpadmngr",
  "profitablegate",
  "effectivegate",
  "bet365",
  "1xbet",
];

function scrubUrlForExport(raw: string): string {
  return String(raw || "")
    .slice(0, 360)
    .replace(
      /([?&](?:token|api_key|apikey|key|auth|sig|signature|access_token|pat)=)[^&]+/gi,
      "$1[REDACTED]"
    );
}

function extractHostSafe(urlStr: string): string {
  try {
    const u = new URL(urlStr, window.location.href);
    return u.hostname.toLowerCase();
  } catch {
    return "";
  }
}

function isKnownAdHostHint(host: string): boolean {
  const h = (host || "").toLowerCase();
  if (!h) return false;
  return KNOWN_AD_HINTS.some((kw) => h.includes(kw));
}

function buildCssSelector(el: Element): string {
  if (!el || el.nodeType !== 1) return "";
  const parts: string[] = [];
  let cur: Element | null = el;
  let depth = 0;

  while (cur && cur.nodeType === 1 && depth < 6) {
    let part = cur.tagName.toLowerCase();
    if (cur.id) {
      part += `#${cur.id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
      parts.unshift(part);
      break;
    }
    const cls = Array.from(cur.classList)
      .filter((c) => !c.startsWith("rabtv-insp"))
      .slice(0, 2);
    if (cls.length > 0) {
      part += `.${cls.join(".")}`;
    }
    const parent = cur.parentElement;
    if (parent) {
      const sameTagSiblings = Array.from(parent.children).filter(
        (c) => c.tagName === cur!.tagName
      );
      if (sameTagSiblings.length > 1) {
        const idx = sameTagSiblings.indexOf(cur) + 1;
        part += `:nth-of-type(${idx})`;
      }
    }
    parts.unshift(part);
    cur = parent;
    depth++;
  }
  return parts.join(" > ");
}

function inspectDomElement(
  el: HTMLElement,
  mutationMeta: WeakMap<Node, { ts: number; stack: string }>,
  activeProviderOrigin?: string
): InspectedElementInfo {
  const rect = el.getBoundingClientRect();
  const cs = window.getComputedStyle(el);
  const tag = el.tagName.toLowerCase();

  const dataAttributes: [string, string][] = [];
  for (const attr of Array.from(el.attributes)) {
    if (attr.name.startsWith("data-")) {
      dataAttributes.push([attr.name, attr.value.slice(0, 120)]);
    }
  }

  let iframeSrc: string | undefined;
  let iframeSandbox: string | undefined;
  let iframeAllow: string | undefined;
  let isCrossOriginIframe = false;
  let inferredDomain = window.location.hostname;
  let originType = "same-origin";

  const srcAttr =
    el.getAttribute("src") ||
    el.getAttribute("href") ||
    (el as HTMLImageElement).currentSrc ||
    "";

  if (tag === "iframe") {
    iframeSrc = scrubUrlForExport(el.getAttribute("src") || "");
    iframeSandbox = el.getAttribute("sandbox") || "(no sandbox attribute)";
    iframeAllow = el.getAttribute("allow") || "(default)";
    const h = extractHostSafe(el.getAttribute("src") || "");
    if (h) {
      inferredDomain = h;
      if (h !== window.location.hostname) {
        isCrossOriginIframe = true;
        originType = `cross-origin-iframe (${h})`;
      } else {
        originType = "same-origin-iframe";
      }
    }
  } else if (srcAttr) {
    const h = extractHostSafe(srcAttr);
    if (h && h !== window.location.hostname) {
      inferredDomain = h;
      originType = `third-party-resource (${h})`;
    }
  } else if (el.getAttribute("onclick") || el.getAttribute("style")) {
    originType = "inline-element";
  }

  // Walk ancestor chain for nested iframes or containers
  const parentIframeChain: string[] = [];
  if (tag === "iframe" && iframeSrc) {
    parentIframeChain.push(`iframe[src="${iframeSrc.slice(0, 90)}"]`);
  }
  let p: HTMLElement | null = el.parentElement;
  let guard = 0;
  while (p && guard < 8) {
    if (p.hasAttribute("data-tour") || p.id) {
      parentIframeChain.push(
        `${p.tagName.toLowerCase()}${p.id ? `#${p.id}` : ""}${
          p.getAttribute("data-tour")
            ? `[data-tour="${p.getAttribute("data-tour")}"]`
            : ""
        }`
      );
    }
    p = p.parentElement;
    guard++;
  }

  const meta = mutationMeta.get(el);
  const zNum = parseInt(cs.zIndex, 10);
  const opacityNum = parseFloat(cs.opacity || "1");
  const area = rect.width * rect.height;
  const viewportArea = Math.max(1, window.innerWidth * window.innerHeight);

  const isTrackingPixel =
    (tag === "img" || tag === "iframe") &&
    rect.width <= 3 &&
    rect.height <= 3 &&
    Boolean(srcAttr);

  const isSuspiciousOverlay =
    (cs.position === "fixed" || cs.position === "absolute") &&
    !el.classList.contains("rabtv-vidsrc-protected") &&
    !el.closest("[data-rabtv-inspector='true']") &&
    ((Number.isFinite(zNum) && zNum >= 9999 && area > viewportArea * 0.25) ||
      (opacityNum < 0.12 &&
        cs.pointerEvents !== "none" &&
        area > viewportArea * 0.2));

  if (isCrossOriginIframe && activeProviderOrigin) {
    const provHost = extractHostSafe(activeProviderOrigin);
    if (provHost && inferredDomain === provHost) {
      originType = `active-player-iframe (${inferredDomain})`;
    }
  }

  return {
    selector: buildCssSelector(el),
    tag,
    id: el.id || "",
    classes: Array.from(el.classList).slice(0, 10),
    dataAttributes: dataAttributes.slice(0, 12),
    rect: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    },
    computed: {
      position: cs.position,
      zIndex: cs.zIndex,
      opacity: cs.opacity,
      pointerEvents: cs.pointerEvents,
      display: cs.display,
      visibility: cs.visibility,
    },
    originType,
    inferredDomain,
    iframeSrc,
    iframeSandbox,
    iframeAllow,
    parentIframeChain,
    injectedAtMs: meta?.ts,
    injectionStack: meta?.stack,
    isSuspiciousOverlay,
    isTrackingPixel,
    isKnownAdDomain: isKnownAdHostHint(inferredDomain),
    isCrossOriginIframe,
  };
}

/**
 * Zero-footprint gate mounted on /player. Renders nothing for normal users.
 */
export function PlayerAdInspectorGate(props: PlayerAdInspectorProps) {
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("rabtv_is_admin") === "true";
  });

  useEffect(() => {
    const sync = () => {
      setIsAdmin(localStorage.getItem("rabtv_is_admin") === "true");
    };
    window.addEventListener("rabtv_settings_updated", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("rabtv_settings_updated", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  if (!isAdmin) return null;
  return <PlayerAdInspectorActive {...props} />;
}

type DrawerTab = "element" | "network" | "threats";
type NetFilter = "all" | "blocked" | "thirdparty" | "popups" | "scripts";

function PlayerAdInspectorActive({
  mediaId,
  mediaType,
  title,
  activeProviderId,
  activeProviderName,
  activeProviderOrigin,
  embedUrl,
  onReloadPlayer,
}: PlayerAdInspectorProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [pickMode, setPickMode] = useState<boolean>(true);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("network");
  const [netFilter, setNetFilter] = useState<NetFilter>("all");
  const [dockSide, setDockSide] = useState<"right" | "left">("right");

  const [hoveredEl, setHoveredEl] = useState<HTMLElement | null>(null);
  const [pinnedEl, setPinnedEl] = useState<HTMLElement | null>(null);
  const [inspectedInfo, setInspectedInfo] =
    useState<InspectedElementInfo | null>(null);

  const [nativeAvailable, setNativeAvailable] = useState<boolean>(false);
  const [networkEvents, setNetworkEvents] = useState<NativeNetworkEvent[]>([]);
  const [sessionBlocks, setSessionBlocks] = useState<string[]>([]);
  const [removedElements, setRemovedElements] = useState<
    RemovedElementRecord[]
  >([]);
  const [manualDomainInput, setManualDomainInput] = useState<string>("");
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(
    null
  );
  const [busy, setBusy] = useState<boolean>(false);

  const mutationMetaRef = useRef<WeakMap<Node, { ts: number; stack: string }>>(
    new WeakMap()
  );
  const rafRef = useRef<number | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);

  const showFeedback = useCallback((ok: boolean, text: string) => {
    setFeedback({ ok, text });
    if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = window.setTimeout(() => {
      setFeedback(null);
      feedbackTimerRef.current = null;
    }, 3500);
  }, []);

  // Keyboard shortcut Alt+Shift+D to toggle inspector, P to toggle pin/pick, Esc to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (e.altKey && e.shiftKey && (e.key === "D" || e.key === "d")) {
        e.preventDefault();
        setIsOpen((v) => !v);
      } else if (isOpen && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        setPickMode((v) => !v);
      } else if (isOpen && e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  // Activate Native Android Capture + MutationObserver + Resource Waterfall ONLY when Inspector is open
  useEffect(() => {
    if (!isOpen) return;

    const bridge = getNativeInspectorBridge();
    const hasNative = Boolean(bridge);
    setNativeAvailable(hasNative);

    if (bridge?.setCaptureEnabled) {
      try {
        bridge.setCaptureEnabled(true);
      } catch {
        // ignore
      }
    }

    // Best-effort audit record on open
    void logInspectorAuditEvent(
      "INSPECTOR_OPEN",
      `${title} (${mediaType}-${mediaId})`,
      `Opened Player Ad Inspector on provider ${activeProviderName || activeProviderId}`
    );

    // 1. Track newly injected DOM nodes with timestamp + approximate call stack
    const observer = new MutationObserver((mutations) => {
      const now = Date.now();
      for (const m of mutations) {
        for (const node of Array.from(m.addedNodes)) {
          if (node instanceof HTMLElement) {
            if (node.closest("[data-rabtv-inspector='true']")) continue;
            if (!mutationMetaRef.current.has(node)) {
              const stack = new Error().stack || "MutationObserver (async)";
              mutationMetaRef.current.set(node, {
                ts: now,
                stack: stack.split("\n").slice(0, 5).join("\n"),
              });
            }
          }
        }
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    // 2. Poll native cross-origin WebView network ring buffer + merge browser PerformanceObserver entries
    const pollNetwork = () => {
      const merged: NativeNetworkEvent[] = [];

      if (bridge?.getNetworkLogJson) {
        try {
          const parsed = JSON.parse(bridge.getNetworkLogJson());
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              merged.push({
                id: Number(item.id) || merged.length + 1,
                ts: Number(item.ts) || Date.now(),
                url: String(item.url || ""),
                host: String(item.host || ""),
                method: String(item.method || "GET"),
                isMainFrame: Boolean(item.isMainFrame),
                isMedia: Boolean(item.isMedia),
                action: String(item.action || "ALLOWED"),
                reason: String(item.reason || ""),
                source: "native",
                isMinifiedHint: String(item.url || "").includes(".min.js"),
              });
            }
          }
        } catch {
          // ignore parse glitches
        }
      }

      // Also include browser PerformanceResourceTiming entries (works on desktop web too!)
      if (typeof performance !== "undefined" && performance.getEntriesByType) {
        try {
          const resEntries = performance.getEntriesByType(
            "resource"
          ) as PerformanceResourceTiming[];
          const recent = resEntries.slice(-120);
          let browserSeq = 900000;
          for (const entry of recent) {
            const url = scrubUrlForExport(entry.name);
            const host = extractHostSafe(entry.name);
            if (!host || host === window.location.hostname) continue;
            if (merged.some((m) => m.url === url)) continue;
            merged.push({
              id: browserSeq++,
              ts: Math.round(performance.timeOrigin + entry.startTime),
              url,
              host,
              method: entry.initiatorType?.toUpperCase() || "RES",
              isMainFrame: false,
              isMedia: /\.(m3u8|mpd|ts|mp4|m4s|vtt|aac)(\?|$)/i.test(url),
              action: isKnownAdHostHint(host) ? "SUSPECT_AD" : "ALLOWED_3P",
              reason: `Browser ${entry.initiatorType || "resource"}`,
              source: "browser",
              transferSize: entry.transferSize || 0,
              durationMs: Math.round(entry.duration || 0),
              isMinifiedHint: /\.min\.js(\?|$)/i.test(url),
            });
          }
        } catch {
          // ignore
        }
      }

      merged.sort((a, b) => b.ts - a.ts);
      setNetworkEvents(merged.slice(0, 300));
    };

    pollNetwork();
    const intervalId = window.setInterval(pollNetwork, 1200);

    return () => {
      observer.disconnect();
      window.clearInterval(intervalId);
      if (bridge?.setCaptureEnabled) {
        try {
          bridge.setCaptureEnabled(false);
        } catch {
          // ignore
        }
      }
    };
  }, [isOpen, mediaId, mediaType, title, activeProviderId, activeProviderName]);

  // Hover & Click-to-Pin Listeners (throttled via requestAnimationFrame)
  useEffect(() => {
    if (!isOpen || !pickMode) return;

    const handleMove = (e: MouseEvent) => {
      if (rafRef.current) return;
      const clientX = e.clientX;
      const clientY = e.clientY;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        const target = document.elementFromPoint(
          clientX,
          clientY
        ) as HTMLElement | null;
        if (!target || target.closest("[data-rabtv-inspector='true']")) {
          return;
        }
        setHoveredEl(target);
        if (!pinnedEl) {
          setInspectedInfo(
            inspectDomElement(
              target,
              mutationMetaRef.current,
              activeProviderOrigin
            )
          );
        }
      });
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || target.closest("[data-rabtv-inspector='true']")) return;
      e.preventDefault();
      e.stopPropagation();
      setPinnedEl(target);
      setHoveredEl(target);
      setInspectedInfo(
        inspectDomElement(target, mutationMetaRef.current, activeProviderOrigin)
      );
      setPickMode(false);
      setDrawerTab("element");
    };

    document.addEventListener("mousemove", handleMove, { passive: true });
    document.addEventListener("click", handleClick, true);
    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("click", handleClick, true);
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isOpen, pickMode, pinnedEl, activeProviderOrigin]);

  // Actions
  const handleSessionTestBlock = (rawDomain: string) => {
    const domain = normalizeBlockDomain(rawDomain);
    if (!domain) {
      showFeedback(false, "Invalid domain to test-block.");
      return;
    }
    if (isDomainProtected(domain)) {
      showFeedback(false, `Cannot block protected core domain "${domain}".`);
      return;
    }
    const bridge = getNativeInspectorBridge();
    if (bridge?.addSessionBlockedDomain) {
      bridge.addSessionBlockedDomain(domain);
    }
    setSessionBlocks((prev) =>
      prev.includes(domain) ? prev : [domain, ...prev]
    );
    showFeedback(
      true,
      `🧪 Session-blocked ${domain}. Tap "Reload Player" to test playback!`
    );
  };

  const handleRemoveSessionBlock = (domain: string) => {
    const bridge = getNativeInspectorBridge();
    if (bridge?.removeSessionBlockedDomain) {
      bridge.removeSessionBlockedDomain(domain);
    }
    setSessionBlocks((prev) => prev.filter((d) => d !== domain));
    showFeedback(true, `Removed session block for ${domain}.`);
  };

  const handleGlobalBlock = async (rawDomain: string, reason?: string) => {
    const domain = normalizeBlockDomain(rawDomain);
    if (!domain) {
      showFeedback(false, "Enter or select a valid third-party domain.");
      return;
    }
    setBusy(true);
    try {
      const res = await addGlobalAdBlockDomain({
        domain,
        reason:
          reason ||
          `Captured via Player Inspector on ${title} (${activeProviderName || activeProviderId})`,
        source: "player_inspector",
        providerId: activeProviderId,
      });
      if (res.ok) {
        showFeedback(
          true,
          `🛡️ Blocked ${domain} globally across all RABBiT TV devices!`
        );
      } else {
        showFeedback(false, res.error || "Failed to publish global block.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleForceRemoveElement = () => {
    const target = pinnedEl || hoveredEl;
    if (!target || target.closest("[data-rabtv-inspector='true']")) {
      showFeedback(false, "Pin an element first before removing it.");
      return;
    }
    const prevDisplay = target.style.display;
    target.style.setProperty("display", "none", "important");
    const rec: RemovedElementRecord = {
      id: `rm_${Date.now().toString(36)}`,
      selector: inspectedInfo?.selector || target.tagName.toLowerCase(),
      el: target,
      prevDisplay,
    };
    setRemovedElements((prev) => [rec, ...prev]);
    setPinnedEl(null);
    showFeedback(true, `🗑️ Hidden "${rec.selector}" for this session.`);
  };

  const handleUndoRemoveElement = (rec: RemovedElementRecord) => {
    try {
      rec.el.style.display = rec.prevDisplay || "";
    } catch {
      // ignore if detached
    }
    setRemovedElements((prev) => prev.filter((r) => r.id !== rec.id));
    showFeedback(true, `↺ Restored "${rec.selector}".`);
  };

  const handleReportAdTicket = async (domainOverride?: string) => {
    const domain =
      domainOverride ||
      inspectedInfo?.inferredDomain ||
      extractHostSafe(embedUrl) ||
      "unknown";
    setBusy(true);
    try {
      const res = await submitAdInjectionTicket({
        mediaId,
        mediaType,
        title,
        providerId: activeProviderName
          ? `${activeProviderId} (${activeProviderName})`
          : activeProviderId,
        domain,
        selector: inspectedInfo?.selector || "iframe-network-capture",
        originType: inspectedInfo?.originType || "third-party-network",
        notes: `Captured ${networkEvents.length} waterfall events (${
          networkEvents.filter((e) => e.action.startsWith("BLOCKED")).length
        } blocked).`,
      });
      if (res.ok) {
        showFeedback(
          true,
          "🚩 Ad injection ticket saved to /admin → Ad Blocklist!"
        );
      } else {
        showFeedback(false, res.error || "Failed to file ad ticket.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleCaptureSnapshot = () => {
    const snapshotPayload = {
      capturedAt: new Date().toISOString(),
      media: { mediaId, mediaType, title },
      player: {
        activeProviderId,
        activeProviderName,
        activeProviderOrigin,
        embedUrl: scrubUrlForExport(embedUrl),
        nativeBridgeActive: nativeAvailable,
      },
      inspectedElement: inspectedInfo,
      sessionBlockedDomains: sessionBlocks,
      networkWaterfall: networkEvents.slice(0, 200),
    };
    const blob = new Blob([JSON.stringify(snapshotPayload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rabtv_ad_snapshot_${mediaType}-${mediaId}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showFeedback(true, "📸 Scrubbed forensic snapshot downloaded!");
  };

  const handleCopyText = async (txt: string, label: string) => {
    try {
      await navigator.clipboard.writeText(txt);
      showFeedback(true, `📋 Copied ${label}!`);
    } catch {
      showFeedback(false, "Clipboard unavailable on this WebView.");
    }
  };

  const filteredNetwork = useMemo(() => {
    return networkEvents.filter((ev) => {
      if (netFilter === "blocked") return ev.action.startsWith("BLOCKED");
      if (netFilter === "popups")
        return ev.action === "BLOCKED_POPUP" || ev.action === "BLOCKED_REDIRECT";
      if (netFilter === "scripts")
        return /\.js(\?|$)/i.test(ev.url) || ev.method === "SCRIPT";
      if (netFilter === "thirdparty")
        return !ev.isMedia && ev.action !== "ALLOWED_WHITELIST";
      return true;
    });
  }, [networkEvents, netFilter]);

  const suspectHostsSummary = useMemo(() => {
    const counts = new Map<
      string,
      { host: string; count: number; blocked: number; sampleAction: string }
    >();
    const provHost = activeProviderOrigin
      ? extractHostSafe(activeProviderOrigin)
      : "";

    for (const ev of networkEvents) {
      if (!ev.host || ev.isMedia || ev.host === provHost) continue;
      if (isDomainProtected(ev.host)) continue;
      const cur = counts.get(ev.host) || {
        host: ev.host,
        count: 0,
        blocked: 0,
        sampleAction: ev.action,
      };
      cur.count++;
      if (ev.action.startsWith("BLOCKED")) cur.blocked++;
      counts.set(ev.host, cur);
    }
    return Array.from(counts.values())
      .sort((a, b) => b.blocked - a.blocked || b.count - a.count)
      .slice(0, 15);
  }, [networkEvents, activeProviderOrigin]);

  const highlightTarget = pinnedEl || hoveredEl;
  const highlightRect =
    isOpen && highlightTarget ? highlightTarget.getBoundingClientRect() : null;

  if (typeof document === "undefined") return null;

  return createPortal(
    <div data-rabtv-inspector="true" className="rabtv-vidsrc-protected">
      {/* NON-INTRUSIVE FLOATING ADMIN TRIGGER PILL */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          title="Open Admin Player Ad Inspector (Alt+Shift+D)"
          className="fixed bottom-4 right-4 z-[9990] flex items-center gap-1.5 rounded-full border border-cyan-400/60 bg-[#0c0a09]/92 hover:bg-[#C4282A] px-3.5 py-2 text-[11px] font-black text-cyan-200 hover:text-white shadow-[0_8px_28px_rgba(0,0,0,0.85)] backdrop-blur-md cursor-pointer transition hover:scale-105"
        >
          <span>🛡️</span>
          <span>Inspect Ads</span>
        </button>
      )}

      {/* GPU-ACCELERATED ELEMENT HIGHLIGHT OVERLAY (Zero Layout Shift!) */}
      {isOpen && highlightRect && highlightRect.width > 0 && (
        <div
          style={{
            position: "fixed",
            left: 0,
            top: 0,
            width: `${highlightRect.width}px`,
            height: `${highlightRect.height}px`,
            transform: `translate3d(${highlightRect.left}px, ${highlightRect.top}px, 0)`,
            pointerEvents: "none",
            zIndex: 9992,
            border: pinnedEl
              ? "2px solid #C4282A"
              : "2px solid #22D3EE",
            backgroundColor: pinnedEl
              ? "rgba(196, 40, 42, 0.16)"
              : "rgba(34, 211, 238, 0.14)",
            borderRadius: "6px",
          }}
        >
          <span
            className={`absolute -top-6 left-0 px-2 py-0.5 rounded text-[10px] font-mono font-black whitespace-nowrap shadow-lg ${
              pinnedEl
                ? "bg-[#C4282A] text-white"
                : "bg-cyan-400 text-black"
            }`}
          >
            {pinnedEl ? "PINNED • " : ""}
            {inspectedInfo?.tag}
            {inspectedInfo?.id ? `#${inspectedInfo.id}` : ""} • z:
            {inspectedInfo?.computed.zIndex} • {inspectedInfo?.rect.width}×
            {inspectedInfo?.rect.height}
          </span>
        </div>
      )}

      {/* NON-INTRUSIVE FLOATING / DOCKED ADMIN INSPECTOR DRAWER */}
      {isOpen && (
        <aside
          aria-label="Admin Player Ad Inspector"
          className={`fixed top-3 bottom-3 ${
            dockSide === "right" ? "right-3" : "left-3"
          } z-[9995] w-[calc(100vw-24px)] max-w-[380px] rounded-3xl border border-cyan-500/45 bg-[#0c0a09]/96 text-[#E8DCC8] shadow-[0_20px_60px_rgba(0,0,0,0.95)] flex flex-col overflow-hidden backdrop-blur-xl`}
        >
          {/* Drawer Header */}
          <div className="px-4 py-3 border-b border-white/10 bg-[#141210] space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-xs font-black uppercase tracking-wider text-cyan-300 truncate">
                  🛡️ Player Ad Inspector
                </h2>
                <p className="text-[10px] text-[#8C8175] truncate">
                  {activeProviderName || activeProviderId} •{" "}
                  {nativeAvailable
                    ? "Native Iframe Bridge ON"
                    : "Web Mode (Cross-Origin SOP)"}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    setDockSide((s) => (s === "right" ? "left" : "right"))
                  }
                  title="Flip Drawer Side"
                  className="rounded-lg border border-white/15 bg-white/5 hover:bg-white/15 px-2 py-1 text-[10px] font-bold text-white cursor-pointer"
                >
                  {dockSide === "right" ? "⇤" : "⇥"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  title="Close Inspector (Esc)"
                  className="rounded-lg border border-red-500/40 bg-red-950/70 hover:bg-red-600 px-2 py-1 text-[10px] font-black text-red-100 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Quick Mode Toolbar */}
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setPickMode((v) => !v);
                  if (!pickMode) setPinnedEl(null);
                }}
                className={`rounded-xl py-1.5 text-[10px] font-extrabold cursor-pointer ${
                  pickMode
                    ? "bg-cyan-500 text-black"
                    : "border border-white/15 bg-black/70 text-white"
                }`}
              >
                {pickMode ? "🎯 Picking..." : "🎯 Pick Element"}
              </button>
              <button
                type="button"
                onClick={handleCaptureSnapshot}
                className="rounded-xl border border-white/15 bg-black/70 hover:bg-white/10 py-1.5 text-[10px] font-extrabold text-white cursor-pointer"
              >
                📸 Snapshot
              </button>
              <button
                type="button"
                onClick={onReloadPlayer}
                className="rounded-xl border border-amber-400/40 bg-amber-950/60 hover:bg-amber-800 py-1.5 text-[10px] font-extrabold text-amber-200 cursor-pointer"
              >
                ↻ Reload
              </button>
            </div>

            {/* 3 Sub-Tabs */}
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              {(
                [
                  { id: "element", label: "Element" },
                  {
                    id: "network",
                    label: `Network (${networkEvents.length})`,
                  },
                  {
                    id: "threats",
                    label: `Threats (${suspectHostsSummary.length})`,
                  },
                ] as { id: DrawerTab; label: string }[]
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setDrawerTab(t.id)}
                  className={`rounded-xl py-1.5 text-[10.5px] font-extrabold cursor-pointer ${
                    drawerTab === t.id
                      ? "bg-[#C4282A] text-white"
                      : "bg-black/70 border border-white/10 text-[#8C8175] hover:text-white"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {feedback && (
            <div
              className={`mx-3 mt-2 rounded-xl border px-3 py-1.5 text-[10.5px] font-extrabold text-center ${
                feedback.ok
                  ? "border-emerald-400/45 bg-emerald-950/85 text-emerald-200"
                  : "border-red-400/45 bg-red-950/85 text-red-200"
              }`}
            >
              {feedback.text}
            </div>
          )}

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3 text-xs scrollbar-none">
            {/* TAB 1: ELEMENT DOM, STYLES, STACK & IFRAME CHAIN */}
            {drawerTab === "element" && (
              <div className="space-y-3">
                {!inspectedInfo ? (
                  <div className="rounded-2xl border border-white/10 bg-[#141210] p-4 text-center space-y-1.5">
                    <p className="font-black text-white">
                      Hover or Tap Any Element on the Player
                    </p>
                    <p className="text-[11px] text-[#8C8175]">
                      Hover highlights in cyan; click pins in crimson so you can
                      inspect attributes, stack traces, and block its origin.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Cross-Origin SOP Notice */}
                    {inspectedInfo.isCrossOriginIframe && (
                      <div className="rounded-xl border border-cyan-500/40 bg-cyan-950/40 p-2.5 text-[10.5px] text-cyan-200 leading-snug">
                        {nativeAvailable
                          ? "🔒 Cross-origin iframe DOM is isolated by WebView SOP — switch to the Network tab to see every inner-iframe script, ad host, and popup captured natively by MainActivity!"
                          : "🔒 Cross-origin iframe DOM is protected by browser SOP. Outer iframe attributes are shown below; open inside the Android APK for full inner-iframe network waterfall."}
                      </div>
                    )}

                    {/* Suspicious Badges */}
                    {(inspectedInfo.isSuspiciousOverlay ||
                      inspectedInfo.isTrackingPixel ||
                      inspectedInfo.isKnownAdDomain) && (
                      <div className="flex flex-wrap gap-1.5">
                        {inspectedInfo.isSuspiciousOverlay && (
                          <span className="rounded-md bg-red-600/30 border border-red-400/50 px-2 py-0.5 text-[10px] font-black text-red-200">
                            ⚠️ High-Z / Transparent Click Overlay
                          </span>
                        )}
                        {inspectedInfo.isTrackingPixel && (
                          <span className="rounded-md bg-amber-600/30 border border-amber-400/50 px-2 py-0.5 text-[10px] font-black text-amber-200">
                            👁️ 1×1 Tracking Pixel
                          </span>
                        )}
                        {inspectedInfo.isKnownAdDomain && (
                          <span className="rounded-md bg-red-600/35 border border-red-400/60 px-2 py-0.5 text-[10px] font-black text-red-100">
                            🚫 Known Ad Network
                          </span>
                        )}
                      </div>
                    )}

                    {/* Selector & Origin */}
                    <div className="rounded-2xl border border-white/10 bg-[#141210] p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-extrabold uppercase text-[#8C8175]">
                          CSS Selector
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            void handleCopyText(
                              inspectedInfo.selector,
                              "selector"
                            )
                          }
                          className="text-[10px] font-bold text-cyan-300 hover:underline cursor-pointer"
                        >
                          Copy
                        </button>
                      </div>
                      <p className="font-mono text-[10.5px] text-white break-all bg-black/70 rounded-lg p-2">
                        {inspectedInfo.selector}
                      </p>

                      <div className="grid grid-cols-2 gap-2 text-[10.5px]">
                        <div>
                          <span className="block text-[#8C8175]">Origin</span>
                          <strong className="text-amber-300 break-all">
                            {inspectedInfo.originType}
                          </strong>
                        </div>
                        <div>
                          <span className="block text-[#8C8175]">Domain</span>
                          <strong className="font-mono text-white break-all">
                            {inspectedInfo.inferredDomain}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Computed Styles & Box */}
                    <div className="rounded-2xl border border-white/10 bg-[#141210] p-3 space-y-1.5 text-[10.5px]">
                      <span className="block text-[10px] font-extrabold uppercase text-[#8C8175]">
                        Box & Computed Styles
                      </span>
                      <p className="font-mono text-white">
                        {inspectedInfo.rect.width}×{inspectedInfo.rect.height}px
                        @ ({inspectedInfo.rect.x}, {inspectedInfo.rect.y})
                      </p>
                      <p className="font-mono text-[#E8DCC8]">
                        pos:{inspectedInfo.computed.position} • z:
                        {inspectedInfo.computed.zIndex} • op:
                        {inspectedInfo.computed.opacity} • ptr:
                        {inspectedInfo.computed.pointerEvents}
                      </p>
                      {inspectedInfo.classes.length > 0 && (
                        <p className="font-mono text-[10px] text-[#8C8175] break-all">
                          .{inspectedInfo.classes.join(" .")}
                        </p>
                      )}
                      {inspectedInfo.dataAttributes.length > 0 && (
                        <div className="pt-1 space-y-0.5 font-mono text-[10px] text-cyan-300">
                          {inspectedInfo.dataAttributes.map(([k, v]) => (
                            <p key={k} className="truncate">
                              {k}=&quot;{v}&quot;
                            </p>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Iframe Sandbox & Chain */}
                    {(inspectedInfo.iframeSrc ||
                      inspectedInfo.parentIframeChain.length > 0) && (
                      <div className="rounded-2xl border border-white/10 bg-[#141210] p-3 space-y-1.5 text-[10px] font-mono">
                        <span className="block font-sans font-extrabold uppercase text-[#8C8175]">
                          Iframe & Ancestor Chain
                        </span>
                        {inspectedInfo.iframeSrc && (
                          <p className="text-cyan-300 break-all">
                            src: {inspectedInfo.iframeSrc}
                          </p>
                        )}
                        {inspectedInfo.iframeSandbox && (
                          <p className="text-amber-300 break-all">
                            sandbox: {inspectedInfo.iframeSandbox}
                          </p>
                        )}
                        {inspectedInfo.parentIframeChain.length > 0 && (
                          <p className="text-[#8C8175] break-all">
                            chain: {inspectedInfo.parentIframeChain.join(" ← ")}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Injection Timestamp & Stack */}
                    {inspectedInfo.injectedAtMs && (
                      <div className="rounded-2xl border border-amber-500/30 bg-[#141210] p-3 space-y-1 text-[10px] font-mono">
                        <span className="block font-sans font-extrabold uppercase text-amber-300">
                          Dynamically Injected @{" "}
                          {new Date(
                            inspectedInfo.injectedAtMs
                          ).toLocaleTimeString()}
                        </span>
                        <pre className="whitespace-pre-wrap break-all text-[#8C8175]">
                          {inspectedInfo.injectionStack}
                        </pre>
                      </div>
                    )}

                    {/* One-Click Element Actions */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleSessionTestBlock(inspectedInfo.inferredDomain)
                        }
                        className="rounded-xl border border-amber-400/45 bg-amber-950/60 hover:bg-amber-800 py-2 text-[10.5px] font-extrabold text-amber-200 cursor-pointer"
                      >
                        🧪 Test Block Host
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void handleGlobalBlock(inspectedInfo.inferredDomain)
                        }
                        className="rounded-xl bg-[#C4282A] hover:bg-red-600 py-2 text-[10.5px] font-extrabold text-white cursor-pointer disabled:opacity-45"
                      >
                        🛡️ Block Globally
                      </button>
                      <button
                        type="button"
                        onClick={handleForceRemoveElement}
                        className="rounded-xl border border-white/15 bg-white/10 hover:bg-white/20 py-2 text-[10.5px] font-bold text-white cursor-pointer"
                      >
                        🗑️ Hide Element
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleReportAdTicket()}
                        className="rounded-xl border border-cyan-400/45 bg-cyan-950/60 hover:bg-cyan-800 py-2 text-[10.5px] font-extrabold text-cyan-200 cursor-pointer disabled:opacity-45"
                      >
                        🚩 Report Ticket
                      </button>
                    </div>
                  </>
                )}

                {removedElements.length > 0 && (
                  <div className="rounded-2xl border border-white/10 bg-[#141210] p-3 space-y-1.5">
                    <span className="block text-[10px] font-extrabold uppercase text-[#8C8175]">
                      Hidden This Session (Tap to Undo)
                    </span>
                    {removedElements.map((rec) => (
                      <button
                        key={rec.id}
                        type="button"
                        onClick={() => handleUndoRemoveElement(rec)}
                        className="w-full text-left font-mono text-[10px] text-amber-300 hover:underline truncate cursor-pointer"
                      >
                        ↺ {rec.selector}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: LIVE CROSS-ORIGIN IFRAME & BROWSER NETWORK WATERFALL */}
            {drawerTab === "network" && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-1.5 flex-wrap">
                  <div className="flex items-center gap-1 flex-wrap">
                    {(
                      [
                        { id: "all", label: "All" },
                        { id: "blocked", label: "Blocked" },
                        { id: "thirdparty", label: "3rd-Party" },
                        { id: "scripts", label: "Scripts" },
                        { id: "popups", label: "Popups" },
                      ] as { id: NetFilter; label: string }[]
                    ).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setNetFilter(f.id)}
                        className={`rounded-lg px-2 py-1 text-[10px] font-extrabold cursor-pointer ${
                          netFilter === f.id
                            ? "bg-cyan-500 text-black"
                            : "bg-white/5 text-[#8C8175] hover:text-white"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      getNativeInspectorBridge()?.clearNetworkLog?.();
                      setNetworkEvents([]);
                    }}
                    className="text-[10px] font-bold text-red-300 hover:underline cursor-pointer"
                  >
                    Clear
                  </button>
                </div>

                {filteredNetwork.length === 0 ? (
                  <p className="text-[11px] text-[#8C8175] text-center py-6">
                    No matching network requests captured yet. Tap Reload or
                    interact with the player to inspect traffic.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {filteredNetwork.slice(0, 80).map((ev) => {
                      const isBlocked = ev.action.startsWith("BLOCKED");
                      return (
                        <div
                          key={`${ev.source}-${ev.id}`}
                          className={`rounded-xl border p-2.5 space-y-1.5 ${
                            isBlocked
                              ? "border-red-500/40 bg-red-950/25"
                              : ev.isMedia
                                ? "border-emerald-500/30 bg-emerald-950/15"
                                : "border-white/10 bg-[#141210]"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="font-mono text-[10.5px] font-black text-white truncate">
                              {ev.host || "unknown"}
                            </span>
                            <span
                              className={`shrink-0 rounded px-1.5 py-0.5 text-[8.5px] font-black uppercase ${
                                isBlocked
                                  ? "bg-red-600/40 text-red-100"
                                  : ev.isMedia
                                    ? "bg-emerald-600/35 text-emerald-200"
                                    : "bg-white/10 text-cyan-200"
                              }`}
                            >
                              {ev.action}
                            </span>
                          </div>

                          <p className="font-mono text-[9.5px] text-[#8C8175] break-all line-clamp-2">
                            {ev.url}
                          </p>

                          <div className="flex items-center justify-between gap-1 text-[9.5px] text-[#8C8175]">
                            <span>
                              {ev.source === "native" ? "Android" : "Web"} •{" "}
                              {ev.method}
                              {ev.isMinifiedHint ? " • minified" : ""}
                              {ev.reason ? ` • ${ev.reason}` : ""}
                            </span>
                          </div>

                          {!ev.isMedia &&
                            ev.host &&
                            !isDomainProtected(ev.host) && (
                              <div className="flex items-center gap-1.5 pt-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleSessionTestBlock(ev.host)}
                                  className="rounded-md bg-amber-600/30 hover:bg-amber-600/60 px-2 py-0.5 text-[9.5px] font-extrabold text-amber-200 cursor-pointer"
                                >
                                  🧪 Test Block
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    void handleGlobalBlock(
                                      ev.host,
                                      `Waterfall ${ev.action} on ${title}`
                                    )
                                  }
                                  className="rounded-md bg-[#C4282A]/80 hover:bg-red-600 px-2 py-0.5 text-[9.5px] font-extrabold text-white cursor-pointer"
                                >
                                  🛡️ Global Block
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleCopyText(ev.url, "URL")
                                  }
                                  className="ml-auto text-[9.5px] font-bold text-cyan-300 hover:underline cursor-pointer"
                                >
                                  Copy URL
                                </button>
                              </div>
                            )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: TOP SUSPECT AD HOSTS, SESSION BLOCKS & MANUAL BLOCK */}
            {drawerTab === "threats" && (
              <div className="space-y-3">
                {/* Quick Manual Domain Blocker */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const clean = sanitizeAdminText(manualDomainInput, 120);
                    if (!clean) return;
                    void handleGlobalBlock(clean).then(() =>
                      setManualDomainInput("")
                    );
                  }}
                  className="rounded-2xl border border-white/10 bg-[#141210] p-3 space-y-2"
                >
                  <span className="block text-[10px] font-extrabold uppercase text-[#8C8175]">
                    Quick Block Any Domain Globally
                  </span>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      dir="ltr"
                      placeholder="ad-domain.com"
                      value={manualDomainInput}
                      onChange={(e) => setManualDomainInput(e.target.value)}
                      className="flex-1 rounded-xl border border-white/15 bg-black/80 px-2.5 py-1.5 text-xs font-mono text-white"
                    />
                    <button
                      type="submit"
                      disabled={busy}
                      className="rounded-xl bg-[#C4282A] hover:bg-red-600 px-3 py-1.5 text-[10.5px] font-extrabold text-white cursor-pointer"
                    >
                      Block
                    </button>
                  </div>
                </form>

                {/* Active Session-Only Test Blocks */}
                {sessionBlocks.length > 0 && (
                  <div className="rounded-2xl border border-amber-400/40 bg-amber-950/25 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase text-amber-300">
                        🧪 Active Session Test Blocks ({sessionBlocks.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          getNativeInspectorBridge()?.clearSessionBlockedDomains?.();
                          setSessionBlocks([]);
                        }}
                        className="text-[10px] font-bold text-amber-200 hover:underline cursor-pointer"
                      >
                        Clear All
                      </button>
                    </div>
                    {sessionBlocks.map((dom) => (
                      <div
                        key={dom}
                        className="flex items-center justify-between gap-2 text-[10.5px] font-mono"
                      >
                        <span className="text-white truncate">{dom}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleGlobalBlock(dom)}
                            className="rounded bg-[#C4282A] px-2 py-0.5 text-[9.5px] font-sans font-extrabold text-white cursor-pointer"
                          >
                            Promote Global
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveSessionBlock(dom)}
                            className="text-red-300 font-bold cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Ranked Third-Party Hosts Observed on This Player */}
                <div className="space-y-2">
                  <span className="block text-[10px] font-extrabold uppercase text-[#8C8175]">
                    Third-Party Hosts Observed on This Stream
                  </span>
                  {suspectHostsSummary.length === 0 ? (
                    <p className="text-[11px] text-[#8C8175] text-center py-4">
                      No non-whitelisted third-party hosts observed yet.
                    </p>
                  ) : (
                    suspectHostsSummary.map((row) => (
                      <div
                        key={row.host}
                        className="rounded-xl border border-white/10 bg-[#141210] p-2.5 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[11px] font-black text-white truncate">
                            {row.host}
                          </span>
                          <span className="text-[10px] font-bold text-amber-300 shrink-0">
                            {row.count} req ({row.blocked} blocked)
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSessionTestBlock(row.host)}
                            className="rounded-md bg-amber-600/30 hover:bg-amber-600/60 px-2 py-1 text-[10px] font-extrabold text-amber-200 cursor-pointer"
                          >
                            🧪 Test Block
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleGlobalBlock(row.host)}
                            className="rounded-md bg-[#C4282A] hover:bg-red-600 px-2 py-1 text-[10px] font-extrabold text-white cursor-pointer"
                          >
                            🛡️ Block Globally
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleReportAdTicket(row.host)}
                            className="rounded-md border border-cyan-400/40 bg-cyan-950/60 px-2 py-1 text-[10px] font-bold text-cyan-200 cursor-pointer"
                          >
                            🚩 Ticket
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </aside>
      )}
    </div>,
    document.body
  );
}