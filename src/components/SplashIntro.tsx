// src/components/SplashIntro.tsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import type { AppTheme } from "@/lib/settings";

// 1x1 transparent GIF prevents Android WebView from flashing a giant default play icon
const TRANSPARENT_POSTER =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

// Priority order:
// 1. Local bundled asset (instant + works offline when placed in public/assets/)
// 2. Direct GitHub raw CDN (no redirect, fast in Android WebView)
// 3. Exact GitHub raw/refs URL fallback
const SPLASH_VIDEO_SOURCES = [
  "/assets/gemini_generated_video_0470f1fe.mp4",
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/gemini_generated_video_0470f1fe.mp4",
  "https://github.com/rogerskyle0506-ui/RABBiT-TV-2.0/raw/refs/heads/main/assets/gemini_generated_video_0470f1fe.mp4",
];

export interface SplashIntroProps {
  appTheme?: AppTheme;
  onFinish: () => void;
}

const themeAccentMap: Record<
  AppTheme,
  { border: string; text: string; bg: string; glow: string }
> = {
  red: {
    border: "border-red-500/45 hover:border-red-400",
    text: "text-red-100 hover:text-white",
    bg: "bg-red-950/75 hover:bg-red-900/90",
    glow: "rgba(239, 68, 68, 0.16)",
  },
  midnight: {
    border: "border-blue-500/45 hover:border-sky-400",
    text: "text-sky-100 hover:text-white",
    bg: "bg-blue-950/75 hover:bg-blue-900/90",
    glow: "rgba(59, 130, 246, 0.16)",
  },
  emerald: {
    border: "border-emerald-500/45 hover:border-emerald-400",
    text: "text-emerald-100 hover:text-white",
    bg: "bg-emerald-950/75 hover:bg-emerald-900/90",
    glow: "rgba(16, 185, 129, 0.16)",
  },
  amber: {
    border: "border-amber-500/45 hover:border-amber-400",
    text: "text-amber-100 hover:text-white",
    bg: "bg-amber-950/75 hover:bg-amber-900/90",
    glow: "rgba(245, 158, 11, 0.16)",
  },
  cyan: {
    border: "border-cyan-500/45 hover:border-cyan-400",
    text: "text-cyan-100 hover:text-white",
    bg: "bg-cyan-950/75 hover:bg-cyan-900/90",
    glow: "rgba(6, 182, 212, 0.16)",
  },
  violet: {
    border: "border-violet-500/45 hover:border-violet-400",
    text: "text-violet-100 hover:text-white",
    bg: "bg-purple-950/75 hover:bg-purple-900/90",
    glow: "rgba(139, 92, 246, 0.16)",
  },
};

export const SplashIntro: React.FC<SplashIntroProps> = ({
  appTheme = "violet",
  onFinish,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const finishedRef = useRef(false);

  const [sourceIndex, setSourceIndex] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMutedFallback, setIsMutedFallback] = useState(false);

  const theme = themeAccentMap[appTheme] || themeAccentMap.violet;

  const completeSplash = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setIsFadingOut(true);
    window.setTimeout(() => {
      onFinish();
    }, 420);
  }, [onFinish]);

  // Dismiss native Capacitor SplashScreen immediately if present so our video takes over
  useEffect(() => {
    if (typeof window === "undefined") return;
    const capPlugins = (window as any).Capacitor?.Plugins;
    if (capPlugins?.SplashScreen?.hide) {
      try {
        void capPlugins.SplashScreen.hide();
      } catch {
        // ignore if plugin is not configured
      }
    }
  }, []);

  // Attempt playback whenever active source changes (try with sound first, fallback to muted)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || finishedRef.current) return;

    let cancelled = false;
    video.muted = false;
    video.volume = 1;

    const tryPlay = async () => {
      try {
        await video.play();
        if (!cancelled) {
          setIsMutedFallback(false);
          setIsPlaying(true);
        }
      } catch {
        // Browser / Android WebView blocked unmuted autoplay — retry muted so intro always plays
        if (cancelled || finishedRef.current) return;
        try {
          video.muted = true;
          setIsMutedFallback(true);
          await video.play();
          if (!cancelled) {
            setIsPlaying(true);
          }
        } catch {
          // If playback still fails on this source, try next fallback source
          if (!cancelled) {
            setSourceIndex((prev) => {
              if (prev < SPLASH_VIDEO_SOURCES.length - 1) return prev + 1;
              completeSplash();
              return prev;
            });
          }
        }
      }
    };

    void tryPlay();
    return () => {
      cancelled = true;
    };
  }, [sourceIndex, completeSplash]);

  // Safety timeout: never trap the user on a black screen if offline and video isn't bundled locally
  useEffect(() => {
    if (isPlaying) return;
    const stallTimer = window.setTimeout(() => {
      if (!finishedRef.current && !isPlaying) {
        completeSplash();
      }
    }, 5500);
    return () => window.clearTimeout(stallTimer);
  }, [isPlaying, completeSplash]);

  // Hard max duration guard (10s video + small buffer) in case an older TV WebView misses onEnded
  useEffect(() => {
    const maxTimer = window.setTimeout(() => {
      completeSplash();
    }, 13500);
    return () => window.clearTimeout(maxTimer);
  }, [completeSplash]);

  // TV Remote / Keyboard skip support (Escape, Backspace, Enter, Space)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "Escape" ||
        e.key === "Backspace" ||
        e.key === "Enter" ||
        e.key === " "
      ) {
        e.preventDefault();
        completeSplash();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [completeSplash]);

  const handleVideoError = () => {
    setSourceIndex((prev) => {
      if (prev < SPLASH_VIDEO_SOURCES.length - 1) {
        return prev + 1;
      }
      completeSplash();
      return prev;
    });
  };

  const handleUnmute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    video.volume = 1;
    setIsMutedFallback(false);
    void video.play().catch(() => {});
  };

  return (
    <div
      className={`rabtv-vidsrc-protected rabtv-splash-root fixed inset-0 z-[100000] bg-black overflow-hidden select-none transition-opacity duration-[420ms] ${
        isFadingOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      role="presentation"
      aria-label="RABBiT TV Intro Animation"
    >
      <style>{`
        .rabtv-splash-root {
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100vh;
          height: 100dvh;
          min-height: 100dvh;
          margin: 0;
          padding: 0;
        }
        .rabtv-splash-video {
          position: absolute;
          inset: 0;
          width: 100% !important;
          height: 100% !important;
          min-width: 100%;
          min-height: 100%;
          object-fit: cover;
          object-position: center center;
          display: block;
        }
        .rabtv-splash-video::-webkit-media-controls,
        .rabtv-splash-video::-webkit-media-controls-start-playback-button {
          display: none !important;
          -webkit-appearance: none !important;
        }
      `}</style>

      {/* Subtle theme-matched ambient backdrop while video buffer initializes */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(circle at center, ${theme.glow} 0%, rgba(0, 0, 0, 0.96) 72%)`,
        }}
      />

      {/* Full-Viewport 100% Width x 100% Height Edge-to-Edge Intro Video (No 16:9 Letterboxing) */}
      <video
        ref={videoRef}
        key={SPLASH_VIDEO_SOURCES[sourceIndex]}
        src={SPLASH_VIDEO_SOURCES[sourceIndex]}
        poster={TRANSPARENT_POSTER}
        autoPlay
        playsInline
        preload="auto"
        controls={false}
        onPlaying={() => setIsPlaying(true)}
        onEnded={completeSplash}
        onError={handleVideoError}
        className="rabtv-splash-video z-10 bg-black"
      />

      {/* Bottom Controls Overlay: Optional Tap-for-Sound (only if WebView muted it) */}
      <div className="absolute bottom-6 sm:bottom-8 inset-x-4 sm:inset-x-6 z-20 flex items-center justify-between gap-3 pointer-events-none">
        <div>
          {isMutedFallback && isPlaying && (
            <button
              type="button"
              onClick={handleUnmute}
              className={`pointer-events-auto inline-flex items-center gap-1.5 rounded-full border backdrop-blur-md px-3.5 py-2 text-xs font-extrabold shadow-xl transition active:scale-95 cursor-pointer ${theme.bg} ${theme.border} ${theme.text}`}
            >
              <span>🔇 Tap for Sound</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SplashIntro;