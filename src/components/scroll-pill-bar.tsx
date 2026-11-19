// src/components/scroll-pill-bar.tsx
import React, { useState, useRef, useEffect, useCallback, memo } from "react";
import {
  type AppTheme,
  getLargeButtons,
  getReducedMotion,
  getGlowIntensity,
  getHardwareLimits,
} from "@/lib/settings";

export interface PillOption {
  id: string;
  label: string;
}

export interface ScrollPillBarProps {
  options: PillOption[];
  activeId: string;
  onSelect: (id: string) => void;
  appTheme: AppTheme;
  getPrimaryBgColor: (theme: AppTheme) => string;
  ariaLabel?: string;
}

export const ScrollPillBar = memo(function ScrollPillBar({
  options,
  activeId,
  onSelect,
  appTheme,
  getPrimaryBgColor,
  ariaLabel = "Category navigation",
}: ScrollPillBarProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef({
    isDown: false,
    startX: 0,
    scrollLeft: 0,
    didDrag: false,
  });

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [largeButtons, setLargeButtons] = useState<boolean>(() =>
    getLargeButtons()
  );
  const [reducedMotion, setReducedMotion] = useState<boolean>(() =>
    getReducedMotion()
  );
  const [glowOff, setGlowOff] = useState<boolean>(
    () => getGlowIntensity() === "off"
  );
  const [isLowRam, setIsLowRam] = useState<boolean>(
    () => getHardwareLimits().effectiveMode === "low"
  );

  // Sync live accessibility & hardware preferences
  useEffect(() => {
    const syncPrefs = () => {
      setLargeButtons(getLargeButtons());
      setReducedMotion(getReducedMotion());
      setGlowOff(getGlowIntensity() === "off");
      setIsLowRam(getHardwareLimits().effectiveMode === "low");
    };
    syncPrefs();
    window.addEventListener("rabtv_settings_updated", syncPrefs);
    window.addEventListener("rabtv_ram_mode_updated", syncPrefs);
    return () => {
      window.removeEventListener("rabtv_settings_updated", syncPrefs);
      window.removeEventListener("rabtv_ram_mode_updated", syncPrefs);
    };
  }, []);

  const checkScrollBounds = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    // 5px margin threshold avoids sub-pixel rounding glitches on high-DPI screens
    setCanScrollLeft(scrollLeft > 5);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 5);
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    checkScrollBounds();
    container.addEventListener("scroll", checkScrollBounds, { passive: true });
    window.addEventListener("resize", checkScrollBounds, { passive: true });

    // Safe ResizeObserver guard for older Android / Fire OS WebViews
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        checkScrollBounds();
      });
      resizeObserver.observe(container);
    }

    return () => {
      container.removeEventListener("scroll", checkScrollBounds);
      window.removeEventListener("resize", checkScrollBounds);
      resizeObserver?.disconnect();
    };
  }, [options, largeButtons, checkScrollBounds]);

  // Smoothly auto-center the active pill whenever activeId updates
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const activeBtn = container.querySelector<HTMLButtonElement>(
      `button[data-pill-id="${CSS?.escape ? CSS.escape(activeId) : activeId}"]`
    );
    if (activeBtn) {
      activeBtn.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [activeId, reducedMotion]);

  const scrollByAmount = (offset: number) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollBy({
      left: offset,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  };

  // Horizontal mouse-wheel support for desktop & air-mouse users
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth) {
      el.scrollLeft += e.deltaY;
    }
  };

  // Click-and-drag scrolling for air-mouse / touchpads
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    dragStateRef.current = {
      isDown: true,
      startX: e.pageX - el.offsetLeft,
      scrollLeft: el.scrollLeft,
      didDrag: false,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = scrollContainerRef.current;
    if (!el || !dragStateRef.current.isDown) return;
    const x = e.pageX - el.offsetLeft;
    const walk = x - dragStateRef.current.startX;
    if (Math.abs(walk) > 6) {
      dragStateRef.current.didDrag = true;
      el.scrollLeft = dragStateRef.current.scrollLeft - walk;
    }
  };

  const handleMouseEnd = () => {
    dragStateRef.current.isDown = false;
  };

  // Full TV Remote / D-Pad Keyboard Navigation (Left, Right, Home, End)
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    currentIndex: number
  ) => {
    const pillButtons =
      scrollContainerRef.current?.querySelectorAll<HTMLButtonElement>(
        "button[data-pill-btn]"
      );
    if (!pillButtons || pillButtons.length === 0) return;

    let targetIdx: number | null = null;
    if (e.key === "ArrowRight") {
      targetIdx = (currentIndex + 1) % pillButtons.length;
    } else if (e.key === "ArrowLeft") {
      targetIdx = (currentIndex - 1 + pillButtons.length) % pillButtons.length;
    } else if (e.key === "Home") {
      targetIdx = 0;
    } else if (e.key === "End") {
      targetIdx = pillButtons.length - 1;
    }

    if (targetIdx !== null) {
      e.preventDefault();
      pillButtons[targetIdx]?.focus();
      pillButtons[targetIdx]?.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  };

  const themeAccent = (() => {
    switch (appTheme) {
      case "red":
        return {
          arrow: "text-red-300",
          border: "border-red-500/30",
          laser: "from-transparent via-red-500 to-amber-400",
          ring: "focus:ring-red-400",
        };
      case "midnight":
        return {
          arrow: "text-sky-300",
          border: "border-sky-500/30",
          laser: "from-transparent via-sky-400 to-blue-500",
          ring: "focus:ring-sky-400",
        };
      case "emerald":
        return {
          arrow: "text-emerald-300",
          border: "border-emerald-500/30",
          laser: "from-transparent via-emerald-400 to-teal-400",
          ring: "focus:ring-emerald-400",
        };
      case "amber":
        return {
          arrow: "text-amber-300",
          border: "border-amber-500/30",
          laser: "from-transparent via-amber-400 to-orange-500",
          ring: "focus:ring-amber-400",
        };
      case "cyan":
        return {
          arrow: "text-cyan-300",
          border: "border-cyan-500/30",
          laser: "from-transparent via-cyan-400 to-sky-500",
          ring: "focus:ring-cyan-400",
        };
      case "violet":
      default:
        return {
          arrow: "text-violet-300",
          border: "border-violet-500/30",
          laser: "from-transparent via-pink-500 to-cyan-400",
          ring: "focus:ring-violet-400",
        };
    }
  })();

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`relative w-full max-w-full sm:max-w-fit mx-auto overflow-hidden rounded-2xl border ${
        themeAccent.border
      } bg-slate-950/75 ${
        isLowRam ? "" : "backdrop-blur-xl"
      } shadow-[0_12px_32px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.16)] p-1.5 flex justify-center`}
    >
      {/* Couture Top Specular Laser Accent */}
      {!glowOff && (
        <div
          className={`absolute inset-x-8 top-0 h-[1.5px] bg-gradient-to-r ${themeAccent.laser} opacity-80 pointer-events-none z-20`}
        />
      )}

      {/* Left Edge Fade + Elevated Glass Chevron */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-slate-950 via-slate-950/80 to-transparent z-20 flex items-center justify-start pl-1.5 transition-opacity duration-200 ${
          canScrollLeft
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      >
        <button
          type="button"
          onClick={() => scrollByAmount(-220)}
          aria-label="Scroll left"
          className={`flex h-7 w-7 items-center justify-center rounded-full bg-black/80 hover:bg-black border border-white/15 shadow-lg focus:outline-none focus:ring-2 ${themeAccent.ring} transition hover:scale-110 active:scale-95 cursor-pointer`}
        >
          <span
            className={`text-sm font-black ${themeAccent.arrow} ${
              !reducedMotion && !glowOff ? "animate-slow-glow" : ""
            }`}
          >
            ‹
          </span>
        </button>
      </div>

      {/* Scrollable Pill Track */}
      <div
        ref={scrollContainerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseEnd}
        onMouseLeave={handleMouseEnd}
        className="flex items-center justify-start sm:justify-center gap-2 overflow-x-auto scrollbar-none px-7 py-1 min-w-full sm:min-w-0 select-none"
      >
        {options.map((item, index) => {
          const isActive = activeId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              data-pill-btn
              data-pill-id={item.id}
              onClick={() => {
                if (dragStateRef.current.didDrag) {
                  dragStateRef.current.didDrag = false;
                  return;
                }
                onSelect(item.id);
              }}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={`relative rounded-xl ${
                largeButtons ? "px-5 py-2.5 text-sm" : "px-4 py-2 text-xs"
              } font-extrabold tracking-wide whitespace-nowrap shrink-0 cursor-pointer transition-all duration-200 focus:outline-none focus:ring-2 ${
                themeAccent.ring
              } ${
                isActive
                  ? `${getPrimaryBgColor(
                      appTheme
                    )} text-white shadow-[0_6px_18px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.35)] scale-[1.03]`
                  : "bg-white/[0.05] text-slate-300 border border-white/10 hover:bg-white/[0.12] hover:text-white hover:border-white/25"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Right Edge Fade + Elevated Glass Chevron */}
      <div
        className={`absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-slate-950 via-slate-950/80 to-transparent z-20 flex items-center justify-end pr-1.5 transition-opacity duration-200 ${
          canScrollRight
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      >
        <button
          type="button"
          onClick={() => scrollByAmount(220)}
          aria-label="Scroll right"
          className={`flex h-7 w-7 items-center justify-center rounded-full bg-black/80 hover:bg-black border border-white/15 shadow-lg focus:outline-none focus:ring-2 ${themeAccent.ring} transition hover:scale-110 active:scale-95 cursor-pointer`}
        >
          <span
            className={`text-sm font-black ${themeAccent.arrow} ${
              !reducedMotion && !glowOff ? "animate-slow-glow" : ""
            }`}
          >
            ›
          </span>
        </button>
      </div>
    </div>
  );
});

ScrollPillBar.displayName = "ScrollPillBar";

export default ScrollPillBar;
