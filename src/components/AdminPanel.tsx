// src/components/AdminPanel.tsx
import React, { useState, useEffect } from "react";
import { AdminBugInbox } from "@/components/AdminBugInbox";
import { AppTheme } from "@/lib/settings";

interface AdminPanelProps {
  appTheme: AppTheme;
  getPrimaryBgColor: (theme: AppTheme) => string;
  getPrimaryAccentColor: (theme: AppTheme) => string;
}

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

  return (
    <div className="space-y-4">
      {/* ADMIN BUG REPORT INBOX INTEGRATION (Placed right where your white arrow pointed) */}
      <div className="bg-red-950/40 p-3.5 rounded-xl border border-red-500/30 box-border backdrop-blur-md">
        <AdminBugInbox />
      </div>

      <div className="space-y-3 bg-red-950/40 p-3.5 rounded-xl border border-red-500/30 box-border backdrop-blur-md">
        <h4 className="text-xs font-bold uppercase tracking-wider text-red-300">
          🔑 Admin Key Generator & Manager
        </h4>
        <form onSubmit={handleKeygen} className="space-y-2">
          <input
            type="text"
            placeholder="User name"
            value={keygenName}
            onChange={(e) => setKeygenName(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-3 py-2 text-xs font-bold text-white placeholder-slate-500 focus:outline-none"
          />
          <input
            type="number"
            min={1}
            max={120}
            placeholder="User age"
            value={keygenAge}
            onChange={(e) => setKeygenAge(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-3 py-2 text-xs font-bold text-white placeholder-slate-500 focus:outline-none"
          />
          <button
            type="submit"
            className="w-full py-2 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold text-white shadow transition"
          >
            Generate & Push Key to Gist
          </button>
        </form>
        {keygenResult && (
          <div className="rounded-lg bg-black/60 border border-red-400/30 p-2 text-center">
            <p className="text-xs font-bold text-amber-300">{keygenResult}</p>
          </div>
        )}

        {/* Key List & Management Section */}
        <div className="pt-3 border-t border-red-500/20 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200">Active & Used Keys</span>
            <button
              type="button"
              onClick={fetchRemoteKeys}
              className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-[10px] font-bold text-white transition"
            >
              {loadingKeys ? "Loading..." : "🔄 Refresh List"}
            </button>
          </div>
          
          <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
            {remoteKeys.length === 0 ? (
              <p className="text-[10px] text-slate-400 text-center py-2">Click refresh to load keys from Gist.</p>
            ) : (
              remoteKeys.map((kObj, idx) => (
                <div key={idx} className="flex items-center justify-between bg-black/50 p-2.5 rounded-lg border border-white/10 text-[11px]">
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
  );
}
