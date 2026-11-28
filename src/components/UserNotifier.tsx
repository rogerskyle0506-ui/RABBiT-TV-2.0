// src/components/UserNotifier.tsx
import React, { useEffect, useState, useCallback } from "react";
import { getSavedUserAge, getHardwareLimits } from "@/lib/settings";

export type ToastSeverity = "info" | "warning" | "critical";

interface NotificationItem {
  id: string;
  target: string;
  message: string;
  severity?: ToastSeverity;
  timestamp: number;
}

interface RemoteFleetAnnouncement {
  maintenanceMode?: boolean;
  motdBanner?: string;
  minAppVersion?: string;
  updatedAt?: number;
}

interface UserNotifierProps {
  appTheme: string;
}

const AGE_LOCK_KEY = "rabtv_age_passcode";
const IMG_UN_CARD_FRAME =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-referral-section-card.jpg";
const IMG_UN_HIGHLIGHT_FRAME =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-legal-highlight-card.jpg";
const IMG_UN_BTN_IDLE =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-legal-tab-idle.jpg";

const USER_NOTIFIER_STYLES = `
  .rabtv-un-root[data-theme="violet"], :root { --rabtv-un-filter: hue-rotate(-78deg) saturate(1.12) brightness(1.02); }
  .rabtv-un-root[data-theme="red"] { --rabtv-un-filter: hue-rotate(0deg) saturate(1.08) brightness(1.0); }
  .rabtv-un-root[data-theme="midnight"] { --rabtv-un-filter: hue-rotate(-132deg) saturate(1.14) brightness(1.04); }
  .rabtv-un-root[data-theme="emerald"] { --rabtv-un-filter: hue-rotate(154deg) saturate(1.10) brightness(1.02); }
  .rabtv-un-root[data-theme="amber"] { --rabtv-un-filter: hue-rotate(28deg) saturate(1.14) brightness(1.04); }
  .rabtv-un-root[data-theme="cyan"] { --rabtv-un-filter: hue-rotate(-154deg) saturate(1.12) brightness(1.04); }

  .rabtv-un-card {
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
    padding: 16px 16px !important;
    background-color: rgba(12, 10, 9, 0.94);
    contain: layout paint;
  }
  .rabtv-un-9slice {
    position: absolute;
    inset: 0;
    box-sizing: border-box;
    border-style: solid;
    border-color: transparent;
    border-width: 14px 14px;
    border-image-source: url("${IMG_UN_CARD_FRAME}");
    border-image-slice: 14% 11% fill;
    border-image-repeat: stretch;
    filter: var(--rabtv-un-filter);
    pointer-events: none;
    z-index: 0;
  }
  .rabtv-un-9slice--fleet {
    border-image-source: url("${IMG_UN_HIGHLIGHT_FRAME}");
    filter: none;
  }
`;

export function UserNotifier({ appTheme }: UserNotifierProps) {
  const [activeToast, setActiveToast] = useState<NotificationItem | null>(null);
  const [fleetBanner, setFleetBanner] =
    useState<RemoteFleetAnnouncement | null>(null);

  const checkNotifications = useCallback(async () => {
    if (typeof document !== "undefined" && document.hidden) return;

    const GIST_ID = ((import.meta as any).env?.VITE_GIST_ID as string) || "";
    const GITHUB_TOKEN =
      ((import.meta as any).env?.VITE_GH_PAT as string) || "";
    const GIST_API_URL = GIST_ID
      ? `https://api.github.com/gists/${GIST_ID}`
      : "";

    if (!GIST_ID || !GITHUB_TOKEN || !GIST_API_URL) return;

    try {
      const res = await fetch(`${GIST_API_URL}?t=${Date.now()}`, {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "RabbitTV-App",
        },
        cache: "no-store",
      });
      if (!res.ok) return;

      const gistData = await res.json();

      // 1. Check Fleet MOTD / Maintenance Config (admin_config.json)
      const rawConfig = gistData.files?.["admin_config.json"]?.content;
      if (rawConfig) {
        try {
          const parsedConfig: RemoteFleetAnnouncement = JSON.parse(rawConfig);
          const hasBannerText = Boolean(parsedConfig?.motdBanner?.trim());
          const isMaint = Boolean(parsedConfig?.maintenanceMode);
          const bannerStamp = String(parsedConfig?.updatedAt || "default");
          const dismissedFleet =
            localStorage.getItem(`rabtv_dismissed_fleet_${bannerStamp}`) ===
            "true";

          if ((isMaint || hasBannerText) && !dismissedFleet) {
            setFleetBanner(parsedConfig);
          } else {
            setFleetBanner(null);
          }
        } catch {
          // ignore malformed admin_config.json
        }
      }

      // 2. Check Targeted & Global Broadcast Toasts (notifications.json)
      const rawContent = gistData.files?.["notifications.json"]?.content;
      if (!rawContent) {
        setActiveToast(null);
        return;
      }

      const notifsList: NotificationItem[] = JSON.parse(rawContent);
      if (!Array.isArray(notifsList) || notifsList.length === 0) {
        setActiveToast(null);
        return;
      }

      // Get current user credentials from localStorage (supports 4 to 6 digit PINs)
      const profileName = (
        localStorage.getItem("rabtv_profile_name") || ""
      )
        .toLowerCase()
        .trim();
      const userAge = String(getSavedUserAge() || "").trim();
      const userPin = String(localStorage.getItem(AGE_LOCK_KEY) || "").trim();

      // Sort newest-first and skip any notification this device already dismissed
      const sortedNotifs = [...notifsList].sort(
        (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
      );

      const matched = sortedNotifs.find((n) => {
        if (!n || !n.id || !n.target) return false;
        const alreadyDismissed =
          localStorage.getItem(`rabtv_dismissed_notif_${n.id}`) === "true";
        if (alreadyDismissed) return false;

        const t = n.target.toLowerCase().trim();
        if (t === "all" || t === "*") return true;
        if (profileName && (t === profileName || t.includes(profileName))) {
          return true;
        }
        if (userAge && (t === userAge || t.includes(`(${userAge})`))) {
          return true;
        }
        if (userPin && t === userPin) return true;
        return false;
      });

      setActiveToast(matched || null);
    } catch (err) {
      console.error("Failed to poll notifications", err);
    }
  }, []);

  useEffect(() => {
    void checkNotifications();
    const interval = window.setInterval(checkNotifications, 30000);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void checkNotifications();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [checkNotifications]);

  const handleDismissToast = () => {
    if (activeToast) {
      localStorage.setItem(`rabtv_dismissed_notif_${activeToast.id}`, "true");
      setActiveToast(null);
      // Immediately check if another unread toast is waiting in the queue
      void checkNotifications();
    }
  };

  const handleDismissFleetBanner = () => {
    if (fleetBanner) {
      const stamp = String(fleetBanner.updatedAt || "default");
      localStorage.setItem(`rabtv_dismissed_fleet_${stamp}`, "true");
      setFleetBanner(null);
    }
  };

  const isLowRam = getHardwareLimits().effectiveMode === "low";
  if (!activeToast && !fleetBanner) return null;

  // Determine severity styling for active toast
  const rawMsg = activeToast?.message || "";
  const effectiveSeverity: ToastSeverity =
    activeToast?.severity ||
    (rawMsg.includes("🚨") || rawMsg.toLowerCase().includes("[urgent]")
      ? "critical"
      : rawMsg.includes("⚠️")
        ? "warning"
        : "info");

  const severityStyles =
    effectiveSeverity === "critical"
      ? {
          border:
            "border-red-400 shadow-[0_20px_50px_rgba(0,0,0,0.95),0_0_35px_rgba(239,68,68,0.65)]",
          badgeBg: "bg-red-600/30 border-red-400/60 text-red-200",
          titleColor: "text-red-300",
          titleText: "🚨 Critical Admin Broadcast",
          icon: "🚨",
        }
      : effectiveSeverity === "warning"
        ? {
            border:
              "border-amber-400/80 shadow-[0_20px_50px_rgba(0,0,0,0.95),0_0_30px_rgba(245,158,11,0.5)]",
            badgeBg: "bg-amber-500/25 border-amber-400/50 text-amber-200",
            titleColor: "text-amber-300",
            titleText: "⚠️ System Notice & Advisory",
            icon: "⚠️",
          }
        : {
            border:
              "border-red-500/60 shadow-[0_20px_50px_rgba(0,0,0,0.95),0_0_30px_rgba(239,68,68,0.45)]",
            badgeBg: "bg-red-600/25 border-red-500/45 text-red-300",
            titleColor: "text-red-400",
            titleText: "📢 System Announcement / Update",
            icon: "📢",
          };

  return (
    <div data-theme={appTheme} className="rabtv-un-root rabtv-vidsrc-protected fixed bottom-5 right-3 sm:right-6 z-50 flex flex-col gap-3 max-w-md w-[92vw] pointer-events-none">
      <style>{USER_NOTIFIER_STYLES}</style>

      {/* 1. Fleet MOTD / Maintenance Bulletin (9-Sliced Amber Highlight Frame) */}
      {fleetBanner && (
        <div className={`rabtv-un-card pointer-events-auto rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.95)] ${isLowRam ? "" : "backdrop-blur-xl"}`}>
          <div className="rabtv-un-9slice rabtv-un-9slice--fleet" aria-hidden="true" />
          <div className="relative z-10 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 border border-amber-400/50 text-lg">
                🛡️
              </div>
              <div className="space-y-1 min-w-0">
                <h4 className="text-[11px] font-black uppercase tracking-wider text-amber-300">
                  {fleetBanner.maintenanceMode
                    ? "⚡ System Maintenance Active"
                    : "🌐 RABBiT TV Bulletin"}
                </h4>
                <p className="text-xs text-slate-100 font-semibold leading-relaxed break-words">
                  {fleetBanner.motdBanner ||
                    "Scheduled maintenance is currently in progress. Some streams may briefly resync."}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDismissFleetBanner}
              aria-label="Dismiss Bulletin"
              style={{ backgroundImage: `url(${IMG_UN_BTN_IDLE})`, backgroundSize: "100% 100%" }}
              className="rounded-lg px-2.5 py-1 text-xs font-black text-white hover:brightness-125 transition shrink-0 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 2. Targeted or Global Push Toast (9-Sliced Armored Frame) */}
      {activeToast && (
        <div
          className={`rabtv-un-card pointer-events-auto rounded-2xl ${isLowRam ? "" : "backdrop-blur-xl"} transition-all duration-300 ${severityStyles.border}`}
        >
          <div className="rabtv-un-9slice" aria-hidden="true" />
          <div className="relative z-10 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border font-bold text-lg shadow-lg ${severityStyles.badgeBg}`}
              >
                {severityStyles.icon}
              </div>
              <div className="space-y-1.5 min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full bg-black/75 border border-white/15 px-2.5 py-0.5">
                  <span
                    className={`text-[10px] font-black uppercase tracking-wider ${severityStyles.titleColor}`}
                  >
                    {severityStyles.titleText}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-white font-semibold leading-relaxed break-words drop-shadow">
                  {activeToast.message}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDismissToast}
              aria-label="Dismiss Notification"
              style={{ backgroundImage: `url(${IMG_UN_BTN_IDLE})`, backgroundSize: "100% 100%" }}
              className="rounded-lg px-2.5 py-1.5 text-xs font-black text-white hover:brightness-125 transition shrink-0 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}