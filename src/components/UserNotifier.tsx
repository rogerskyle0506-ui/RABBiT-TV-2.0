// src/components/UserNotifier.tsx
import React, { useEffect, useState, useCallback } from "react";
import { getSavedUserAge } from "@/lib/settings";

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
const RABBIT_HEADER_PILL =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/rabbit-header-pill.jpg";
const RABBIT_PANEL_ALT =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/rabbit-panel-alt.jpg";

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
    <div className="rabtv-vidsrc-protected fixed bottom-5 right-4 sm:right-6 z-50 flex flex-col gap-3 max-w-md w-[92vw] pointer-events-none">
      {/* 1. Fleet MOTD / Maintenance Banner (if active in admin_config.json) */}
      {fleetBanner && (
        <div className="pointer-events-auto relative overflow-hidden rounded-3xl bg-slate-950/85 border-2 border-amber-400/70 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.95),0_0_30px_rgba(245,158,11,0.45)] backdrop-blur-2xl">
          <div
            className="absolute inset-0 pointer-events-none z-0 opacity-70 mix-blend-lighten"
            style={{
              backgroundImage: `url(${RABBIT_PANEL_ALT})`,
              backgroundSize: "100% 100%",
              backgroundRepeat: "no-repeat",
            }}
          />
          <div className="relative z-10 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500/25 border border-amber-400/50 text-lg shadow-[0_0_15px_rgba(245,158,11,0.4)]">
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
              className="rounded-xl bg-black/60 hover:bg-red-600 border border-white/15 hover:border-red-300 px-2.5 py-1 text-xs font-bold text-slate-200 hover:text-white transition shrink-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400"
              aria-label="Dismiss Bulletin"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 2. Targeted or Global Push Toast (notifications.json) */}
      {activeToast && (
        <div
          className={`pointer-events-auto relative overflow-hidden rounded-3xl bg-slate-950/85 border-2 p-4 backdrop-blur-2xl transition-all duration-300 ${severityStyles.border}`}
        >
          {/* Crystal Neon Frame Layer */}
          <div
            className="absolute inset-0 pointer-events-none z-0 opacity-75 mix-blend-lighten"
            style={{
              backgroundImage: `url(${RABBIT_PANEL_ALT})`,
              backgroundSize: "100% 100%",
              backgroundRepeat: "no-repeat",
            }}
          />

          <div className="relative z-10 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border font-bold text-lg shadow-lg ${severityStyles.badgeBg}`}
              >
                {severityStyles.icon}
              </div>
              <div className="space-y-1.5 min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full bg-black/60 border border-white/10 px-2.5 py-0.5">
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
              className="rounded-xl bg-black/65 hover:bg-red-600 border border-white/15 hover:border-red-300 px-2.5 py-1.5 text-xs font-extrabold text-slate-200 hover:text-white transition transform hover:scale-105 active:scale-95 shrink-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-400"
              aria-label="Dismiss Notification"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
