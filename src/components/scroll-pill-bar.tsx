// src/components/ScrollPillBar.tsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import { AppTheme } from "@/lib/settings";

interface PillOption {
  id: string;
  label: string;
}

interface ScrollPillBarProps {
  options: PillOption[];
  activeId: string;
  onSelect: (id: string) => void;
  appTheme: AppTheme;
  getPrimaryBgColor: (theme: AppTheme) => string;
}

export function ScrollPillBar({
  options,
  activeId,
  onSelect,
  appTheme,
  getPrimaryBgColor,
}: ScrollPillBarProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScrollBounds = useCallback(() => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      // Scroll margin threshold (5px) prevents rounding precision glitches on high-DPI displays[cite: 13]
      setCanScrollLeft(scrollLeft > 5);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 5);
    }
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    checkScrollBounds();

    // Listen for manual user scrolling
    container.addEventListener("scroll", checkScrollBounds, { passive: true });

    // Listen for container resize or dynamic pill layout recalculations
    const resizeObserver = new ResizeObserver(() => {
      checkScrollBounds();
    });
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener("scroll", checkScrollBounds);
      resizeObserver.disconnect();
    };
  }, [options, checkScrollBounds]);

  const scrollByAmount = (offset: number) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: offset, behavior: "smooth" });
    }
  };

  // D-pad / Keyboard Arrow Key navigation handler for remote control integration
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    const pillButtons = scrollContainerRef.current?.querySelectorAll<HTMLButtonElement>("button[data-pill-btn]");
    if (!pillButtons || pillButtons.length === 0) return;

    if (e.key === "ArrowRight") {
      e.preventDefault();
      const nextIndex = (currentIndex + 1) % pillButtons.length;
      pillButtons[nextIndex]?.focus();
      pillButtons[nextIndex]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prevIndex = (currentIndex - 1 + pillButtons.length) % pillButtons.length;
      pillButtons[prevIndex]?.focus();
      pillButtons[prevIndex]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  };

  // Dynamic Theme Color Mapping for the micro-arrows & soft neon aura[cite: 13]
  const getThemeArrowColor = (theme: AppTheme) => {
    switch (theme) {
      case "red":
        return "text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.8)]";
      case "midnight":
        return "text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.8)]";
      case "emerald":
        return "text-emerald-300 drop-shadow-[0_0_8px_rgba(110,231,183,0.8)]";
      case "amber":
        return "text-amber-300 drop-shadow-[0_0_8px_rgba(252,211,77,0.8)]";
      case "cyan":
        return "text-cyan-300 drop-shadow-[0_0_8px_rgba(103,232,249,0.8)]";
      case "violet":
      default:
        return "text-purple-400 drop-shadow-[0_0_8px_rgba(192,132,252,0.8)]";
    }
  };

  return (
    <div className="relative w-full max-w-fit mx-auto overflow-hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md p-1.5 flex justify-center">
      {/* Left Side Edge Fade + Clickable Interactive Left Arrow Button */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-black/95 via-black/60 to-transparent z-20 flex items-center justify-start pl-2 transition-opacity duration-300 ${
          canScrollLeft ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <button
          type="button"
          onClick={() => scrollByAmount(-200)}
          aria-label="Scroll left"
          className="p-1 rounded-lg hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/30 transition cursor-pointer"
        >
          <span className={`text-base font-black transition-colors duration-300 animate-slow-glow ${getThemeArrowColor(appTheme)}`}>
            ‹
          </span>
        </button>
      </div>

      {/* Centered Scrollable Track */}
      <div
        ref={scrollContainerRef}
        className="flex items-center justify-start sm:justify-center gap-2 overflow-x-auto scrollbar-none px-6 py-1 min-w-full sm:min-w-0"
      >
        {options.map((item, index) => (
          <button
            key={item.id}
            type="button"
            data-pill-btn
            onClick={() => onSelect(item.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition shrink-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/50 ${
              activeId === item.id
                ? `${getPrimaryBgColor(appTheme)} text-white shadow-md`
                : "bg-white/5 text-slate-300 hover:bg-white/10"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Right Side Edge Fade + Clickable Interactive Right Arrow Button */}
      <div
        className={`absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-black/95 via-black/60 to-transparent z-20 flex items-center justify-end pr-2 transition-opacity duration-300 ${
          canScrollRight ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <button
          type="button"
          onClick={() => scrollByAmount(200)}
          aria-label="Scroll right"
          className="p-1 rounded-lg hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/30 transition cursor-pointer"
        >
          <span className={`text-base font-black transition-colors duration-300 animate-slow-glow ${getThemeArrowColor(appTheme)}`}>
            ›
          </span>
        </button>
      </div>
    </div>
  );
}
