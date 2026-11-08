// src/components/AdminPanel.tsx
import React, { useState, useEffect } from "react";
import { AdminBugInbox } from "@/components/AdminBugInbox";
import { AppTheme } from "@/lib/settings";

interface AdminPanelProps {
  appTheme: AppTheme;
  getPrimaryBgColor: (theme: AppTheme) => string;
  getPrimaryAccentColor: (theme: AppTheme) => string;
}

// Background images for the admin menu sections
const RABBIT_HEADER_PILL = "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/rabbit-header-pill.jpg";
const RABBIT_PANEL       = "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/rabbit-panel.jpg";
const RABBIT_PANEL_ALT   = "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/rabbit-panel-alt.jpg";
const RABBIT_DIVIDER     = "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/rabbit-divider.jpg";

export function AdminPanel({
  appTheme,
  getPrimaryBgColor,
  getPrimaryAccentColor,
}: AdminPanelProps) {
  const [keygenName, setKeygenName] = useState("");
  const [keygenAge, setKeygenAge] = useState("");
  const [keygenResult, setKeygenResult] = useState<string | null>(null);
  const [remoteKeys, setRemoteKeys] = useState<any[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);

  // Target User Messaging / Toast Notification States
  const [targetQuery, setTargetQuery] = useState("");
  const [targetMessage, setTargetMessage] = useState("");
  const [toastPushStatus, setToastPushStatus] = useState<string | null>(null);

  const fetchRemoteKeys = async () => {
    const GIST_ID = (import.meta as any).env?.VITE_GIST_ID as string || "";
    const GITHUB_TOKEN = (import.meta as any).env?.VITE_GH_PAT as string || "";
    const GIST_API_URL = GIST_ID ? `https://api.github.com/gists/${GIST_ID}` : "";

    if (!GIST_ID || !GITHUB_TOKEN || !GIST_API_URL) return;
    setLoadingKeys(true);
    try {
      const res = await fetch(GIST_API_URL, {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "RabbitTV-App"
        }
      });
      if (res.ok) {
        const gistData = await res.json();
        const rawContent = gistData.files?.["keys.json"]?.content;
        const parsed = JSON.parse(rawContent);
        const normalized = parsed.map((item: any) => 
          typeof item === "object" && item !== null ? item : { key: item, active: true, owner: "Legacy" }
        );
        setRemoteKeys(normalized);
      }
    } catch (err) {
      console.error("Failed to fetch keys", err);
    } finally {
      setLoadingKeys(false);
    }
  };

  useEffect(() => {
    fetchRemoteKeys();
  }, []);

  const handleKeygen = async (e: React.FormEvent) => {
    e.preventDefault();
    const GIST_ID = (import.meta as any).env?.VITE_GIST_ID as string || "";
    const GITHUB_TOKEN = (import.meta as any).env?.VITE_GH_PAT as string || "";
    const GIST_API_URL = GIST_ID ? `https://api.github.com/gists/${GIST_ID}` : "";

    if (!GIST_ID || !GITHUB_TOKEN || !GIST_API_URL) {
      setKeygenResult("⚠️ GIST_ID or VITE_GH_PAT is missing from environment secrets.");
      return;
    }
    const age = parseInt(keygenAge.trim(), 10);
    if (!keygenName.trim() || isNaN(age) || age < 1 || age > 120) {
      setKeygenResult("Enter a valid name and age (1–120).");
      return;
    }

    const rawKeyString = `${keygenName.trim().toLowerCase()}-${age}-${Date.now()}`;
    const generatedKey = Math.abs(
      rawKeyString.split("").reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0)
    ).toString();

    setKeygenResult(`Generated Key: ${generatedKey} — Pushing directly to Gist...`);

    try {
      const getRes = await fetch(GIST_API_URL, {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "RabbitTV-App"
        }
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
      const newKeyObj = { key: stringKey, active: true, owner: `${keygenName.trim()} (${age})` };
      keysList.push(newKeyObj);

      const updatedContent = JSON.stringify(keysList, null, 2);

      const patchRes = await fetch(GIST_API_URL, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "User-Agent": "RabbitTV-App"
        },
        body: JSON.stringify({
          files: {
            "keys.json": {
              content: updatedContent
            }
          }
        })
      });

      const patchData = await patchRes.json();

      if (patchRes.ok) {
        setKeygenResult(`✅ Key [${stringKey}] Committed & Activated on Gist!`);
        fetchRemoteKeys();
      } else {
        setKeygenResult(`⚠️ Gist Commit Failed: ${patchData.message || JSON.stringify(patchData)}`);
      }
    } catch (error: any) {
      console.error("Error pushing directly to Gist:", error);
      setKeygenResult(`⚠️ Network Error: ${error.message || error}`);
    }
  };

  const handleModifyKeyStatus = async (targetKey: string, action: "toggle" | "delete") => {
    const GIST_ID = (import.meta as any).env?.VITE_GIST_ID as string || "";
    const GITHUB_TOKEN = (import.meta as any).env?.VITE_GH_PAT as string || "";
    const GIST_API_URL = GIST_ID ? `https://api.github.com/gists/${GIST_ID}` : "";

    if (!GIST_ID || !GITHUB_TOKEN || !GIST_API_URL) return;
    try {
      const res = await fetch(GIST_API_URL, {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "RabbitTV-App"
        }
      });
      if (!res.ok) return;
      const gistData = await res.json();
      let keysList = JSON.parse(gistData.files?.["keys.json"]?.content);

      keysList = keysList.map((item: any) => {
        const kVal = typeof item === "object" ? item.key : item;
        if (kVal === targetKey) {
          if (action === "delete") return null;
          const currentActive = typeof item === "object" ? item.active : true;
          return { 
            key: kVal, 
            active: !currentActive, 
            owner: item.owner || item.usedBy || "Admin Recycled" 
          };
        }
        return item;
      }).filter(Boolean);

      const updatedContent = JSON.stringify(keysList, null, 2);
      const patchRes = await fetch(GIST_API_URL, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "User-Agent": "RabbitTV-App"
        },
        body: JSON.stringify({
          files: {
            "keys.json": {
              content: updatedContent
            }
          }
        })
      });

      if (patchRes.ok) {
        fetchRemoteKeys();
      }
    } catch (err) {
      console.error("Error updating key status", err);
    }
  };

  const handlePushTargetToast = async (e: React.FormEvent) => {
    e.preventDefault();
    const GIST_ID = (import.meta as any).env?.VITE_GIST_ID as string || "";
    const GITHUB_TOKEN = (import.meta as any).env?.VITE_GH_PAT as string || "";
    const GIST_API_URL = GIST_ID ? `https://api.github.com/gists/${GIST_ID}` : "";

    if (!GIST_ID || !GITHUB_TOKEN || !GIST_API_URL) {
      setToastPushStatus("⚠️ Gist credentials missing.");
      return;
    }
    if (!targetQuery.trim() || !targetMessage.trim()) {
      setToastPushStatus("⚠️ Provide target identifier (Name/PIN/Age) and message.");
      return;
    }

    setToastPushStatus("Pushing target notification toast...");
    try {
      const getRes = await fetch(GIST_API_URL, {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "RabbitTV-App"
        }
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

      const newToast = {
        target: targetQuery.trim(),
        message: targetMessage.trim(),
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
          "User-Agent": "RabbitTV-App"
        },
        body: JSON.stringify({
          files: {
            "notifications.json": {
              content: JSON.stringify(notifsList, null, 2)
            }
          }
        })
      });

      if (patchRes.ok) {
        setToastPushStatus(`✅ Toast successfully pushed to target: [${targetQuery.trim()}]`);
        setTargetMessage("");
        setTimeout(() => setToastPushStatus(null), 4000);
      } else {
        setToastPushStatus("⚠️ Failed to push toast notification.");
      }
    } catch (err: any) {
      console.error("Error pushing toast", err);
      setToastPushStatus(`⚠️ Error: ${err.message || err}`);
    }
  };

  return (
    <div className="space-y-3.5 w-full">
      <div className="px-1 pt-1 pb-2">
        <h3 className="text-xs font-black uppercase tracking-wider text-red-400 flex items-center gap-2">
          <span>🔐 Admin Security & Management</span>
        </h3>
      </div>

      {/* 1. BUG REPORTS INBOX SUBMENU */}
      <div className="border-0 bg-transparent overflow-hidden w-full">
        <details className="group border-0 bg-transparent overflow-hidden w-full">
          <summary
            className="w-full flex items-center justify-between px-4 py-4 text-left text-xs font-bold text-red-200 hover:bg-white/5 transition relative overflow-hidden rounded-xl border border-red-500/30"
            style={{
              backgroundImage: `url(${RABBIT_HEADER_PILL})`,
              backgroundSize: "100% 100%",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center center",
            }}
          >
            <div className="absolute inset-0 bg-red-950/40 pointer-events-none w-full h-full" />
            <span className="relative z-10 flex items-center gap-2">🐞 Bug Reports Inbox</span>
            <span className="relative z-10 transform group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div
            className="p-4 border-0 space-y-2 relative w-full opacity-75 mt-1 rounded-xl border border-red-500/20"
            style={{
              backgroundImage: `url(${RABBIT_PANEL})`,
              backgroundSize: "100% 100%",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center center",
            }}
          >
            <div className="relative z-10 w-full">
              <AdminBugInbox />
            </div>
          </div>
        </details>
      </div>

      {/* 2. PUSH TOAST NOTIFICATION SUBMENU */}
      <div className="border-0 bg-transparent overflow-hidden w-full">
        <details className="group border-0 bg-transparent overflow-hidden w-full">
          <summary
            className="w-full flex items-center justify-between px-4 py-4 text-left text-xs font-bold text-red-200 hover:bg-white/5 transition relative overflow-hidden rounded-xl border border-red-500/30"
            style={{
              backgroundImage: `url(${RABBIT_HEADER_PILL})`,
              backgroundSize: "100% 100%",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center center",
            }}
          >
            <div className="absolute inset-0 bg-red-950/40 pointer-events-none w-full h-full" />
            <span className="relative z-10 flex items-center gap-2">📢 Push Toast to User</span>
            <span className="relative z-10 transform group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div
            className="p-4 border-0 space-y-3 relative w-full opacity-75 mt-1 rounded-xl border border-red-500/20"
            style={{
              backgroundImage: `url(${RABBIT_PANEL_ALT})`,
              backgroundSize: "100% 100%",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center center",
            }}
          >
            <div className="relative z-10 space-y-3 w-full">
              <p className="text-[10px] text-slate-300 font-semibold">
                Target user by name, age, or PIN to prompt updates or alerts directly on their screen.
              </p>
              <form onSubmit={handlePushTargetToast} className="space-y-2.5 w-full">
                <input
                  type="text"
                  placeholder="Target User Identifier (Name, PIN, or Age)"
                  value={targetQuery}
                  onChange={(e) => setTargetQuery(e.target.value)}
                  className="w-full rounded-lg border border-red-500/30 bg-slate-800/80 px-3 py-2 text-xs font-bold text-white placeholder-slate-400 focus:outline-none"
                />
                <textarea
                  rows={2}
                  placeholder="Notification message (e.g. Please update your app to v2.1)"
                  value={targetMessage}
                  onChange={(e) => setTargetMessage(e.target.value)}
                  className="w-full rounded-lg border border-red-500/30 bg-slate-800/80 px-3 py-2 text-xs font-bold text-white placeholder-slate-400 focus:outline-none resize-none"
                />
                <button
                  type="submit"
                  className="w-full py-2 rounded-lg bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 text-white text-xs font-bold shadow-md shadow-red-600/30 transition hover:brightness-110"
                >
                  🚀 Push Toast to User Screen
                </button>
              </form>
              {toastPushStatus && (
                <div className="rounded-lg bg-black/70 border border-red-500/30 p-2 text-center">
                  <p className="text-xs font-bold text-amber-300">{toastPushStatus}</p>
                </div>
              )}
            </div>
          </div>
        </details>
      </div>

      {/* 3. KEY GENERATOR & MANAGER SUBMENU */}
      <div className="border-0 bg-transparent overflow-hidden w-full">
        <details className="group border-0 bg-transparent overflow-hidden w-full">
          <summary
            className="w-full flex items-center justify-between px-4 py-4 text-left text-xs font-bold text-red-200 hover:bg-white/5 transition relative overflow-hidden rounded-xl border border-red-500/30"
            style={{
              backgroundImage: `url(${RABBIT_HEADER_PILL})`,
              backgroundSize: "100% 100%",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center center",
            }}
          >
            <div className="absolute inset-0 bg-red-950/40 pointer-events-none w-full h-full" />
            <span className="relative z-10 flex items-center gap-2">🔑 Admin Key Generator & Manager</span>
            <span className="relative z-10 transform group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div
            className="p-4 border-0 space-y-3 relative w-full opacity-75 mt-1 rounded-xl border border-red-500/20"
            style={{
              backgroundImage: `url(${RABBIT_PANEL})`,
              backgroundSize: "100% 100%",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center center",
            }}
          >
            <div className="relative z-10 space-y-3 w-full">
              <form onSubmit={handleKeygen} className="space-y-2.5 w-full">
                <input
                  type="text"
                  placeholder="User name"
                  value={keygenName}
                  onChange={(e) => setKeygenName(e.target.value)}
                  className="w-full rounded-lg border border-red-500/30 bg-slate-800/80 px-3 py-2 text-xs font-bold text-white placeholder-slate-400 focus:outline-none"
                />
                <input
                  type="number"
                  min={1}
                  max={120}
                  placeholder="User age"
                  value={keygenAge}
                  onChange={(e) => setKeygenAge(e.target.value)}
                  className="w-full rounded-lg border border-red-500/30 bg-slate-800/80 px-3 py-2 text-xs font-bold text-white placeholder-slate-400 focus:outline-none"
                />
                <button
                  type="submit"
                  className="w-full py-2 rounded-lg bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 text-white text-xs font-bold shadow-md shadow-red-600/30 transition hover:brightness-110"
                >
                  Generate & Push Key to Gist
                </button>
              </form>
              {keygenResult && (
                <div className="rounded-lg bg-black/70 border border-red-500/30 p-2 text-center">
                  <p className="text-xs font-bold text-amber-300">{keygenResult}</p>
                </div>
              )}

              {/* Key List & Management Section */}
              <div className="pt-3 border-t border-red-500/20 space-y-2 w-full">
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-bold text-slate-200">Active & Used Keys</span>
                  <button
                    type="button"
                    onClick={fetchRemoteKeys}
                    className="px-2.5 py-1 rounded bg-red-950/60 border border-red-500/30 hover:bg-red-900/80 text-[10px] font-bold text-red-200 transition"
                  >
                    {loadingKeys ? "Loading..." : "🔄 Refresh List"}
                  </button>
                </div>

                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 w-full">
                  {remoteKeys.length === 0 ? (
                    <p className="text-[10px] text-slate-400 text-center py-2">Click refresh to load keys from Gist.</p>
                  ) : (
                    remoteKeys.map((kObj, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-black/60 p-2.5 rounded-lg border border-red-500/20 text-[11px] w-full">
                        <div className="truncate pr-2 space-y-0.5">
                          <div>
                            <span className="font-mono font-bold text-amber-300">{kObj.key}</span>
                            <span className={`ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold ${kObj.active ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>
                              {kObj.active ? "Active" : "Used/Inactive"}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-300">
                            👤 <strong>User:</strong> {kObj.owner || kObj.usedBy || "Unassigned"}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleModifyKeyStatus(kObj.key, "toggle")}
                            className={`px-2 py-0.5 rounded text-[9px] font-bold transition ${kObj.active ? "bg-amber-600/40 text-amber-200" : "bg-emerald-600/40 text-emerald-200"}`}
                          >
                            {kObj.active ? "Mark Unused" : "Reactivate"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleModifyKeyStatus(kObj.key, "delete")}
                            className="px-1.5 py-0.5 rounded bg-red-600/40 text-red-200 text-[9px] font-bold"
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
        </details>
      </div>

      {/* Subtle divider */}
      <div className="pt-2 text-center w-full">
        <img
          src={RABBIT_DIVIDER}
          alt=""
          className="w-2/3 mx-auto h-2 object-contain opacity-70"
        />
      </div>
    </div>
  );
}
