// src/components/scroll-pill-bar.tsx
import React, { useState, useRef, useEffect, useCallback, memo } from "react";
import {
  type AppTheme,
  getLargeButtons,
  getReducedMotion,
  getHardwareLimits,
} from "@/lib/settings";

const IMG_SPB_TRACK =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-pill-track-background.jpg";
const IMG_SPB_ACTIVE =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-pill-active-crimson.jpg";
const IMG_SPB_IDLE =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-pill-inactive-dark.jpg";

const SCROLL_PILL_STYLES = `
  .rabtv-spb-shell[data-theme="violet"], :root { --rabtv-spb-filter: hue-rotate(-78deg) saturate(1.12) brightness(1.02); }
  .rabtv-spb-shell[data-theme="red"] { --rabtv-spb-filter: hue-rotate(0deg) saturate(1.08) brightness(1.0); }
  .rabtv-spb-shell[data-theme="midnight"] { --rabtv-spb-filter: hue-rotate(-132deg) saturate(1.14) brightness(1.04); }
  .rabtv-spb-shell[data-theme="emerald"] { --rabtv-spb-filter: hue-rotate(154deg) saturate(1.10) brightness(1.02); }
  .rabtv-spb-shell[data-theme="amber"] { --rabtv-spb-filter: hue-rotate(28deg) saturate(1.14) brightness(1.04); }
  .rabtv-spb-shell[data-theme="cyan"] { --rabtv-spb-filter: hue-rotate(-154deg) saturate(1.12) brightness(1.04); }

  .rabtv-spb-shell { position: relative; overflow: hidden; background-color: #0c0a09; contain: layout paint; }
  .rabtv-spb-track-bg { position: absolute; inset: 0; background-size: 100% 100%; opacity: 0.78; filter: var(--rabtv-spb-filter); pointer-events: none; z-index: 0; }
  .rabtv-spb-scroll { -webkit-mask-image: linear-gradient(to right, transparent 0%, black 18px, black calc(100% - 18px), transparent 100%); mask-image: linear-gradient(to right, transparent 0%, black 18px, black calc(100% - 18px), transparent 100%); }
  .rabtv-spb-pill { position: relative; overflow: hidden; background-color: #0c0a09; border: 0 !important; contain: layout paint; transition: transform 140ms ease, filter 140ms ease; }
  .rabtv-spb-pill:hover { filter: brightness(1.1); }
  .rabtv-spb-pill-art { position: absolute; inset: 0; background-size: 100% 100%; filter: var(--rabtv-spb-filter); pointer-events: none; z-index: 0; }
`;

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
  const [isLowRam, setIsLowRam] = useState<boolean>(
    () => getHardwareLimits().effectiveMode === "low"
  );

  // Sync live accessibility & hardware preferences
  useEffect(() => {
    const syncPrefs = () => {
      setLargeButtons(getLargeButtons());
      setReducedMotion(getReducedMotion());
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
      data-theme={appTheme}
      role="tablist"
      aria-label={ariaLabel}
      className={`rabtv-spb-shell relative w-full max-w-full sm:max-w-fit mx-auto rounded-2xl border ${themeAccent.border} ${
        isLowRam ? "" : "backdrop-blur-xl"
      } shadow-xl p-1.5 flex justify-center`}
    >
      <style>{SCROLL_PILL_STYLES}</style>
      <div
        className="rabtv-spb-track-bg"
        aria-hidden="true"
        style={{ backgroundImage: `url(${IMG_SPB_TRACK})` }}
      />

      {/* Left Chevron */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r from-[#0c0a09] via-[#0c0a09]/80 to-transparent z-20 flex items-center justify-start pl-1.5 transition-opacity duration-200 ${
          canScrollLeft ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <button
          type="button"
          onClick={() => scrollByAmount(-220)}
          aria-label="Scroll left"
          className={`flex h-7 w-7 items-center justify-center rounded-full bg-black/85 hover:bg-black border border-white/15 shadow-lg focus:outline-none focus:ring-2 ${themeAccent.ring} transition hover:scale-110 active:scale-95 cursor-pointer`}
        >
          <span className={`text-sm font-black ${themeAccent.arrow}`}>‹</span>
        </button>
      </div>

      {/* Armored Scrollable Pill Track */}
      <div
        ref={scrollContainerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseEnd}
        onMouseLeave={handleMouseEnd}
        className="rabtv-spb-scroll relative z-10 flex items-center justify-start sm:justify-center gap-2 overflow-x-auto scrollbar-none px-7 py-1 min-w-full sm:min-w-0 select-none"
      >
        {options.map((item, index) => {
          const isActive = activeId === item.id;
          void getPrimaryBgColor;
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
              className={`rabtv-spb-pill rounded-xl ${
                largeButtons ? "px-5 py-2.5 text-sm" : "px-4 py-2 text-xs"
              } font-extrabold tracking-wide text-white whitespace-nowrap shrink-0 cursor-pointer focus:outline-none focus:ring-2 ${
                themeAccent.ring
              } ${isActive ? "scale-[1.03]" : "opacity-90 hover:opacity-100"}`}
            >
              <span
                className="rabtv-spb-pill-art"
                aria-hidden="true"
                style={{
                  backgroundImage: `url(${isActive ? IMG_SPB_ACTIVE : IMG_SPB_IDLE})`,
                  opacity: isActive ? 0.98 : 0.88,
                }}
              />
              <span className="relative z-10 drop-shadow-[0_1px_4px_rgba(0,0,0,0.96)]">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Right Chevron */}
      <div
        className={`absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-[#0c0a09] via-[#0c0a09]/80 to-transparent z-20 flex items-center justify-end pr-1.5 transition-opacity duration-200 ${
          canScrollRight ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <button
          type="button"
          onClick={() => scrollByAmount(220)}
          aria-label="Scroll right"
          className={`flex h-7 w-7 items-center justify-center rounded-full bg-black/85 hover:bg-black border border-white/15 shadow-lg focus:outline-none focus:ring-2 ${themeAccent.ring} transition hover:scale-110 active:scale-95 cursor-pointer`}
        >
          <span className={`text-sm font-black ${themeAccent.arrow}`}>›</span>
        </button>
      </div>
    </div>
  );
});

ScrollPillBar.displayName = "ScrollPillBar";

export default ScrollPillBar;