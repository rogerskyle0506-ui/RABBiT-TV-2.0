// src/components/AdminPanel.tsx
import React, { useState, useEffect } from "react";
import { AdminBugInbox } from "@/components/AdminBugInbox";
import { AppTheme } from "@/lib/settings";

interface AdminPanelProps {
  appTheme: AppTheme;
  getPrimaryBgColor: (theme: AppTheme) => string;
  getPrimaryAccentColor: (theme: AppTheme) => string;
}

// Background images for the admin menu sections matching sidebar menu layout
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

  // Accordion state matching sidebar menu layout
  const [activeAdminSection, setActiveAdminSection] = useState<"inbox" | "toast" | "keygen" | null>(null);

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

  const uniqueUsers = Array.from(
    new Set(
      remoteKeys
        .map((k) => k.owner || k.usedBy)
        .filter((u) => u && u !== "Legacy" && u !== "Admin Recycled" && u !== "Unassigned")
    )
  );

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
    <div className="space-y-3.5 w-full box-border">
      <div className="px-1 pt-1 pb-2">
        <h3 className="text-xs font-black uppercase tracking-wider text-red-400 flex items-center gap-2">
          <span>🔐 Admin Security & Management</span>
        </h3>
      </div>

      {/* ACCORDION SECTIONS MATCHING SIDEBAR MENU LAYOUT & PERMANENT RED THEME */}

      {/* 1. BUG REPORTS INBOX SUBMENU */}
      <div className="border-0 bg-transparent overflow-hidden w-full relative box-border">
        <button
          type="button"
          onClick={() => setActiveAdminSection(activeAdminSection === "inbox" ? null : "inbox")}
          className="w-full flex items-center justify-between px-8 py-3.5 text-left text-xs font-bold text-red-200 relative overflow-hidden rounded-xl border-0 shadow-sm group cursor-pointer box-border -mx-2"
          style={{
            width: "calc(100% + 1rem)",
            WebkitMaskImage: "linear-gradient(to right, rgba(0,0,0,0.05) 0%, rgba(0,0,0,1) 12%, rgba(0,0,0,1) 88%, rgba(0,0,0,0.05) 100%)",
            maskImage: "linear-gradient(to right, rgba(0,0,0,0.05) 0%, rgba(0,0,0,1) 12%, rgba(0,0,0,1) 88%, rgba(0,0,0,0.05) 100%)",
          }}
        >
          <div 
            className="absolute inset-0 pointer-events-none rounded-xl overflow-hidden z-0"
            style={{
              backgroundImage: `url(${RABBIT_HEADER_PILL})`,
              backgroundSize: "130% 100%",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center center",
            }}
          >
            <div className="absolute inset-0 bg-red-950/60 w-full h-full" />
          </div>
          <span className="relative z-10 flex items-center gap-2">🐞 Bug Reports Inbox</span>
          <span className={`relative z-10 transform transition-transform ${activeAdminSection === "inbox" ? "rotate-180" : ""}`}>▼</span>
        </button>
        {activeAdminSection === "inbox" && (
          <div
            className="w-full px-6 py-5 border-0 space-y-3 relative rounded-xl mt-2 shadow-xl border-0 overflow-hidden box-border"
            style={{
              backgroundImage: `url(${RABBIT_PANEL_ALT})`,
              backgroundSize: "100% 100%",
              backgroundRepeat: "no-repeat",
            }}
          >
            <div className="relative z-10 w-full box-border">
              <AdminBugInbox />
            </div>
          </div>
        )}
      </div>

      {/* 2. PUSH TOAST NOTIFICATION SUBMENU WITH USER DROPDOWN */}
      <div className="border-0 bg-transparent overflow-hidden w-full relative box-border">
        <button
          type="button"
          onClick={() => setActiveAdminSection(activeAdminSection === "toast" ? null : "toast")}
          className="w-full flex items-center justify-between px-8 py-3.5 text-left text-xs font-bold text-red-200 relative overflow-hidden rounded-xl border-0 shadow-sm group cursor-pointer box-border -mx-2"
          style={{
            width: "calc(100% + 1rem)",
            WebkitMaskImage: "linear-gradient(to right, rgba(0,0,0,0.05) 0%, rgba(0,0,0,1) 12%, rgba(0,0,0,1) 88%, rgba(0,0,0,0.05) 100%)",
            maskImage: "linear-gradient(to right, rgba(0,0,0,0.05) 0%, rgba(0,0,0,1) 12%, rgba(0,0,0,1) 88%, rgba(0,0,0,0.05) 100%)",
          }}
        >
          <div 
            className="absolute inset-0 pointer-events-none rounded-xl overflow-hidden z-0"
            style={{
              backgroundImage: `url(${RABBIT_HEADER_PILL})`,
              backgroundSize: "130% 100%",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center center",
            }}
          >
            <div className="absolute inset-0 bg-red-950/60 w-full h-full" />
          </div>
          <span className="relative z-10 flex items-center gap-2">📢 Push Toast to User</span>
          <span className={`relative z-10 transform transition-transform ${activeAdminSection === "toast" ? "rotate-180" : ""}`}>▼</span>
        </button>
        {activeAdminSection === "toast" && (
          <div
            className="w-full px-6 py-5 border-0 space-y-3 relative rounded-xl mt-2 shadow-xl border-0 overflow-hidden box-border"
            style={{
              backgroundImage: `url(${RABBIT_PANEL_ALT})`,
              backgroundSize: "100% 100%",
              backgroundRepeat: "no-repeat",
            }}
          >
            <div className="relative z-10 space-y-3 w-full box-border">
              <p className="text-[11px] text-slate-300 font-semibold">
                Select a registered user from the dropdown or enter a custom identifier to message them directly.
              </p>
              <form onSubmit={handlePushTargetToast} className="space-y-2.5 w-full box-border">
                {uniqueUsers.length > 0 && (
                  <div className="w-full box-border">
                    <label className="block text-[10px] text-red-300 mb-1 font-bold">Select Registered User:</label>
                    <select
                      value={targetQuery}
                      onChange={(e) => setTargetQuery(e.target.value)}
                      className="w-full rounded-lg border border-red-500/30 bg-slate-800/90 px-3 py-2 text-xs font-bold text-white focus:outline-none cursor-pointer box-border"
                    >
                      <option value="">-- Choose User from List --</option>
                      {uniqueUsers.map((user) => (
                        <option key={user} value={user} className="bg-slate-900 text-white">
                          👤 {user}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="w-full box-border">
                  <label className="block text-[10px] text-red-300 mb-1 font-bold">Target User Identifier (Name / PIN / Age):</label>
                  <input
                    type="text"
                    placeholder="Type or select user identifier..."
                    value={targetQuery}
                    onChange={(e) => setTargetQuery(e.target.value)}
                    className="w-full rounded-lg border border-red-500/30 bg-slate-800/80 px-3 py-2 text-xs font-bold text-white placeholder-slate-400 focus:outline-none box-border"
                  />
                </div>
                <div className="w-full box-border">
                  <label className="block text-[10px] text-red-300 mb-1 font-bold">Notification Message:</label>
                  <textarea
                    rows={2}
                    placeholder="Enter notification message (e.g. Please update your app to v2.1)..."
                    value={targetMessage}
                    onChange={(e) => setTargetMessage(e.target.value)}
                    className="w-full rounded-lg border border-red-500/30 bg-slate-800/80 px-3 py-2 text-xs font-bold text-white placeholder-slate-400 focus:outline-none resize-none box-border"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-lg bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 text-white text-xs font-bold shadow-md shadow-red-600/30 transition hover:brightness-110 border-0 cursor-pointer"
                >
                  🚀 Push Toast to User Screen
                </button>
              </form>
              {toastPushStatus && (
                <div className="rounded-lg bg-black/70 border border-red-500/30 p-2 text-center box-border">
                  <p className="text-xs font-bold text-amber-300">{toastPushStatus}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. KEY GENERATOR & MANAGER SUBMENU */}
      <div className="border-0 bg-transparent overflow-hidden w-full relative box-border">
        <button
          type="button"
          onClick={() => setActiveAdminSection(activeAdminSection === "keygen" ? null : "keygen")}
          className="w-full flex items-center justify-between px-8 py-3.5 text-left text-xs font-bold text-red-200 relative overflow-hidden rounded-xl border-0 shadow-sm group cursor-pointer box-border -mx-2"
          style={{
            width: "calc(100% + 1rem)",
            WebkitMaskImage: "linear-gradient(to right, rgba(0,0,0,0.05) 0%, rgba(0,0,0,1) 12%, rgba(0,0,0,1) 88%, rgba(0,0,0,0.05) 100%)",
            maskImage: "linear-gradient(to right, rgba(0,0,0,0.05) 0%, rgba(0,0,0,1) 12%, rgba(0,0,0,1) 88%, rgba(0,0,0,0.05) 100%)",
          }}
        >
          <div 
            className="absolute inset-0 pointer-events-none rounded-xl overflow-hidden z-0"
            style={{
              backgroundImage: `url(${RABBIT_HEADER_PILL})`,
              backgroundSize: "130% 100%",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center center",
            }}
          >
            <div className="absolute inset-0 bg-red-950/60 w-full h-full" />
          </div>
          <span className="relative z-10 flex items-center gap-2">🔑 Admin Key Generator & Manager</span>
          <span className={`relative z-10 transform transition-transform ${activeAdminSection === "keygen" ? "rotate-180" : ""}`}>▼</span>
        </button>
        {activeAdminSection === "keygen" && (
          <div
            className="w-full px-6 py-5 border-0 space-y-3 relative rounded-xl mt-2 shadow-xl border-0 overflow-hidden box-border"
            style={{
              backgroundImage: `url(${RABBIT_PANEL_ALT})`,
              backgroundSize: "100% 100%",
              backgroundRepeat: "no-repeat",
            }}
          >
            <div className="relative z-10 space-y-3 w-full box-border">
              <form onSubmit={handleKeygen} className="space-y-2.5 w-full box-border">
                <input
                  type="text"
                  placeholder="User name"
                  value={keygenName}
                  onChange={(e) => setKeygenName(e.target.value)}
                  className="w-full rounded-lg border border-red-500/30 bg-slate-800/80 px-3 py-2 text-xs font-bold text-white placeholder-slate-400 focus:outline-none box-border"
                />
                <input
                  type="number"
                  min={1}
                  max={120}
                  placeholder="User age"
                  value={keygenAge}
                  onChange={(e) => setKeygenAge(e.target.value)}
                  className="w-full rounded-lg border border-red-500/30 bg-slate-800/80 px-3 py-2 text-xs font-bold text-white placeholder-slate-400 focus:outline-none box-border"
                />
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-lg bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 text-white text-xs font-bold shadow-md shadow-red-600/30 transition hover:brightness-110 border-0 cursor-pointer"
                >
                  Generate & Push Key to Gist
                </button>
              </form>
              {keygenResult && (
                <div className="rounded-lg bg-black/70 border border-red-500/30 p-2 text-center box-border">
                  <p className="text-xs font-bold text-amber-300">{keygenResult}</p>
                </div>
              )}

              {/* Key List & Management Section */}
              <div className="pt-3 border-t border-red-500/20 space-y-2 w-full box-border">
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-bold text-slate-200">Active & Used Keys</span>
                  <button
                    type="button"
                    onClick={fetchRemoteKeys}
                    className="px-2.5 py-1 rounded bg-red-950/60 border border-red-500/30 hover:bg-red-900/80 text-[10px] font-bold text-red-200 transition cursor-pointer"
                  >
                    {loadingKeys ? "Loading..." : "🔄 Refresh List"}
                  </button>
                </div>

                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 w-full box-border scrollbar-none">
                  {remoteKeys.length === 0 ? (
                    <p className="text-[10px] text-slate-400 text-center py-2">Click refresh to load keys from Gist.</p>
                  ) : (
                    remoteKeys.map((kObj, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-black/60 p-2.5 rounded-lg border border-red-500/20 text-[11px] w-full box-border">
                        <div className="truncate pr-2 space-y-0.5 min-w-0 flex-1">
                          <div>
                            <span className="font-mono font-bold text-amber-300">{kObj.key}</span>
                            <span className={`ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold ${kObj.active ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>
                              {kObj.active ? "Active" : "Used/Inactive"}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-300 truncate">
                            👤 <strong>User:</strong> {kObj.owner || kObj.usedBy || "Unassigned"}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleModifyKeyStatus(kObj.key, "toggle")}
                            className={`px-2 py-0.5 rounded text-[9px] font-bold transition cursor-pointer ${kObj.active ? "bg-amber-600/40 text-amber-200" : "bg-emerald-600/40 text-emerald-200"}`}
                          >
                            {kObj.active ? "Mark Unused" : "Reactivate"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleModifyKeyStatus(kObj.key, "delete")}
                            className="px-1.5 py-0.5 rounded bg-red-600/40 text-red-200 text-[9px] font-bold cursor-pointer"
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

      {/* Subtle divider */}
      <div className="pt-2 text-center w-full box-border">
        <img
          src={RABBIT_DIVIDER}
          alt=""
          className="w-2/3 mx-auto h-2 object-contain opacity-70"
        />
      </div>
    </div>
  );
}
