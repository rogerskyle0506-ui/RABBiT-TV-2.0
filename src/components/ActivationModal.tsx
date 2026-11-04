// src/components/ActivationModal.tsx
import React from "react";
import { AppTheme, CardSize } from "@/lib/settings";

interface ActivationModalProps {
  isOpen: boolean;
  appTheme: AppTheme;
  cardSize: CardSize;
  profileNameInput: string;
  setProfileNameInput: (val: string) => void;
  userAgeInput: string;
  setUserAgeInput: (val: string) => void;
  ageLockInput: string;
  setAgeLockInput: (val: string) => void;
  passcodeInput: string;
  setPasscodeInput: (val: string) => void;
  passcodeError: boolean;
  passcodeErrorMsg: string;
  ageErrorNotice: boolean;
  ageLockError: boolean;
  helpfulMouse: boolean;
  allThemesList: { id: AppTheme; label: string }[];
  handleThemeChange: (theme: AppTheme) => void;
  handleSizeChange: (size: CardSize) => void;
  handleMouseToggle: (enabled: boolean) => void;
  handleFirstTimeAuthorize: (e: React.FormEvent) => void;
  handleOpenExternal: (url: string, e?: React.MouseEvent) => void;
  getCardBackground: (theme: AppTheme) => string;
  getPrimaryAccentColor: (theme: AppTheme) => string;
  getPrimaryBgColor: (theme: AppTheme) => string;
  headerIconUrl: string;
}

export function ActivationModal({
  isOpen,
  appTheme,
  cardSize,
  profileNameInput,
  setProfileNameInput,
  userAgeInput,
  setUserAgeInput,
  ageLockInput,
  setAgeLockInput,
  passcodeInput,
  setPasscodeInput,
  passcodeError,
  passcodeErrorMsg,
  ageErrorNotice,
  ageLockError,
  helpfulMouse,
  allThemesList,
  handleThemeChange,
  handleSizeChange,
  handleMouseToggle,
  handleFirstTimeAuthorize,
  handleOpenExternal,
  getCardBackground,
  getPrimaryAccentColor,
  getPrimaryBgColor,
  headerIconUrl,
}: ActivationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3 sm:p-6 backdrop-blur-xl overflow-y-auto">
      <form
        onSubmit={handleFirstTimeAuthorize}
        className={`relative w-full max-w-xl my-auto rounded-3xl border text-white shadow-2xl ${getCardBackground(appTheme)} backdrop-blur-2xl max-h-[92vh] overflow-y-auto`}
      >
        <div className="p-5 sm:p-8 space-y-4 sm:space-y-5">
          <div className="text-center space-y-2">
            <div className="mx-auto flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl overflow-hidden border border-white/20 shadow-lg bg-black">
              <img
                src={headerIconUrl}
                alt="RABBiT TV Logo"
                className="h-full w-full object-fill"
              />
            </div>
            <h2 className={`text-xl sm:text-2xl font-bold ${getPrimaryAccentColor(appTheme)}`}>
              Welcome to RABBiT TV
            </h2>
          </div>

          <div className="space-y-2.5 text-xs sm:text-sm leading-relaxed text-slate-300 text-center">
            <p>Get all your favorite movies and TV shows right here, streaming smoothly in one place!</p>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-300">
              <strong>⏳ Trial:</strong> Enter <strong>`9654`</strong> for a free 7-day trial (one-time per device). Full unlock uses a personal activation code verified securely online.
            </div>
          </div>

          <div className="space-y-1.5 border-t border-white/10 pt-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              What&apos;s your name?{" "}
              <span className="text-slate-400 font-normal lowercase">(Used for your unlock verification)</span>
            </label>
            <input
              type="text"
              maxLength={25}
              value={profileNameInput}
              onChange={(e) => setProfileNameInput(e.target.value)}
              placeholder="Enter Name"
              className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-4 py-2.5 text-center text-sm sm:text-base font-bold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>

          <div className="space-y-1.5 border-t border-white/10 pt-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              How old are you?
            </label>
            <input
              type="number"
              min={1}
              max={120}
              value={userAgeInput}
              onChange={(e) => setUserAgeInput(e.target.value)}
              placeholder="Enter Age"
              className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-4 py-2.5 text-center text-sm sm:text-base font-bold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
            {ageErrorNotice && (
              <p className="text-xs font-semibold text-red-400 text-center">⚠️ Please enter your age.</p>
            )}
          </div>

          <div className="space-y-1.5 border-t border-white/10 pt-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Create Age-Lock Code <span className="text-red-400">*</span>
            </label>
            <p className="text-[11px] text-slate-300 text-center">
              Choose a 4-digit PIN parents can use later to change the age setting. Required.
            </p>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={ageLockInput}
              onChange={(e) => setAgeLockInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="••••"
              className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-4 py-2 text-center text-lg font-bold tracking-[0.4em] text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
            {ageLockError && (
              <p className="text-xs font-semibold text-red-400 text-center">
                ⚠️ Enter a 4-digit age-lock code (numbers only).
              </p>
            )}
          </div>

          <div className="space-y-2 border-t border-white/10 pt-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Select Startup Theme:
            </label>
            <div className="grid grid-cols-3 gap-2">
              {allThemesList.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleThemeChange(t.id)}
                  className={`rounded-xl border py-2 px-1 text-[11px] sm:text-xs font-bold transition focus:outline-none ${
                    appTheme === t.id
                      ? `border-white/30 ${getPrimaryBgColor(t.id)} text-white shadow-lg`
                      : "border-white/10 bg-slate-800/60 text-slate-300 hover:bg-slate-700/60"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 border-t border-white/10 pt-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Select Display Size:
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["small", "medium", "large"] as CardSize[]).map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => handleSizeChange(size)}
                  className={`rounded-xl border py-2 px-1 text-[11px] sm:text-xs font-bold transition focus:outline-none ${
                    cardSize === size
                      ? `border-white/30 ${getPrimaryBgColor(appTheme)} text-white shadow-lg`
                      : "border-white/10 bg-slate-800/60 text-slate-300 hover:bg-slate-700/60"
                  }`}
                >
                  {size === "small" ? "Small (25%)" : size === "medium" ? "Medium (60%)" : "Large (100%)"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-white/10 pt-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                XL Mouse Pointer
              </label>
              <p className="text-[11px] text-slate-300">Enlarges cursor 3x for projector/TV use.</p>
            </div>
            <button
              type="button"
              onClick={() => handleMouseToggle(!helpfulMouse)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                helpfulMouse ? "bg-violet-600" : "bg-slate-700"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  helpfulMouse ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <div className="space-y-2.5 border-t border-white/10 pt-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Unlock Code or Trial (`9654`):
            </label>
            <input
              type="text"
              maxLength={16}
              value={passcodeInput}
              onChange={(e) => setPasscodeInput(e.target.value)}
              placeholder="Unlock code or 9654"
              className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-4 py-3 text-center text-base sm:text-lg font-bold tracking-widest text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
            {passcodeError && (
              <div className="space-y-1 text-center">
                <p className="text-xs font-semibold text-red-400">{passcodeErrorMsg}</p>
                <p className="text-[11px] text-slate-300">
                  Need help? Message{" "}
                  <button
                    type="button"
                    onClick={(e) =>
                      handleOpenExternal(
                        "https://wa.me/?text=Hi%20Rabbit,%20I%20need%20help%20with%20my%20passcode%20on%20RABBiT%20TV",
                        e
                      )
                    }
                    className="text-emerald-400 font-bold underline hover:text-emerald-300 bg-transparent border-none cursor-pointer p-0 inline"
                  >
                    WhatsApp contact (@RabbitProductions)
                  </button>{" "}
                  or text{" "}
                  <button
                    type="button"
                    onClick={(e) => handleOpenExternal("sms:7058093865", e)}
                    className="text-amber-300 font-bold underline hover:text-amber-200 bg-transparent border-none cursor-pointer p-0 inline"
                  >
                    (705) 809-3865
                  </button>
                  .
                </p>
              </div>
            )}

            <div className="rounded-xl border border-white/10 bg-black/40 p-2.5 text-center text-xs text-slate-300 space-y-1 backdrop-blur-md">
              <p className="font-semibold text-white">Need an activation code or support?</p>
              <p className="text-[11px] text-slate-300">
                Message me on WhatsApp (
                <button
                  type="button"
                  onClick={(e) =>
                    handleOpenExternal(
                      "https://wa.me/?text=Hi%20Rabbit,%20I%20need%20an%20activation%20code%20for%20RABBiT%20TV",
                      e
                    )
                  }
                  className="text-emerald-400 font-bold underline hover:text-emerald-300 bg-transparent border-none cursor-pointer p-0 inline"
                >
                  @RabbitProductions
                </button>
                ) or text for a code at{" "}
                <button
                  type="button"
                  onClick={(e) => handleOpenExternal("sms:7058093865", e)}
                  className="text-amber-300 font-bold underline hover:text-amber-200 bg-transparent border-none cursor-pointer p-0 inline"
                >
                  (705) 809-3865
                </button>
                .
              </p>
            </div>

            <button
              type="submit"
              className={`w-full rounded-xl ${getPrimaryBgColor(appTheme)} py-3.5 text-sm sm:text-base font-bold text-white shadow-lg transition active:scale-95 focus:outline-none`}
            >
              Activate & Enter RABBiT TV
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
