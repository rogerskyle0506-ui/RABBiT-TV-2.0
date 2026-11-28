// src/components/ProfileSwitcherModal.tsx
import React, { useState, useEffect, useRef, memo } from "react";
import {
  type AppTheme,
  getHardwareLimits,
  getLargeButtons,
  verifyAgeLockPin,
  getPinLockoutState,
  recordPinFailure,
  resetPinFailures,
} from "@/lib/settings";
import {
  getAllCustomMascotBadges,
  EMOJI_MASCOT_BADGES,
  DEFAULT_MASCOT_ID,
  MASCOT_UPDATED_EVENT,
  syncRemoteMascotBadges,
  type MascotBadgeOption,
} from "@/lib/mascots";
import { MascotAvatar } from "@/components/MascotAvatar";
import {
  getHouseholdProfiles,
  getActiveProfileId,
  createHouseholdProfile,
  switchHouseholdProfile,
  deleteHouseholdProfile,
  MAX_PROFILES,
  type HouseholdProfile,
} from "@/lib/profiles";

const IMG_PS_MODAL_FRAME =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-referral-modal-frame.jpg";
const IMG_PS_BANNER =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-profiles-banner.jpg";
const IMG_PS_CARD =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-referral-section-card.jpg";
const IMG_PS_BTN_PRIMARY =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-referral-btn-primary.jpg";
const IMG_PS_BTN_IDLE =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-referral-tab-idle.jpg";
const IMG_PS_BTN_ACTIVE =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-referral-tab-active.jpg";
const IMG_PS_INPUT =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-search-input-bar-background.jpg";

const PROFILE_SWITCHER_STYLES = `
  :root, html[data-theme="violet"] { --rabtv-ps-filter: hue-rotate(-78deg) saturate(1.12) brightness(1.02); }
  html[data-theme="red"] { --rabtv-ps-filter: hue-rotate(0deg) saturate(1.08) brightness(1.0); }
  html[data-theme="midnight"] { --rabtv-ps-filter: hue-rotate(-132deg) saturate(1.14) brightness(1.04); }
  html[data-theme="emerald"] { --rabtv-ps-filter: hue-rotate(154deg) saturate(1.10) brightness(1.02); }
  html[data-theme="amber"] { --rabtv-ps-filter: hue-rotate(28deg) saturate(1.14) brightness(1.04); }
  html[data-theme="cyan"] { --rabtv-ps-filter: hue-rotate(-154deg) saturate(1.12) brightness(1.04); }

  .rabtv-ps-shell {
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
    padding: 18px 14px !important;
    background-color: #0c0a09;
    contain: layout paint;
  }
  @media (min-width: 640px) { .rabtv-ps-shell { padding: 24px 22px !important; } }
  .rabtv-ps-shell-9slice {
    position: absolute;
    inset: 0;
    box-sizing: border-box;
    border-style: solid;
    border-color: transparent;
    border-width: 24px 20px;
    border-image-source: url("${IMG_PS_MODAL_FRAME}");
    border-image-slice: 12% 11% fill;
    border-image-repeat: stretch;
    filter: var(--rabtv-ps-filter);
    pointer-events: none;
    z-index: 0;
  }
  .rabtv-ps-card {
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
    padding: 16px 14px !important;
    background-color: #0c0a09;
    contain: layout paint;
  }
  .rabtv-ps-card-9slice {
    position: absolute;
    inset: 0;
    box-sizing: border-box;
    border-style: solid;
    border-color: transparent;
    border-width: 14px 14px;
    border-image-source: url("${IMG_PS_CARD}");
    border-image-slice: 14% 11% fill;
    border-image-repeat: stretch;
    filter: var(--rabtv-ps-filter);
    pointer-events: none;
    z-index: 0;
  }
  .rabtv-ps-btn {
    position: relative;
    overflow: hidden;
    background-color: #0c0a09;
    border: 0 !important;
    clip-path: polygon(8px 0%, calc(100% - 8px) 0%, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0% calc(100% - 8px), 0% 8px);
    contain: layout paint;
    transition: transform 140ms ease, filter 140ms ease;
  }
  .rabtv-ps-btn:hover:not(:disabled) { transform: scale(1.02); filter: brightness(1.09); }
  .rabtv-ps-btn:active:not(:disabled) { transform: scale(0.97); }
  .rabtv-ps-btn-art {
    position: absolute;
    inset: -2px;
    background-size: 100% 100%;
    filter: var(--rabtv-ps-filter);
    pointer-events: none;
    z-index: 0;
  }
  .rabtv-ps-btn-scrim {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 78% 72% at 50% 50%, rgba(12,10,9,0.36) 0%, rgba(12,10,9,0.14) 100%);
    pointer-events: none;
    z-index: 1;
  }
  .rabtv-ps-btn-label {
    position: relative;
    z-index: 2;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    text-shadow: 0 1px 4px rgba(12,10,9,0.96);
  }
  .rabtv-ps-input-shell {
    position: relative;
    overflow: hidden;
    background-color: #0c0a09;
    contain: layout paint;
  }
  .rabtv-ps-input-9slice {
    position: absolute;
    inset: 0;
    box-sizing: border-box;
    border-style: solid;
    border-color: transparent;
    border-width: 7px 16px;
    border-image-source: url("${IMG_PS_INPUT}");
    border-image-slice: 22% 14% fill;
    border-image-repeat: stretch;
    filter: var(--rabtv-ps-filter);
    pointer-events: none;
    z-index: 0;
  }
`;

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

  // Custom mascot badges list (Vite-bundled + 24h cached remote sync)
  const [customBadges, setCustomBadges] = useState<MascotBadgeOption[]>(() =>
    getAllCustomMascotBadges()
  );
  const [mascotTab, setMascotTab] = useState<"custom" | "emoji">(() =>
    getAllCustomMascotBadges().length > 0 ? "custom" : "emoji"
  );

  // Add-profile form state (uncontrolled ref for name to keep Android WebView strictly LTR)
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [newMascot, setNewMascot] = useState<string>(() => DEFAULT_MASCOT_ID);
  const [newTheme, setNewTheme] = useState<AppTheme>(appTheme);
  const [newAge, setNewAge] = useState<string>("25");
  const [newIsKids, setNewIsKids] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isLowRam = getHardwareLimits().effectiveMode === "low";
  const largeButtons = getLargeButtons();

  const reloadProfiles = () => {
    setProfiles(getHouseholdProfiles());
    setActiveId(getActiveProfileId());
  };

  useEffect(() => {
    if (!isOpen) return;
    reloadProfiles();
    const currentBadges = getAllCustomMascotBadges();
    setCustomBadges(currentBadges);
    setMascotTab(currentBadges.length > 0 ? "custom" : "emoji");
    setNewMascot(currentBadges[0]?.id || DEFAULT_MASCOT_ID);
    setManageMode(false);
    setShowAddForm(false);
    setPinTargetProfile(null);
    setPinInput("");
    setPinError(null);
    setFormError(null);
    setNewTheme(appTheme);

    const controller = new AbortController();
    const syncLocal = () => setCustomBadges(getAllCustomMascotBadges());
    window.addEventListener(MASCOT_UPDATED_EVENT, syncLocal);
    void syncRemoteMascotBadges(controller.signal).then((badges) => {
      if (!controller.signal.aborted) {
        setCustomBadges(badges);
      }
    });

    return () => {
      controller.abort();
      window.removeEventListener(MASCOT_UPDATED_EVENT, syncLocal);
    };
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
      data-theme={appTheme}
      className={`rabtv-vidsrc-protected fixed inset-0 z-[99995] flex items-center justify-center bg-black/86 p-2.5 sm:p-5 ${
        isLowRam ? "" : "backdrop-blur-xl"
      }`}
      onClick={() => canDismiss && !pinTargetProfile && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Who's Watching Profile Switcher"
    >
      <style>{PROFILE_SWITCHER_STYLES}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        className="rabtv-ps-shell w-full max-w-2xl max-h-[92dvh] rounded-[26px] text-white flex flex-col shadow-2xl"
      >
        <div className="rabtv-ps-shell-9slice" aria-hidden="true" />

        <div className="relative z-10 flex flex-col max-h-full overflow-y-auto scrollbar-none space-y-4">
          {/* Full-Crew VIP Backstage Header Banner */}
          <div className="relative overflow-hidden rounded-2xl border border-white/10 min-h-[158px] sm:min-h-[188px] p-3.5 sm:p-4 flex flex-col justify-between bg-[#0c0a09] shrink-0">
            <div
              className="absolute inset-0 bg-cover bg-center opacity-92 pointer-events-none"
              style={{
                backgroundImage: `url(${IMG_PS_BANNER})`,
                backgroundPosition: "center 32%",
              }}
              aria-hidden="true"
            />
            <div
              className="absolute inset-0 bg-gradient-to-b from-[#0c0a09]/86 via-[#0c0a09]/22 to-[#0c0a09]/92 pointer-events-none"
              aria-hidden="true"
            />

            <div className="relative z-10 flex items-center justify-between gap-2">
              <span className="rounded-full bg-black/80 border border-white/15 px-2.5 py-1 text-[9.5px] font-black uppercase tracking-widest text-cyan-300">
                👥 Household Profiles
              </span>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setManageMode((m) => !m);
                    setShowAddForm(false);
                  }}
                  className="rabtv-ps-btn px-3 py-1.5 text-[11px] font-extrabold text-white cursor-pointer"
                >
                  <span
                    className="rabtv-ps-btn-art"
                    style={{
                      backgroundImage: `url(${manageMode ? IMG_PS_BTN_ACTIVE : IMG_PS_BTN_IDLE})`,
                    }}
                  />
                  <span className="rabtv-ps-btn-scrim" />
                  <span className="rabtv-ps-btn-label">
                    {manageMode ? "✓ Done" : "⚙️ Manage"}
                  </span>
                </button>

                {canDismiss && (
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close Profile Switcher"
                    className="rabtv-ps-btn px-3 py-1.5 text-[11px] font-extrabold text-white cursor-pointer"
                  >
                    <span className="rabtv-ps-btn-art" style={{ backgroundImage: `url(${IMG_PS_BTN_IDLE})` }} />
                    <span className="rabtv-ps-btn-scrim" />
                    <span className="rabtv-ps-btn-label">✕</span>
                  </button>
                )}
              </div>
            </div>

            <div className="relative z-10 pt-10 text-center sm:text-left">
              <h2 className="text-lg sm:text-2xl font-black uppercase tracking-tight text-amber-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.98)]">
                Who&apos;s Watching?
              </h2>
              <p className="text-[11px] font-bold text-zinc-200 drop-shadow">
                Each profile keeps its own theme, Watch History, My List &amp; Kids Lock.
              </p>
            </div>
          </div>

          {/* PIN VERIFICATION STEP */}
          {pinTargetProfile ? (
            <form
              onSubmit={handleConfirmPinSwitch}
              className="rabtv-ps-card rounded-2xl text-center"
            >
              <div className="rabtv-ps-card-9slice" aria-hidden="true" />
              <div className="relative z-10 space-y-4 py-2">
                <div className="text-3xl">🔒</div>
                <h3 className="text-base font-black text-white">
                  Parental PIN Required
                </h3>
                <p className="text-xs text-zinc-300">
                  Enter your 4–6 digit PIN to switch from Kids Mode to{" "}
                  <strong className="text-amber-300">
                    {pinTargetProfile.name}
                  </strong>
                  .
                </p>
                <div className="rabtv-ps-input-shell max-w-xs mx-auto rounded-xl">
                  <div className="rabtv-ps-input-9slice" aria-hidden="true" />
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
                    className="relative z-10 w-full h-11 bg-transparent px-4 text-sm font-black tracking-[0.35em] text-white focus:outline-none"
                  />
                </div>
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
                    className="rabtv-ps-btn py-2.5 text-xs font-extrabold text-white cursor-pointer"
                  >
                    <span className="rabtv-ps-btn-art" style={{ backgroundImage: `url(${IMG_PS_BTN_IDLE})` }} />
                    <span className="rabtv-ps-btn-scrim" />
                    <span className="rabtv-ps-btn-label">Cancel</span>
                  </button>
                  <button
                    type="submit"
                    className="rabtv-ps-btn py-2.5 text-xs font-extrabold text-white cursor-pointer"
                  >
                    <span className="rabtv-ps-btn-art" style={{ backgroundImage: `url(${IMG_PS_BTN_PRIMARY})` }} />
                    <span className="rabtv-ps-btn-scrim" />
                    <span className="rabtv-ps-btn-label">Unlock &amp; Switch</span>
                  </button>
                </div>
              </div>
            </form>
          ) : showAddForm ? (
            /* ADD NEW PROFILE FORM */
            <form onSubmit={handleCreateProfile} className="rabtv-ps-card rounded-2xl">
              <div className="rabtv-ps-card-9slice" aria-hidden="true" />
              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm sm:text-base font-black text-amber-300">
                    + Add Household Profile
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="text-xs font-bold text-zinc-300 hover:text-white cursor-pointer"
                  >
                    ← Back
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider mb-1 text-zinc-300">
                      Profile Name
                    </span>
                    <div className="rabtv-ps-input-shell rounded-xl">
                      <div className="rabtv-ps-input-9slice" aria-hidden="true" />
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
                        className="relative z-10 w-full h-10 bg-transparent px-4 text-xs font-bold text-white placeholder-zinc-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider mb-1 text-zinc-300">
                      Age (for Content Filter)
                    </span>
                    <div className="rabtv-ps-input-shell rounded-xl">
                      <div className="rabtv-ps-input-9slice" aria-hidden="true" />
                      <input
                        type="number"
                        dir="ltr"
                        min={1}
                        max={120}
                        disabled={newIsKids}
                        value={newIsKids ? "8" : newAge}
                        onChange={(e) => setNewAge(e.target.value)}
                        className="relative z-10 w-full h-10 bg-transparent px-4 text-xs font-bold text-white focus:outline-none disabled:opacity-50"
                      />
                    </div>
                  </div>
                </div>

                {/* Mascot Badge Picker */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-300">
                      Choose Mascot Badge
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setMascotTab("custom")}
                        className="rabtv-ps-btn px-2.5 py-1 text-[10px] font-extrabold text-white cursor-pointer"
                      >
                        <span
                          className="rabtv-ps-btn-art"
                          style={{ backgroundImage: `url(${mascotTab === "custom" ? IMG_PS_BTN_ACTIVE : IMG_PS_BTN_IDLE})` }}
                        />
                        <span className="rabtv-ps-btn-scrim" />
                        <span className="rabtv-ps-btn-label">🎨 Custom ({customBadges.length})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setMascotTab("emoji")}
                        className="rabtv-ps-btn px-2.5 py-1 text-[10px] font-extrabold text-white cursor-pointer"
                      >
                        <span
                          className="rabtv-ps-btn-art"
                          style={{ backgroundImage: `url(${mascotTab === "emoji" ? IMG_PS_BTN_ACTIVE : IMG_PS_BTN_IDLE})` }}
                        />
                        <span className="rabtv-ps-btn-scrim" />
                        <span className="rabtv-ps-btn-label">✨ Classic</span>
                      </button>
                    </div>
                  </div>

                  {mascotTab === "custom" && customBadges.length > 0 ? (
                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-48 overflow-y-auto pr-0.5 scrollbar-none">
                      {customBadges.map((badge) => {
                        const isSelected = newMascot === badge.id;
                        return (
                          <button
                            key={badge.id}
                            type="button"
                            onClick={() => setNewMascot(badge.id)}
                            className={`p-1 rounded-2xl border flex items-center justify-center transition cursor-pointer ${
                              isSelected
                                ? "border-cyan-300 ring-2 ring-cyan-400 scale-[1.04] bg-black"
                                : "border-white/15 bg-black/70 hover:border-white/40"
                            }`}
                            title={badge.label}
                            aria-label={badge.label}
                          >
                            <MascotAvatar
                              mascot={badge.id}
                              size="lg"
                              rounded="xl"
                              alt={badge.label}
                            />
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                      {EMOJI_MASCOT_BADGES.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setNewMascot(m.id)}
                          className={`h-10 rounded-xl border text-lg flex items-center justify-center transition cursor-pointer ${
                            newMascot === m.id
                              ? "border-cyan-300 ring-2 ring-cyan-400 bg-black scale-105"
                              : "border-white/15 bg-black/70"
                          }`}
                          title={m.label}
                        >
                          {m.emojiFallback}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Theme Picker */}
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-zinc-300">
                    Profile Theme
                  </span>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                    {THEME_OPTIONS.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setNewTheme(t.id)}
                        className="rabtv-ps-btn py-1.5 px-1 text-[10px] font-extrabold text-white cursor-pointer"
                      >
                        <span
                          className="rabtv-ps-btn-art"
                          style={{ backgroundImage: `url(${newTheme === t.id ? IMG_PS_BTN_ACTIVE : IMG_PS_BTN_IDLE})` }}
                        />
                        <span className="rabtv-ps-btn-scrim" />
                        <span className="rabtv-ps-btn-label">{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Kids Safe Mode Toggle */}
                <label className="flex items-center justify-between gap-2 rounded-xl border border-emerald-400/35 bg-emerald-950/30 px-3.5 py-2.5 cursor-pointer">
                  <div>
                    <span className="block text-xs font-extrabold text-emerald-300">
                      🧒 Kids Safe Profile
                    </span>
                    <span className="block text-[10px] text-zinc-300">
                      Auto-locks mature titles &amp; requires PIN to switch out.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={newIsKids}
                    onChange={(e) => setNewIsKids(e.target.checked)}
                    className="h-4 w-4 rounded accent-emerald-400"
                  />
                </label>

                {formError && (
                  <p className="text-xs font-bold text-red-400">{formError}</p>
                )}

                <button
                  type="submit"
                  className="rabtv-ps-btn w-full py-3.5 text-xs font-black uppercase tracking-wider text-white cursor-pointer"
                >
                  <span className="rabtv-ps-btn-art" style={{ backgroundImage: `url(${IMG_PS_BTN_PRIMARY})` }} />
                  <span className="rabtv-ps-btn-scrim" />
                  <span className="rabtv-ps-btn-label">✓ Create Profile</span>
                </button>
              </div>
            </form>
          ) : (
            /* ARMORED 9-SLICED PROFILE GRID */
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {profiles.map((prof) => {
                  const isActive = prof.id === activeId;
                  return (
                    <div
                      key={prof.id}
                      className={`rabtv-ps-card rounded-2xl flex flex-col items-center text-center transition-all ${
                        isActive ? "ring-2 ring-cyan-400/80 shadow-[0_0_24px_rgba(34,211,238,0.28)]" : ""
                      }`}
                    >
                      <div className="rabtv-ps-card-9slice" aria-hidden="true" />
                      {manageMode && profiles.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteProfile(prof.id)}
                          className="absolute top-3 right-3 z-20 h-6 w-6 rounded-full bg-red-950/90 hover:bg-red-600 border border-red-400/50 text-[10px] font-black text-red-200 hover:text-white flex items-center justify-center cursor-pointer"
                          title={`Delete ${prof.name}`}
                        >
                          ✕
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleSelectProfile(prof)}
                        disabled={manageMode}
                        className={`relative z-10 w-full flex flex-col items-center gap-2 focus:outline-none ${
                          manageMode ? "cursor-default" : "cursor-pointer"
                        }`}
                      >
                        <MascotAvatar
                          mascot={prof.mascot}
                          size="xl"
                          rounded="2xl"
                          className="border border-white/15 bg-black/80 shadow-inner"
                          alt={prof.name}
                        />

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
                            <span className="rounded-full bg-black/80 border border-white/15 px-2 py-0.5 text-[9px] font-bold uppercase text-cyan-200">
                              {prof.theme}
                            </span>
                          </div>
                        </div>

                        {isActive && !manageMode && (
                          <span className="mt-1 rounded-lg bg-cyan-500/25 border border-cyan-400/60 px-2.5 py-0.5 text-[10px] font-black uppercase text-cyan-200">
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
                    className="rabtv-ps-card rounded-2xl flex flex-col items-center justify-center text-center gap-2 min-h-[168px] transition hover:scale-[1.02] cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  >
                    <div className="rabtv-ps-card-9slice" aria-hidden="true" />
                    <div className="relative z-10 flex flex-col items-center gap-2">
                      <span className="h-12 w-12 rounded-2xl border border-cyan-400/40 bg-black/80 flex items-center justify-center text-2xl font-black text-cyan-300">
                        +
                      </span>
                      <span className="text-xs font-extrabold text-amber-300">
                        Add Profile
                      </span>
                      <span className="text-[10px] text-zinc-400">
                        {profiles.length} / {MAX_PROFILES} used
                      </span>
                    </div>
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
                    className={`rabtv-ps-btn ${
                      largeButtons ? "px-6 py-3 text-sm" : "px-6 py-2.5 text-xs"
                    } font-extrabold text-white cursor-pointer`}
                  >
                    <span className="rabtv-ps-btn-art" style={{ backgroundImage: `url(${IMG_PS_BTN_PRIMARY})` }} />
                    <span className="rabtv-ps-btn-scrim" />
                    <span className="rabtv-ps-btn-label">
                      Continue as {activeProfile?.name || "Current Profile"} →
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

ProfileSwitcherModal.displayName = "ProfileSwitcherModal";
export default ProfileSwitcherModal;