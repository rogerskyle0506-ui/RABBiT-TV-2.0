// src/components/HolidayOverlay.tsx
import React, { useEffect, useMemo, useState, memo } from "react";
import { getActiveHoliday, type Holiday } from "@/lib/holiday-theme";
import {
  getHardwareLimits,
  getReducedMotion,
  getGlowIntensity,
} from "@/lib/settings";

interface ParticleSeed {
  id: number;
  leftPct: number;
  sizePx: number;
  durationSec: number;
  delaySec: number;
  opacity: number;
  depthTier: 0 | 1 | 2; // 0 = distant bokeh, 1 = mid, 2 = foreground hero 3D
  driftPx: number;
}

/**
 * Deterministic golden-ratio particle generator (avoids SSR/hydration mismatch
 * and keeps editorial composition balanced across any screen ratio).
 */
function buildEditorialSeeds(count: number, minSize: number, maxSize: number): ParticleSeed[] {
  const items: ParticleSeed[] = [];
  for (let i = 0; i < count; i++) {
    const phi = (i * 0.61803398875) % 1;
    const secondary = ((i * 0.38196601125) + 0.17) % 1;
    const depthTier = (i % 3) as 0 | 1 | 2;
    const sizeScale = depthTier === 2 ? 1 : depthTier === 1 ? 0.78 : 0.56;
    const baseSize = minSize + secondary * (maxSize - minSize);

    items.push({
      id: i,
      leftPct: Math.round((4 + phi * 92) * 10) / 10,
      sizePx: Math.round(baseSize * sizeScale),
      durationSec: Math.round((depthTier === 2 ? 10 : depthTier === 1 ? 14 : 19) + secondary * 6),
      delaySec: Math.round(phi * 12 * 10) / 10,
      opacity: depthTier === 2 ? 0.88 : depthTier === 1 ? 0.62 : 0.36,
      depthTier,
      driftPx: Math.round((secondary - 0.5) * 48),
    });
  }
  return items;
}

/**
 * 3D Sculpted Crystal Snowflake SVG (Multi-faceted specular ice & silver)
 */
function CrystalSnowflakeSvg({ size, id }: { size: number; id: number }) {
  const gradId = `snow-ice-${id}`;
  const rimId = `snow-rim-${id}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="block"
    >
      <defs>
        <linearGradient id={gradId} x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="45%" stopColor="#bae6fd" />
          <stop offset="85%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#e0f2fe" />
        </linearGradient>
        <radialGradient id={rimId} cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#7dd3fc" stopOpacity="0.15" />
        </radialGradient>
      </defs>
      <g stroke={`url(#${gradId})`} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        {/* 6 Main Crystalline Axes */}
        <line x1="32" y1="4" x2="32" y2="60" />
        <line x1="7.8" y1="18" x2="56.2" y2="46" />
        <line x1="56.2" y1="18" x2="7.8" y2="46" />
        {/* Faceted Ice Chevrons */}
        <polyline points="25,12 32,18 39,12" />
        <polyline points="25,52 32,46 39,52" />
        <polyline points="14,16 20,24 12,28" />
        <polyline points="50,48 44,40 52,36" />
        <polyline points="50,16 44,24 52,28" />
        <polyline points="14,48 20,40 12,36" />
      </g>
      {/* Central 3D Diamond Core */}
      <polygon
        points="32,21 41.5,26.5 41.5,37.5 32,43 22.5,37.5 22.5,26.5"
        fill={`url(#${rimId})`}
        stroke="#ffffff"
        strokeWidth="1.2"
      />
      <circle cx="32" cy="32" r="3.2" fill="#ffffff" />
    </svg>
  );
}

/**
 * 3D Sculpted Obsidian & Molten-Gold Halloween Lantern Pumpkin SVG
 */
function SculptedPumpkinSvg({ size, id }: { size: number; id: number }) {
  const bodyId = `pump-body-${id}`;
  const coreId = `pump-core-${id}`;
  const stemId = `pump-stem-${id}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="block"
    >
      <defs>
        <radialGradient id={bodyId} cx="35%" cy="28%" r="72%">
          <stop offset="0%" stopColor="#fdba74" />
          <stop offset="35%" stopColor="#ea580c" />
          <stop offset="78%" stopColor="#7c2d12" />
          <stop offset="100%" stopColor="#1c0a05" />
        </radialGradient>
        <radialGradient id={coreId} cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="55%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#b45309" />
        </radialGradient>
        <linearGradient id={stemId} x1="28" y1="6" x2="38" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fcd34d" />
          <stop offset="55%" stopColor="#059669" />
          <stop offset="100%" stopColor="#064e3b" />
        </linearGradient>
      </defs>
      {/* Metallic Curled Stem */}
      <path
        d="M31 18 C30 11, 35 7, 39 9 C36 11, 35 14, 35 18 Z"
        fill={`url(#${stemId})`}
        stroke="#fde68a"
        strokeWidth="0.9"
      />
      {/* Sculpted 3D Outer Lobes */}
      <ellipse cx="21" cy="37" rx="13" ry="17" fill={`url(#${bodyId})`} stroke="#fb923c" strokeOpacity="0.45" strokeWidth="1" />
      <ellipse cx="43" cy="37" rx="13" ry="17" fill={`url(#${bodyId})`} stroke="#fb923c" strokeOpacity="0.45" strokeWidth="1" />
      {/* Center Specular Rib */}
      <ellipse cx="32" cy="38" rx="12.5" ry="18.5" fill={`url(#${bodyId})`} stroke="#fdba74" strokeOpacity="0.6" strokeWidth="1.1" />
      {/* Glass Highlight */}
      <path
        d="M25 24 C23 30, 23 39, 25 47"
        stroke="#ffedd5"
        strokeOpacity="0.45"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {/* Molten Gold Carved Eyes & Grin */}
      <polygon points="22,34 27,29 29,35" fill={`url(#${coreId})`} />
      <polygon points="42,34 37,29 35,35" fill={`url(#${coreId})`} />
      <path
        d="M22 43 Q27 48 32 45 Q37 48 42 43 Q37 51 32 49 Q27 51 22 43 Z"
        fill={`url(#${coreId})`}
      />
    </svg>
  );
}

/**
 * 3D Faceted Ruby & Rose-Gold Crystal Heart SVG
 */
function FacetedRubyHeartSvg({ size, id }: { size: number; id: number }) {
  const rubyId = `ruby-main-${id}`;
  const facetId = `ruby-facet-${id}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="block"
    >
      <defs>
        <linearGradient id={rubyId} x1="12" y1="10" x2="54" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fecdd3" />
          <stop offset="28%" stopColor="#fb7185" />
          <stop offset="68%" stopColor="#e11d48" />
          <stop offset="100%" stopColor="#4c0519" />
        </linearGradient>
        <linearGradient id={facetId} x1="14" y1="12" x2="36" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#fda4af" stopOpacity="0.08" />
        </linearGradient>
      </defs>
      {/* Sculpted Gemstone Heart Silhouette */}
      <path
        d="M32 56 L11 33 C5 26 7 15 16 12 C23 10 29 14 32 20 C35 14 41 10 48 12 C57 15 59 26 53 33 L32 56 Z"
        fill={`url(#${rubyId})`}
        stroke="#fda4af"
        strokeWidth="1.2"
      />
      {/* Internal Diamond Cut Facets */}
      <polygon points="32,20 17,18 22,33 32,30" fill={`url(#${facetId})`} />
      <polygon points="32,30 42,33 32,54 22,33" fill="#881337" fillOpacity="0.35" />
      <polyline points="11,33 22,33 32,30 42,33 53,33" stroke="#ffe4e6" strokeOpacity="0.4" strokeWidth="0.9" />
      <circle cx="20" cy="20" r="2.2" fill="#ffffff" fillOpacity="0.9" />
    </svg>
  );
}

/**
 * 3D Champagne Gold Diamond Sparkle SVG (Future-ready for New Year's / Celebration)
 */
function ChampagneStarSvg({ size, id }: { size: number; id: number }) {
  const goldId = `gold-star-${id}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={goldId} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fef9c3" />
          <stop offset="45%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
      </defs>
      <path
        d="M32 4 L38 26 L60 32 L38 38 L32 60 L26 38 L4 32 L26 26 Z"
        fill={`url(#${goldId})`}
        stroke="#fef3c7"
        strokeWidth="1"
      />
      <circle cx="32" cy="32" r="4" fill="#ffffff" />
    </svg>
  );
}

function isMediaPlaybackScreen(): boolean {
  if (typeof window === "undefined") return false;
  if (document.fullscreenElement) return true;
  const path = (window.location.pathname || "").toLowerCase();
  return (
    path.includes("/player") ||
    path.includes("/live-player") ||
    path.includes("/watch")
  );
}

export const HolidayOverlay = memo(function HolidayOverlay() {
  const holiday: Holiday = getActiveHoliday();
  const [isLowRam, setIsLowRam] = useState<boolean>(
    () => getHardwareLimits().effectiveMode === "low"
  );
  const [reducedMotion, setReducedMotion] = useState<boolean>(() =>
    getReducedMotion()
  );
  const [glowOff, setGlowOff] = useState<boolean>(
    () => getGlowIntensity() === "off"
  );
  const [isPlaybackRoute, setIsPlaybackRoute] = useState<boolean>(() =>
    isMediaPlaybackScreen()
  );
  const [isTabHidden, setIsTabHidden] = useState<boolean>(false);

  // Sync live settings and playback-route suppression
  useEffect(() => {
    const syncState = () => {
      setIsLowRam(getHardwareLimits().effectiveMode === "low");
      setReducedMotion(getReducedMotion());
      setGlowOff(getGlowIntensity() === "off");
      setIsPlaybackRoute(isMediaPlaybackScreen());
    };

    const handleVisibility = () => {
      setIsTabHidden(document.hidden);
      syncState();
    };

    syncState();
    window.addEventListener("rabtv_settings_updated", syncState);
    window.addEventListener("rabtv_ram_mode_updated", syncState);
    window.addEventListener("popstate", syncState);
    document.addEventListener("fullscreenchange", syncState);
    document.addEventListener("visibilitychange", handleVisibility);

    // Lightweight route check for SPA navigations into player screens
    const routeCheckInterval = window.setInterval(() => {
      const nextPlayback = isMediaPlaybackScreen();
      setIsPlaybackRoute((prev) => (prev !== nextPlayback ? nextPlayback : prev));
    }, 1500);

    return () => {
      window.removeEventListener("rabtv_settings_updated", syncState);
      window.removeEventListener("rabtv_ram_mode_updated", syncState);
      window.removeEventListener("popstate", syncState);
      document.removeEventListener("fullscreenchange", syncState);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.clearInterval(routeCheckInterval);
    };
  }, []);

  const normalizedHoliday = String(holiday || "").toLowerCase();

  // Particle counts strictly budgeted for 1-2GB sticks vs 4GB+ devices
  const particleCount = useMemo(() => {
    if (reducedMotion) return 4;
    if (normalizedHoliday === "halloween") return isLowRam ? 5 : 9;
    if (normalizedHoliday === "christmas") return isLowRam ? 10 : 22;
    if (normalizedHoliday === "valentines") return isLowRam ? 8 : 15;
    return isLowRam ? 8 : 16;
  }, [normalizedHoliday, isLowRam, reducedMotion]);

  const seeds = useMemo(() => {
    if (normalizedHoliday === "halloween") {
      return buildEditorialSeeds(particleCount, 30, 46);
    }
    if (normalizedHoliday === "christmas") {
      return buildEditorialSeeds(particleCount, 14, 30);
    }
    if (normalizedHoliday === "valentines") {
      return buildEditorialSeeds(particleCount, 18, 34);
    }
    return buildEditorialSeeds(particleCount, 16, 30);
  }, [normalizedHoliday, particleCount]);

  // Never render when no holiday is active or during video playback
  if (!holiday || isPlaybackRoute) return null;

  const isHalloween = normalizedHoliday === "halloween";
  const isChristmas = normalizedHoliday === "christmas";
  const isValentines = normalizedHoliday === "valentines";
  const isNewYear = normalizedHoliday.includes("new") || normalizedHoliday.includes("year");

  if (!isHalloween && !isChristmas && !isValentines && !isNewYear) return null;

  const topRimGradient = isChristmas
    ? "from-sky-400/20 via-cyan-200/10 to-transparent"
    : isHalloween
      ? "from-amber-600/20 via-purple-900/15 to-transparent"
      : isValentines
        ? "from-rose-500/20 via-pink-500/10 to-transparent"
        : "from-amber-400/20 via-yellow-200/10 to-transparent";

  const animPlayState = isTabHidden ? "paused" : "running";

  // Static High-Fashion Ambient Mode when Senior Reduced Motion is active
  if (reducedMotion) {
    return (
      <div
        className="rabtv-vidsrc-protected pointer-events-none fixed inset-0 z-[55] overflow-hidden select-none"
        aria-hidden="true"
      >
        <div className={`absolute inset-x-0 top-0 h-20 bg-gradient-to-b ${topRimGradient}`} />
        <div className="absolute top-16 left-5 opacity-55">
          {isChristmas && <CrystalSnowflakeSvg size={28} id={901} />}
          {isHalloween && <SculptedPumpkinSvg size={36} id={902} />}
          {isValentines && <FacetedRubyHeartSvg size={30} id={903} />}
          {isNewYear && <ChampagneStarSvg size={28} id={904} />}
        </div>
        <div className="absolute top-16 right-5 opacity-55">
          {isChristmas && <CrystalSnowflakeSvg size={24} id={905} />}
          {isHalloween && <SculptedPumpkinSvg size={32} id={906} />}
          {isValentines && <FacetedRubyHeartSvg size={26} id={907} />}
          {isNewYear && <ChampagneStarSvg size={24} id={908} />}
        </div>
      </div>
    );
  }

  return (
    <div
      className="rabtv-vidsrc-protected pointer-events-none fixed inset-0 z-[55] overflow-hidden select-none"
      style={{ perspective: "900px" }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes rabtv3dFall {
          0% {
            transform: translate3d(0, -12vh, 0) rotateX(0deg) rotateY(0deg) rotateZ(0deg);
          }
          50% {
            transform: translate3d(var(--drift-x, 18px), 50vh, 24px) rotateX(160deg) rotateY(180deg) rotateZ(90deg);
          }
          100% {
            transform: translate3d(0, 112vh, 0) rotateX(360deg) rotateY(360deg) rotateZ(180deg);
          }
        }
        @keyframes rabtv3dHoverLantern {
          0%, 100% {
            transform: translate3d(0, 0, 0) rotateY(-14deg) rotateZ(-4deg) scale(1);
          }
          50% {
            transform: translate3d(var(--drift-x, 10px), -18px, 30px) rotateY(14deg) rotateZ(4deg) scale(1.06);
          }
        }
        .rabtv-holiday-3d-fall {
          position: absolute;
          top: -8vh;
          will-change: transform;
          transform-style: preserve-3d;
          animation-name: rabtv3dFall;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        .rabtv-holiday-3d-lantern {
          position: absolute;
          will-change: transform;
          transform-style: preserve-3d;
          animation-name: rabtv3dHoverLantern;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
        }
      `}</style>

      {/* Subtle Editorial Top Rim Ambient Aura */}
      {!glowOff && (
        <div
          className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${topRimGradient}`}
        />
      )}

      {/* Halloween: Perimeter 3D Floating Sculpted Lanterns (Keeps center catalog 100% clear) */}
      {isHalloween &&
        seeds.map((s, idx) => {
          const isLeftEdge = idx % 2 === 0;
          const topPct = 10 + ((idx * 17) % 74);
          const edgeOffset = 2 + (idx % 3) * 3.5;
          return (
            <div
              key={s.id}
              className="rabtv-holiday-3d-lantern"
              style={
                {
                  top: `${topPct}%`,
                  left: isLeftEdge ? `${edgeOffset}%` : undefined,
                  right: !isLeftEdge ? `${edgeOffset}%` : undefined,
                  opacity: s.opacity,
                  animationDuration: `${5.5 + (idx % 4) * 1.4}s`,
                  animationDelay: `${(idx * 0.7) % 4}s`,
                  animationPlayState: animPlayState,
                  "--drift-x": `${isLeftEdge ? 8 : -8}px`,
                  filter:
                    !isLowRam && !glowOff
                      ? "drop-shadow(0 10px 18px rgba(234, 88, 12, 0.45))"
                      : undefined,
                } as React.CSSProperties
              }
            >
              <SculptedPumpkinSvg size={s.sizePx} id={s.id} />
            </div>
          );
        })}

      {/* Christmas / Valentines / New Year: Multi-Depth 3D Parallax Cascade */}
      {!isHalloween &&
        seeds.map((s) => {
          const glowShadow =
            !isLowRam && !glowOff && s.depthTier === 2
              ? isChristmas
                ? "drop-shadow(0 0 12px rgba(125, 211, 252, 0.55))"
                : isValentines
                  ? "drop-shadow(0 0 14px rgba(244, 63, 94, 0.55))"
                  : "drop-shadow(0 0 12px rgba(251, 191, 36, 0.55))"
              : undefined;

          return (
            <div
              key={s.id}
              className="rabtv-holiday-3d-fall"
              style={
                {
                  left: `${s.leftPct}%`,
                  opacity: s.opacity,
                  animationDuration: `${s.durationSec}s`,
                  animationDelay: `-${s.delaySec}s`,
                  animationPlayState: animPlayState,
                  "--drift-x": `${s.driftPx}px`,
                  filter: glowShadow,
                } as React.CSSProperties
              }
            >
              {isChristmas && <CrystalSnowflakeSvg size={s.sizePx} id={s.id} />}
              {isValentines && <FacetedRubyHeartSvg size={s.sizePx} id={s.id} />}
              {isNewYear && <ChampagneStarSvg size={s.sizePx} id={s.id} />}
            </div>
          );
        })}
    </div>
  );
});

HolidayOverlay.displayName = "HolidayOverlay";
