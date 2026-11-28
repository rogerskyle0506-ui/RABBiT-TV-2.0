// src/components/MovieNightMatcher.tsx
import React, { useState, useEffect, useMemo, useCallback, memo } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  type AppTheme,
  getSavedUserAge,
  getKidsModeLocked,
  isAllowedForAge,
  getOptimalTmdbImageWidth,
  getHardwareLimits,
  getLargeButtons,
} from "@/lib/settings";
import { isTitleDisliked } from "@/lib/watch-history";
import { isTitleBroken } from "@/lib/broken-links";
import { bgAudio } from "@/lib/background-audio";

const TMDB_API_KEY =
  ((import.meta as any).env?.VITE_TMDB_API_KEY as string) || "";
const TMDB_BASE_URL = "https://api.themoviedb.org/3/";
const FETCH_TIMEOUT_MS = 7000;

const IMG_MN_MODAL_FRAME =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-referral-modal-frame.jpg";
const IMG_MN_BANNER =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-movienight-banner.jpg";
const IMG_MN_CARD =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-referral-section-card.jpg";
const IMG_MN_BTN_KEEP =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-movienight-btn-keep.jpg";
const IMG_MN_BTN_PASS =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-movienight-btn-pass.jpg";
const IMG_MN_BTN_IDLE =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-referral-tab-idle.jpg";

const MOVIE_NIGHT_STYLES = `
  :root, html[data-theme="violet"] { --rabtv-mn-filter: hue-rotate(-78deg) saturate(1.12) brightness(1.02); }
  html[data-theme="red"] { --rabtv-mn-filter: hue-rotate(0deg) saturate(1.08) brightness(1.0); }
  html[data-theme="midnight"] { --rabtv-mn-filter: hue-rotate(-132deg) saturate(1.14) brightness(1.04); }
  html[data-theme="emerald"] { --rabtv-mn-filter: hue-rotate(154deg) saturate(1.10) brightness(1.02); }
  html[data-theme="amber"] { --rabtv-mn-filter: hue-rotate(28deg) saturate(1.14) brightness(1.04); }
  html[data-theme="cyan"] { --rabtv-mn-filter: hue-rotate(-154deg) saturate(1.12) brightness(1.04); }

  .rabtv-mn-shell {
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
    padding: 18px 14px !important;
    background-color: #0c0a09;
    contain: layout paint;
  }
  @media (min-width: 640px) { .rabtv-mn-shell { padding: 24px 22px !important; } }
  .rabtv-mn-shell-9slice {
    position: absolute;
    inset: 0;
    box-sizing: border-box;
    border-style: solid;
    border-color: transparent;
    border-width: 24px 20px;
    border-image-source: url("${IMG_MN_MODAL_FRAME}");
    border-image-slice: 12% 11% fill;
    border-image-repeat: stretch;
    filter: var(--rabtv-mn-filter);
    pointer-events: none;
    z-index: 0;
  }
  .rabtv-mn-card {
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
    padding: 15px 15px !important;
    background-color: #0c0a09;
    contain: layout paint;
  }
  .rabtv-mn-card-9slice {
    position: absolute;
    inset: 0;
    box-sizing: border-box;
    border-style: solid;
    border-color: transparent;
    border-width: 14px 14px;
    border-image-source: url("${IMG_MN_CARD}");
    border-image-slice: 14% 11% fill;
    border-image-repeat: stretch;
    filter: var(--rabtv-mn-filter);
    pointer-events: none;
    z-index: 0;
  }
  .rabtv-mn-btn {
    position: relative;
    overflow: hidden;
    background-color: #0c0a09;
    border: 0 !important;
    clip-path: polygon(9px 0%, calc(100% - 9px) 0%, 100% 9px, 100% calc(100% - 9px), calc(100% - 9px) 100%, 9px 100%, 0% calc(100% - 9px), 0% 9px);
    contain: layout paint;
    transition: transform 140ms ease, filter 140ms ease;
  }
  .rabtv-mn-btn:hover:not(:disabled) { transform: scale(1.02); filter: brightness(1.1); }
  .rabtv-mn-btn:active:not(:disabled) { transform: scale(0.97); }
  .rabtv-mn-btn-art {
    position: absolute;
    inset: -2px;
    background-size: 100% 100%;
    pointer-events: none;
    z-index: 0;
  }
  .rabtv-mn-btn-scrim {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 78% 72% at 50% 50%, rgba(12,10,9,0.36) 0%, rgba(12,10,9,0.14) 100%);
    pointer-events: none;
    z-index: 1;
  }
  .rabtv-mn-btn-label {
    position: relative;
    z-index: 2;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    text-shadow: 0 1px 4px rgba(12,10,9,0.96);
  }
`;

export interface MovieNightMatcherProps {
  isOpen: boolean;
  appTheme: AppTheme;
  onClose: () => void;
}

interface MoodPreset {
  id: string;
  icon: string;
  label: string;
  tagline: string;
  params: Record<string, string>;
  kidSafe: boolean;
}

const MOOD_PRESETS: MoodPreset[] = [
  {
    id: "under-90",
    icon: "⏱️",
    label: "Under 90 Mins",
    tagline: "Fast, punchy movies that wrap up early",
    params: {
      "with_runtime.lte": "95",
      "vote_average.gte": "6.5",
      "vote_count.gte": "150",
      sort_by: "popularity.desc",
    },
    kidSafe: true,
  },
  {
    id: "family-laughs",
    icon: "👨‍👩‍👧",
    label: "Family Laughs",
    tagline: "Feel-good comedies & animated hits for everyone",
    params: {
      with_genres: "35,10751",
      "vote_average.gte": "6.5",
      "vote_count.gte": "120",
      sort_by: "popularity.desc",
    },
    kidSafe: true,
  },
  {
    id: "mind-bender",
    icon: "🧠",
    label: "Mind-Bender",
    tagline: "Twisty sci-fi & mystery thrillers",
    params: {
      with_genres: "878,9648",
      "vote_average.gte": "7.0",
      "vote_count.gte": "200",
      sort_by: "vote_average.desc",
    },
    kidSafe: false,
  },
  {
    id: "action-rush",
    icon: "💥",
    label: "Action Rush",
    tagline: "High-octane blockbusters & big stunts",
    params: {
      with_genres: "28,12",
      "vote_average.gte": "6.6",
      "vote_count.gte": "250",
      sort_by: "popularity.desc",
    },
    kidSafe: false,
  },
  {
    id: "date-night",
    icon: "❤️",
    label: "Date Night",
    tagline: "Charming rom-coms & warm dramas",
    params: {
      with_genres: "10749,35",
      "vote_average.gte": "6.7",
      "vote_count.gte": "150",
      sort_by: "popularity.desc",
    },
    kidSafe: false,
  },
  {
    id: "late-thrills",
    icon: "🌙",
    label: "Late-Night Thrills",
    tagline: "Edge-of-your-seat suspense & horror",
    params: {
      with_genres: "53,27",
      "vote_average.gte": "6.5",
      "vote_count.gte": "150",
      sort_by: "popularity.desc",
    },
    kidSafe: false,
  },
];

interface MatcherCandidate {
  id: string;
  title: string;
  overview: string;
  posterUrl: string;
  year: string;
  rating: string;
}

interface MatcherThemeTokens {
  modalShell: string;
  subPanel: string;
  dividerBorder: string;
  accentText: string;
  accentBar: string;
  mutedText: string;
  subMutedText: string;
  badge: string;
  subtleBadge: string;
  btnPrimary: string;
  btnSecondary: string;
  moodCard: string;
  focusRing: string;
}

function getMatcherThemeTokens(theme: AppTheme): MatcherThemeTokens {
  switch (theme) {
    case "red":
      return {
        modalShell:
          "bg-zinc-950/95 border-red-500/40 shadow-[0_24px_70px_rgba(0,0,0,0.95),0_0_32px_rgba(239,68,68,0.22)]",
        subPanel: "bg-black/75 border-red-500/25",
        dividerBorder: "border-red-500/20",
        accentText: "text-red-300",
        accentBar: "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.9)]",
        mutedText: "text-zinc-300",
        subMutedText: "text-zinc-400",
        badge: "bg-red-950/80 border-red-500/40 text-red-200",
        subtleBadge: "bg-black/75 border-red-500/25 text-zinc-200",
        btnPrimary:
          "bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 text-white shadow-lg shadow-red-600/35",
        btnSecondary:
          "bg-red-950/60 hover:bg-red-900/80 border-red-500/35 text-red-100 hover:text-white",
        moodCard:
          "bg-black/70 hover:bg-red-950/60 border-red-500/25 hover:border-red-400/70",
        focusRing: "focus:ring-red-500",
      };
    case "midnight":
      return {
        modalShell:
          "bg-slate-950/95 border-blue-500/40 shadow-[0_24px_70px_rgba(0,0,0,0.95),0_0_32px_rgba(59,130,246,0.22)]",
        subPanel: "bg-black/75 border-blue-500/25",
        dividerBorder: "border-blue-500/20",
        accentText: "text-sky-300",
        accentBar: "bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.9)]",
        mutedText: "text-slate-300",
        subMutedText: "text-slate-400",
        badge: "bg-blue-950/80 border-blue-500/40 text-sky-200",
        subtleBadge: "bg-black/75 border-blue-500/25 text-slate-200",
        btnPrimary:
          "bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-500 text-white shadow-lg shadow-blue-600/35",
        btnSecondary:
          "bg-blue-950/60 hover:bg-blue-900/80 border-blue-500/35 text-blue-100 hover:text-white",
        moodCard:
          "bg-black/70 hover:bg-blue-950/60 border-blue-500/25 hover:border-sky-400/70",
        focusRing: "focus:ring-sky-400",
      };
    case "emerald":
      return {
        modalShell:
          "bg-neutral-950/95 border-emerald-500/40 shadow-[0_24px_70px_rgba(0,0,0,0.95),0_0_32px_rgba(16,185,129,0.22)]",
        subPanel: "bg-black/75 border-emerald-500/25",
        dividerBorder: "border-emerald-500/20",
        accentText: "text-emerald-300",
        accentBar: "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]",
        mutedText: "text-neutral-300",
        subMutedText: "text-neutral-400",
        badge: "bg-emerald-950/80 border-emerald-500/40 text-emerald-200",
        subtleBadge: "bg-black/75 border-emerald-500/25 text-neutral-200",
        btnPrimary:
          "bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 text-white shadow-lg shadow-emerald-600/35",
        btnSecondary:
          "bg-emerald-950/60 hover:bg-emerald-900/80 border-emerald-500/35 text-emerald-100 hover:text-white",
        moodCard:
          "bg-black/70 hover:bg-emerald-950/60 border-emerald-500/25 hover:border-emerald-400/70",
        focusRing: "focus:ring-emerald-400",
      };
    case "amber":
      return {
        modalShell:
          "bg-stone-950/95 border-amber-500/40 shadow-[0_24px_70px_rgba(0,0,0,0.95),0_0_32px_rgba(245,158,11,0.22)]",
        subPanel: "bg-black/75 border-amber-500/25",
        dividerBorder: "border-amber-500/20",
        accentText: "text-amber-300",
        accentBar: "bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.9)]",
        mutedText: "text-stone-300",
        subMutedText: "text-stone-400",
        badge: "bg-amber-950/80 border-amber-500/40 text-amber-200",
        subtleBadge: "bg-black/75 border-amber-500/25 text-stone-200",
        btnPrimary:
          "bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 text-white shadow-lg shadow-amber-600/35",
        btnSecondary:
          "bg-amber-950/60 hover:bg-amber-900/80 border-amber-500/35 text-amber-100 hover:text-white",
        moodCard:
          "bg-black/70 hover:bg-amber-950/60 border-amber-500/25 hover:border-amber-400/70",
        focusRing: "focus:ring-amber-400",
      };
    case "cyan":
      return {
        modalShell:
          "bg-slate-950/95 border-cyan-500/40 shadow-[0_24px_70px_rgba(0,0,0,0.95),0_0_32px_rgba(6,182,212,0.22)]",
        subPanel: "bg-black/75 border-cyan-500/25",
        dividerBorder: "border-cyan-500/20",
        accentText: "text-cyan-300",
        accentBar: "bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.9)]",
        mutedText: "text-slate-300",
        subMutedText: "text-slate-400",
        badge: "bg-cyan-950/80 border-cyan-500/40 text-cyan-200",
        subtleBadge: "bg-black/75 border-cyan-500/25 text-slate-200",
        btnPrimary:
          "bg-gradient-to-r from-cyan-600 via-teal-600 to-blue-600 text-white shadow-lg shadow-cyan-600/35",
        btnSecondary:
          "bg-cyan-950/60 hover:bg-cyan-900/80 border-cyan-500/35 text-cyan-100 hover:text-white",
        moodCard:
          "bg-black/70 hover:bg-cyan-950/60 border-cyan-500/25 hover:border-cyan-400/70",
        focusRing: "focus:ring-cyan-400",
      };
    case "violet":
    default:
      return {
        modalShell:
          "bg-slate-950/95 border-violet-500/40 shadow-[0_24px_70px_rgba(0,0,0,0.95),0_0_32px_rgba(139,92,246,0.22)]",
        subPanel: "bg-black/75 border-violet-500/25",
        dividerBorder: "border-violet-500/20",
        accentText: "text-violet-300",
        accentBar: "bg-violet-500 shadow-[0_0_12px_rgba(139,92,246,0.9)]",
        mutedText: "text-slate-300",
        subMutedText: "text-slate-400",
        badge: "bg-purple-950/80 border-violet-500/40 text-violet-200",
        subtleBadge: "bg-black/75 border-violet-500/25 text-slate-200",
        btnPrimary:
          "bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white shadow-lg shadow-violet-600/35",
        btnSecondary:
          "bg-purple-950/60 hover:bg-purple-900/80 border-violet-500/35 text-purple-100 hover:text-white",
        moodCard:
          "bg-black/70 hover:bg-purple-950/60 border-violet-500/25 hover:border-violet-400/70",
        focusRing: "focus:ring-violet-400",
      };
  }
}

export const MovieNightMatcher = memo(function MovieNightMatcher({
  isOpen,
  appTheme,
  onClose,
}: MovieNightMatcherProps) {
  const navigate = useNavigate();

  const [selectedMood, setSelectedMood] = useState<MoodPreset | null>(null);
  const [candidates, setCandidates] = useState<MatcherCandidate[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [keptList, setKeptList] = useState<MatcherCandidate[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const tokens = useMemo(() => getMatcherThemeTokens(appTheme), [appTheme]);
  const isLowRam = getHardwareLimits().effectiveMode === "low";
  const largeButtons = getLargeButtons();
  const kidsActive = getKidsModeLocked() || getSavedUserAge() < 13;

  const availableMoods = useMemo(
    () => (kidsActive ? MOOD_PRESETS.filter((m) => m.kidSafe) : MOOD_PRESETS),
    [kidsActive]
  );

  // Reset cleanly when closed
  useEffect(() => {
    if (!isOpen) {
      setSelectedMood(null);
      setCandidates([]);
      setCurrentIndex(0);
      setKeptList([]);
      setLoading(false);
      setErrorMsg(null);
    }
  }, [isOpen]);

  const loadMoodDeck = useCallback(
    async (mood: MoodPreset) => {
      setSelectedMood(mood);
      setLoading(true);
      setErrorMsg(null);
      setCandidates([]);
      setCurrentIndex(0);
      setKeptList([]);

      const controller = new AbortController();
      const timeoutId = window.setTimeout(
        () => controller.abort(),
        FETCH_TIMEOUT_MS
      );

      try {
        const pageNum = Math.floor(Math.random() * 3) + 1;
        const params = new URLSearchParams({
          api_key: TMDB_API_KEY,
          include_adult: "false",
          language: "en-US",
          page: String(pageNum),
          ...mood.params,
        });

        if (kidsActive) {
          params.set("certification_country", "US");
          params.set("certification.lte", "PG");
        }

        const res = await fetch(
          `${TMDB_BASE_URL}discover/movie?${params.toString()}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error("Could not reach TMDB catalog.");

        const data = await res.json();
        const posterW = getOptimalTmdbImageWidth();
        const userAge = getSavedUserAge();

        const rawList = Array.isArray(data?.results) ? data.results : [];
        const pool: MatcherCandidate[] = [];

        for (const item of rawList) {
          if (!item?.id || !item?.title || !item?.poster_path) continue;
          const idStr = String(item.id);
          if (
            isTitleBroken(idStr) ||
            isTitleBroken(`movie-${idStr}`) ||
            isTitleDisliked(idStr) ||
            isTitleDisliked(`movie-${idStr}`)
          ) {
            continue;
          }
          if (!isAllowedForAge(item.adult ? "R" : undefined, "MOVIE", userAge)) {
            continue;
          }

          pool.push({
            id: idStr,
            title: String(item.title),
            overview:
              String(item.overview || "").trim() ||
              "Ready to stream right now.",
            posterUrl: `https://image.tmdb.org/t/p/${posterW}${item.poster_path}`,
            year: String(item.release_date || "").split("-")[0] || "Movie",
            rating:
              typeof item.vote_average === "number" && item.vote_average > 0
                ? item.vote_average.toFixed(1)
                : "7.0",
          });
        }

        // Shuffle and deal a crisp 5-card couch vote deck
        for (let i = pool.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [pool[i], pool[j]] = [pool[j], pool[i]];
        }

        const deck = pool.slice(0, 5);
        if (!deck.length) {
          setErrorMsg("No matching movies found for that mood — try another!");
        } else {
          setCandidates(deck);
        }
      } catch {
        setErrorMsg("Network timeout — please check Wi-Fi and try again.");
      } finally {
        window.clearTimeout(timeoutId);
        setLoading(false);
      }
    },
    [kidsActive]
  );

  const activeCard =
    candidates.length > 0 && currentIndex < candidates.length
      ? candidates[currentIndex]
      : null;

  const isVotingComplete =
    Boolean(selectedMood) &&
    !loading &&
    candidates.length > 0 &&
    currentIndex >= candidates.length;

  const handleVote = useCallback(
    (keep: boolean) => {
      if (!activeCard) return;
      if (keep) {
        setKeptList((prev) => [...prev, activeCard]);
      }
      setCurrentIndex((prev) => prev + 1);
    },
    [activeCard]
  );

  // Keyboard & TV Remote shortcuts (Esc closes, Left=Pass, Right=Keep)
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (activeCard && e.key === "ArrowLeft") {
        e.preventDefault();
        handleVote(false);
      } else if (activeCard && e.key === "ArrowRight") {
        e.preventDefault();
        handleVote(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose, activeCard, handleVote]);

  const handleLaunchMovie = (movie: MatcherCandidate) => {
    bgAudio.pause();
    onClose();
    navigate({
      to: "/player",
      search: { id: movie.id, type: "movie", season: 1, episode: 1 },
    });
  };

  const handleOpenDetails = (movie: MatcherCandidate) => {
    onClose();
    navigate({
      to: "/details",
      search: { id: movie.id, type: "movie" },
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className={`rabtv-vidsrc-protected fixed inset-0 z-50 flex items-center justify-center bg-black/84 p-2.5 sm:p-4 ${
        isLowRam ? "" : "backdrop-blur-xl"
      }`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Movie Night Matcher"
    >
      <style>{MOVIE_NIGHT_STYLES}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        className="rabtv-mn-shell w-full max-w-xl max-h-[92dvh] rounded-[26px] text-white flex flex-col shadow-2xl"
      >
        <div className="rabtv-mn-shell-9slice" aria-hidden="true" />

        <div className="relative z-10 flex flex-col max-h-full overflow-y-auto scrollbar-none space-y-3.5">
          {/* Screening Lounge Mascot Hero Header */}
          <div className="relative overflow-hidden rounded-2xl border border-white/10 min-h-[154px] sm:min-h-[178px] p-3.5 flex flex-col justify-between bg-[#0c0a09] shrink-0">
            <div
              className="absolute inset-0 bg-cover bg-center opacity-92 pointer-events-none"
              style={{
                backgroundImage: `url(${IMG_MN_BANNER})`,
                backgroundPosition: "center 55%",
              }}
              aria-hidden="true"
            />
            <div
              className="absolute inset-0 bg-gradient-to-b from-[#0c0a09]/88 via-[#0c0a09]/25 to-[#0c0a09]/92 pointer-events-none"
              aria-hidden="true"
            />

            <div className="relative z-10 flex items-center justify-between gap-2">
              <span className="rounded-full bg-black/80 border border-white/15 px-2.5 py-1 text-[9.5px] font-black uppercase tracking-widest text-amber-300">
                🍿 Couch Vote
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close Movie Night Matcher"
                className="rabtv-mn-btn px-3 py-1.5 text-[11px] font-extrabold text-white cursor-pointer"
              >
                <span className="rabtv-mn-btn-art" style={{ backgroundImage: `url(${IMG_MN_BTN_IDLE})` }} />
                <span className="rabtv-mn-btn-scrim" />
                <span className="rabtv-mn-btn-label">✕ Close</span>
              </button>
            </div>

            <div className="relative z-10 pt-8 text-center sm:text-left">
              <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight text-amber-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.98)]">
                Movie Night Matcher
              </h2>
              <p className="text-[11px] font-bold text-zinc-200 drop-shadow">
                {selectedMood
                  ? `${selectedMood.icon} ${selectedMood.label} • 5-Card Couch Vote`
                  : "Pick a vibe — vote Pass or Keep in 30 seconds"}
              </p>
            </div>
          </div>

          {/* STEP 1: MOOD PICKER */}
          {!selectedMood && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {availableMoods.map((mood) => (
                <button
                  key={mood.id}
                  type="button"
                  onClick={() => void loadMoodDeck(mood)}
                  className="rabtv-mn-card rounded-2xl text-left transition hover:scale-[1.02] active:scale-[0.98] cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-400"
                >
                  <div className="rabtv-mn-card-9slice" aria-hidden="true" />
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{mood.icon}</span>
                      <span className="text-sm font-black text-white">
                        {mood.label}
                      </span>
                    </div>
                    <p className="text-[11px] leading-snug text-zinc-300">
                      {mood.tagline}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* LOADING STATE */}
          {selectedMood && loading && (
            <div className="rabtv-mn-card rounded-2xl py-12 flex flex-col items-center justify-center gap-3">
              <div className="rabtv-mn-card-9slice" aria-hidden="true" />
              <div className="relative z-10 flex flex-col items-center gap-3">
                <div className={`h-9 w-9 rounded-full border-2 border-t-transparent animate-spin ${tokens.accentText}`} />
                <span className="text-xs font-bold text-zinc-200">
                  Dealing 5 {selectedMood.label} picks…
                </span>
              </div>
            </div>
          )}

          {/* ERROR STATE */}
          {selectedMood && !loading && errorMsg && (
            <div className="rabtv-mn-card rounded-2xl text-center">
              <div className="rabtv-mn-card-9slice" aria-hidden="true" />
              <div className="relative z-10 py-4 space-y-3">
                <p className="text-xs font-bold text-amber-300">⚠️ {errorMsg}</p>
                <button
                  type="button"
                  onClick={() => setSelectedMood(null)}
                  className="rabtv-mn-btn px-4 py-2 text-xs font-extrabold text-white cursor-pointer"
                >
                  <span className="rabtv-mn-btn-art" style={{ backgroundImage: `url(${IMG_MN_BTN_IDLE})` }} />
                  <span className="rabtv-mn-btn-scrim" />
                  <span className="rabtv-mn-btn-label">← Pick Another Mood</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: 5-CARD PASS / KEEP COUCH VOTE */}
          {activeCard && !loading && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between text-[11px] font-extrabold px-1">
                <span className="text-zinc-300">
                  Card {currentIndex + 1} of {candidates.length}
                </span>
                <span className="rounded-full bg-emerald-950/80 border border-emerald-400/45 px-2.5 py-0.5 text-emerald-300">
                  Kept: {keptList.length}
                </span>
              </div>

              <div className="rabtv-mn-card rounded-2xl">
                <div className="rabtv-mn-card-9slice" aria-hidden="true" />
                <div className="relative z-10 flex flex-col sm:flex-row gap-3.5">
                  <img
                    src={activeCard.posterUrl}
                    alt={activeCard.title}
                    className="w-full sm:w-36 aspect-[2/3] object-cover rounded-xl shrink-0 bg-black border border-white/15"
                  />
                  <div className="flex-1 min-w-0 flex flex-col justify-between gap-2.5 text-left">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="rounded-full bg-amber-950/80 border border-amber-400/50 px-2 py-0.5 text-[10px] font-extrabold text-amber-300">
                          ★ {activeCard.rating}
                        </span>
                        <span className="rounded-full bg-black/80 border border-white/15 px-2 py-0.5 text-[10px] font-bold text-zinc-200">
                          {activeCard.year}
                        </span>
                      </div>
                      <h3 className="text-lg font-black text-white leading-tight line-clamp-2">
                        {activeCard.title}
                      </h3>
                      <p className="text-xs leading-relaxed line-clamp-4 text-zinc-300">
                        {activeCard.overview}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleLaunchMovie(activeCard)}
                      className="rabtv-mn-btn w-full py-2.5 text-xs font-extrabold uppercase tracking-wider text-white cursor-pointer"
                    >
                      <span className="rabtv-mn-btn-art" style={{ backgroundImage: `url(${IMG_MN_BTN_IDLE})` }} />
                      <span className="rabtv-mn-btn-scrim" />
                      <span className="rabtv-mn-btn-label">⚡ Skip Vote &amp; Watch Now</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Dedicated Armored Pass & Keep Controls */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleVote(false)}
                  className={`rabtv-mn-btn w-full ${
                    largeButtons ? "py-3.5 text-sm" : "py-3 text-xs"
                  } font-black uppercase tracking-wider text-white cursor-pointer`}
                >
                  <span className="rabtv-mn-btn-art" style={{ backgroundImage: `url(${IMG_MN_BTN_PASS})` }} />
                  <span className="rabtv-mn-btn-scrim" />
                  <span className="rabtv-mn-btn-label">👎 Pass</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleVote(true)}
                  className={`rabtv-mn-btn w-full ${
                    largeButtons ? "py-3.5 text-sm" : "py-3 text-xs"
                  } font-black uppercase tracking-wider text-white cursor-pointer`}
                >
                  <span className="rabtv-mn-btn-art" style={{ backgroundImage: `url(${IMG_MN_BTN_KEEP})` }} />
                  <span className="rabtv-mn-btn-scrim" />
                  <span className="rabtv-mn-btn-label">👍 Keep</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: COUCH MATCH RESULTS */}
          {isVotingComplete && (
            <div className="space-y-3.5">
              <div className="text-center space-y-1">
                <h3 className="text-lg font-black text-amber-300">
                  {keptList.length > 0
                    ? `🎉 Your Top ${keptList.length} ${
                        keptList.length === 1 ? "Match" : "Matches"
                      }`
                    : "Tough Crowd! Let's Deal 5 Fresh Picks"}
                </h3>
                <p className="text-xs text-zinc-300">
                  {keptList.length > 0
                    ? "Tap Watch to launch straight into the cinema player."
                    : "None of those hit the spot — try another round or mood."}
                </p>
              </div>

              {keptList.length > 0 && (
                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-0.5 scrollbar-none">
                  {keptList.map((movie) => (
                    <div key={movie.id} className="rabtv-mn-card rounded-2xl">
                      <div className="rabtv-mn-card-9slice" aria-hidden="true" />
                      <div className="relative z-10 flex items-center gap-3">
                        <img
                          src={movie.posterUrl}
                          alt={movie.title}
                          className="h-16 w-11 rounded-lg object-cover shrink-0 bg-black border border-white/15"
                        />
                        <div className="min-w-0 flex-1 text-left">
                          <p className="text-xs sm:text-sm font-black text-white truncate">
                            {movie.title}
                          </p>
                          <p className="text-[10.5px] font-bold text-amber-300">
                            ★ {movie.rating} • {movie.year}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenDetails(movie)}
                            className="rabtv-mn-btn px-2.5 py-2 text-[11px] font-bold text-white cursor-pointer"
                            title="View Details"
                          >
                            <span className="rabtv-mn-btn-art" style={{ backgroundImage: `url(${IMG_MN_BTN_IDLE})` }} />
                            <span className="rabtv-mn-btn-scrim" />
                            <span className="rabtv-mn-btn-label">ⓘ</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleLaunchMovie(movie)}
                            className="rabtv-mn-btn px-3.5 py-2 text-[10.5px] font-black uppercase text-white cursor-pointer"
                          >
                            <span className="rabtv-mn-btn-art" style={{ backgroundImage: `url(${IMG_MN_BTN_KEEP})` }} />
                            <span className="rabtv-mn-btn-scrim" />
                            <span className="rabtv-mn-btn-label">▶ Watch</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setSelectedMood(null)}
                  className="rabtv-mn-btn w-full py-2.5 text-xs font-extrabold text-white cursor-pointer"
                >
                  <span className="rabtv-mn-btn-art" style={{ backgroundImage: `url(${IMG_MN_BTN_IDLE})` }} />
                  <span className="rabtv-mn-btn-scrim" />
                  <span className="rabtv-mn-btn-label">← Change Mood</span>
                </button>
                <button
                  type="button"
                  onClick={() => selectedMood && void loadMoodDeck(selectedMood)}
                  className="rabtv-mn-btn w-full py-2.5 text-xs font-extrabold text-white cursor-pointer"
                >
                  <span className="rabtv-mn-btn-art" style={{ backgroundImage: `url(${IMG_MN_BTN_KEEP})` }} />
                  <span className="rabtv-mn-btn-scrim" />
                  <span className="rabtv-mn-btn-label">🔄 Deal 5 New</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

MovieNightMatcher.displayName = "MovieNightMatcher";
export default MovieNightMatcher;