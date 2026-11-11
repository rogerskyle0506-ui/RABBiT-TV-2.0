// src/components/Screensaver.tsx
import { useState, useEffect, useRef, useCallback } from "react";

const TIMEOUT_STORAGE_KEY = "rabtv_screensaver_timeout_ms";
const DEFAULT_TIMEOUT = 2.5 * 60 * 60 * 1000; // 2.5 hours in milliseconds

// Options: 3 hours, 2 hours, 1 hour, 30 mins, 20 mins, 5 mins
export const TIMEOUT_OPTIONS = [
  { label: "3 Hours", value: 3 * 60 * 60 * 1000 },
  { label: "2.5 Hours (Default)", value: 2.5 * 60 * 60 * 1000 },
  { label: "2 Hours", value: 2 * 60 * 60 * 1000 },
  { label: "1 Hour", value: 1 * 60 * 60 * 1000 },
  { label: "30 Minutes", value: 30 * 60 * 1000 },
  { label: "20 Minutes", value: 20 * 60 * 1000 },
  { label: "5 Minutes", value: 5 * 60 * 1000 },
];

const LOGO_URL = "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/rabbit-header-pill.jpg";

export function Screensaver() {
  const [isActive, setIsActive] = useState(false);
  const [timeoutMs, setTimeoutMs] = useState<number>(() => {
    const saved = localStorage.getItem(TIMEOUT_STORAGE_KEY);
    return saved ? Number(saved) : DEFAULT_TIMEOUT;
  });

  const idleTimerRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Position and velocity for the bouncing logo (slow speed to prevent burn-in)
  const posRef = useRef({ x: 100, y: 100 });
  const velRef = useRef({ vx: 0.8, vy: 0.8 });
  const logoRef = useRef<HTMLDivElement>(null);

  // Save timeout setting
  const updateTimeout = (newMs: number) => {
    setTimeoutMs(newMs);
    localStorage.setItem(TIMEOUT_STORAGE_KEY, String(newMs));
  };

  // Check if media is currently playing or fullscreen is active
  const isMediaActive = useCallback(() => {
    // 1. Check if document is in fullscreen mode
    if (document.fullscreenElement) {
      return true;
    }

    // 2. Check all video/audio elements across the DOM
    const mediaElements = document.querySelectorAll("video, audio");
    for (const el of mediaElements) {
      const media = el as HTMLMediaElement;
      if (!media.paused && !media.ended && media.readyState > 2) {
        return true;
      }
    }

    // 3. Check for active iframes (like vidsrc players in details or live tv)
    const iframes = document.querySelectorAll("iframe");
    for (const iframe of iframes) {
      // If an iframe is present and playing in details/live tv view
      const src = iframe.src || "";
      if (src.includes("vidsrc") || src.includes("embed") || src.includes("live")) {
        // If user is actively on details player or live tv with iframe loaded
        if (window.location.pathname.includes("/details") || window.location.pathname.includes("/live")) {
          return true;
        }
      }
    }

    return false;
  }, []);

  // Reset idle timer
  const resetIdleTimer = useCallback(() => {
    if (isActive) return; // If screensaver is already active, don't reset on background events unless dismissed

    if (idleTimerRef.current) {
      window.clearTimeout(idleTimerRef.current);
    }

    idleTimerRef.current = window.setTimeout(() => {
      // Before activating, verify no media or fullscreen is active
      if (!isMediaActive()) {
        setIsActive(true);
      } else {
        // Delay again if media is currently playing
        resetIdleTimer();
      }
    }, timeoutMs);
  }, [isActive, timeoutMs, isMediaActive]);

  // Setup user activity listeners
  useEffect(() => {
    const events = ["mousedown", "mousemove", "keydown", "touchstart", "scroll", "click"];
    const handleActivity = () => {
      if (isActive) {
        setIsActive(false);
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

  // Bouncing animation loop
  useEffect(() => {
    if (!isActive) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const logoWidth = 260;
    const logoHeight = 120;

    // Initialize random starting position within bounds
    posRef.current = {
      x: Math.random() * Math.max(50, window.innerWidth - logoWidth - 50),
      y: Math.random() * Math.max(50, window.innerHeight - logoHeight - 50),
    };

    // Randomize initial direction (slow linear movement)
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.75; // Slow movement to prevent burn-in
    velRef.current = {
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
    };

    const animate = () => {
      if (!logoRef.current) return;

      posRef.current.x += velRef.current.vx;
      posRef.current.y += velRef.current.vy;

      const maxX = window.innerWidth - logoWidth;
      const maxY = window.innerHeight - logoHeight;

      // Bounce off walls
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
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div
      className="fixed inset-0 z-[99999] bg-black overflow-hidden cursor-none select-none"
      onClick={() => setIsActive(false)}
      onKeyDown={() => setIsActive(false)}
    >
      <div
        ref={logoRef}
        className="absolute w-[260px] h-[120px] rounded-2xl overflow-hidden border border-white/10 shadow-[0_0_30px_rgba(192,132,252,0.3)] pointer-events-none"
        style={{ willChange: "transform" }}
      >
        <img
          src={LOGO_URL}
          alt="RABBiT TV Screensaver"
          className="w-full h-full object-cover opacity-90"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end justify-center pb-2">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-violet-400 drop-shadow-md">
            RABBiT TV
          </span>
        </div>
      </div>
    </div>
  );
}
