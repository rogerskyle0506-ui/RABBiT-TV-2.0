// src/components/MascotAvatar.tsx
import React, { useState, useEffect, useMemo, memo } from "react";
import { resolveMascotBadge } from "@/lib/mascots";

export type MascotAvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

export interface MascotAvatarProps {
  mascot?: string | null;
  size?: MascotAvatarSize;
  rounded?: "full" | "xl" | "2xl";
  className?: string;
  alt?: string;
}

const SIZE_CLASSES: Record<MascotAvatarSize, { box: string; emoji: string }> = {
  xs: { box: "h-5 w-5", emoji: "text-xs" },
  sm: { box: "h-7 w-7", emoji: "text-sm" },
  md: { box: "h-10 w-10", emoji: "text-lg" },
  lg: { box: "h-14 w-14 sm:h-16 sm:w-16", emoji: "text-2xl sm:text-3xl" },
  xl: { box: "h-16 w-16 sm:h-20 sm:w-20", emoji: "text-3xl sm:text-4xl" },
};

const ROUNDED_CLASSES: Record<"full" | "xl" | "2xl", string> = {
  full: "rounded-full",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
};

export const MascotAvatar = memo(function MascotAvatar({
  mascot,
  size = "md",
  rounded = "full",
  className = "",
  alt,
}: MascotAvatarProps) {
  const badge = useMemo(() => resolveMascotBadge(mascot), [mascot]);
  const [sourceStep, setSourceStep] = useState<0 | 1 | 2>(0);

  // Reset image fallback chain whenever the mascot changes
  useEffect(() => {
    setSourceStep(0);
  }, [badge.id]);

  const sizeStyle = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  const radiusClass = ROUNDED_CLASSES[rounded] || "rounded-full";

  const activeSrc =
    badge.category === "custom"
      ? sourceStep === 0
        ? badge.imageUrl
        : sourceStep === 1
          ? badge.localUrl
          : undefined
      : undefined;

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden bg-black/75 select-none ${sizeStyle.box} ${radiusClass} ${className}`}
    >
      {activeSrc ? (
        <img
          src={activeSrc}
          alt={alt || badge.label}
          loading="lazy"
          decoding="async"
          onError={() => {
            setSourceStep((prev) => (prev === 0 ? 1 : 2));
          }}
          className="h-full w-full object-cover object-center"
        />
      ) : (
        <span className={`leading-none ${sizeStyle.emoji}`} aria-hidden="true">
          {badge.emojiFallback}
        </span>
      )}
    </span>
  );
});

MascotAvatar.displayName = "MascotAvatar";
export default MascotAvatar;