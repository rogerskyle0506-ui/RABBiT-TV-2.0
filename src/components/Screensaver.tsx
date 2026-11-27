// src/components/Screensaver.tsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { bgAudio } from "@/lib/background-audio";
import {
  AppTheme,
  SCREENSAVER_TIMEOUT_OPTIONS,
  getSavedTheme,
  getSavedScreensaverTimeout,
  saveScreensaverTimeout,
  getClockFormat,
  formatAppTime,
  getReducedMotion,
  getHardwareLimits,
  getProfileMascot,
} from "@/lib/settings";

// Re-export options so sidebar.tsx and other components stay 100% compatible
export const TIMEOUT_OPTIONS = SCREENSAVER_TIMEOUT_OPTIONS;

const LOGO_URL =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-screensaver-card.jpg";

export function Screensaver() {
  const [isActive, setIsActive] = useState(false);
  const [sleepReason, setSleepReason] = useState<string | null>(null);
  const [timeoutMs, setTimeoutMs] = useState<number>(() =>
    getSavedScreensaverTimeout()
  );
  const [appTheme, setAppTheme] = useState<AppTheme>(() => getSavedTheme());
  const [lowPowerMode, setLowPowerMode] = useState<boolean>(
    () => getReducedMotion() || getHardwareLimits().effectiveMode === "low"
  );
  const [mascot, setMascot] = useState<string>(() => getProfileMascot());
  const [clockText, setClockText] = useState<string>(() =>
    formatAppTime(new Date(), getClockFormat())
  );
  const [currentStationName, setCurrentStationName] = useState<string>("");

  const idleTimerRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Position and velocity for the bouncing logo (slow speed to prevent burn-in)
  const posRef = useRef({ x: 80, y: 80 });
  const velRef = useRef({ vx: 0.7, vy: 0.7 });
  const logoRef = useRef<HTMLDivElement>(null);

  // Sync live settings whenever user updates Sidebar preferences
  useEffect(() => {
    const syncSettings = () => {
      const nextTimeout = getSavedScreensaverTimeout();
      setTimeoutMs(nextTimeout);
      setAppTheme(getSavedTheme());
      setLowPowerMode(
        getReducedMotion() || getHardwareLimits().effectiveMode === "low"
      );
      setMascot(getProfileMascot());
      setClockText(formatAppTime(new Date(), getClockFormat()));
    };

    syncSettings();
    window.addEventListener("rabtv_settings_updated", syncSettings);
    window.addEventListener("rabtv_ram_mode_updated", syncSettings);
    window.addEventListener("storage", syncSettings);

    return () => {
      window.removeEventListener("rabtv_settings_updated", syncSettings);
      window.removeEventListener("rabtv_ram_mode_updated", syncSettings);
      window.removeEventListener("storage", syncSettings);
    };
  }, []);

  // Listen for Couch Sleep Timer trigger from __root.tsx
  useEffect(() => {
    const handleSleepTrigger = () => {
      setSleepReason("Sleep Timer Activated");
      setCurrentStationName("");
      setClockText(formatAppTime(new Date(), getClockFormat()));
      setIsActive(true);
    };

    window.addEventListener("rabtv_sleep_timer_triggered", handleSleepTrigger);
    return () =>
      window.removeEventListener(
        "rabtv_sleep_timer_triggered",
        handleSleepTrigger
      );
  }, []);

  // Keep clock updated while screensaver is active
  useEffect(() => {
    if (!isActive) return;
    setClockText(formatAppTime(new Date(), getClockFormat()));
    const clockInterval = window.setInterval(() => {
      setClockText(formatAppTime(new Date(), getClockFormat()));
    }, 15000);
    return () => window.clearInterval(clockInterval);
  }, [isActive]);

  // Helper kept for backwards compatibility if ever called internally
  const updateTimeout = (newMs: number) => {
    setTimeoutMs(newMs);
    saveScreensaverTimeout(newMs);
  };
  void updateTimeout;

  // Check if media is currently playing or fullscreen is active
  const isMediaActive = useCallback(() => {
    if (typeof window === "undefined") return false;

    // 1. Check if document is in fullscreen mode
    if (document.fullscreenElement) {
      return true;
    }

    // 2. Check all video/audio elements across the DOM (skip background lobby radio)
    const mediaElements = document.querySelectorAll("video, audio");
    for (const el of mediaElements) {
      const media = el as HTMLMediaElement;
      if (!media.paused && !media.ended && media.readyState > 2) {
        if (media.dataset && media.dataset.bgAudio === "true") {
          continue;
        }
        return true;
      }
    }

    // 3. Check for active iframes (vidsrc players in details, live tv, or watch pages)
    const path = window.location.pathname || "";
    if (
      path.includes("/details") ||
      path.includes("/live") ||
      path.includes("/watch") ||
      path.includes("/player")
    ) {
      const iframes = document.querySelectorAll("iframe");
      for (const iframe of iframes) {
        const src = iframe.src || "";
        if (
          src.includes("vidsrc") ||
          src.includes("embed") ||
          src.includes("live") ||
          src.includes("player")
        ) {
          return true;
        }
      }
    }

    return false;
  }, []);

  // Reset idle timer
  const resetIdleTimer = useCallback(() => {
    if (typeof window === "undefined" || isActive) return;

    if (idleTimerRef.current) {
      window.clearTimeout(idleTimerRef.current);
    }

    idleTimerRef.current = window.setTimeout(() => {
      if (!isMediaActive()) {
        try {
          const station = bgAudio.getCurrentStation();
          const isBgPlaying = localStorage.getItem("rabtv_bg_music_state") !== "muted";
          if (isBgPlaying && station && station.name) {
            setCurrentStationName(station.name);
          } else {
            setCurrentStationName("");
          }
        } catch {
          setCurrentStationName("");
        }

        setSleepReason(null);
        setClockText(formatAppTime(new Date(), getClockFormat()));
        setIsActive(true);
      } else {
        resetIdleTimer();
      }
    }, timeoutMs);
  }, [isActive, timeoutMs, isMediaActive]);

  // Setup user activity listeners
  useEffect(() => {
    if (typeof window === "undefined") return;

    const events = [
      "mousedown",
      "mousemove",
      "keydown",
      "touchstart",
      "scroll",
      "click",
    ];
    const handleActivity = () => {
      if (isActive) {
        setIsActive(false);
        setSleepReason(null);
      }
      resetIdleTimer();
    };

    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    resetIdleTimer();

    return () => {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [isActive, resetIdleTimer]);

  // Movement Loop: Low-RAM / Reduced Motion uses zero-GPU 8s step jumps; High-RAM floats smoothly
  useEffect(() => {
    if (!isActive || typeof window === "undefined") {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const logoWidth = 100%;
    const logoHeight = 100%;

    const placeRandomly = () => {
      const maxX = Math.max(20, window.innerWidth - logoWidth - 50);
      const maxY = Math.max(20, window.innerHeight - logoHeight - 50);
      posRef.current = {
        x: Math.round(Math.random() * maxX),
        y: Math.round(Math.random() * maxY),
      };
      if (logoRef.current) {
        logoRef.current.style.transform = `translate3d(${posRef.current.x}px, ${posRef.current.y}px, 0)`;
      }
    };

    placeRandomly();

    if (lowPowerMode) {
      const jumpInterval = window.setInterval(placeRandomly, 8000);
      return () => window.clearInterval(jumpInterval);
    }

    const angle = Math.random() * Math.PI * 2;
    const speed = 0.65; // Slow linear movement to prevent OLED/projector burn-in
    velRef.current = {
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
    };

    const animate = () => {
      if (!logoRef.current) return;

      posRef.current.x += velRef.current.vx;
      posRef.current.y += velRef.current.vy;

      const maxX = Math.max(0, window.innerWidth - logoWidth);
      const maxY = Math.max(0, window.innerHeight - logoHeight);

      if (posRef.current.x <= 0) {
        posRef.current.x = 0;
        velRef.current.vx *= -1;
      } else if (posRef.current.x >= maxX) {
        posRef.current.x = maxX;
        velRef.current.vx *= -1;
      }

      if (posRef.current.y <= 0) {
        posRef.current.y = 0;
        velRef.current.vy *= -1;
      } else if (posRef.current.y >= maxY) {
        posRef.current.y = maxY;
        velRef.current.vy *= -1;
      }

      logoRef.current.style.transform = `translate3d(${posRef.current.x}px, ${posRef.current.y}px, 0)`;
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isActive, lowPowerMode]);

  const themeAccent = useMemo(() => {
    switch (appTheme) {
      case "red":
        return {
          border: "border-red-500/40",
          glow: "shadow-[0_0_35px_rgba(239,68,68,0.4)]",
          text: "text-red-300",
        };
      case "midnight":
        return {
          border: "border-sky-500/40",
          glow: "shadow-[0_0_35px_rgba(56,189,248,0.4)]",
          text: "text-sky-300",
        };
      case "emerald":
        return {
          border: "border-emerald-500/40",
          glow: "shadow-[0_0_35px_rgba(16,185,129,0.4)]",
          text: "text-emerald-300",
        };
      case "amber":
        return {
          border: "border-amber-500/40",
          glow: "shadow-[0_0_35px_rgba(245,158,11,0.4)]",
          text: "text-amber-300",
        };
      case "cyan":
        return {
          border: "border-cyan-500/40",
          glow: "shadow-[0_0_35px_rgba(34,211,238,0.4)]",
          text: "text-cyan-300",
        };
      case "violet":
      default:
        return {
          border: "border-violet-500/40",
          glow: "shadow-[0_0_35px_rgba(168,85,247,0.4)]",
          text: "text-violet-300",
        };
    }
  }, [appTheme]);

  if (!isActive) return null;

  return (
    <div
      className="rabtv-vidsrc-protected fixed inset-0 z-[99999] bg-black overflow-hidden cursor-none select-none"
      onClick={() => {
        setIsActive(false);
        setSleepReason(null);
      }}
      onKeyDown={() => {
        setIsActive(false);
        setSleepReason(null);
      }}
    >
      <div
        ref={logoRef}
        className="absolute flex flex-col items-center w-[290px] pointer-events-none"
        style={{ willChange: "transform" }}
      >
        <div
          className={`w-full h-[126px] rounded-2xl overflow-hidden border ${themeAccent.border} ${themeAccent.glow} relative bg-slate-950`}
        >
          <img
            src={LOGO_URL}
            alt="RABBiT TV Screensaver"
            className="w-full h-full object-cover opacity-85"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent flex flex-col items-center justify-end pb-2.5 px-3">
            <span className="text-xl font-black tracking-wider text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
              {clockText}
            </span>
            <span
              className={`text-[10px] font-extrabold uppercase tracking-[0.25em] ${themeAccent.text} drop-shadow-md`}
            >
              {mascot} RABBiT TV
            </span>
          </div>
        </div>

        {/* Sleep Timer Notice or Current Radio Station Playing Sub-Label */}
        {sleepReason ? (
          <div className="mt-2 px-3 py-1 rounded-xl bg-black/85 border border-amber-400/40 shadow-lg text-center max-w-full">
            <span className="text-[10px] font-extrabold text-amber-300 block">
              🌙 {sleepReason} • Tap or press any key to wake
            </span>
          </div>
        ) : currentStationName ? (
          <div
            className={`mt-2 px-3 py-1 rounded-xl bg-black/85 border ${themeAccent.border} shadow-lg text-center max-w-full`}
          >
            <span
              className={`text-[10px] font-bold ${themeAccent.text} truncate block drop-shadow`}
            >
              🎵 Playing: {currentStationName}
            </span>
          </div>
        ) : (
          <span className="mt-2 text-[9px] font-bold uppercase tracking-widest text-slate-500">
            Tap or press any key to wake
          </span>
        )}
      </div>
    </div>
  );
}
