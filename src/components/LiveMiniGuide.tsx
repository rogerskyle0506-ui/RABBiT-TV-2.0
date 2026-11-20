// src/components/LiveMiniGuide.tsx
import React, { useState, useEffect, useMemo, useRef, useCallback, memo } from "react";
import type { LiveChannel } from "@/lib/live-feed-service";
import {
  type AppTheme,
  getFavoriteChannelIds,
  getKidsModeLocked,
  getSavedUserAge,
} from "@/lib/settings";
import { getChannelDescription } from "@/lib/channel-descriptions";

export type MiniGuideMode = "tune" | "split";

export interface LiveMiniGuideProps {
  isOpen: boolean;
  mode: MiniGuideMode;
  appTheme: AppTheme;
  channels: LiveChannel[];
  currentStreamUrl: string;
  secondaryStreamUrl?: string;
  isLowRam: boolean;
  largeButtons: boolean;
  onSelectChannel: (channel: LiveChannel) => void;
  onClose: () => void;
}

const MATURE_LIVE_KEYWORDS = [
  "adult",
  "crime",
  "deadly",
  "murder",
  "cops",
  "48 hours",
  "csi",
  "thriller",
  "paranormal",
  "haunt",
  "ghost",
  "botched",
  "prisoner",
  "hell",
  "ridiculousness",
];

const INITIAL_RENDER_LIMIT = 60;

interface MiniGuideThemeTokens {
  drawerShell: string;
  headerBg: string;
  dividerBorder: string;
  accentText: string;
  accentBar: string;
  mutedText: string;
  subMutedText: string;
  inputClass: string;
  pillActive: string;
  pillIdle: string;
  rowActive: string;
  rowSecondary: string;
  rowIdle: string;
  logoBox: string;
  badge: string;
  closeBtn: string;
  focusRing: string;
}

function getMiniGuideThemeTokens(theme: AppTheme): MiniGuideThemeTokens {
  switch (theme) {
    case "red":
      return {
        drawerShell:
          "bg-zinc-950/92 border-red-500/40 shadow-[12px_0_50px_rgba(0,0,0,0.92),0_0_28px_rgba(239,68,68,0.2)]",
        headerBg: "bg-red-950/35 border-red-500/25",
        dividerBorder: "border-red-500/20",
        accentText: "text-red-300",
        accentBar: "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.9)]",
        mutedText: "text-zinc-300",
        subMutedText: "text-zinc-400",
        inputClass:
          "border-red-500/35 bg-black/80 text-white placeholder-zinc-400 focus:ring-2 focus:ring-red-500 focus:border-red-400",
        pillActive:
          "bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 text-white shadow-md shadow-red-600/30",
        pillIdle:
          "bg-red-950/45 hover:bg-red-900/70 border-red-500/25 text-red-100 hover:text-white",
        rowActive:
          "bg-red-950/75 border-red-400/80 ring-1 ring-red-400/50 shadow-[0_0_18px_rgba(239,68,68,0.25)]",
        rowSecondary:
          "bg-red-950/45 border-red-400/50",
        rowIdle:
          "bg-black/55 hover:bg-red-950/45 border-red-500/20 hover:border-red-400/50",
        logoBox: "bg-black/85 border-red-500/25",
        badge: "bg-red-950/80 border-red-400/45 text-red-200",
        closeBtn:
          "bg-red-950/60 hover:bg-red-900/85 border-red-500/35 text-red-100 hover:text-white",
        focusRing: "focus:ring-red-500",
      };
    case "midnight":
      return {
        drawerShell:
          "bg-slate-950/92 border-blue-500/40 shadow-[12px_0_50px_rgba(0,0,0,0.92),0_0_28px_rgba(59,130,246,0.2)]",
        headerBg: "bg-blue-950/35 border-blue-500/25",
        dividerBorder: "border-blue-500/20",
        accentText: "text-sky-300",
        accentBar: "bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.9)]",
        mutedText: "text-slate-300",
        subMutedText: "text-slate-400",
        inputClass:
          "border-blue-500/35 bg-black/80 text-white placeholder-slate-400 focus:ring-2 focus:ring-sky-400 focus:border-sky-400",
        pillActive:
          "bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-500 text-white shadow-md shadow-blue-600/30",
        pillIdle:
          "bg-blue-950/45 hover:bg-blue-900/70 border-blue-500/25 text-sky-100 hover:text-white",
        rowActive:
          "bg-blue-950/75 border-sky-400/80 ring-1 ring-sky-400/50 shadow-[0_0_18px_rgba(56,189,248,0.25)]",
        rowSecondary:
          "bg-blue-950/45 border-sky-400/50",
        rowIdle:
          "bg-black/55 hover:bg-blue-950/45 border-blue-500/20 hover:border-sky-400/50",
        logoBox: "bg-black/85 border-blue-500/25",
        badge: "bg-blue-950/80 border-sky-400/45 text-sky-200",
        closeBtn:
          "bg-blue-950/60 hover:bg-blue-900/85 border-blue-500/35 text-blue-100 hover:text-white",
        focusRing: "focus:ring-sky-400",
      };
    case "emerald":
      return {
        drawerShell:
          "bg-neutral-950/92 border-emerald-500/40 shadow-[12px_0_50px_rgba(0,0,0,0.92),0_0_28px_rgba(16,185,129,0.2)]",
        headerBg: "bg-emerald-950/35 border-emerald-500/25",
        dividerBorder: "border-emerald-500/20",
        accentText: "text-emerald-300",
        accentBar: "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]",
        mutedText: "text-neutral-300",
        subMutedText: "text-neutral-400",
        inputClass:
          "border-emerald-500/35 bg-black/80 text-white placeholder-neutral-400 focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400",
        pillActive:
          "bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 text-white shadow-md shadow-emerald-600/30",
        pillIdle:
          "bg-emerald-950/45 hover:bg-emerald-900/70 border-emerald-500/25 text-emerald-100 hover:text-white",
        rowActive:
          "bg-emerald-950/75 border-emerald-400/80 ring-1 ring-emerald-400/50 shadow-[0_0_18px_rgba(52,211,153,0.25)]",
        rowSecondary:
          "bg-emerald-950/45 border-emerald-400/50",
        rowIdle:
          "bg-black/55 hover:bg-emerald-950/45 border-emerald-500/20 hover:border-emerald-400/50",
        logoBox: "bg-black/85 border-emerald-500/25",
        badge: "bg-emerald-950/80 border-emerald-400/45 text-emerald-200",
        closeBtn:
          "bg-emerald-950/60 hover:bg-emerald-900/85 border-emerald-500/35 text-emerald-100 hover:text-white",
        focusRing: "focus:ring-emerald-400",
      };
    case "amber":
      return {
        drawerShell:
          "bg-stone-950/92 border-amber-500/40 shadow-[12px_0_50px_rgba(0,0,0,0.92),0_0_28px_rgba(245,158,11,0.2)]",
        headerBg: "bg-amber-950/35 border-amber-500/25",
        dividerBorder: "border-amber-500/20",
        accentText: "text-amber-300",
        accentBar: "bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.9)]",
        mutedText: "text-stone-300",
        subMutedText: "text-stone-400",
        inputClass:
          "border-amber-500/35 bg-black/80 text-white placeholder-stone-400 focus:ring-2 focus:ring-amber-400 focus:border-amber-400",
        pillActive:
          "bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 text-white shadow-md shadow-amber-600/30",
        pillIdle:
          "bg-amber-950/45 hover:bg-amber-900/70 border-amber-500/25 text-amber-100 hover:text-white",
        rowActive:
          "bg-amber-950/75 border-amber-400/80 ring-1 ring-amber-400/50 shadow-[0_0_18px_rgba(251,191,36,0.25)]",
        rowSecondary:
          "bg-amber-950/45 border-amber-400/50",
        rowIdle:
          "bg-black/55 hover:bg-amber-950/45 border-amber-500/20 hover:border-amber-400/50",
        logoBox: "bg-black/85 border-amber-500/25",
        badge: "bg-amber-950/80 border-amber-400/45 text-amber-200",
        closeBtn:
          "bg-amber-950/60 hover:bg-amber-900/85 border-amber-500/35 text-amber-100 hover:text-white",
        focusRing: "focus:ring-amber-400",
      };
    case "cyan":
      return {
        drawerShell:
          "bg-slate-950/92 border-cyan-500/40 shadow-[12px_0_50px_rgba(0,0,0,0.92),0_0_28px_rgba(6,182,212,0.2)]",
        headerBg: "bg-cyan-950/35 border-cyan-500/25",
        dividerBorder: "border-cyan-500/20",
        accentText: "text-cyan-300",
        accentBar: "bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.9)]",
        mutedText: "text-slate-300",
        subMutedText: "text-slate-400",
        inputClass:
          "border-cyan-500/35 bg-black/80 text-white placeholder-slate-400 focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400",
        pillActive:
          "bg-gradient-to-r from-cyan-600 via-teal-600 to-blue-600 text-white shadow-md shadow-cyan-600/30",
        pillIdle:
          "bg-cyan-950/45 hover:bg-cyan-900/70 border-cyan-500/25 text-cyan-100 hover:text-white",
        rowActive:
          "bg-cyan-950/75 border-cyan-400/80 ring-1 ring-cyan-400/50 shadow-[0_0_18px_rgba(34,211,238,0.25)]",
        rowSecondary:
          "bg-cyan-950/45 border-cyan-400/50",
        rowIdle:
          "bg-black/55 hover:bg-cyan-950/45 border-cyan-500/20 hover:border-cyan-400/50",
        logoBox: "bg-black/85 border-cyan-500/25",
        badge: "bg-cyan-950/80 border-cyan-400/45 text-cyan-200",
        closeBtn:
          "bg-cyan-950/60 hover:bg-cyan-900/85 border-cyan-500/35 text-cyan-100 hover:text-white",
        focusRing: "focus:ring-cyan-400",
      };
    case "violet":
    default:
      return {
        drawerShell:
          "bg-slate-950/92 border-violet-500/40 shadow-[12px_0_50px_rgba(0,0,0,0.92),0_0_28px_rgba(139,92,246,0.2)]",
        headerBg: "bg-purple-950/35 border-violet-500/25",
        dividerBorder: "border-violet-500/20",
        accentText: "text-violet-300",
        accentBar: "bg-violet-500 shadow-[0_0_12px_rgba(139,92,246,0.9)]",
        mutedText: "text-slate-300",
        subMutedText: "text-slate-400",
        inputClass:
          "border-violet-500/35 bg-black/80 text-white placeholder-slate-400 focus:ring-2 focus:ring-violet-400 focus:border-violet-400",
        pillActive:
          "bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white shadow-md shadow-violet-600/30",
        pillIdle:
          "bg-purple-950/45 hover:bg-purple-900/70 border-violet-500/25 text-purple-100 hover:text-white",
        rowActive:
          "bg-purple-950/75 border-violet-400/80 ring-1 ring-violet-400/50 shadow-[0_0_18px_rgba(139,92,246,0.25)]",
        rowSecondary:
          "bg-purple-950/45 border-violet-400/50",
        rowIdle:
          "bg-black/55 hover:bg-purple-950/45 border-violet-500/20 hover:border-violet-400/50",
        logoBox: "bg-black/85 border-violet-500/25",
        badge: "bg-purple-950/80 border-violet-400/45 text-violet-200",
        closeBtn:
          "bg-purple-950/60 hover:bg-purple-900/85 border-violet-500/35 text-purple-100 hover:text-white",
        focusRing: "focus:ring-violet-400",
      };
  }
}

function resolveChannelCategory(ch: LiveChannel): string {
  const raw = ((ch as any).category || (ch as any).group || "")
    .toString()
    .trim();
  if (raw) return raw;

  const lower = (ch.title || "").toLowerCase();
  if (
    /sport|nfl|nba|nhl|mlb|ufc|wwe|fight|boxing|golf|tennis|racing|f1|soccer|football|espn|tsn|fox sports|beinsports|red bull|outdoor/.test(
      lower
    )
  ) {
    return "Sports";
  }
  if (/news|cnn|cbc|bbc|nbc|abc|cbs|bloomberg|weather|sky|global|ctv/.test(lower)) {
    return "News";
  }
  if (/movie|cinema|film|action|horror|thriller|sci-fi|comedy|drama|western|hallmark/.test(lower)) {
    return "Movies";
  }
  if (/kid|cartoon|nick|disney|anime|toon|family|lego|baby|pokemon/.test(lower)) {
    return "Kids";
  }
  if (/music|mtv|vevo|concert|radio|hits|hip hop|rock|country|jazz/.test(lower)) {
    return "Music";
  }
  return "Entertainment";
}

/**
 * Isolated uncontrolled search input to keep Android WebView typing strictly LTR.
 */
const MiniGuideSearchInput = memo(function MiniGuideSearchInput({
  tokens,
  onQueryChange,
}: {
  tokens: MiniGuideThemeTokens;
  onQueryChange: (q: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [hasText, setHasText] = useState(false);

  const handleClear = () => {
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.focus();
    }
    setHasText(false);
    onQueryChange("");
  };

  return (
    <div className="relative w-full">
      <span
        className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none ${tokens.accentText}`}
      >
        🔍
      </span>
      <input
        ref={inputRef}
        type="search"
        dir="ltr"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        defaultValue=""
        onInput={(e) => {
          const val = (e.target as HTMLInputElement).value;
          setHasText(Boolean(val));
          onQueryChange(val);
        }}
        placeholder="Filter channels..."
        style={{ direction: "ltr", unicodeBidi: "plaintext", textAlign: "left" }}
        className={`w-full h-9 rounded-xl border pl-8 pr-8 text-xs font-bold focus:outline-none transition ${tokens.inputClass}`}
      />
      {hasText && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear channel filter"
          className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-xs hover:text-white cursor-pointer ${tokens.subMutedText}`}
        >
          ✕
        </button>
      )}
    </div>
  );
});

export const LiveMiniGuide = memo(function LiveMiniGuide({
  isOpen,
  mode,
  appTheme,
  channels,
  currentStreamUrl,
  secondaryStreamUrl = "",
  isLowRam,
  largeButtons,
  onSelectChannel,
  onClose,
}: LiveMiniGuideProps) {
  const listContainerRef = useRef<HTMLDivElement>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [renderLimit, setRenderLimit] = useState<number>(INITIAL_RENDER_LIMIT);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(
    () => new Set(getFavoriteChannelIds())
  );

  const tokens = useMemo(() => getMiniGuideThemeTokens(appTheme), [appTheme]);

  // Refresh pinned favorites when guide opens & reset limit when filters change
  useEffect(() => {
    if (!isOpen) return;
    setFavoriteIds(new Set(getFavoriteChannelIds()));
    setRenderLimit(INITIAL_RENDER_LIMIT);
  }, [isOpen]);

  useEffect(() => {
    setRenderLimit(INITIAL_RENDER_LIMIT);
  }, [selectedCategory, searchQuery]);

  // Apply Kids Safe Mode guard once
  const safeChannels = useMemo(() => {
    const kidsActive = getKidsModeLocked() || getSavedUserAge() < 13;
    if (!kidsActive) return channels;
    return channels.filter((ch) => {
      const lower = (ch.title || "").toLowerCase();
      return !MATURE_LIVE_KEYWORDS.some((kw) => lower.includes(kw));
    });
  }, [channels]);

  // Pre-compute category buckets cleanly
  const { categories, categorizedChannels } = useMemo(() => {
    const catSet = new Set<string>();
    const withCats = safeChannels.map((ch) => {
      const cat = resolveChannelCategory(ch);
      catSet.add(cat);
      return { channel: ch, category: cat };
    });

    const preferredOrder = [
      "Sports",
      "News",
      "Movies",
      "Entertainment",
      "Kids",
      "Music",
    ];
    const sortedExtra = Array.from(catSet)
      .filter((c) => !preferredOrder.includes(c))
      .sort((a, b) => a.localeCompare(b));

    const orderedCats = [
      "All",
      ...(favoriteIds.size > 0 ? ["★ Pinned"] : []),
      ...preferredOrder.filter((c) => catSet.has(c)),
      ...sortedExtra,
    ];

    return { categories: orderedCats, categorizedChannels: withCats };
  }, [safeChannels, favoriteIds]);

  const filteredChannels = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return categorizedChannels
      .filter(({ channel, category }) => {
        if (selectedCategory === "★ Pinned") {
          const cid = channel.channelId || channel.streamUrl || channel.url;
          if (!favoriteIds.has(cid)) return false;
        } else if (selectedCategory !== "All" && category !== selectedCategory) {
          return false;
        }
        if (q) {
          const titleMatch = (channel.title || "").toLowerCase().includes(q);
          const catMatch = category.toLowerCase().includes(q);
          if (!titleMatch && !catMatch) return false;
        }
        return true;
      })
      .map((entry) => entry.channel);
  }, [categorizedChannels, selectedCategory, searchQuery, favoriteIds]);

  const visibleChannels = useMemo(
    () => filteredChannels.slice(0, renderLimit),
    [filteredChannels, renderLimit]
  );

  // D-pad / TV remote navigation inside the mini-guide
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input") return;

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const container = listContainerRef.current;
        if (!container) return;
        const buttons = Array.from(
          container.querySelectorAll<HTMLButtonElement>("button[data-guide-item]")
        );
        if (!buttons.length) return;

        e.preventDefault();
        e.stopPropagation();
        const idx = buttons.findIndex((b) => b === document.activeElement);
        const nextIdx =
          e.key === "ArrowDown"
            ? idx < buttons.length - 1
              ? idx + 1
              : 0
            : idx > 0
              ? idx - 1
              : buttons.length - 1;
        buttons[nextIdx]?.focus();
        buttons[nextIdx]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen, onClose]);

  const handleSelect = useCallback(
    (ch: LiveChannel) => {
      onSelectChannel(ch);
      onClose();
    },
    [onSelectChannel, onClose]
  );

  if (!isOpen) return null;

  const isSplitPick = mode === "split";

  return (
    <div
      className="rabtv-vidsrc-protected fixed inset-0 z-50 flex justify-start pointer-events-none"
      role="dialog"
      aria-modal="true"
      aria-label={
        isSplitPick ? "Choose Second Split-Screen Channel" : "Live TV Mini-Guide"
      }
    >
      <style>{`
        @keyframes miniGuideSlideIn {
          0% {
            opacity: 0;
            transform: translate3d(-28px, 0, 0);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }
        .animate-mini-guide-in {
          animation: miniGuideSlideIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Light backdrop — keeps live video visible on the right */}
      <div
        className="fixed inset-0 bg-black/45 pointer-events-auto"
        onClick={onClose}
      />

      {/* Left-Edge Transparent Slide-Over Drawer */}
      <aside
        data-tour="live-mini-guide"
        className={`relative z-10 pointer-events-auto h-[100dvh] w-full max-w-[min(370px,88vw)] flex flex-col border-r overflow-hidden animate-mini-guide-in ${
          isLowRam ? "" : "backdrop-blur-2xl"
        } ${tokens.drawerShell}`}
      >
        {/* Top Header */}
        <div
          className={`shrink-0 px-3.5 py-3 border-b space-y-2.5 ${tokens.headerBg}`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`w-1.5 h-6 rounded-full shrink-0 ${tokens.accentBar}`}
              />
              <div className="min-w-0">
                <h2 className="text-sm font-black text-white truncate">
                  {isSplitPick
                    ? "⊞ Pick 2nd Live Channel"
                    : "📺 Live Mini-Guide"}
                </h2>
                <p className={`text-[10px] font-semibold truncate ${tokens.subMutedText}`}>
                  {isSplitPick
                    ? "Plays side-by-side in Split-Screen Mode"
                    : `${filteredChannels.length} channels • Zap without leaving stream`}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className={`shrink-0 rounded-xl border px-2.5 py-1.5 text-xs font-extrabold transition cursor-pointer focus:outline-none focus:ring-2 ${tokens.closeBtn} ${tokens.focusRing}`}
            >
              ✕
            </button>
          </div>

          <MiniGuideSearchInput
            tokens={tokens}
            onQueryChange={setSearchQuery}
          />

          {/* Horizontal Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
            {categories.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`shrink-0 rounded-lg border px-2.5 py-1 text-[10px] font-extrabold whitespace-nowrap transition cursor-pointer focus:outline-none focus:ring-2 ${
                    tokens.focusRing
                  } ${
                    active ? `${tokens.pillActive} border-transparent` : tokens.pillIdle
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Channel Rows */}
        <div
          ref={listContainerRef}
          className="flex-1 overflow-y-auto px-2.5 py-2.5 space-y-1.5 scrollbar-none"
        >
          {visibleChannels.length === 0 ? (
            <div className="py-12 px-4 text-center space-y-1.5">
              <p className="text-sm font-bold text-white">No channels match.</p>
              <p className={`text-xs ${tokens.subMutedText}`}>
                Try switching to "All" or clearing your filter.
              </p>
            </div>
          ) : (
            <>
              {visibleChannels.map((ch) => {
                const u = (ch.streamUrl || ch.url || "").trim();
                const isMainPlaying = u && u === currentStreamUrl;
                const isSplitPlaying = Boolean(
                  secondaryStreamUrl && u && u === secondaryStreamUrl
                );
                const cid = ch.channelId || u;
                const isPinned = favoriteIds.has(cid);

                return (
                  <button
                    key={cid || ch.title}
                    type="button"
                    data-guide-item="true"
                    onClick={() => handleSelect(ch)}
                    className={`w-full flex items-center gap-2.5 rounded-2xl border ${
                      largeButtons ? "p-3" : "p-2.5"
                    } text-left transition cursor-pointer focus:outline-none focus:ring-2 ${
                      tokens.focusRing
                    } ${
                      isMainPlaying
                        ? tokens.rowActive
                        : isSplitPlaying
                          ? tokens.rowSecondary
                          : tokens.rowIdle
                    }`}
                  >
                    {/* Channel Logo */}
                    <div
                      className={`h-11 w-14 shrink-0 rounded-xl border p-1.5 flex items-center justify-center overflow-hidden ${tokens.logoBox}`}
                    >
                      {ch.logo ? (
                        <img
                          src={ch.logo}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <span className={`text-[10px] font-black ${tokens.accentText}`}>
                          LIVE
                        </span>
                      )}
                    </div>

                    {/* Title & Description */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {isPinned && (
                          <span className={`text-[11px] shrink-0 ${tokens.accentText}`}>
                            ★
                          </span>
                        )}
                        <span className="text-xs font-extrabold text-white truncate">
                          {ch.title}
                        </span>
                      </div>
                      <p
                        className={`text-[10px] line-clamp-1 mt-0.5 ${tokens.subMutedText}`}
                      >
                        {getChannelDescription(ch.title) || "Live TV broadcast"}
                      </p>
                    </div>

                    {/* Status Pill */}
                    <div className="shrink-0">
                      {isMainPlaying ? (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-950/85 border border-emerald-400/45 px-2 py-0.5 text-[9px] font-black text-emerald-300 uppercase">
                          ● On Air
                        </span>
                      ) : isSplitPlaying ? (
                        <span
                          className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[9px] font-black uppercase ${tokens.badge}`}
                        >
                          ⊞ Screen 2
                        </span>
                      ) : (
                        <span
                          className={`text-[10px] font-extrabold ${tokens.accentText}`}
                        >
                          {isSplitPick ? "+ Add" : "▶"}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}

              {filteredChannels.length > renderLimit && (
                <button
                  type="button"
                  onClick={() => setRenderLimit((prev) => prev + 60)}
                  className={`w-full mt-2 rounded-xl border py-2.5 text-xs font-extrabold transition cursor-pointer focus:outline-none focus:ring-2 ${tokens.closeBtn} ${tokens.focusRing}`}
                >
                  Load More ({filteredChannels.length - renderLimit} remaining)
                </button>
              )}
            </>
          )}
        </div>

        {/* Footer Remote Hint */}
        <div
          className={`shrink-0 px-3.5 py-2 border-t text-[10px] font-semibold flex items-center justify-between ${tokens.dividerBorder} ${tokens.subMutedText}`}
        >
          <span>▲▼ Browse • Enter Zap</span>
          <span>Esc Close</span>
        </div>
      </aside>
    </div>
  );
});

LiveMiniGuide.displayName = "LiveMiniGuide";
export default LiveMiniGuide;