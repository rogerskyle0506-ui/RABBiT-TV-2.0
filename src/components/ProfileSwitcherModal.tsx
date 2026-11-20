// src/components/ProfileSwitcherModal.tsx
import React, { useState, useEffect, useMemo, useRef, memo } from "react";
import {
  type AppTheme,
  PROFILE_MASCOT_OPTIONS,
  getHardwareLimits,
  getLargeButtons,
  verifyAgeLockPin,
  getPinLockoutState,
  recordPinFailure,
  resetPinFailures,
} from "@/lib/settings";
import {
  getHouseholdProfiles,
  getActiveProfileId,
  createHouseholdProfile,
  switchHouseholdProfile,
  deleteHouseholdProfile,
  MAX_PROFILES,
  type HouseholdProfile,
} from "@/lib/profiles";

export interface ProfileSwitcherModalProps {
  isOpen: boolean;
  appTheme: AppTheme;
  canDismiss?: boolean;
  onClose: () => void;
}

const THEME_OPTIONS: { id: AppTheme; label: string }[] = [
  { id: "violet", label: "🟣 Violet" },
  { id: "red", label: "🔴 Red" },
  { id: "midnight", label: "🔵 Midnight" },
  { id: "emerald", label: "🟢 Emerald" },
  { id: "amber", label: "🟠 Amber" },
  { id: "cyan", label: "🔷 Cyan" },
];

interface SwitcherThemeTokens {
  shell: string;
  subPanel: string;
  dividerBorder: string;
  accentText: string;
  accentBar: string;
  mutedText: string;
  subMutedText: string;
  badge: string;
  btnPrimary: string;
  btnSecondary: string;
  cardIdle: string;
  cardActive: string;
  inputClass: string;
  focusRing: string;
}

function getSwitcherThemeTokens(theme: AppTheme): SwitcherThemeTokens {
  switch (theme) {
    case "red":
      return {
        shell:
          "bg-zinc-950/95 border-red-500/40 shadow-[0_25px_75px_rgba(0,0,0,0.96),0_0_36px_rgba(239,68,68,0.22)]",
        subPanel: "bg-black/75 border-red-500/25",
        dividerBorder: "border-red-500/20",
        accentText: "text-red-300",
        accentBar: "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.9)]",
        mutedText: "text-zinc-300",
        subMutedText: "text-zinc-400",
        badge: "bg-red-950/80 border-red-500/40 text-red-200",
        btnPrimary:
          "bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 text-white shadow-lg shadow-red-600/35",
        btnSecondary:
          "bg-red-950/60 hover:bg-red-900/80 border-red-500/35 text-red-100 hover:text-white",
        cardIdle:
          "bg-black/70 hover:bg-red-950/55 border-red-500/25 hover:border-red-400/70",
        cardActive:
          "bg-red-950/75 border-red-400 ring-2 ring-red-400/50 shadow-[0_0_24px_rgba(239,68,68,0.3)]",
        inputClass:
          "border-red-500/35 bg-black/85 text-white placeholder-zinc-500 focus:ring-2 focus:ring-red-500",
        focusRing: "focus:ring-red-500",
      };
    case "midnight":
      return {
        shell:
          "bg-slate-950/95 border-blue-500/40 shadow-[0_25px_75px_rgba(0,0,0,0.96),0_0_36px_rgba(59,130,246,0.22)]",
        subPanel: "bg-black/75 border-blue-500/25",
        dividerBorder: "border-blue-500/20",
        accentText: "text-sky-300",
        accentBar: "bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.9)]",
        mutedText: "text-slate-300",
        subMutedText: "text-slate-400",
        badge: "bg-blue-950/80 border-blue-500/40 text-sky-200",
        btnPrimary:
          "bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-500 text-white shadow-lg shadow-blue-600/35",
        btnSecondary:
          "bg-blue-950/60 hover:bg-blue-900/80 border-blue-500/35 text-blue-100 hover:text-white",
        cardIdle:
          "bg-black/70 hover:bg-blue-950/55 border-blue-500/25 hover:border-sky-400/70",
        cardActive:
          "bg-blue-950/75 border-sky-400 ring-2 ring-sky-400/50 shadow-[0_0_24px_rgba(56,189,248,0.3)]",
        inputClass:
          "border-blue-500/35 bg-black/85 text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-400",
        focusRing: "focus:ring-sky-400",
      };
    case "emerald":
      return {
        shell:
          "bg-neutral-950/95 border-emerald-500/40 shadow-[0_25px_75px_rgba(0,0,0,0.96),0_0_36px_rgba(16,185,129,0.22)]",
        subPanel: "bg-black/75 border-emerald-500/25",
        dividerBorder: "border-emerald-500/20",
        accentText: "text-emerald-300",
        accentBar: "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]",
        mutedText: "text-neutral-300",
        subMutedText: "text-neutral-400",
        badge: "bg-emerald-950/80 border-emerald-500/40 text-emerald-200",
        btnPrimary:
          "bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 text-white shadow-lg shadow-emerald-600/35",
        btnSecondary:
          "bg-emerald-950/60 hover:bg-emerald-900/80 border-emerald-500/35 text-emerald-100 hover:text-white",
        cardIdle:
          "bg-black/70 hover:bg-emerald-950/55 border-emerald-500/25 hover:border-emerald-400/70",
        cardActive:
          "bg-emerald-950/75 border-emerald-400 ring-2 ring-emerald-400/50 shadow-[0_0_24px_rgba(52,211,153,0.3)]",
        inputClass:
          "border-emerald-500/35 bg-black/85 text-white placeholder-neutral-500 focus:ring-2 focus:ring-emerald-400",
        focusRing: "focus:ring-emerald-400",
      };
    case "amber":
      return {
        shell:
          "bg-stone-950/95 border-amber-500/40 shadow-[0_25px_75px_rgba(0,0,0,0.96),0_0_36px_rgba(245,158,11,0.22)]",
        subPanel: "bg-black/75 border-amber-500/25",
        dividerBorder: "border-amber-500/20",
        accentText: "text-amber-300",
        accentBar: "bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.9)]",
        mutedText: "text-stone-300",
        subMutedText: "text-stone-400",
        badge: "bg-amber-950/80 border-amber-500/40 text-amber-200",
        btnPrimary:
          "bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 text-white shadow-lg shadow-amber-600/35",
        btnSecondary:
          "bg-amber-950/60 hover:bg-amber-900/80 border-amber-500/35 text-amber-100 hover:text-white",
        cardIdle:
          "bg-black/70 hover:bg-amber-950/55 border-amber-500/25 hover:border-amber-400/70",
        cardActive:
          "bg-amber-950/75 border-amber-400 ring-2 ring-amber-400/50 shadow-[0_0_24px_rgba(251,191,36,0.3)]",
        inputClass:
          "border-amber-500/35 bg-black/85 text-white placeholder-stone-500 focus:ring-2 focus:ring-amber-400",
        focusRing: "focus:ring-amber-400",
      };
    case "cyan":
      return {
        shell:
          "bg-slate-950/95 border-cyan-500/40 shadow-[0_25px_75px_rgba(0,0,0,0.96),0_0_36px_rgba(6,182,212,0.22)]",
        subPanel: "bg-black/75 border-cyan-500/25",
        dividerBorder: "border-cyan-500/20",
        accentText: "text-cyan-300",
        accentBar: "bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.9)]",
        mutedText: "text-slate-300",
        subMutedText: "text-slate-400",
        badge: "bg-cyan-950/80 border-cyan-500/40 text-cyan-200",
        btnPrimary:
          "bg-gradient-to-r from-cyan-600 via-teal-600 to-blue-600 text-white shadow-lg shadow-cyan-600/35",
        btnSecondary:
          "bg-cyan-950/60 hover:bg-cyan-900/80 border-cyan-500/35 text-cyan-100 hover:text-white",
        cardIdle:
          "bg-black/70 hover:bg-cyan-950/55 border-cyan-500/25 hover:border-cyan-400/70",
        cardActive:
          "bg-cyan-950/75 border-cyan-400 ring-2 ring-cyan-400/50 shadow-[0_0_24px_rgba(34,211,238,0.3)]",
        inputClass:
          "border-cyan-500/35 bg-black/85 text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-400",
        focusRing: "focus:ring-cyan-400",
      };
    case "violet":
    default:
      return {
        shell:
          "bg-slate-950/95 border-violet-500/40 shadow-[0_25px_75px_rgba(0,0,0,0.96),0_0_36px_rgba(139,92,246,0.22)]",
        subPanel: "bg-black/75 border-violet-500/25",
        dividerBorder: "border-violet-500/20",
        accentText: "text-violet-300",
        accentBar: "bg-violet-500 shadow-[0_0_12px_rgba(139,92,246,0.9)]",
        mutedText: "text-slate-300",
        subMutedText: "text-slate-400",
        badge: "bg-purple-950/80 border-violet-500/40 text-violet-200",
        btnPrimary:
          "bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white shadow-lg shadow-violet-600/35",
        btnSecondary:
          "bg-purple-950/60 hover:bg-purple-900/80 border-violet-500/35 text-purple-100 hover:text-white",
        cardIdle:
          "bg-black/70 hover:bg-purple-950/55 border-violet-500/25 hover:border-violet-400/70",
        cardActive:
          "bg-purple-950/75 border-violet-400 ring-2 ring-violet-400/50 shadow-[0_0_24px_rgba(139,92,246,0.3)]",
        inputClass:
          "border-violet-500/35 bg-black/85 text-white placeholder-slate-500 focus:ring-2 focus:ring-violet-400",
        focusRing: "focus:ring-violet-400",
      };
  }
}

export const ProfileSwitcherModal = memo(function ProfileSwitcherModal({
  isOpen,
  appTheme,
  canDismiss = true,
  onClose,
}: ProfileSwitcherModalProps) {
  const [profiles, setProfiles] = useState<HouseholdProfile[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [manageMode, setManageMode] = useState<boolean>(false);
  const [showAddForm, setShowAddForm] = useState<boolean>(false);

  // PIN gate when switching OUT of a Kids Safe Mode profile
  const [pinTargetProfile, setPinTargetProfile] =
    useState<HouseholdProfile | null>(null);
  const [pinInput, setPinInput] = useState<string>("");
  const [pinError, setPinError] = useState<string | null>(null);

  // Add-profile form state (uncontrolled ref for name to keep Android WebView strictly LTR)
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [newMascot, setNewMascot] = useState<string>("🐰");
  const [newTheme, setNewTheme] = useState<AppTheme>(appTheme);
  const [newAge, setNewAge] = useState<string>("25");
  const [newIsKids, setNewIsKids] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const tokens = useMemo(() => getSwitcherThemeTokens(appTheme), [appTheme]);
  const isLowRam = getHardwareLimits().effectiveMode === "low";
  const largeButtons = getLargeButtons();

  const reloadProfiles = () => {
    setProfiles(getHouseholdProfiles());
    setActiveId(getActiveProfileId());
  };

  useEffect(() => {
    if (!isOpen) return;
    reloadProfiles();
    setManageMode(false);
    setShowAddForm(false);
    setPinTargetProfile(null);
    setPinInput("");
    setPinError(null);
    setFormError(null);
    setNewTheme(appTheme);
  }, [isOpen, appTheme]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (pinTargetProfile) {
          setPinTargetProfile(null);
          setPinInput("");
          setPinError(null);
        } else if (showAddForm) {
          setShowAddForm(false);
        } else if (canDismiss) {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, pinTargetProfile, showAddForm, canDismiss, onClose]);

  if (!isOpen) return null;

  const activeProfile = profiles.find((p) => p.id === activeId) || profiles[0];

  const handleSelectProfile = (target: HouseholdProfile) => {
    if (manageMode) return;
    if (target.id === activeId) {
      onClose();
      return;
    }

    // Require Parental PIN when leaving a Kids Safe Mode profile for an adult profile
    if (activeProfile?.isKids && !target.isKids) {
      setPinTargetProfile(target);
      setPinInput("");
      setPinError(null);
      return;
    }

    switchHouseholdProfile(target.id);
    onClose();
  };

  const handleConfirmPinSwitch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinTargetProfile) return;

    const lock = getPinLockoutState();
    if (lock.isLocked) {
      setPinError(`⏳ Locked for ${lock.remainingSeconds}s.`);
      return;
    }

    const ok = await verifyAgeLockPin(pinInput);
    if (!ok) {
      const next = recordPinFailure();
      setPinInput("");
      setPinError(
        next.isLocked
          ? `🚨 Too many tries. Wait ${next.remainingSeconds}s.`
          : `⚠️ Incorrect PIN (${next.attemptsLeft} tries left).`
      );
      return;
    }

    resetPinFailures();
    switchHouseholdProfile(pinTargetProfile.id);
    setPinTargetProfile(null);
    setPinInput("");
    setPinError(null);
    onClose();
  };

  const handleCreateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const rawName = nameInputRef.current?.value || "";
    const res = createHouseholdProfile({
      name: rawName,
      mascot: newMascot,
      theme: newTheme,
      age: newIsKids ? 8 : parseInt(newAge, 10) || 25,
      isKids: newIsKids,
    });
    if (!res.ok || !res.profile) {
      setFormError(res.error || "Could not create profile.");
      return;
    }
    setFormError(null);
    if (nameInputRef.current) nameInputRef.current.value = "";
    setShowAddForm(false);
    reloadProfiles();
  };

  const handleDeleteProfile = (id: string) => {
    const res = deleteHouseholdProfile(id);
    if (!res.ok) {
      setFormError(res.error || "Cannot delete profile.");
      return;
    }
    setFormError(null);
    reloadProfiles();
  };

  return (
    <div
      className="rabtv-vidsrc-protected fixed inset-0 z-[99995] flex items-center justify-center bg-black/85 p-3 sm:p-6 backdrop-blur-md"
      onClick={() => canDismiss && !pinTargetProfile && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Who's Watching Profile Switcher"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-2xl max-h-[90dvh] overflow-y-auto rounded-3xl border p-5 sm:p-7 space-y-5 scrollbar-none ${
          isLowRam ? "" : "backdrop-blur-2xl"
        } ${tokens.shell}`}
      >
        {/* Header */}
        <div
          className={`flex flex-wrap items-center justify-between gap-2 pb-3 border-b ${tokens.dividerBorder}`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={`w-1.5 h-6 rounded-full shrink-0 ${tokens.accentBar}`}
            />
            <div className="min-w-0">
              <h2 className="text-lg sm:text-2xl font-black text-white truncate">
                👥 Who&apos;s Watching?
              </h2>
              <p className={`text-[11px] sm:text-xs ${tokens.subMutedText}`}>
                Each profile keeps its own theme, Watch History, My List & Kids Lock.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setManageMode((m) => !m);
                setShowAddForm(false);
              }}
              className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition cursor-pointer focus:outline-none focus:ring-2 ${
                manageMode ? tokens.btnPrimary : tokens.btnSecondary
              } ${tokens.focusRing}`}
            >
              {manageMode ? "✓ Done" : "⚙️ Manage"}
            </button>

            {canDismiss && (
              <button
                type="button"
                onClick={onClose}
                className={`h-8 w-8 rounded-full border text-xs font-bold flex items-center justify-center cursor-pointer focus:outline-none focus:ring-2 ${tokens.btnSecondary} ${tokens.focusRing}`}
                aria-label="Close Profile Switcher"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* PIN VERIFICATION STEP (When exiting Kids Safe Mode) */}
        {pinTargetProfile ? (
          <form
            onSubmit={handleConfirmPinSwitch}
            className={`rounded-2xl border p-5 space-y-4 text-center ${tokens.subPanel}`}
          >
            <div className="text-3xl">🔒</div>
            <h3 className="text-base font-black text-white">
              Parental PIN Required
            </h3>
            <p className={`text-xs ${tokens.mutedText}`}>
              Enter your 4–6 digit PIN to switch from Kids Mode to{" "}
              <strong className={tokens.accentText}>
                {pinTargetProfile.name}
              </strong>
              .
            </p>
            <input
              type="password"
              dir="ltr"
              inputMode="numeric"
              maxLength={6}
              autoFocus
              placeholder="••••••"
              value={pinInput}
              onChange={(e) =>
                setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              style={{ direction: "ltr", unicodeBidi: "plaintext", textAlign: "center" }}
              className={`w-full max-w-xs mx-auto block rounded-xl border px-4 py-2.5 text-sm font-black tracking-[0.35em] focus:outline-none ${tokens.inputClass}`}
            />
            {pinError && (
              <p className="text-xs font-bold text-red-400">{pinError}</p>
            )}
            <div className="grid grid-cols-2 gap-2.5 max-w-xs mx-auto pt-1">
              <button
                type="button"
                onClick={() => {
                  setPinTargetProfile(null);
                  setPinInput("");
                  setPinError(null);
                }}
                className={`rounded-xl border py-2.5 text-xs font-bold cursor-pointer ${tokens.btnSecondary}`}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`rounded-xl py-2.5 text-xs font-extrabold cursor-pointer ${tokens.btnPrimary}`}
              >
                Unlock & Switch
              </button>
            </div>
          </form>
        ) : showAddForm ? (
          /* ADD NEW PROFILE FORM */
          <form
            onSubmit={handleCreateProfile}
            className={`rounded-2xl border p-4 sm:p-5 space-y-4 ${tokens.subPanel}`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-black text-white">
                + Add Household Profile
              </h3>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className={`text-xs font-bold hover:text-white cursor-pointer ${tokens.subMutedText}`}
              >
                ← Back
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span
                  className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${tokens.subMutedText}`}
                >
                  Profile Name
                </span>
                <input
                  ref={nameInputRef}
                  type="text"
                  dir="ltr"
                  maxLength={24}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="e.g. Kids, Guest, Alex"
                  style={{ direction: "ltr", unicodeBidi: "plaintext", textAlign: "left" }}
                  className={`w-full h-10 rounded-xl border px-3 text-xs font-bold focus:outline-none ${tokens.inputClass}`}
                />
              </div>

              <div>
                <span
                  className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${tokens.subMutedText}`}
                >
                  Age (for Content Filter)
                </span>
                <input
                  type="number"
                  dir="ltr"
                  min={1}
                  max={120}
                  disabled={newIsKids}
                  value={newIsKids ? "8" : newAge}
                  onChange={(e) => setNewAge(e.target.value)}
                  className={`w-full h-10 rounded-xl border px-3 text-xs font-bold focus:outline-none disabled:opacity-50 ${tokens.inputClass}`}
                />
              </div>
            </div>

            {/* Mascot Picker */}
            <div>
              <span
                className={`block text-[10px] font-bold uppercase tracking-wider mb-1.5 ${tokens.subMutedText}`}
              >
                Choose Mascot
              </span>
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                {PROFILE_MASCOT_OPTIONS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setNewMascot(m.id)}
                    className={`h-10 rounded-xl border text-lg flex items-center justify-center transition cursor-pointer ${
                      newMascot === m.id
                        ? `${tokens.btnPrimary} border-transparent scale-105`
                        : tokens.cardIdle
                    }`}
                    title={m.label}
                  >
                    {m.id}
                  </button>
                ))}
              </div>
            </div>

            {/* Theme Picker */}
            <div>
              <span
                className={`block text-[10px] font-bold uppercase tracking-wider mb-1.5 ${tokens.subMutedText}`}
              >
                Profile Theme
              </span>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {THEME_OPTIONS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setNewTheme(t.id)}
                    className={`rounded-xl border py-1.5 px-1 text-[10px] font-extrabold transition cursor-pointer ${
                      newTheme === t.id
                        ? `${tokens.btnPrimary} border-transparent`
                        : tokens.cardIdle
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Kids Safe Mode Toggle */}
            <label
              className={`flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 cursor-pointer ${tokens.cardIdle}`}
            >
              <div>
                <span className="block text-xs font-extrabold text-emerald-300">
                  🧒 Kids Safe Profile
                </span>
                <span className={`block text-[10px] ${tokens.subMutedText}`}>
                  Auto-locks mature titles & requires PIN to switch out.
                </span>
              </div>
              <input
                type="checkbox"
                checked={newIsKids}
                onChange={(e) => setNewIsKids(e.target.checked)}
                className="h-4 w-4 rounded"
              />
            </label>

            {formError && (
              <p className="text-xs font-bold text-red-400">{formError}</p>
            )}

            <button
              type="submit"
              className={`w-full rounded-2xl py-3 text-xs font-black uppercase tracking-wider cursor-pointer ${tokens.btnPrimary}`}
            >
              ✓ Create Profile
            </button>
          </form>
        ) : (
          /* PROFILE GRID */
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              {profiles.map((prof) => {
                const isActive = prof.id === activeId;
                return (
                  <div
                    key={prof.id}
                    className={`relative rounded-2xl border p-4 flex flex-col items-center text-center gap-2 transition-all ${
                      isActive ? tokens.cardActive : tokens.cardIdle
                    }`}
                  >
                    {manageMode && profiles.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteProfile(prof.id)}
                        className="absolute top-2 right-2 h-6 w-6 rounded-full bg-red-950/90 hover:bg-red-600 border border-red-400/50 text-[10px] font-black text-red-200 hover:text-white flex items-center justify-center cursor-pointer"
                        title={`Delete ${prof.name}`}
                      >
                        ✕
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleSelectProfile(prof)}
                      disabled={manageMode}
                      className={`w-full flex flex-col items-center gap-2 focus:outline-none ${
                        manageMode ? "cursor-default" : "cursor-pointer"
                      }`}
                    >
                      <div
                        className={`h-16 w-16 sm:h-20 sm:w-20 rounded-2xl border flex items-center justify-center text-3xl sm:text-4xl shadow-inner ${tokens.subPanel}`}
                      >
                        {prof.mascot}
                      </div>

                      <div className="space-y-1 w-full">
                        <p className="text-sm font-black text-white truncate">
                          {prof.name}
                        </p>
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          {prof.isKids && (
                            <span className="rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2 py-0.5 text-[9px] font-extrabold text-emerald-300 uppercase">
                              🧒 Kids
                            </span>
                          )}
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${tokens.badge}`}
                          >
                            {prof.theme}
                          </span>
                        </div>
                      </div>

                      {isActive && !manageMode && (
                        <span
                          className={`mt-1 rounded-lg px-2.5 py-0.5 text-[10px] font-black uppercase ${tokens.btnPrimary}`}
                        >
                          Active
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}

              {/* Add Profile Tile */}
              {profiles.length < MAX_PROFILES && (
                <button
                  type="button"
                  onClick={() => {
                    setManageMode(false);
                    setShowAddForm(true);
                  }}
                  className={`rounded-2xl border-2 border-dashed p-4 flex flex-col items-center justify-center text-center gap-2 min-h-[168px] transition cursor-pointer focus:outline-none focus:ring-2 ${tokens.cardIdle} ${tokens.focusRing}`}
                >
                  <span
                    className={`h-12 w-12 rounded-2xl border flex items-center justify-center text-2xl font-black ${tokens.badge}`}
                  >
                    +
                  </span>
                  <span className={`text-xs font-extrabold ${tokens.accentText}`}>
                    Add Profile
                  </span>
                  <span className={`text-[10px] ${tokens.subMutedText}`}>
                    {profiles.length} / {MAX_PROFILES} used
                  </span>
                </button>
              )}
            </div>

            {formError && (
              <p className="text-xs font-bold text-red-400 text-center">
                {formError}
              </p>
            )}

            {canDismiss && (
              <div className="flex justify-center pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className={`rounded-xl border ${
                    largeButtons ? "px-6 py-3 text-sm" : "px-5 py-2 text-xs"
                  } font-extrabold cursor-pointer ${tokens.btnSecondary}`}
                >
                  Continue as {activeProfile?.name || "Current Profile"} →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

ProfileSwitcherModal.displayName = "ProfileSwitcherModal";
export default ProfileSwitcherModal;