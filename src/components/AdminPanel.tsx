// src/components/AdminPanel.tsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import { AdminBugInbox } from "@/components/AdminBugInbox";
import { AppTheme } from "@/lib/settings";

interface AdminPanelProps {
  appTheme: AppTheme;
  getPrimaryBgColor: (theme: AppTheme) => string;
  getPrimaryAccentColor: (theme: AppTheme) => string;
}

// Background images for the admin menu sections matching Crystal Console sidebar layout
const RABBIT_HEADER_PILL =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/rabbit-header-pill.jpg";
const RABBIT_PANEL =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/rabbit-panel.jpg";
const RABBIT_PANEL_ALT =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/rabbit-panel-alt.jpg";
const RABBIT_DIVIDER =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/rabbit-divider.jpg";

const AGE_LOCK_KEY = "rabtv_age_passcode";
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
  // Admin Security Vault Lock States
  const [isVaultLocked, setIsVaultLocked] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem(ADMIN_VAULT_LOCKED_KEY) === "true";
    }
    return false;
  });
  const [vaultPinInput, setVaultPinInput] = useState("");
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number>(0);
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

  // Accordion state matching sidebar menu layout
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
      const res = await fetch(GIST_API_URL, {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "RabbitTV-App",
        },
      });
      if (res.ok) {
        const gistData = await res.json();

        // 1. Parse keys.json
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
            // ignore malformed JSON
          }
        }

        // 2. Parse notifications.json
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

        // 3. Parse admin_config.json (if present)
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

  // Vault Lock & Unlock Handlers
  const handleLockVault = () => {
    setIsVaultLocked(true);
    setVaultPinInput("");
    setVaultError(null);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(ADMIN_VAULT_LOCKED_KEY, "true");
    }
  };

  const handleUnlockVault = (e: React.FormEvent) => {
    e.preventDefault();
    if (Date.now() < lockoutUntil) {
      const waitSec = Math.ceil((lockoutUntil - Date.now()) / 1000);
      setVaultError(`⏳ Too many failed attempts. Wait ${waitSec}s.`);
      return;
    }

    const savedPin =
      (typeof window !== "undefined"
        ? localStorage.getItem(AGE_LOCK_KEY)
        : "") || "";

    if (
      (savedPin && vaultPinInput.trim() === savedPin) ||
      (!savedPin && vaultPinInput.trim().length === 4)
    ) {
      setIsVaultLocked(false);
      setFailedAttempts(0);
      setVaultPinInput("");
      setVaultError(null);
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(ADMIN_VAULT_LOCKED_KEY);
      }
    } else {
      const nextFailures = failedAttempts + 1;
      setFailedAttempts(nextFailures);
      setVaultPinInput("");
      if (nextFailures >= 3) {
        const lockTime = Date.now() + 30000;
        setLockoutUntil(lockTime);
        setVaultError("🚨 Vault locked for 30s due to 3 failed PIN attempts.");
      } else {
        setVaultError(
          `❌ Incorrect Admin PIN (${3 - nextFailures} attempts remaining).`
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
      setTimeout(() => setCopiedKeyId(null), 2000);
    } catch {
      // fallback ignore
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

    // Cryptographically stronger salted 8-to-10 digit numeric key
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

      const updatedContent = JSON.stringify(keysList, null, 2);

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
              content: updatedContent,
            },
          },
        }),
      });

      const patchData = await patchRes.json();

      if (patchRes.ok) {
        setKeygenResult(`✅ Key [${stringKey}] Committed & Activated on Gist!`);
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
      });
      if (!res.ok) return;
      const gistData = await res.json();
      let keysList = JSON.parse(gistData.files?.["keys.json"]?.content);

      keysList = keysList
        .map((item: any) => {
          const kVal = typeof item === "object" ? item.key : item;
          if (kVal === targetKey) {
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

      const updatedContent = JSON.stringify(keysList, null, 2);
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
              content: updatedContent,
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
        "⚠️ Provide target identifier (ALL / Name / PIN / Age) and message."
      );
      return;
    }

    setToastPushStatus("Pushing target notification toast...");
    try {
      const getRes = await fetch(GIST_API_URL, {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "RabbitTV-App",
        },
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
        setToastPushStatus(
          `✅ Toast pushed to target: [${targetQuery.trim()}]`
        );
        setTargetMessage("");
        setActiveNotifs(notifsList);
        setTimeout(() => setToastPushStatus(null), 4000);
      } else {
        setToastPushStatus("⚠️ Failed to push toast notification.");
      }
    } catch (err: any) {
      console.error("Error pushing toast", err);
      setToastPushStatus(`⚠️ Error: ${err.message || err}`);
    }
  };

  const handleDeleteNotification = async (toastId?: string, clearAll = false) => {
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
        setTimeout(() => setToastPushStatus(null), 2500);
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
        setFleetSyncStatus("✅ Fleet Configuration Synced to Gist!");
        setTimeout(() => setFleetSyncStatus(null), 3500);
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
    setTimeout(() => setFleetSyncStatus(null), 3000);
  };

  /**
   * Renders a Crystal Crimson Admin Accordion Pill with 3D mouse hover & D-pad focus pop-out physics.
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
        className={`crystal-admin-pill w-full flex items-center justify-between px-6 py-3.5 text-left text-xs font-extrabold text-red-100 relative overflow-hidden rounded-2xl cursor-pointer box-border transition-all duration-200 ease-out hover:scale-[1.04] focus:scale-[1.05] hover:-translate-y-0.5 focus:-translate-y-0.5 active:scale-[0.98] focus:outline-none ${
          isActive
            ? "ring-2 ring-red-400 shadow-[0_0_28px_rgba(239,68,68,0.55),0_0_16px_rgba(245,158,11,0.3)] scale-[1.02]"
            : "hover:shadow-[0_10px_26px_rgba(239,68,68,0.4)] focus:ring-2 focus:ring-red-400"
        }`}
        style={{
          WebkitMaskImage:
            "linear-gradient(to right, rgba(0,0,0,0.12) 0%, rgba(0,0,0,1) 10%, rgba(0,0,0,1) 90%, rgba(0,0,0,0.12) 100%)",
          maskImage:
            "linear-gradient(to right, rgba(0,0,0,0.12) 0%, rgba(0,0,0,1) 10%, rgba(0,0,0,1) 90%, rgba(0,0,0,0.12) 100%)",
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none rounded-2xl overflow-hidden z-0 opacity-90"
          style={{
            backgroundImage: `url(${RABBIT_HEADER_PILL})`,
            backgroundSize: "130% 100%",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center center",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-red-950/75 via-red-900/45 to-red-950/75 backdrop-blur-[4px] w-full h-full" />
        </div>

        <span className="relative z-10 flex items-center gap-2.5 truncate pr-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
          <span className="text-sm shrink-0">{icon}</span>
          <span className="truncate">{title}</span>
        </span>

        <div className="relative z-10 flex items-center gap-2 shrink-0">
          {badgeText && (
            <span className="rounded-full bg-black/65 border border-red-400/40 px-2 py-0.5 text-[9px] font-black text-amber-300 backdrop-blur-md">
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
      {/* Executive Command Header & Security Controls */}
      <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-red-950/70 via-black/75 to-red-950/70 border border-red-500/40 px-3.5 py-2.5 shadow-[0_0_20px_rgba(239,68,68,0.25)] backdrop-blur-xl">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-red-600/30 border border-red-400/50 text-xs shadow-[0_0_10px_rgba(239,68,68,0.6)]">
            🔐
          </span>
          <div className="min-w-0">
            <h3 className="text-[11px] font-black uppercase tracking-wider text-red-300 truncate">
              Admin Command Center
            </h3>
            <span className="block text-[9px] text-amber-300/90 font-bold">
              {isVaultLocked
                ? "● Vault Locked"
                : `● ${keyStats.active} Active Keys • ${activeNotifs.length} Toasts`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {!isVaultLocked && (
            <button
              type="button"
              onClick={handleLockVault}
              className="px-2.5 py-1 rounded-lg bg-red-950/80 hover:bg-red-800 border border-red-400/40 text-[10px] font-extrabold text-red-100 transition hover:scale-105 cursor-pointer"
              title="Lock Admin Controls with PIN"
            >
              🔒 Lock
            </button>
          )}
          <button
            type="button"
            onClick={handleStepDownAdmin}
            className="px-2 py-1 rounded-lg bg-black/70 hover:bg-red-600 border border-white/15 hover:border-red-300 text-[10px] font-bold text-slate-300 hover:text-white transition hover:scale-105 cursor-pointer"
            title="Exit Admin Mode on this device"
          >
            🚪 Exit
          </button>
        </div>
      </div>

      {/* SECURITY VAULT PIN GATE */}
      {isVaultLocked ? (
        <div className="relative w-full px-5 py-5 rounded-2xl shadow-2xl overflow-hidden box-border backdrop-blur-xl bg-slate-950/75 border border-red-500/40 space-y-3 text-center">
          <div
            className="absolute inset-0 pointer-events-none z-0 opacity-75 mix-blend-lighten"
            style={{
              backgroundImage: `url(${RABBIT_PANEL_ALT})`,
              backgroundSize: "100% 100%",
              backgroundRepeat: "no-repeat",
            }}
          />
          <div className="relative z-10 space-y-2.5">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-red-600/25 border border-red-400/50 text-lg shadow-[0_0_15px_rgba(239,68,68,0.5)]">
              🛡️
            </div>
            <h4 className="text-xs font-black uppercase tracking-wider text-red-200">
              Admin Vault Locked
            </h4>
            <p className="text-[10px] text-slate-300 leading-relaxed">
              Enter your 4-digit security PIN to unlock Gist Keygen, Toast
              Broadcasts, and Fleet Controls.
            </p>
            <form onSubmit={handleUnlockVault} className="space-y-2 pt-1">
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="••••"
                value={vaultPinInput}
                onChange={(e) =>
                  setVaultPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                className="w-36 mx-auto block text-center rounded-xl border border-red-500/40 bg-black/80 px-3 py-2 text-sm font-black text-white tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-red-400"
              />
              <button
                type="submit"
                className="w-full py-2 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 text-white text-xs font-extrabold shadow-lg shadow-red-600/30 transition hover:scale-[1.02] cursor-pointer"
              >
                🔓 Unlock Command Center
              </button>
            </form>
            {vaultError && (
              <p className="text-[10px] font-bold text-amber-300">
                {vaultError}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2.5 w-full box-border">
          {/* 1. BUG REPORTS INBOX SUBMENU */}
          <div className="w-full box-border">
            {renderCrimsonAccordionButton(
              "inbox",
              "🐞",
              "Bug Reports Inbox"
            )}
            {activeAdminSection === "inbox" && (
              <div className="relative w-full px-5 py-4 rounded-2xl mt-2 shadow-2xl overflow-hidden box-border backdrop-blur-xl bg-slate-950/60 border border-red-500/35">
                <div
                  className="absolute inset-0 pointer-events-none z-0 opacity-75 mix-blend-lighten"
                  style={{
                    backgroundImage: `url(${RABBIT_PANEL_ALT})`,
                    backgroundSize: "100% 100%",
                    backgroundRepeat: "no-repeat",
                  }}
                />
                <div className="relative z-10 w-full box-border">
                  <AdminBugInbox />
                </div>
              </div>
            )}
          </div>

          {/* 2. PUSH TOAST & GLOBAL BROADCAST CENTER */}
          <div className="w-full box-border">
            {renderCrimsonAccordionButton(
              "toast",
              "📢",
              "Push Toast & Broadcasts",
              activeNotifs.length > 0 ? `${activeNotifs.length} Live` : undefined
            )}
            {activeAdminSection === "toast" && (
              <div className="relative w-full px-5 py-4 rounded-2xl mt-2 shadow-2xl overflow-hidden box-border backdrop-blur-xl bg-slate-950/60 border border-red-500/35 space-y-3.5">
                <div
                  className="absolute inset-0 pointer-events-none z-0 opacity-75 mix-blend-lighten"
                  style={{
                    backgroundImage: `url(${RABBIT_PANEL_ALT})`,
                    backgroundSize: "100% 100%",
                    backgroundRepeat: "no-repeat",
                  }}
                />
                <div className="relative z-10 space-y-3 w-full box-border">
                  {/* Quick Preset: Broadcast to ALL vs Specific User */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-red-300">
                      Target Recipient:
                    </span>
                    <button
                      type="button"
                      onClick={() => setTargetQuery("ALL")}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition cursor-pointer ${
                        targetQuery.toUpperCase() === "ALL"
                          ? "bg-red-600 text-white shadow-[0_0_12px_rgba(239,68,68,0.6)]"
                          : "bg-red-950/70 border border-red-500/35 text-red-200 hover:bg-red-900/70"
                      }`}
                    >
                      🌐 Broadcast to ALL Users
                    </button>
                  </div>

                  <form
                    onSubmit={handlePushTargetToast}
                    className="space-y-2.5 w-full box-border"
                  >
                    {uniqueUsers.length > 0 && (
                      <div className="w-full box-border">
                        <select
                          value={
                            uniqueUsers.includes(targetQuery) ? targetQuery : ""
                          }
                          onChange={(e) => setTargetQuery(e.target.value)}
                          className="w-full rounded-xl border border-red-500/35 bg-black/75 px-3 py-2 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-red-400 cursor-pointer box-border"
                        >
                          <option value="">
                            -- Or Pick Registered User ({uniqueUsers.length}) --
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
                      </div>
                    )}

                    <div className="w-full box-border">
                      <input
                        type="text"
                        placeholder="Target (ALL, User Name, 4-digit PIN, or Age)..."
                        value={targetQuery}
                        onChange={(e) => setTargetQuery(e.target.value)}
                        className="w-full rounded-xl border border-red-500/35 bg-black/75 px-3 py-2 text-xs font-bold text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-400 box-border"
                      />
                    </div>

                    {/* Alert Severity Level */}
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { id: "info", label: "🔔 Standard" },
                          { id: "warning", label: "⚠️ Warning" },
                          { id: "critical", label: "🚨 Urgent" },
                        ] as { id: ToastSeverity; label: string }[]
                      ).map((sev) => (
                        <button
                          key={sev.id}
                          type="button"
                          onClick={() => setToastSeverity(sev.id)}
                          className={`py-1.5 rounded-xl text-[10px] font-extrabold transition cursor-pointer ${
                            toastSeverity === sev.id
                              ? "bg-gradient-to-r from-red-600 to-orange-600 text-white shadow-md"
                              : "bg-black/60 border border-red-500/25 text-red-200 hover:bg-red-950/60"
                          }`}
                        >
                          {sev.label}
                        </button>
                      ))}
                    </div>

                    <div className="w-full box-border">
                      <textarea
                        rows={2}
                        placeholder="Enter notification message (e.g. New v2.6 update available)..."
                        value={targetMessage}
                        onChange={(e) => setTargetMessage(e.target.value)}
                        className="w-full rounded-xl border border-red-500/35 bg-black/75 px-3 py-2 text-xs font-bold text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none box-border"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 text-white text-xs font-extrabold shadow-lg shadow-red-600/35 transition hover:scale-[1.02] active:scale-95 cursor-pointer"
                    >
                      🚀 Push Toast to User Screen
                    </button>
                  </form>

                  {toastPushStatus && (
                    <div className="rounded-xl bg-black/80 border border-red-500/40 p-2 text-center box-border">
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
                        Loading notification queue...
                      </p>
                    ) : activeNotifs.length === 0 ? (
                      <p className="text-[10px] text-slate-400 text-center py-1">
                        No active toasts queued on Gist.
                      </p>
                    ) : (
                      <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1 scrollbar-none">
                        {activeNotifs.map((n) => (
                          <div
                            key={n.id || n.timestamp}
                            className="flex items-center justify-between gap-2 rounded-xl bg-black/70 border border-red-500/25 px-2.5 py-1.5 text-[10px]"
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

          {/* 3. KEY GENERATOR & LICENSE MANAGER SUBMENU */}
          <div className="w-full box-border">
            {renderCrimsonAccordionButton(
              "keygen",
              "🔑",
              "Key Generator & Licenses",
              `${keyStats.total} Keys`
            )}
            {activeAdminSection === "keygen" && (
              <div className="relative w-full px-5 py-4 rounded-2xl mt-2 shadow-2xl overflow-hidden box-border backdrop-blur-xl bg-slate-950/60 border border-red-500/35 space-y-3.5">
                <div
                  className="absolute inset-0 pointer-events-none z-0 opacity-75 mix-blend-lighten"
                  style={{
                    backgroundImage: `url(${RABBIT_PANEL_ALT})`,
                    backgroundSize: "100% 100%",
                    backgroundRepeat: "no-repeat",
                  }}
                />
                <div className="relative z-10 space-y-3 w-full box-border">
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
                        className="col-span-2 rounded-xl border border-red-500/35 bg-black/75 px-3 py-2 text-xs font-bold text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-400 box-border"
                      />
                      <input
                        type="number"
                        min={1}
                        max={120}
                        placeholder="Age"
                        value={keygenAge}
                        onChange={(e) => setKeygenAge(e.target.value)}
                        className="col-span-1 rounded-xl border border-red-500/35 bg-black/75 px-2.5 py-2 text-xs font-bold text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-400 box-border"
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
                    <div className="rounded-xl bg-black/80 border border-red-500/40 p-2.5 text-center space-y-1.5 box-border">
                      <p className="text-[11px] font-bold text-amber-300">
                        {keygenResult}
                      </p>
                      {lastGeneratedKey && (
                        <button
                          type="button"
                          onClick={() => void handleCopyKey(lastGeneratedKey)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-red-600/40 hover:bg-red-600 border border-red-400/50 px-3 py-1 text-[10px] font-extrabold text-white transition cursor-pointer"
                        >
                          <span>
                            {copiedKeyId === lastGeneratedKey
                              ? "✓ Copied to Clipboard!"
                              : `📋 Copy Key [${lastGeneratedKey}]`}
                          </span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Key List & Management Section */}
                  <div className="pt-2.5 border-t border-red-500/25 space-y-2 w-full box-border">
                    <div className="flex items-center justify-between gap-1.5 w-full">
                      <span className="text-[11px] font-extrabold text-slate-200">
                        Keys ({keyStats.active} Active • {keyStats.used} Used)
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={handleExportKeysBackup}
                          className="px-2 py-1 rounded-lg bg-black/70 border border-red-500/30 hover:bg-red-950 text-[9px] font-bold text-amber-300 transition cursor-pointer"
                          title="Download Keys JSON Backup"
                        >
                          💾 Backup
                        </button>
                        <button
                          type="button"
                          onClick={() => void fetchRemoteAdminData()}
                          className="px-2 py-1 rounded-lg bg-red-950/70 border border-red-500/35 hover:bg-red-900/80 text-[9px] font-bold text-red-200 transition cursor-pointer"
                        >
                          {loadingKeys ? "..." : "🔄 Sync"}
                        </button>
                      </div>
                    </div>

                    {/* Search & Filter Keys Bar */}
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={keySearchQuery}
                        onChange={(e) => setKeySearchQuery(e.target.value)}
                        placeholder="Search user or key..."
                        className="flex-1 rounded-lg border border-red-500/30 bg-black/70 px-2.5 py-1 text-[10px] font-bold text-white placeholder-slate-500 focus:outline-none"
                      />
                      {(["all", "active", "used"] as KeyFilterMode[]).map(
                        (mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setKeyFilterMode(mode)}
                            className={`px-2 py-1 rounded-lg text-[9px] font-extrabold uppercase transition cursor-pointer ${
                              keyFilterMode === mode
                                ? "bg-red-600 text-white"
                                : "bg-black/60 text-slate-400 hover:text-white border border-white/10"
                            }`}
                          >
                            {mode}
                          </button>
                        )
                      )}
                    </div>

                    <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1 w-full box-border scrollbar-none">
                      {filteredKeys.length === 0 ? (
                        <p className="text-[10px] text-slate-400 text-center py-2">
                          No keys match your current filter.
                        </p>
                      ) : (
                        filteredKeys.map((kObj, idx) => (
                          <div
                            key={`${kObj.key}-${idx}`}
                            className="flex items-center justify-between bg-black/75 p-2.5 rounded-xl border border-red-500/25 text-[11px] w-full box-border hover:border-red-400/50 transition"
                          >
                            <div className="truncate pr-2 space-y-0.5 min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => void handleCopyKey(String(kObj.key))}
                                  className="font-mono font-bold text-amber-300 hover:underline cursor-pointer"
                                  title="Click to copy key"
                                >
                                  {kObj.key}
                                </button>
                                {copiedKeyId === String(kObj.key) && (
                                  <span className="text-[9px] text-emerald-400 font-bold">
                                    ✓ Copied
                                  </span>
                                )}
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase ${
                                    kObj.active
                                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                      : "bg-red-500/20 text-red-300 border border-red-500/30"
                                  }`}
                                >
                                  {kObj.active ? "Active" : "Claimed"}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-300 truncate">
                                👤{" "}
                                <strong>
                                  {kObj.owner || kObj.usedBy || "Unassigned"}
                                </strong>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  void handleModifyKeyStatus(kObj.key, "toggle")
                                }
                                className={`px-2 py-1 rounded-lg text-[9px] font-extrabold transition cursor-pointer ${
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
                                className="px-2 py-1 rounded-lg bg-red-600/40 hover:bg-red-600 text-red-100 text-[9px] font-extrabold cursor-pointer"
                                title="Delete Key Permanently"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 4. FLEET COMMAND & SYSTEM CONTROLS (New!) */}
          <div className="w-full box-border">
            {renderCrimsonAccordionButton(
              "fleet",
              "🛡️",
              "Fleet Command & Quarantine"
            )}
            {activeAdminSection === "fleet" && (
              <div className="relative w-full px-5 py-4 rounded-2xl mt-2 shadow-2xl overflow-hidden box-border backdrop-blur-xl bg-slate-950/60 border border-red-500/35 space-y-3.5">
                <div
                  className="absolute inset-0 pointer-events-none z-0 opacity-75 mix-blend-lighten"
                  style={{
                    backgroundImage: `url(${RABBIT_PANEL})`,
                    backgroundSize: "100% 100%",
                    backgroundRepeat: "no-repeat",
                  }}
                />
                <div className="relative z-10 space-y-3 w-full box-border">
                  <form onSubmit={handleSyncFleetConfig} className="space-y-2.5">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-red-300">
                      🌐 Remote Fleet Policies (admin_config.json)
                    </p>

                    <div className="flex items-center justify-between rounded-xl bg-black/70 border border-red-500/25 px-3 py-2">
                      <div>
                        <p className="text-xs font-bold text-white">
                          Allow New 7-Day Free Trials
                        </p>
                        <p className="text-[9px] text-slate-400">
                          Disable to require a key on all new installs.
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
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                          fleetConfig.allowTrials
                            ? "bg-emerald-600"
                            : "bg-red-900"
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

                    <div className="flex items-center justify-between rounded-xl bg-black/70 border border-red-500/25 px-3 py-2">
                      <div>
                        <p className="text-xs font-bold text-white">
                          System Maintenance Banner
                        </p>
                        <p className="text-[9px] text-slate-400">
                          Displays an admin notice across active clients.
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
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
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

                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder="Global MOTD Banner Text..."
                        value={fleetConfig.motdBanner}
                        onChange={(e) =>
                          setFleetConfig((prev) => ({
                            ...prev,
                            motdBanner: e.target.value,
                          }))
                        }
                        className="col-span-2 rounded-xl border border-red-500/35 bg-black/75 px-2.5 py-1.5 text-xs font-bold text-white placeholder-slate-500 focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Min Ver (1.2.0)"
                        value={fleetConfig.minAppVersion}
                        onChange={(e) =>
                          setFleetConfig((prev) => ({
                            ...prev,
                            minAppVersion: e.target.value,
                          }))
                        }
                        className="col-span-1 rounded-xl border border-red-500/35 bg-black/75 px-2.5 py-1.5 text-xs font-bold text-white placeholder-slate-500 focus:outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 text-white text-xs font-extrabold shadow-lg shadow-red-600/30 transition hover:scale-[1.02] cursor-pointer"
                    >
                      ⚡ Sync Fleet Policies to Gist
                    </button>
                  </form>

                  {/* Broken Links Quarantine Reset */}
                  <div className="pt-2.5 border-t border-red-500/25 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-bold text-white">
                        Quarantined Broken Titles ({brokenLinksCount})
                      </p>
                      <p className="text-[9px] text-slate-400">
                        Restore hidden titles reported broken on this device.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearQuarantinedBrokenLinks}
                      disabled={brokenLinksCount === 0}
                      className="px-3 py-1.5 rounded-xl bg-red-950/80 hover:bg-red-700 disabled:opacity-40 border border-red-500/40 text-[10px] font-extrabold text-red-100 transition cursor-pointer shrink-0"
                    >
                      ↺ Restore All
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
              </div>
            )}
          </div>
        </div>
      )}

      {/* Subtle Neon Divider */}
      <div className="pt-2 text-center w-full box-border">
        <img
          src={RABBIT_DIVIDER}
          alt=""
          className="w-2/3 mx-auto h-2 object-contain opacity-75"
        />
      </div>
    </div>
  );
}
