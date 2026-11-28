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
} from "@/lib/settings";

// Re-export options so sidebar.tsx and other components stay 100% compatible
export const TIMEOUT_OPTIONS = SCREENSAVER_TIMEOUT_OPTIONS;

const IMG_SCREENSAVER_CARD =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-screensaver-card.jpg";
const IMG_SCREENSAVER_SLEEP =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-screensaver-sleep.jpg";

const SCREENSAVER_STYLES = `
  :root, html[data-theme="violet"] {
    --rabtv-ss-filter: hue-rotate(-78deg) saturate(1.12) brightness(1.02);
    --rabtv-ss-eq-a: #a855f7;
    --rabtv-ss-eq-b: #22d3ee;
  }
  html[data-theme="red"] {
    --rabtv-ss-filter: hue-rotate(0deg) saturate(1.08) brightness(1.0);
    --rabtv-ss-eq-a: #ef4444;
    --rabtv-ss-eq-b: #22d3ee;
  }
  html[data-theme="midnight"] {
    --rabtv-ss-filter: hue-rotate(-132deg) saturate(1.14) brightness(1.04);
    --rabtv-ss-eq-a: #38bdf8;
    --rabtv-ss-eq-b: #818cf8;
  }
  html[data-theme="emerald"] {
    --rabtv-ss-filter: hue-rotate(154deg) saturate(1.10) brightness(1.02);
    --rabtv-ss-eq-a: #10b981;
    --rabtv-ss-eq-b: #22d3ee;
  }
  html[data-theme="amber"] {
    --rabtv-ss-filter: hue-rotate(28deg) saturate(1.14) brightness(1.04);
    --rabtv-ss-eq-a: #f59e0b;
    --rabtv-ss-eq-b: #fde047;
  }
  html[data-theme="cyan"] {
    --rabtv-ss-filter: hue-rotate(-154deg) saturate(1.12) brightness(1.04);
    --rabtv-ss-eq-a: #22d3ee;
    --rabtv-ss-eq-b: #38bdf8;
  }

  @keyframes rabtvEqPulseA {
    0%, 100% { transform: scaleY(0.18); }
    25% { transform: scaleY(0.92); }
    52% { transform: scaleY(0.36); }
    78% { transform: scaleY(0.78); }
  }
  @keyframes rabtvEqPulseB {
    0%, 100% { transform: scaleY(0.68); }
    30% { transform: scaleY(0.22); }
    58% { transform: scaleY(0.96); }
    82% { transform: scaleY(0.34); }
  }
  @keyframes rabtvEqPulseC {
    0%, 100% { transform: scaleY(0.32); }
    20% { transform: scaleY(0.84); }
    48% { transform: scaleY(0.16); }
    74% { transform: scaleY(0.95); }
  }
  .rabtv-ss-eq-bar {
    flex: 1;
    height: 100%;
    border-radius: 2px 2px 1px 1px;
    transform-origin: bottom center;
    background: linear-gradient(180deg, var(--rabtv-ss-eq-b) 0%, var(--rabtv-ss-eq-a) 100%);
    box-shadow: 0 0 8px var(--rabtv-ss-eq-a);
    will-change: transform;
  }
`;

const EQ_BAR_PROFILES = [
  { anim: "rabtvEqPulseA", dur: "0.72s", delay: "-0.10s" },
  { anim: "rabtvEqPulseB", dur: "0.58s", delay: "-0.35s" },
  { anim: "rabtvEqPulseC", dur: "0.64s", delay: "-0.18s" },
  { anim: "rabtvEqPulseA", dur: "0.54s", delay: "-0.42s" },
  { anim: "rabtvEqPulseB", dur: "0.68s", delay: "-0.22s" },
  { anim: "rabtvEqPulseC", dur: "0.52s", delay: "-0.08s" },
  { anim: "rabtvEqPulseA", dur: "0.62s", delay: "-0.31s" },
  { anim: "rabtvEqPulseB", dur: "0.56s", delay: "-0.49s" },
  { anim: "rabtvEqPulseC", dur: "0.70s", delay: "-0.15s" },
  { anim: "rabtvEqPulseA", dur: "0.55s", delay: "-0.27s" },
  { anim: "rabtvEqPulseB", dur: "0.66s", delay: "-0.40s" },
  { anim: "rabtvEqPulseC", dur: "0.60s", delay: "-0.12s" },
  { anim: "rabtvEqPulseA", dur: "0.58s", delay: "-0.33s" },
  { anim: "rabtvEqPulseB", dur: "0.74s", delay: "-0.19s" },
];

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
  const [reducedMotion, setReducedMotion] = useState<boolean>(() =>
    getReducedMotion()
  );
  const [clockText, setClockText] = useState<string>(() =>
    formatAppTime(new Date(), getClockFormat())
  );
  const [currentStationName, setCurrentStationName] = useState<string>("");

  const idleTimerRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Position & velocity for burn-in-safe floating emblem
  const posRef = useRef({ x: 40, y: 60 });
  const velRef = useRef({ vx: 0.6, vy: 0.6 });
  const logoRef = useRef<HTMLDivElement>(null);

  const readLiveStation = useCallback((): string => {
    try {
      const station = bgAudio.getCurrentStation();
      const musicState = localStorage.getItem("rabtv_bg_music_state");
      const isBgPlaying = musicState !== "muted" && musicState !== "paused";
      if (isBgPlaying && station && station.name) {
        return station.name;
      }
    } catch {
      // ignore
    }
    return "";
  }, []);

  useEffect(() => {
    const syncSettings = () => {
      setTimeoutMs(getSavedScreensaverTimeout());
      setAppTheme(getSavedTheme());
      setReducedMotion(getReducedMotion());
      setLowPowerMode(
        getReducedMotion() || getHardwareLimits().effectiveMode === "low"
      );
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

  // Keep clock & station readout live while screensaver is visible
  useEffect(() => {
    if (!isActive) return;
    setClockText(formatAppTime(new Date(), getClockFormat()));
    if (!sleepReason) {
      setCurrentStationName(readLiveStation());
    }
    const clockInterval = window.setInterval(() => {
      setClockText(formatAppTime(new Date(), getClockFormat()));
      if (!sleepReason) {
        setCurrentStationName(readLiveStation());
      }
    }, 10000);
    return () => window.clearInterval(clockInterval);
  }, [isActive, sleepReason, readLiveStation]);

  const updateTimeout = (newMs: number) => {
    setTimeoutMs(newMs);
    saveScreensaverTimeout(newMs);
  };
  void updateTimeout;

  // Never interrupt active video playback or fullscreen
  const isMediaActive = useCallback(() => {
    if (typeof window === "undefined") return false;
    if (document.fullscreenElement) return true;

    const mediaElements = document.querySelectorAll("video, audio");
    for (const el of mediaElements) {
      const media = el as HTMLMediaElement;
      if (!media.paused && !media.ended && media.readyState > 2) {
        if (media.dataset && media.dataset.bgAudio === "true") continue;
        return true;
      }
    }

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

  const resetIdleTimer = useCallback(() => {
    if (typeof window === "undefined" || isActive) return;
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);

    idleTimerRef.current = window.setTimeout(() => {
      if (!isMediaActive()) {
        setCurrentStationName(readLiveStation());
        setSleepReason(null);
        setClockText(formatAppTime(new Date(), getClockFormat()));
        setIsActive(true);
      } else {
        resetIdleTimer();
      }
    }, timeoutMs);
  }, [isActive, timeoutMs, isMediaActive, readLiveStation]);

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

  // Burn-in-safe movement loop (Low-RAM/Reduced Motion uses 8s step jumps; High-RAM glides)
  useEffect(() => {
    if (!isActive || typeof window === "undefined") {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const measureCard = () => {
      const w = logoRef.current?.offsetWidth || Math.min(480, window.innerWidth * 0.88);
      const h = logoRef.current?.offsetHeight || Math.round((w * 9) / 16) + 24;
      return { w, h };
    };

    const placeRandomly = () => {
      const { w, h } = measureCard();
      const maxX = Math.max(12, window.innerWidth - w - 12);
      const maxY = Math.max(12, window.innerHeight - h - 12);
      posRef.current = {
        x: Math.round(12 + Math.random() * Math.max(0, maxX - 12)),
        y: Math.round(12 + Math.random() * Math.max(0, maxY - 12)),
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
    const speed = 0.55;
    velRef.current = {
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
    };

    const animate = () => {
      if (!logoRef.current) return;
      const { w, h } = measureCard();

      posRef.current.x += velRef.current.vx;
      posRef.current.y += velRef.current.vy;

      const maxX = Math.max(8, window.innerWidth - w - 8);
      const maxY = Math.max(8, window.innerHeight - h - 8);

      if (posRef.current.x <= 8) {
        posRef.current.x = 8;
        velRef.current.vx = Math.abs(velRef.current.vx);
      } else if (posRef.current.x >= maxX) {
        posRef.current.x = maxX;
        velRef.current.vx = -Math.abs(velRef.current.vx);
      }

      if (posRef.current.y <= 8) {
        posRef.current.y = 8;
        velRef.current.vy = Math.abs(velRef.current.vy);
      } else if (posRef.current.y >= maxY) {
        posRef.current.y = maxY;
        velRef.current.vy = -Math.abs(velRef.current.vy);
      }

      logoRef.current.style.transform = `translate3d(${posRef.current.x}px, ${posRef.current.y}px, 0)`;
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isActive, lowPowerMode]);

  const accentText = useMemo(() => {
    switch (appTheme) {
      case "red":
        return "text-red-300";
      case "midnight":
        return "text-sky-300";
      case "emerald":
        return "text-emerald-300";
      case "amber":
        return "text-amber-300";
      case "cyan":
        return "text-cyan-300";
      case "violet":
      default:
        return "text-violet-300";
    }
  }, [appTheme]);

  if (!isActive) return null;

  const isRadioActive = Boolean(currentStationName && !sleepReason);
  const dateLabel = new Date().toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

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
      <style>{SCREENSAVER_STYLES}</style>

      {/* Non-Interactive Floating 16:9 Armored Card */}
      <div
        ref={logoRef}
        className="absolute pointer-events-none flex flex-col items-center"
        style={{
          width: "min(480px, 88vw)",
          willChange: "transform",
        }}
      >
        <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black shadow-[0_0_40px_rgba(0,0,0,0.95)]">
          {/* Card Artwork: 3-Bay Radio/Clock Card OR Sleep-Mode Snoozing Rabbit Card */}
          <img
            src={sleepReason ? IMG_SCREENSAVER_SLEEP : IMG_SCREENSAVER_CARD}
            alt="RABBiT TV Screensaver"
            className="absolute inset-0 w-full h-full object-fill select-none"
          />

          {sleepReason ? (
            /* SLEEP TIMER LAYOUT (Right 60% Dark Bay) */
            <div
              className="absolute flex flex-col items-center justify-center text-center px-3 gap-1.5"
              style={{
                left: "43%",
                right: "8%",
                top: "16%",
                bottom: "16%",
              }}
            >
              <span className="font-mono text-2xl sm:text-4xl font-black tracking-wider text-amber-200 drop-shadow-[0_2px_10px_rgba(245,158,11,0.5)]">
                {clockText}
              </span>
              <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-[0.2em] text-amber-300/90">
                🌙 {sleepReason}
              </span>
              <span className="text-[9px] sm:text-[10px] font-bold text-slate-400">
                {dateLabel} • RABBiT TV
              </span>
            </div>
          ) : (
            /* 3-BAY RADIO / CLOCK / EQUALIZER OVERLAY (Pixel-Aligned to rabbit-tv-screensaver-card.jpg) */
            <>
              {/* BAY 1 (TOP): Digital Clock Readout */}
              <div
                className="absolute flex flex-col items-center justify-center px-2 overflow-hidden"
                style={{
                  left: "51.5%",
                  right: "10.5%",
                  top: "18%",
                  height: "22%",
                }}
              >
                <span className="font-mono text-xl sm:text-3xl font-black tracking-wider text-white leading-none drop-shadow-[0_0_12px_rgba(34,211,238,0.55)]">
                  {clockText}
                </span>
                <span className="text-[8px] sm:text-[9.5px] font-extrabold uppercase tracking-[0.22em] text-zinc-400 mt-0.5 truncate max-w-full">
                  {dateLabel} • RABBiT TV
                </span>
              </div>

              {/* BAY 2 (MIDDLE): Live Playing Radio Station Ticker */}
              <div
                className="absolute flex items-center justify-center px-2.5 overflow-hidden"
                style={{
                  left: "51.5%",
                  right: "10.5%",
                  top: "44.5%",
                  height: "10.5%",
                }}
              >
                <span
                  className={`text-[9px] sm:text-[11px] font-black uppercase tracking-wider truncate ${
                    isRadioActive ? accentText : "text-zinc-500"
                  }`}
                >
                  {isRadioActive
                    ? `🎵 ${currentStationName}`
                    : "LOBBY RADIO STANDBY"}
                </span>
              </div>

              {/* BAY 3 (BOTTOM): Live Beat-Reactive Sound Equalizer Bars */}
              <div
                className="absolute flex items-end justify-between gap-[3px] px-2.5 py-2 overflow-hidden"
                style={{
                  left: "51.5%",
                  right: "10.5%",
                  top: "59.5%",
                  height: "24%",
                }}
              >
                {EQ_BAR_PROFILES.map((bar, idx) => (
                  <span
                    key={idx}
                    className="rabtv-ss-eq-bar"
                    style={
                      isRadioActive && !reducedMotion
                        ? {
                            animation: `${bar.anim} ${bar.dur} ease-in-out ${bar.delay} infinite`,
                            opacity: 0.94,
                          }
                        : {
                            transform: isRadioActive
                              ? `scaleY(${0.28 + ((idx * 17) % 55) / 100})`
                              : "scaleY(0.1)",
                            opacity: isRadioActive ? 0.72 : 0.25,
                          }
                    }
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <span className="mt-1.5 text-[9px] font-bold uppercase tracking-widest text-zinc-600">
          Tap or press any key to wake
        </span>
      </div>
    </div>
  );
}