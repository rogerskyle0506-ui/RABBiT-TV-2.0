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
      className="rabtv-vidsrc-protected fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-md"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Movie Night Matcher"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-3xl border p-4 sm:p-6 space-y-4 scrollbar-none ${
          isLowRam ? "" : "backdrop-blur-2xl"
        } ${tokens.modalShell}`}
      >
        {/* Modal Header */}
        <div
          className={`flex items-center justify-between gap-2 pb-3 border-b ${tokens.dividerBorder}`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={`w-1.5 h-6 rounded-full shrink-0 ${tokens.accentBar}`}
            />
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-white truncate">
                🍿 Movie Night Matcher
              </h2>
              <p className={`text-[11px] truncate ${tokens.subMutedText}`}>
                {selectedMood
                  ? `${selectedMood.icon} ${selectedMood.label} • 5-Card Couch Vote`
                  : "Pick a vibe — vote Pass or Keep in 30 seconds"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`h-8 w-8 shrink-0 rounded-full border text-xs font-bold flex items-center justify-center cursor-pointer focus:outline-none focus:ring-2 ${tokens.btnSecondary} ${tokens.focusRing}`}
            aria-label="Close Movie Night Matcher"
          >
            ✕
          </button>
        </div>

        {/* STEP 1: MOOD PICKER */}
        {!selectedMood && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {availableMoods.map((mood) => (
              <button
                key={mood.id}
                type="button"
                onClick={() => void loadMoodDeck(mood)}
                className={`rounded-2xl border p-3.5 text-left transition-all hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer focus:outline-none focus:ring-2 ${tokens.moodCard} ${tokens.focusRing}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{mood.icon}</span>
                  <span className="text-sm font-black text-white">
                    {mood.label}
                  </span>
                </div>
                <p className={`text-[11px] leading-snug ${tokens.subMutedText}`}>
                  {mood.tagline}
                </p>
              </button>
            ))}
          </div>
        )}

        {/* LOADING STATE */}
        {selectedMood && loading && (
          <div className="py-14 flex flex-col items-center justify-center gap-3">
            <div
              className={`h-9 w-9 rounded-full border-2 border-t-transparent animate-spin ${tokens.accentText}`}
            />
            <span className={`text-xs font-bold ${tokens.mutedText}`}>
              Dealing 5 {selectedMood.label} picks…
            </span>
          </div>
        )}

        {/* ERROR STATE */}
        {selectedMood && !loading && errorMsg && (
          <div
            className={`rounded-2xl border p-6 text-center space-y-3 ${tokens.subPanel}`}
          >
            <p className={`text-xs font-bold ${tokens.accentText}`}>
              ⚠️ {errorMsg}
            </p>
            <button
              type="button"
              onClick={() => setSelectedMood(null)}
              className={`rounded-xl border px-4 py-2 text-xs font-extrabold cursor-pointer ${tokens.btnSecondary}`}
            >
              ← Pick Another Mood
            </button>
          </div>
        )}

        {/* STEP 2: 5-CARD PASS / KEEP COUCH VOTE */}
        {activeCard && !loading && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-[11px] font-extrabold">
              <span className={tokens.subMutedText}>
                Card {currentIndex + 1} of {candidates.length}
              </span>
              <span
                className={`rounded-full border px-2.5 py-0.5 ${tokens.badge}`}
              >
                Kept: {keptList.length}
              </span>
            </div>

            <div
              className={`rounded-2xl border overflow-hidden flex flex-col sm:flex-row gap-3 p-3 ${tokens.subPanel}`}
            >
              <img
                src={activeCard.posterUrl}
                alt={activeCard.title}
                className="w-full sm:w-36 aspect-[2/3] object-cover rounded-xl shrink-0 bg-black"
              />
              <div className="flex-1 min-w-0 flex flex-col justify-between gap-2 text-left">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${tokens.badge}`}
                    >
                      ★ {activeCard.rating}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${tokens.subtleBadge}`}
                    >
                      {activeCard.year}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-white leading-tight line-clamp-2">
                    {activeCard.title}
                  </h3>
                  <p
                    className={`text-xs leading-relaxed line-clamp-4 ${tokens.mutedText}`}
                  >
                    {activeCard.overview}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleLaunchMovie(activeCard)}
                  className={`w-full rounded-xl py-2 text-xs font-extrabold uppercase tracking-wider transition cursor-pointer ${tokens.btnSecondary} border`}
                >
                  ⚡ Skip Vote & Watch Now
                </button>
              </div>
            </div>

            {/* Pass / Keep Controls */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleVote(false)}
                className={`rounded-2xl border ${
                  largeButtons ? "py-3.5 text-sm" : "py-3 text-xs"
                } font-black uppercase tracking-wider transition active:scale-95 cursor-pointer focus:outline-none focus:ring-2 ${tokens.btnSecondary} ${tokens.focusRing}`}
              >
                👎 Pass
              </button>
              <button
                type="button"
                onClick={() => handleVote(true)}
                className={`rounded-2xl ${
                  largeButtons ? "py-3.5 text-sm" : "py-3 text-xs"
                } font-black uppercase tracking-wider transition active:scale-95 cursor-pointer focus:outline-none focus:ring-2 ${tokens.btnPrimary} ${tokens.focusRing}`}
              >
                👍 Keep
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: COUCH MATCH RESULTS */}
        {isVotingComplete && (
          <div className="space-y-4">
            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-white">
                {keptList.length > 0
                  ? `🎉 Your Top ${keptList.length} ${
                      keptList.length === 1 ? "Match" : "Matches"
                    }`
                  : "Tough Crowd! Let's Deal 5 Fresh Picks"}
              </h3>
              <p className={`text-xs ${tokens.subMutedText}`}>
                {keptList.length > 0
                  ? "Tap Watch Now to launch straight into the cinema player."
                  : "None of those hit the spot — try another round or mood."}
              </p>
            </div>

            {keptList.length > 0 && (
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-0.5 scrollbar-none">
                {keptList.map((movie) => (
                  <div
                    key={movie.id}
                    className={`flex items-center gap-3 rounded-2xl border p-2.5 ${tokens.subPanel}`}
                  >
                    <img
                      src={movie.posterUrl}
                      alt={movie.title}
                      className="h-16 w-11 rounded-lg object-cover shrink-0 bg-black"
                    />
                    <div className="min-w-0 flex-1 text-left">
                      <p className="text-xs sm:text-sm font-black text-white truncate">
                        {movie.title}
                      </p>
                      <p className={`text-[10px] font-bold ${tokens.subMutedText}`}>
                        ★ {movie.rating} • {movie.year}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenDetails(movie)}
                        className={`rounded-xl border px-2.5 py-2 text-[10px] font-bold cursor-pointer ${tokens.btnSecondary}`}
                        title="View Details"
                      >
                        ⓘ
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLaunchMovie(movie)}
                        className={`rounded-xl px-3 py-2 text-[10px] font-black uppercase cursor-pointer ${tokens.btnPrimary}`}
                      >
                        ▶ Watch
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setSelectedMood(null)}
                className={`rounded-xl border py-2.5 text-xs font-bold cursor-pointer ${tokens.btnSecondary}`}
              >
                ← Change Mood
              </button>
              <button
                type="button"
                onClick={() => selectedMood && void loadMoodDeck(selectedMood)}
                className={`rounded-xl py-2.5 text-xs font-extrabold cursor-pointer ${tokens.btnPrimary}`}
              >
                🔄 Deal 5 New
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

MovieNightMatcher.displayName = "MovieNightMatcher";
export default MovieNightMatcher;