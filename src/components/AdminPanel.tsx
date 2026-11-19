// src/components/AdminPanel.tsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import { AdminBugInbox } from "@/components/AdminBugInbox";
import {
  AppTheme,
  verifyAgeLockPin,
  getPinLockoutState,
  recordPinFailure,
  resetPinFailures,
  isValidAgeLockPin,
} from "@/lib/settings";

interface AdminPanelProps {
  appTheme: AppTheme;
  getPrimaryBgColor: (theme: AppTheme) => string;
  getPrimaryAccentColor: (theme: AppTheme) => string;
}

const RABBIT_HEADER_PILL =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/rabbit-header-pill.jpg";
const RABBIT_DIVIDER =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/rabbit-divider.jpg";

const BROKEN_LINKS_STORAGE_KEY = "rabtv_broken_links";
const ADMIN_VAULT_LOCKED_KEY = "rabtv_admin_vault_locked";

type AdminSection = "inbox" | "toast" | "keygen" | "fleet" | null;
type ToastSeverity = "info" | "warning" | "critical";
type KeyFilterMode = "all" | "active" | "used";

interface RemoteFleetConfig {
  allowTrials: boolean;
  maintenanceMode: boolean;
  motdBanner: string;
  minAppVersion: string;
  updatedAt: number;
}

export function AdminPanel({
  appTheme,
  getPrimaryBgColor,
  getPrimaryAccentColor,
}: AdminPanelProps) {
  void appTheme;
  void getPrimaryBgColor;
  void getPrimaryAccentColor;

  // Admin Security Vault Lock States
  const [isVaultLocked, setIsVaultLocked] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem(ADMIN_VAULT_LOCKED_KEY) === "true";
    }
    return false;
  });
  const [vaultPinInput, setVaultPinInput] = useState("");
  const [vaultError, setVaultError] = useState<string | null>(null);

  // Key Generator & Manager States
  const [keygenName, setKeygenName] = useState("");
  const [keygenAge, setKeygenAge] = useState("");
  const [keygenResult, setKeygenResult] = useState<string | null>(null);
  const [lastGeneratedKey, setLastGeneratedKey] = useState<string | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [remoteKeys, setRemoteKeys] = useState<any[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [keySearchQuery, setKeySearchQuery] = useState("");
  const [keyFilterMode, setKeyFilterMode] = useState<KeyFilterMode>("all");

  // Target User Messaging / Toast Notification States
  const [targetQuery, setTargetQuery] = useState("");
  const [targetMessage, setTargetMessage] = useState("");
  const [toastSeverity, setToastSeverity] = useState<ToastSeverity>("info");
  const [toastPushStatus, setToastPushStatus] = useState<string | null>(null);
  const [activeNotifs, setActiveNotifs] = useState<any[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);

  // Fleet Command & Remote Config States
  const [fleetConfig, setFleetConfig] = useState<RemoteFleetConfig>({
    allowTrials: true,
    maintenanceMode: false,
    motdBanner: "",
    minAppVersion: "1.2.0",
    updatedAt: Date.now(),
  });
  const [fleetSyncStatus, setFleetSyncStatus] = useState<string | null>(null);
  const [brokenLinksCount, setBrokenLinksCount] = useState<number>(0);

  const [activeAdminSection, setActiveAdminSection] =
    useState<AdminSection>(null);

  const inactivityTimerRef = useRef<number | null>(null);

  const getGistCredentials = () => {
    const GIST_ID = ((import.meta as any).env?.VITE_GIST_ID as string) || "";
    const GITHUB_TOKEN =
      ((import.meta as any).env?.VITE_GH_PAT as string) || "";
    const GIST_API_URL = GIST_ID
      ? `https://api.github.com/gists/${GIST_ID}`
      : "";
    return { GIST_ID, GITHUB_TOKEN, GIST_API_URL };
  };

  // Auto-lock Admin Vault after 5 minutes of inactivity
  const resetInactivityTimer = () => {
    if (inactivityTimerRef.current) {
      window.clearTimeout(inactivityTimerRef.current);
    }
    if (!isVaultLocked) {
      inactivityTimerRef.current = window.setTimeout(() => {
        setIsVaultLocked(true);
        if (typeof window !== "undefined") {
          sessionStorage.setItem(ADMIN_VAULT_LOCKED_KEY, "true");
        }
      }, 5 * 60 * 1000);
    }
  };

  useEffect(() => {
    resetInactivityTimer();
    return () => {
      if (inactivityTimerRef.current) {
        window.clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [isVaultLocked, activeAdminSection]);

  const refreshLocalBrokenLinksCount = () => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(BROKEN_LINKS_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      setBrokenLinksCount(Array.isArray(parsed) ? parsed.length : 0);
    } catch {
      setBrokenLinksCount(0);
    }
  };

  const fetchRemoteAdminData = async () => {
    const { GIST_ID, GITHUB_TOKEN, GIST_API_URL } = getGistCredentials();
    if (!GIST_ID || !GITHUB_TOKEN || !GIST_API_URL) return;

    setLoadingKeys(true);
    setLoadingNotifs(true);
    try {
      const res = await fetch(`${GIST_API_URL}?t=${Date.now()}`, {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "RabbitTV-App",
        },
        cache: "no-store",
      });
      if (res.ok) {
        const gistData = await res.json();

        const rawKeys = gistData.files?.["keys.json"]?.content;
        if (rawKeys) {
          try {
            const parsedKeys = JSON.parse(rawKeys);
            if (Array.isArray(parsedKeys)) {
              const normalized = parsedKeys.map((item: any) =>
                typeof item === "object" && item !== null
                  ? item
                  : { key: String(item), active: true, owner: "Legacy" }
              );
              setRemoteKeys(normalized);
            }
          } catch {
            // ignore
          }
        }

        const rawNotifs = gistData.files?.["notifications.json"]?.content;
        if (rawNotifs) {
          try {
            const parsedNotifs = JSON.parse(rawNotifs);
            if (Array.isArray(parsedNotifs)) {
              setActiveNotifs(parsedNotifs);
            }
          } catch {
            setActiveNotifs([]);
          }
        }

        const rawConfig = gistData.files?.["admin_config.json"]?.content;
        if (rawConfig) {
          try {
            const parsedConfig = JSON.parse(rawConfig);
            if (parsedConfig && typeof parsedConfig === "object") {
              setFleetConfig((prev) => ({ ...prev, ...parsedConfig }));
            }
          } catch {
            // ignore
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch remote admin Gist data", err);
    } finally {
      setLoadingKeys(false);
      setLoadingNotifs(false);
    }
  };

  useEffect(() => {
    void fetchRemoteAdminData();
    refreshLocalBrokenLinksCount();
  }, []);

  const uniqueUsers = useMemo(
    () =>
      Array.from(
        new Set(
          remoteKeys
            .map((k) => k.owner || k.usedBy)
            .filter(
              (u) =>
                u &&
                u !== "Legacy" &&
                u !== "Admin Recycled" &&
                u !== "Unassigned"
            )
        )
      ),
    [remoteKeys]
  );

  const keyStats = useMemo(() => {
    let activeCount = 0;
    let usedCount = 0;
    for (const k of remoteKeys) {
      if (k.active) activeCount++;
      else usedCount++;
    }
    return {
      total: remoteKeys.length,
      active: activeCount,
      used: usedCount,
    };
  }, [remoteKeys]);

  const filteredKeys = useMemo(() => {
    return remoteKeys.filter((kObj) => {
      if (keyFilterMode === "active" && !kObj.active) return false;
      if (keyFilterMode === "used" && kObj.active) return false;

      if (keySearchQuery.trim()) {
        const q = keySearchQuery.trim().toLowerCase();
        const keyMatch = String(kObj.key || "")
          .toLowerCase()
          .includes(q);
        const ownerMatch = String(kObj.owner || kObj.usedBy || "")
          .toLowerCase()
          .includes(q);
        return keyMatch || ownerMatch;
      }
      return true;
    });
  }, [remoteKeys, keyFilterMode, keySearchQuery]);

  // Vault Lock & 4-6 Digit Hashed PIN Unlock Handlers
  const handleLockVault = () => {
    setIsVaultLocked(true);
    setVaultPinInput("");
    setVaultError(null);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(ADMIN_VAULT_LOCKED_KEY, "true");
    }
  };

  const handleUnlockVault = async (e: React.FormEvent) => {
    e.preventDefault();
    const lockState = getPinLockoutState();
    if (lockState.isLocked) {
      setVaultError(
        `⏳ Too many failed attempts. Wait ${lockState.remainingSeconds}s.`
      );
      return;
    }

    if (!isValidAgeLockPin(vaultPinInput)) {
      setVaultError("⚠️ Enter your 4 to 6 digit security PIN.");
      return;
    }

    const valid = await verifyAgeLockPin(vaultPinInput);
    if (valid) {
      resetPinFailures();
      setIsVaultLocked(false);
      setVaultPinInput("");
      setVaultError(null);
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(ADMIN_VAULT_LOCKED_KEY);
      }
    } else {
      const next = recordPinFailure();
      setVaultPinInput("");
      if (next.isLocked) {
        setVaultError(
          `🚨 Vault locked for ${next.remainingSeconds}s due to failed PIN attempts.`
        );
      } else {
        setVaultError(
          `❌ Incorrect Admin PIN (${next.attemptsLeft} attempts left).`
        );
      }
    }
  };

  const handleStepDownAdmin = () => {
    if (typeof window === "undefined") return;
    localStorage.setItem("rabtv_is_admin", "false");
    window.dispatchEvent(new Event("rabtv_settings_updated"));
  };

  const handleCopyKey = async (keyStr: string) => {
    try {
      await navigator.clipboard.writeText(keyStr);
      setCopiedKeyId(keyStr);
      window.setTimeout(() => setCopiedKeyId(null), 2000);
    } catch {
      // ignore clipboard errors on TV WebViews
    }
  };

  const handleExportKeysBackup = () => {
    const blob = new Blob([JSON.stringify(remoteKeys, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rabtv_admin_keys_backup_${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleKeygen = async (e: React.FormEvent) => {
    e.preventDefault();
    resetInactivityTimer();
    const { GIST_ID, GITHUB_TOKEN, GIST_API_URL } = getGistCredentials();

    if (!GIST_ID || !GITHUB_TOKEN || !GIST_API_URL) {
      setKeygenResult(
        "⚠️ GIST_ID or VITE_GH_PAT is missing from environment secrets."
      );
      return;
    }
    const age = parseInt(keygenAge.trim(), 10);
    if (!keygenName.trim() || isNaN(age) || age < 1 || age > 120) {
      setKeygenResult("Enter a valid name and age (1–120).");
      return;
    }

    const randomEntropy =
      typeof window !== "undefined" && window.crypto
        ? window.crypto.getRandomValues(new Uint32Array(1))[0]
        : Math.floor(Math.random() * 1000000);
    const rawKeyString = `${keygenName
      .trim()
      .toLowerCase()}-${age}-${Date.now()}-${randomEntropy}`;
    const generatedKey = Math.abs(
      rawKeyString
        .split("")
        .reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0)
    ).toString();

    setLastGeneratedKey(generatedKey);
    setKeygenResult(
      `Generated Key: ${generatedKey} — Pushing directly to Gist...`
    );

    try {
      const getRes = await fetch(GIST_API_URL, {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "RabbitTV-App",
        },
        cache: "no-store",
      });

      let keysList: any[] = [];
      if (getRes.ok) {
        const gistData = await getRes.json();
        const rawContent = gistData.files?.["keys.json"]?.content;
        try {
          keysList = JSON.parse(rawContent);
          if (!Array.isArray(keysList)) keysList = [];
        } catch {
          keysList = [];
        }
      }

      const stringKey = String(generatedKey);
      const newKeyObj = {
        key: stringKey,
        active: true,
        owner: `${keygenName.trim()} (${age})`,
        createdAt: new Date().toISOString(),
      };
      keysList.push(newKeyObj);

      const patchRes = await fetch(GIST_API_URL, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "User-Agent": "RabbitTV-App",
        },
        body: JSON.stringify({
          files: {
            "keys.json": {
              content: JSON.stringify(keysList, null, 2),
            },
          },
        }),
      });

      const patchData = await patchRes.json();

      if (patchRes.ok) {
        setKeygenResult(`✅ Key [${stringKey}] Committed & Activated!`);
        setKeygenName("");
        setKeygenAge("");
        void fetchRemoteAdminData();
      } else {
        setKeygenResult(
          `⚠️ Gist Commit Failed: ${
            patchData.message || JSON.stringify(patchData)
          }`
        );
      }
    } catch (error: any) {
      console.error("Error pushing directly to Gist:", error);
      setKeygenResult(`⚠️ Network Error: ${error.message || error}`);
    }
  };

  const handleModifyKeyStatus = async (
    targetKey: string,
    action: "toggle" | "delete"
  ) => {
    resetInactivityTimer();
    const { GIST_ID, GITHUB_TOKEN, GIST_API_URL } = getGistCredentials();
    if (!GIST_ID || !GITHUB_TOKEN || !GIST_API_URL) return;

    try {
      const res = await fetch(GIST_API_URL, {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "RabbitTV-App",
        },
        cache: "no-store",
      });
      if (!res.ok) return;
      const gistData = await res.json();
      let keysList = JSON.parse(gistData.files?.["keys.json"]?.content);

      keysList = keysList
        .map((item: any) => {
          const kVal = typeof item === "object" ? item.key : item;
          if (String(kVal) === String(targetKey)) {
            if (action === "delete") return null;
            const currentActive =
              typeof item === "object" ? item.active : true;
            return {
              ...item,
              key: kVal,
              active: !currentActive,
              owner: item.owner || item.usedBy || "Admin Recycled",
            };
          }
          return item;
        })
        .filter(Boolean);

      const patchRes = await fetch(GIST_API_URL, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "User-Agent": "RabbitTV-App",
        },
        body: JSON.stringify({
          files: {
            "keys.json": {
              content: JSON.stringify(keysList, null, 2),
            },
          },
        }),
      });

      if (patchRes.ok) {
        void fetchRemoteAdminData();
      }
    } catch (err) {
      console.error("Error updating key status", err);
    }
  };

  const handlePushTargetToast = async (e: React.FormEvent) => {
    e.preventDefault();
    resetInactivityTimer();
    const { GIST_ID, GITHUB_TOKEN, GIST_API_URL } = getGistCredentials();

    if (!GIST_ID || !GITHUB_TOKEN || !GIST_API_URL) {
      setToastPushStatus("⚠️ Gist credentials missing.");
      return;
    }
    if (!targetQuery.trim() || !targetMessage.trim()) {
      setToastPushStatus(
        "⚠️ Provide target (ALL / Name / PIN / Age) and message."
      );
      return;
    }

    setToastPushStatus("Pushing notification toast...");
    try {
      const getRes = await fetch(GIST_API_URL, {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "RabbitTV-App",
        },
        cache: "no-store",
      });

      let currentFiles: any = {};
      if (getRes.ok) {
        const gistData = await getRes.json();
        currentFiles = gistData.files || {};
      }

      let notifsList: any[] = [];
      if (currentFiles["notifications.json"]?.content) {
        try {
          notifsList = JSON.parse(currentFiles["notifications.json"].content);
          if (!Array.isArray(notifsList)) notifsList = [];
        } catch {
          notifsList = [];
        }
      }

      const prefix =
        toastSeverity === "critical"
          ? "🚨 [URGENT] "
          : toastSeverity === "warning"
            ? "⚠️ "
            : "";

      const newToast = {
        target: targetQuery.trim(),
        message: `${prefix}${targetMessage.trim()}`,
        severity: toastSeverity,
        timestamp: Date.now(),
        id: Math.random().toString(36).substring(2, 9),
      };

      notifsList.push(newToast);

      const patchRes = await fetch(GIST_API_URL, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "User-Agent": "RabbitTV-App",
        },
        body: JSON.stringify({
          files: {
            "notifications.json": {
              content: JSON.stringify(notifsList, null, 2),
            },
          },
        }),
      });

      if (patchRes.ok) {
        setToastPushStatus(`✅ Toast pushed to [${targetQuery.trim()}]`);
        setTargetMessage("");
        setActiveNotifs(notifsList);
        window.setTimeout(() => setToastPushStatus(null), 4000);
      } else {
        setToastPushStatus("⚠️ Failed to push toast notification.");
      }
    } catch (err: any) {
      console.error("Error pushing toast", err);
      setToastPushStatus(`⚠️ Error: ${err.message || err}`);
    }
  };

  const handleDeleteNotification = async (
    toastId?: string,
    clearAll = false
  ) => {
    resetInactivityTimer();
    const { GIST_ID, GITHUB_TOKEN, GIST_API_URL } = getGistCredentials();
    if (!GIST_ID || !GITHUB_TOKEN || !GIST_API_URL) return;

    try {
      const updatedList = clearAll
        ? []
        : activeNotifs.filter((n) => n.id !== toastId);

      const patchRes = await fetch(GIST_API_URL, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "User-Agent": "RabbitTV-App",
        },
        body: JSON.stringify({
          files: {
            "notifications.json": {
              content: JSON.stringify(updatedList, null, 2),
            },
          },
        }),
      });

      if (patchRes.ok) {
        setActiveNotifs(updatedList);
        setToastPushStatus(
          clearAll ? "🗑️ Cleared all queued toasts!" : "✓ Removed toast."
        );
        window.setTimeout(() => setToastPushStatus(null), 2500);
      }
    } catch (err) {
      console.error("Failed to clear notification", err);
    }
  };

  const handleSyncFleetConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    resetInactivityTimer();
    const { GIST_ID, GITHUB_TOKEN, GIST_API_URL } = getGistCredentials();
    if (!GIST_ID || !GITHUB_TOKEN || !GIST_API_URL) {
      setFleetSyncStatus("⚠️ Gist credentials missing.");
      return;
    }

    setFleetSyncStatus("Syncing remote fleet config to Gist...");
    try {
      const payload: RemoteFleetConfig = {
        ...fleetConfig,
        updatedAt: Date.now(),
      };

      const patchRes = await fetch(GIST_API_URL, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "User-Agent": "RabbitTV-App",
        },
        body: JSON.stringify({
          files: {
            "admin_config.json": {
              content: JSON.stringify(payload, null, 2),
            },
          },
        }),
      });

      if (patchRes.ok) {
        setFleetSyncStatus("✅ Fleet Policies Synced to Gist!");
        window.setTimeout(() => setFleetSyncStatus(null), 3500);
      } else {
        setFleetSyncStatus("⚠️ Failed to sync fleet config.");
      }
    } catch (err: any) {
      setFleetSyncStatus(`⚠️ Error: ${err.message || err}`);
    }
  };

  const handleClearQuarantinedBrokenLinks = () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(BROKEN_LINKS_STORAGE_KEY);
    refreshLocalBrokenLinksCount();
    window.dispatchEvent(new Event("rabtv_broken_links_updated"));
    window.dispatchEvent(new Event("rabtv_catalog_updated"));
    setFleetSyncStatus("✓ Restored all locally reported broken titles!");
    window.setTimeout(() => setFleetSyncStatus(null), 3000);
  };

  // Clean Crystal Crimson Glass Panel class (no distorted stretched JPG lines cutting across text)
  const crimsonSubPanelClass =
    "relative w-full p-3.5 sm:p-4 rounded-2xl mt-2 shadow-[0_12px_35px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(239,68,68,0.12)] overflow-hidden box-border backdrop-blur-xl bg-slate-950/85 border border-red-500/40 space-y-3";

  /**
   * Renders a Crystal Crimson Admin Accordion Pill with concise non-truncating title & 3D hover/focus pop-out.
   */
  const renderCrimsonAccordionButton = (
    sectionId: AdminSection,
    icon: string,
    title: string,
    badgeText?: string
  ) => {
    const isActive = activeAdminSection === sectionId;
    return (
      <button
        type="button"
        onClick={() => {
          resetInactivityTimer();
          setActiveAdminSection(isActive ? null : sectionId);
        }}
        className={`crystal-admin-pill w-full flex items-center justify-between gap-2 px-4 py-3 text-left text-xs font-extrabold text-red-100 relative overflow-hidden rounded-2xl border border-red-500/35 cursor-pointer box-border transition-all duration-200 ease-out hover:scale-[1.03] focus:scale-[1.04] hover:-translate-y-0.5 focus:-translate-y-0.5 active:scale-[0.98] focus:outline-none ${
          isActive
            ? "ring-2 ring-red-400 shadow-[0_0_24px_rgba(239,68,68,0.5)]"
            : "hover:border-red-400/70 hover:shadow-[0_8px_22px_rgba(239,68,68,0.35)] focus:ring-2 focus:ring-red-400"
        }`}
      >
        <div
          className="absolute inset-0 pointer-events-none z-0 opacity-85"
          style={{
            backgroundImage: `url(${RABBIT_HEADER_PILL})`,
            backgroundSize: "130% 100%",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center center",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-red-950/80 via-red-900/50 to-red-950/80 backdrop-blur-[3px] w-full h-full" />
        </div>

        <span className="relative z-10 flex items-center gap-2 min-w-0 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
          <span className="text-sm shrink-0">{icon}</span>
          <span className="truncate">{title}</span>
        </span>

        <div className="relative z-10 flex items-center gap-1.5 shrink-0">
          {badgeText && (
            <span className="rounded-full bg-black/70 border border-red-400/40 px-2 py-0.5 text-[9px] font-black text-amber-300">
              {badgeText}
            </span>
          )}
          <span
            className={`text-[10px] text-red-300 transform transition-transform duration-200 ${
              isActive ? "rotate-180" : ""
            }`}
          >
            ▼
          </span>
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-3 w-full box-border">
      {/* Executive Command Header — Stacked cleanly so title NEVER truncates */}
      <div className="rounded-2xl bg-gradient-to-r from-red-950/80 via-black/85 to-red-950/80 border border-red-500/45 p-3 shadow-[0_0_20px_rgba(239,68,68,0.25)] backdrop-blur-xl space-y-2.5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-600/30 border border-red-400/50 text-sm shadow-[0_0_10px_rgba(239,68,68,0.6)]">
            🔐
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-xs font-black uppercase tracking-wider text-red-300">
              Admin Command Center
            </h3>
            <span className="block text-[10px] text-amber-300/95 font-bold">
              {isVaultLocked
                ? "● Vault Locked"
                : `● ${keyStats.active} Active Keys • ${activeNotifs.length} Toasts`}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {!isVaultLocked ? (
            <button
              type="button"
              onClick={handleLockVault}
              className="py-1.5 px-2.5 rounded-xl bg-red-950/85 hover:bg-red-800 border border-red-400/40 text-[11px] font-extrabold text-red-100 transition cursor-pointer"
              title="Lock Admin Controls with PIN"
            >
              🔒 Lock Vault
            </button>
          ) : (
            <div className="py-1.5 px-2.5 rounded-xl bg-black/60 border border-red-500/30 text-[10px] font-bold text-red-300 text-center">
              🛡️ Locked
            </div>
          )}
          <button
            type="button"
            onClick={handleStepDownAdmin}
            className="py-1.5 px-2.5 rounded-xl bg-black/75 hover:bg-red-600 border border-white/15 hover:border-red-300 text-[11px] font-bold text-slate-200 hover:text-white transition cursor-pointer"
            title="Exit Admin Mode on this device"
          >
            🚪 Exit Admin
          </button>
        </div>
      </div>

      {/* SECURITY VAULT PIN GATE (Supports 4–6 Digit Fire Stick PINs) */}
      {isVaultLocked ? (
        <div className={`${crimsonSubPanelClass} text-center py-5`}>
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-red-600/25 border border-red-400/50 text-lg shadow-[0_0_15px_rgba(239,68,68,0.5)]">
            🛡️
          </div>
          <h4 className="text-xs font-black uppercase tracking-wider text-red-200">
            Admin Vault Locked
          </h4>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Enter your 4–6 digit security PIN to unlock Keygen, Broadcasts, and
            Fleet Controls.
          </p>
          <form onSubmit={handleUnlockVault} className="space-y-2.5 pt-1">
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="••••••"
              value={vaultPinInput}
              onChange={(e) =>
                setVaultPinInput(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              className="w-40 mx-auto block text-center rounded-xl border border-red-500/40 bg-black/80 px-3 py-2 text-sm font-black text-white tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 text-white text-xs font-extrabold shadow-lg shadow-red-600/30 transition hover:scale-[1.02] cursor-pointer"
            >
              🔓 Unlock Command Center
            </button>
          </form>
          {vaultError && (
            <p className="text-[11px] font-bold text-amber-300">{vaultError}</p>
          )}
        </div>
      ) : (
        <div className="space-y-2.5 w-full box-border">
          {/* 1. BUG REPORTS INBOX */}
          <div className="w-full box-border">
            {renderCrimsonAccordionButton("inbox", "🐞", "Bug Reports Inbox")}
            {activeAdminSection === "inbox" && (
              <div className={crimsonSubPanelClass}>
                <AdminBugInbox />
              </div>
            )}
          </div>

          {/* 2. PUSH TOAST & BROADCASTS */}
          <div className="w-full box-border">
            {renderCrimsonAccordionButton(
              "toast",
              "📢",
              "Push Toasts & Alerts",
              activeNotifs.length > 0 ? `${activeNotifs.length}` : undefined
            )}
            {activeAdminSection === "toast" && (
              <div className={crimsonSubPanelClass}>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-red-300">
                      Target Recipient
                    </span>
                    <button
                      type="button"
                      onClick={() => setTargetQuery("ALL")}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition cursor-pointer ${
                        targetQuery.toUpperCase() === "ALL"
                          ? "bg-red-600 text-white shadow-[0_0_12px_rgba(239,68,68,0.6)]"
                          : "bg-red-950/80 border border-red-500/40 text-red-200 hover:bg-red-900/80"
                      }`}
                    >
                      🌐 All Users
                    </button>
                  </div>

                  <form
                    onSubmit={handlePushTargetToast}
                    className="space-y-2.5 w-full box-border"
                  >
                    {uniqueUsers.length > 0 && (
                      <select
                        value={
                          uniqueUsers.includes(targetQuery) ? targetQuery : ""
                        }
                        onChange={(e) => setTargetQuery(e.target.value)}
                        className="w-full rounded-xl border border-red-500/35 bg-black/80 px-3 py-2 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-red-400 cursor-pointer box-border"
                      >
                        <option value="">
                          Pick user ({uniqueUsers.length})...
                        </option>
                        {uniqueUsers.map((user) => (
                          <option
                            key={user}
                            value={user}
                            className="bg-slate-950 text-white"
                          >
                            👤 {user}
                          </option>
                        ))}
                      </select>
                    )}

                    <input
                      type="text"
                      placeholder="Target: ALL, Name, PIN, or Age"
                      value={targetQuery}
                      onChange={(e) => setTargetQuery(e.target.value)}
                      className="w-full rounded-xl border border-red-500/35 bg-black/80 px-3 py-2 text-xs font-bold text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-400 box-border"
                    />

                    {/* Alert Severity Level */}
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { id: "info", label: "🔔 Info" },
                          { id: "warning", label: "⚠️ Warn" },
                          { id: "critical", label: "🚨 Urgent" },
                        ] as { id: ToastSeverity; label: string }[]
                      ).map((sev) => (
                        <button
                          key={sev.id}
                          type="button"
                          onClick={() => setToastSeverity(sev.id)}
                          className={`py-1.5 px-1 rounded-xl text-[10px] font-extrabold transition cursor-pointer ${
                            toastSeverity === sev.id
                              ? "bg-gradient-to-r from-red-600 to-orange-600 text-white shadow-md"
                              : "bg-black/70 border border-red-500/30 text-red-200 hover:bg-red-950/70"
                          }`}
                        >
                          {sev.label}
                        </button>
                      ))}
                    </div>

                    <textarea
                      rows={3}
                      placeholder="Type announcement message..."
                      value={targetMessage}
                      onChange={(e) => setTargetMessage(e.target.value)}
                      className="w-full rounded-xl border border-red-500/35 bg-black/80 px-3 py-2 text-xs font-bold text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none box-border leading-relaxed"
                    />

                    <button
                      type="submit"
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 text-white text-xs font-extrabold shadow-lg shadow-red-600/35 transition hover:scale-[1.02] active:scale-95 cursor-pointer"
                    >
                      🚀 Push Toast to User Screen
                    </button>
                  </form>

                  {toastPushStatus && (
                    <div className="rounded-xl bg-black/80 border border-red-500/40 p-2 text-center">
                      <p className="text-[11px] font-bold text-amber-300">
                        {toastPushStatus}
                      </p>
                    </div>
                  )}

                  {/* Active Gist Notifications Queue Manager */}
                  <div className="pt-2.5 border-t border-red-500/25 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-300">
                        Queued Toasts ({activeNotifs.length})
                      </span>
                      {activeNotifs.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            void handleDeleteNotification(undefined, true)
                          }
                          className="px-2 py-0.5 rounded-lg bg-red-950/80 hover:bg-red-700 border border-red-500/40 text-[9px] font-bold text-red-200 transition cursor-pointer"
                        >
                          🗑️ Purge All
                        </button>
                      )}
                    </div>

                    {loadingNotifs ? (
                      <p className="text-[10px] text-slate-400 text-center py-1">
                        Loading queue...
                      </p>
                    ) : activeNotifs.length === 0 ? (
                      <p className="text-[10px] text-slate-400 text-center py-1">
                        No active toasts queued on Gist.
                      </p>
                    ) : (
                      <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1 scrollbar-none">
                        {activeNotifs.map((n) => (
                          <div
                            key={n.id || n.timestamp}
                            className="flex items-center justify-between gap-2 rounded-xl bg-black/75 border border-red-500/25 px-2.5 py-1.5 text-[10px]"
                          >
                            <div className="min-w-0 flex-1 truncate">
                              <span className="font-extrabold text-amber-300">
                                [{n.target}]
                              </span>{" "}
                              <span className="text-slate-200">{n.message}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                void handleDeleteNotification(n.id, false)
                              }
                              className="px-1.5 py-0.5 rounded bg-red-600/40 hover:bg-red-600 text-red-100 text-[9px] font-bold shrink-0 cursor-pointer"
                              title="Delete Toast"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 3. KEY GENERATOR & LICENSES */}
          <div className="w-full box-border">
            {renderCrimsonAccordionButton(
              "keygen",
              "🔑",
              "Key Manager",
              `${keyStats.total} Keys`
            )}
            {activeAdminSection === "keygen" && (
              <div className={crimsonSubPanelClass}>
                <form
                  onSubmit={handleKeygen}
                  className="space-y-2 w-full box-border"
                >
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="User name"
                      value={keygenName}
                      onChange={(e) => setKeygenName(e.target.value)}
                      className="col-span-2 rounded-xl border border-red-500/35 bg-black/80 px-3 py-2 text-xs font-bold text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-400 box-border"
                    />
                    <input
                      type="number"
                      min={1}
                      max={120}
                      placeholder="Age"
                      value={keygenAge}
                      onChange={(e) => setKeygenAge(e.target.value)}
                      className="col-span-1 rounded-xl border border-red-500/35 bg-black/80 px-2 py-2 text-center text-xs font-bold text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-400 box-border"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 text-white text-xs font-extrabold shadow-lg shadow-red-600/35 transition hover:scale-[1.02] active:scale-95 cursor-pointer"
                  >
                    ⚡ Generate & Push Key to Gist
                  </button>
                </form>

                {keygenResult && (
                  <div className="rounded-xl bg-black/80 border border-red-500/40 p-2.5 text-center space-y-1.5">
                    <p className="text-[11px] font-bold text-amber-300 break-words">
                      {keygenResult}
                    </p>
                    {lastGeneratedKey && (
                      <button
                        type="button"
                        onClick={() => void handleCopyKey(lastGeneratedKey)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-red-600/45 hover:bg-red-600 border border-red-400/50 px-3 py-1 text-[10px] font-extrabold text-white transition cursor-pointer"
                      >
                        {copiedKeyId === lastGeneratedKey
                          ? "✓ Copied!"
                          : `📋 Copy [${lastGeneratedKey}]`}
                      </button>
                    )}
                  </div>
                )}

                {/* Key List Header & Stacked Search + 3-Col Filter Row (Zero Clipping!) */}
                <div className="pt-2.5 border-t border-red-500/25 space-y-2 w-full box-border">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-extrabold text-slate-200">
                      {keyStats.active} Active • {keyStats.used} Used
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleExportKeysBackup}
                        className="px-2.5 py-1 rounded-lg bg-black/75 border border-red-500/35 hover:bg-red-950 text-[10px] font-bold text-amber-300 transition cursor-pointer"
                      >
                        💾 Backup
                      </button>
                      <button
                        type="button"
                        onClick={() => void fetchRemoteAdminData()}
                        className="px-2.5 py-1 rounded-lg bg-red-950/80 border border-red-500/40 hover:bg-red-900/80 text-[10px] font-bold text-red-100 transition cursor-pointer"
                      >
                        {loadingKeys ? "..." : "🔄 Sync"}
                      </button>
                    </div>
                  </div>

                  {/* Full-width Search Input */}
                  <input
                    type="text"
                    value={keySearchQuery}
                    onChange={(e) => setKeySearchQuery(e.target.value)}
                    placeholder="Search user or key..."
                    className="w-full rounded-xl border border-red-500/35 bg-black/80 px-3 py-1.5 text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-red-400 box-border"
                  />

                  {/* Clean 3-Column Filter Pills (ALL / ACTIVE / USED all visible!) */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: "all", label: `All (${keyStats.total})` },
                        { id: "active", label: `Active (${keyStats.active})` },
                        { id: "used", label: `Used (${keyStats.used})` },
                      ] as { id: KeyFilterMode; label: string }[]
                    ).map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setKeyFilterMode(mode.id)}
                        className={`py-1.5 rounded-xl text-[10px] font-extrabold transition cursor-pointer ${
                          keyFilterMode === mode.id
                            ? "bg-red-600 text-white shadow"
                            : "bg-black/70 text-slate-300 hover:text-white border border-white/10"
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>

                  {/* Clean Multi-Row Key Cards (Zero Clipped Badges!) */}
                  <div className="max-h-52 overflow-y-auto space-y-2 pr-0.5 w-full box-border scrollbar-none">
                    {filteredKeys.length === 0 ? (
                      <p className="text-[11px] text-slate-400 text-center py-3">
                        No keys match your current filter.
                      </p>
                    ) : (
                      filteredKeys.map((kObj, idx) => (
                        <div
                          key={`${kObj.key}-${idx}`}
                          className="bg-black/80 p-2.5 rounded-xl border border-red-500/30 space-y-2 w-full box-border"
                        >
                          {/* Row 1: Key Number + Status Badge */}
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                void handleCopyKey(String(kObj.key))
                              }
                              className="font-mono text-xs font-black text-amber-300 hover:underline truncate cursor-pointer text-left"
                              title="Tap to copy key"
                            >
                              {kObj.key}
                            </button>
                            <span
                              className={`shrink-0 px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase ${
                                kObj.active
                                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/35"
                                  : "bg-red-500/20 text-red-300 border border-red-500/35"
                              }`}
                            >
                              {kObj.active ? "Active" : "Claimed"}
                            </span>
                          </div>

                          {/* Row 2: Owner Name */}
                          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-200">
                            <span className="truncate">
                              👤 <strong>{kObj.owner || kObj.usedBy || "Unassigned"}</strong>
                            </span>
                            {copiedKeyId === String(kObj.key) && (
                              <span className="text-[10px] text-emerald-400 font-bold shrink-0">
                                ✓ Copied
                              </span>
                            )}
                          </div>

                          {/* Row 3: Clean Action Bar */}
                          <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                            <button
                              type="button"
                              onClick={() =>
                                void handleCopyKey(String(kObj.key))
                              }
                              className="py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-100 text-[10px] font-bold transition cursor-pointer"
                            >
                              📋 Copy
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void handleModifyKeyStatus(kObj.key, "toggle")
                              }
                              className={`py-1 rounded-lg text-[10px] font-extrabold transition cursor-pointer ${
                                kObj.active
                                  ? "bg-amber-600/35 hover:bg-amber-600/60 text-amber-200"
                                  : "bg-emerald-600/35 hover:bg-emerald-600/60 text-emerald-200"
                              }`}
                            >
                              {kObj.active ? "Revoke" : "Activate"}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void handleModifyKeyStatus(kObj.key, "delete")
                              }
                              className="py-1 rounded-lg bg-red-600/45 hover:bg-red-600 text-red-100 text-[10px] font-extrabold transition cursor-pointer"
                            >
                              🗑️ Del
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 4. FLEET COMMAND & QUARANTINE */}
          <div className="w-full box-border">
            {renderCrimsonAccordionButton(
              "fleet",
              "🛡️",
              "Fleet & Quarantine"
            )}
            {activeAdminSection === "fleet" && (
              <div className={crimsonSubPanelClass}>
                <form onSubmit={handleSyncFleetConfig} className="space-y-2.5">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-red-300">
                    🌐 Remote Policies (admin_config.json)
                  </p>

                  <div className="flex items-center justify-between gap-2 rounded-xl bg-black/75 border border-red-500/30 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white">
                        Allow 7-Day Free Trials
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Disable to require a key on new installs.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setFleetConfig((prev) => ({
                          ...prev,
                          allowTrials: !prev.allowTrials,
                        }))
                      }
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                        fleetConfig.allowTrials
                          ? "bg-emerald-600"
                          : "bg-slate-700"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          fleetConfig.allowTrials
                            ? "translate-x-6"
                            : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2 rounded-xl bg-black/75 border border-red-500/30 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white">
                        Maintenance Banner
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Shows an admin notice across active apps.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setFleetConfig((prev) => ({
                          ...prev,
                          maintenanceMode: !prev.maintenanceMode,
                        }))
                      }
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                        fleetConfig.maintenanceMode
                          ? "bg-red-600"
                          : "bg-slate-700"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          fleetConfig.maintenanceMode
                            ? "translate-x-6"
                            : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Stacked inputs so placeholder text NEVER clips */}
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Global MOTD Banner Message..."
                      value={fleetConfig.motdBanner}
                      onChange={(e) =>
                        setFleetConfig((prev) => ({
                          ...prev,
                          motdBanner: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-red-500/35 bg-black/80 px-3 py-2 text-xs font-bold text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-red-400"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-300 shrink-0">
                        Min App Ver:
                      </span>
                      <input
                        type="text"
                        placeholder="1.2.0"
                        value={fleetConfig.minAppVersion}
                        onChange={(e) =>
                          setFleetConfig((prev) => ({
                            ...prev,
                            minAppVersion: e.target.value,
                          }))
                        }
                        className="flex-1 rounded-xl border border-red-500/35 bg-black/80 px-3 py-1.5 text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-red-400"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 text-white text-xs font-extrabold shadow-lg shadow-red-600/30 transition hover:scale-[1.02] cursor-pointer"
                  >
                    ⚡ Sync Fleet Policies to Gist
                  </button>
                </form>

                {/* Broken Links Quarantine Reset — Clean Stacked Card */}
                <div className="pt-2.5 border-t border-red-500/25 space-y-2">
                  <div>
                    <p className="text-xs font-bold text-white">
                      Quarantined Broken Titles ({brokenLinksCount})
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Restore hidden titles reported broken on this device.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearQuarantinedBrokenLinks}
                    disabled={brokenLinksCount === 0}
                    className="w-full py-2 rounded-xl bg-red-950/85 hover:bg-red-700 disabled:opacity-40 border border-red-500/40 text-xs font-extrabold text-red-100 transition cursor-pointer"
                  >
                    ↺ Restore All Quarantined Titles
                  </button>
                </div>

                {fleetSyncStatus && (
                  <div className="rounded-xl bg-black/80 border border-red-500/40 p-2 text-center">
                    <p className="text-[11px] font-bold text-amber-300">
                      {fleetSyncStatus}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Subtle Neon Divider */}
      <div className="pt-1 text-center w-full box-border">
        <img
          src={RABBIT_DIVIDER}
          alt=""
          className="w-2/3 mx-auto h-2 object-contain opacity-75"
        />
      </div>
    </div>
  );
}
