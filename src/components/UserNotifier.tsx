// src/components/UserNotifier.tsx
import React, { useEffect, useState } from "react";
import { getSavedUserAge } from "@/lib/settings";

interface NotificationItem {
  id: string;
  target: string;
  message: string;
  timestamp: number;
}

interface UserNotifierProps {
  appTheme: string;
}

const AGE_LOCK_KEY = "rabtv_age_passcode";

export function UserNotifier({ appTheme }: UserNotifierProps) {
  const [activeToast, setActiveToast] = useState<NotificationItem | null>(null);

  useEffect(() => {
    const GIST_ID = (import.meta as any).env?.VITE_GIST_ID as string || "";
    const GITHUB_TOKEN = (import.meta as any).env?.VITE_GH_PAT as string || "";
    const GIST_API_URL = GIST_ID ? `https://api.github.com/gists/${GIST_ID}` : "";

    if (!GIST_ID || !GITHUB_TOKEN || !GIST_API_URL) return;

    const checkNotifications = async () => {
      try {
        const res = await fetch(`${GIST_API_URL}?t=${Date.now()}`, {
          headers: {
            Accept: "application/vnd.github+json",
            "User-Agent": "RabbitTV-App"
          }
        });
        if (!res.ok) return;

        const gistData = await res.json();
        const rawContent = gistData.files?.["notifications.json"]?.content;
        if (!rawContent) return;

        const notifsList: NotificationItem[] = JSON.parse(rawContent);
        if (!Array.isArray(notifsList) || notifsList.length === 0) return;

        // Get current user credentials from localStorage
        const profileName = (localStorage.getItem("rabtv_profile_name") || "").toLowerCase().trim();
        const userAge = String(getSavedUserAge() || "").trim();
        const userPin = String(localStorage.getItem(AGE_LOCK_KEY) || "").trim();

        // Check if any notification targets this user
        // Target can match name, age, PIN, or "all" / "*"
        const matched = notifsList.find((n) => {
          const t = n.target.toLowerCase().trim();
          if (t === "all" || t === "*") return true;
          if (profileName && t.includes(profileName)) return true;
          if (userAge && t === userAge) return true;
          if (userPin && t === userPin) return true;
          return false;
        });

        if (matched) {
          // Check if we already dismissed this specific notification ID locally
          const dismissedId = localStorage.getItem(`rabtv_dismissed_notif_${matched.id}`);
          if (!dismissedId) {
            setActiveToast(matched);
          }
        }
      } catch (err) {
        console.error("Failed to poll notifications", err);
      }
    };

    // Check immediately on mount, then every 30 seconds
    void checkNotifications();
    const interval = setInterval(checkNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleDismiss = () => {
    if (activeToast) {
      localStorage.setItem(`rabtv_dismissed_notif_${activeToast.id}`, "true");
      setActiveToast(null);
    }
  };

  if (!activeToast) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md w-[90vw] rounded-2xl bg-slate-900/95 border-2 border-red-500/60 p-4 shadow-[0_0_30px_rgba(239,68,68,0.4)] backdrop-blur-2xl animate-bounce-short">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-600/20 border border-red-500/40 text-red-400 font-bold text-lg">
            📢
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-black uppercase tracking-wider text-red-400">
              System Announcement / Update
            </h4>
            <p className="text-xs text-slate-100 font-medium leading-relaxed">
              {activeToast.message}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-lg bg-white/10 hover:bg-white/20 p-1.5 text-slate-300 hover:text-white transition"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
