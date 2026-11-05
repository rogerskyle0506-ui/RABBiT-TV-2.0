// src/components/ActivationModal.tsx
import React, { useState } from "react";
import {
  CardSize,
  StreamQuality,
  AppTheme,
  DISCLAIMER_ACCEPTED_KEY,
  saveCardSize,
  saveStreamQuality,
  saveTheme,
  setHelpfulMouse,
  saveUserAge,
} from "@/lib/settings";
import { sendPermanentActivationAlert } from "@/lib/report";

// ——— Private GitHub Gist Key Verification & Management ———
const GIST_ID = (import.meta as any).env?.VITE_GIST_ID as string || "";
const GITHUB_TOKEN = (import.meta as any).env?.VITE_GH_PAT as string || "";
const GIST_API_URL = GIST_ID ? `https://api.github.com/gists/${GIST_ID}` : "";

async function verifyUnlockCodeWithGitHub(name: string, age: number, securityKey: string): Promise<boolean> {
  if (!GIST_ID || !GITHUB_TOKEN || !GIST_API_URL) return false;
  try {
    const res = await fetch(GIST_API_URL, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "RabbitTV-App"
      }
    });

    if (!res.ok) return false;
    const gistData = await res.json();
    const rawContent = gistData.files?.["keys.json"]?.content;
    if (!rawContent) return false;

    let keysList = JSON.parse(rawContent);

    if (!Array.isArray(keysList)) return false;

    let matchedIndex = -1;
    let isObjectFormat = typeof keysList[0] === "object" && keysList[0] !== null;

    if (isObjectFormat) {
      matchedIndex = keysList.findIndex((item: any) => item.key === String(securityKey) && item.active === true);
    } else {
      matchedIndex = keysList.findIndex((item: any) => String(item) === String(securityKey));
    }

    if (matchedIndex === -1) return false;

    // Single-use enforcement: Mark key as inactive upon use
    if (isObjectFormat) {
      keysList[matchedIndex].active = false;
      keysList[matchedIndex].usedBy = `${name} (Age: ${age})`;
    } else {
      keysList.splice(matchedIndex, 1);
    }

    const updatedContent = JSON.stringify(keysList, null, 2);
    await fetch(GIST_API_URL, {
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

    return true;
  } catch (error) {
    console.error('Failed to verify and consume key with Gist:', error);
    return false;
  }
}

const ADMIN_NAME = "Rabbit";
const ADMIN_BIRTH_YEAR = 1988;

function getExpectedAdminAge(): number {
  return new Date().getFullYear() - ADMIN_BIRTH_YEAR;
}

function isAdminCredentials(name: string, age: number): boolean {
  return name.trim() === ADMIN_NAME && age === getExpectedAdminAge();
}

const TRIAL_CODE = "9654";
const AGE_LOCK_KEY = "rabtv_age_passcode";

const BANNER_IMAGE_URL = "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/HeaderFamily.jpg";

interface ActivationModalProps {
  isOpen: boolean;
  onAuthorized: () => void;
  appTheme: AppTheme;
  cardSize: CardSize;
  streamQuality: StreamQuality;
  helpfulMouse: boolean;
  allThemesList: { id: AppTheme; label: string }[];
  headerIconUrl: string;
  onThemeChange: (theme: AppTheme) => void;
  onSizeChange: (size: CardSize) => void;
  onMouseToggle: (enabled: boolean) => void;
  handleOpenExternal: (url: string, e?: React.MouseEvent) => void;
  getCardBackground: (theme: AppTheme) => string;
  getPrimaryAccentColor: (theme: AppTheme) => string;
  getPrimaryBgColor: (theme: AppTheme) => string;
}

export function ActivationModal({
  isOpen,
  onAuthorized,
  appTheme,
  cardSize,
  streamQuality,
  helpfulMouse,
  allThemesList,
  headerIconUrl,
  onThemeChange,
  onSizeChange,
  onMouseToggle,
  handleOpenExternal,
  getCardBackground,
  getPrimaryAccentColor,
  getPrimaryBgColor,
}: ActivationModalProps) {
  const [passcodeInput, setPasscodeInput] = useState("");
  const [passcodeError, setPasscodeError] = useState(false);
  const [passcodeErrorMsg, setPasscodeErrorMsg] = useState(
    "⚠️ Invalid Passcode. Please try again."
  );
  const [ageErrorNotice, setAgeErrorNotice] = useState(false);
  const [ageLockError, setAgeLockError] = useState(false);
  const [ageLockInput, setAgeLockInput] = useState("");
  const [userAgeInput, setUserAgeInput] = useState("");
  const [profileNameInput, setProfileNameInput] = useState("");

  if (!isOpen) return null;

  const saveAgeLockCode = (code: string) => {
    localStorage.setItem(AGE_LOCK_KEY, code);
  };

  const completePermanentLogin = (
    finalName: string,
    parsedAge: number,
    ageLockCode: string,
    options?: { admin?: boolean; forceTheme?: AppTheme; forceSize?: CardSize }
  ) => {
    localStorage.setItem(DISCLAIMER_ACCEPTED_KEY, "true");
    localStorage.setItem("rabtv_access_status", "permanent");
    localStorage.removeItem("rabtv_trial_start_timestamp");

    saveAgeLockCode(ageLockCode);

    if (options?.admin) {
      localStorage.setItem("rabtv_is_admin", "true");
    } else {
      localStorage.removeItem("rabtv_is_admin");
    }

    const themeToUse = options?.forceTheme ?? appTheme;
    const sizeToUse = options?.forceSize ?? cardSize;

    saveCardSize(sizeToUse);
    saveStreamQuality(streamQuality);
    saveTheme(themeToUse);
    setHelpfulMouse(helpfulMouse);

    saveUserAge(parsedAge);
    localStorage.setItem("rabtv_profile_name", finalName);

    if (!options?.admin) {
      sendPermanentActivationAlert(finalName);
    }

    setPasscodeError(false);
    setAgeErrorNotice(false);
    setAgeLockError(false);
    window.dispatchEvent(new Event("rabtv_settings_updated"));
    onAuthorized();
  };

  const handleFirstTimeAuthorize = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedAge = userAgeInput.trim();
    if (!trimmedAge || isNaN(parseInt(trimmedAge, 10))) {
      setAgeErrorNotice(true);
      setPasscodeError(false);
      setAgeLockError(false);
      return;
    }

    const ageLock = ageLockInput.trim();
    if (!/^\d{4}$/.test(ageLock)) {
      setAgeLockError(true);
      setAgeErrorNotice(false);
      setPasscodeError(false);
      return;
    }

    const parsedAge = parseInt(trimmedAge, 10);
    const finalName = profileNameInput.trim() || "Friend";
    const enteredCode = passcodeInput.trim();

    if (isAdminCredentials(finalName, parsedAge)) {
      completePermanentLogin(finalName, parsedAge, ageLock, {
        admin: true,
        forceTheme: "red",
        forceSize: "small",
      });
      return;
    }

    if (enteredCode === TRIAL_CODE) {
      const trialAlreadyUsed =
        localStorage.getItem("rabtv_trial_used_flag") === "true";
      if (trialAlreadyUsed) {
        setPasscodeError(true);
        setPasscodeErrorMsg(
          "⚠️ Trial code has already been used on this device and cannot be redeemed again."
        );
        setAgeErrorNotice(false);
        setAgeLockError(false);
        setPasscodeInput("");
        return;
      }

      localStorage.setItem(DISCLAIMER_ACCEPTED_KEY, "true");
      localStorage.setItem("rabtv_access_status", "trial");
      localStorage.setItem("rabtv_trial_start_timestamp", String(Date.now()));
      localStorage.setItem("rabtv_trial_used_flag", "true");
      localStorage.removeItem("rabtv_is_admin");

      saveAgeLockCode(ageLock);
      saveCardSize(cardSize);
      saveStreamQuality(streamQuality);
      saveTheme(appTheme);
      setHelpfulMouse(helpfulMouse);
      saveUserAge(parsedAge);
      localStorage.setItem("rabtv_profile_name", finalName);

      window.dispatchEvent(new Event("rabtv_settings_updated"));
      onAuthorized();
      return;
    }

    const isValidGitHubCode = await verifyUnlockCodeWithGitHub(finalName, parsedAge, enteredCode);
    if (isValidGitHubCode) {
      completePermanentLogin(finalName, parsedAge, ageLock);
      return;
    }

    setPasscodeError(true);
    setPasscodeErrorMsg(
      "⚠️ Invalid Passcode for this name and age."
    );
    setAgeErrorNotice(false);
    setAgeLockError(false);
    setPasscodeInput("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3 sm:p-6 backdrop-blur-xl overflow-y-auto">
      <form
        onSubmit={handleFirstTimeAuthorize}
        className={`relative w-full max-w-xl my-auto rounded-3xl border text-white shadow-2xl ${getCardBackground(appTheme)} backdrop-blur-2xl max-h-[92vh] overflow-hidden`}
      >
        {/* Banner Image Background with Overlay */}
        <div className="absolute inset-0 pointer-events-none z-0">
          <img
            src={BANNER_IMAGE_URL}
            alt="Splash Banner"
            className="w-full h-full object-cover opacity-20 filter blur-xs scale-105"
          />
          <div className="absolute inset-0 bg-slate-950/85" />
        </div>

        <div className="relative z-10 p-5 sm:p-8 space-y-4 sm:space-y-5 max-h-[92vh] overflow-y-auto">
          <div className="text-center space-y-2">
            <div className="mx-auto flex h-16 w-1Understood, absolutely no snippets. Here is the complete, full, updated `ActivationModal.tsx` file containing your banner background image overlay and your exact soft-launch welcome copy, fully integrated and ready to commit.

```tsx
// src/components/ActivationModal.tsx
import React, { useState } from "react";
import {
  CardSize,
  StreamQuality,
  AppTheme,
  DISCLAIMER_ACCEPTED_KEY,
  saveCardSize,
  saveStreamQuality,
  saveTheme,
  setHelpfulMouse,
  saveUserAge,
} from "@/lib/settings";
import { sendPermanentActivationAlert } from "@/lib/report";

// ——— Private GitHub Gist Key Verification & Management ———
const GIST_ID = (import.meta as any).env?.VITE_GIST_ID as string || "";
const GITHUB_TOKEN = (import.meta as any).env?.VITE_GH_PAT as string || "";
const GIST_API_URL = GIST_ID ? `[https://api.github.com/gists/$](https://api.github.com/gists/$){GIST_ID}` : "";

async function verifyUnlockCodeWithGitHub(name: string, age: number, securityKey: string): Promise<boolean> {
  if (!GIST_ID || !GITHUB_TOKEN || !GIST_API_URL) return false;
  try {
    const res = await fetch(GIST_API_URL, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "RabbitTV-App"
      }
    });

    if (!res.ok) return false;
    const gistData = await res.json();
    const rawContent = gistData.files?.["keys.json"]?.content;
    if (!rawContent) return false;

    let keysList = JSON.parse(rawContent);

    if (!Array.isArray(keysList)) return false;

    let matchedIndex = -1;
    let isObjectFormat = typeof keysList[0] === "object" && keysList[0] !== null;

    if (isObjectFormat) {
      matchedIndex = keysList.findIndex((item: any) => item.key === String(securityKey) && item.active === true);
    } else {
      matchedIndex = keysList.findIndex((item: any) => String(item) === String(securityKey));
    }

    if (matchedIndex === -1) return false;

    // Single-use enforcement: Mark key as inactive upon use
    if (isObjectFormat) {
      keysList[matchedIndex].active = false;
      keysList[matchedIndex].usedBy = `${name} (Age: ${age})`;
    } else {
      keysList.splice(matchedIndex, 1);
    }

    const updatedContent = JSON.stringify(keysList, null, 2);
    await fetch(GIST_API_URL, {
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

    return true;
  } catch (error) {
    console.error('Failed to verify and consume key with Gist:', error);
    return false;
  }
}

const ADMIN_NAME = "Rabbit";
const ADMIN_BIRTH_YEAR = 1988;

function getExpectedAdminAge(): number {
  return new Date().getFullYear() - ADMIN_BIRTH_YEAR;
}

function isAdminCredentials(name: string, age: number): boolean {
  return name.trim() === ADMIN_NAME && age === getExpectedAdminAge();
}

const TRIAL_CODE = "9654";
const AGE_LOCK_KEY = "rabtv_age_passcode";

const BANNER_IMAGE_URL = "[https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/HeaderFamily.jpg](https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/HeaderFamily.jpg)";

interface ActivationModalProps {
  isOpen: boolean;
  onAuthorized: () => void;
  appTheme: AppTheme;
  cardSize: CardSize;
  streamQuality: StreamQuality;
  helpfulMouse: boolean;
  allThemesList: { id: AppTheme; label: string }[];
  headerIconUrl: string;
  onThemeChange: (theme: AppTheme) => void;
  onSizeChange: (size: CardSize) => void;
  onMouseToggle: (enabled: boolean) => void;
  handleOpenExternal: (url: string, e?: React.MouseEvent) => void;
  getCardBackground: (theme: AppTheme) => string;
  getPrimaryAccentColor: (theme: AppTheme) => string;
  getPrimaryBgColor: (theme: AppTheme) => string;
}

export function ActivationModal({
  isOpen,
  onAuthorized,
  appTheme,
  cardSize,
  streamQuality,
  helpfulMouse,
  allThemesList,
  headerIconUrl,
  onThemeChange,
  onSizeChange,
  onMouseToggle,
  handleOpenExternal,
  getCardBackground,
  getPrimaryAccentColor,
  getPrimaryBgColor,
}: ActivationModalProps) {
  const [passcodeInput, setPasscodeInput] = useState("");
  const [passcodeError, setPasscodeError] = useState(false);
  const [passcodeErrorMsg, setPasscodeErrorMsg] = useState(
    "⚠️ Invalid Passcode. Please try again."
  );
  const [ageErrorNotice, setAgeErrorNotice] = useState(false);
  const [ageLockError, setAgeLockError] = useState(false);
  const [ageLockInput, setAgeLockInput] = useState("");
  const [userAgeInput, setUserAgeInput] = useState("");
  const [profileNameInput, setProfileNameInput] = useState("");

  if (!isOpen) return null;

  const saveAgeLockCode = (code: string) => {
    localStorage.setItem(AGE_LOCK_KEY, code);
  };

  const completePermanentLogin = (
    finalName: string,
    parsedAge: number,
    ageLockCode: string,
    options?: { admin?: boolean; forceTheme?: AppTheme; forceSize?: CardSize }
  ) => {
    localStorage.setItem(DISCLAIMER_ACCEPTED_KEY, "true");
    localStorage.setItem("rabtv_access_status", "permanent");
    localStorage.removeItem("rabtv_trial_start_timestamp");

    saveAgeLockCode(ageLockCode);

    if (options?.admin) {
      localStorage.setItem("rabtv_is_admin", "true");
    } else {
      localStorage.removeItem("rabtv_is_admin");
    }

    const themeToUse = options?.forceTheme ?? appTheme;
    const sizeToUse = options?.forceSize ?? cardSize;

    saveCardSize(sizeToUse);
    saveStreamQuality(streamQuality);
    saveTheme(themeToUse);
    setHelpfulMouse(helpfulMouse);

    saveUserAge(parsedAge);
    localStorage.setItem("rabtv_profile_name", finalName);

    if (!options?.admin) {
      sendPermanentActivationAlert(finalName);
    }

    setPasscodeError(false);
    setAgeErrorNotice(false);
    setAgeLockError(false);
    window.dispatchEvent(new Event("rabtv_settings_updated"));
    onAuthorized();
  };

  const handleFirstTimeAuthorize = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedAge = userAgeInput.trim();
    if (!trimmedAge || isNaN(parseInt(trimmedAge, 10))) {
      setAgeErrorNotice(true);
      setPasscodeError(false);
      setAgeLockError(false);
      return;
    }

    const ageLock = ageLockInput.trim();
    if (!/^\d{4}$/.test(ageLock)) {
      setAgeLockError(true);
      setAgeErrorNotice(false);
      setPasscodeError(false);
      return;
    }

    const parsedAge = parseInt(trimmedAge, 10);
    const finalName = profileNameInput.trim() || "Friend";
    const enteredCode = passcodeInput.trim();

    if (isAdminCredentials(finalName, parsedAge)) {
      completePermanentLogin(finalName, parsedAge, ageLock, {
        admin: true,
        forceTheme: "red",
        forceSize: "small",
      });
      return;
    }

    if (enteredCode === TRIAL_CODE) {
      const trialAlreadyUsed =
        localStorage.getItem("rabtv_trial_used_flag") === "true";
      if (trialAlreadyUsed) {
        setPasscodeError(true);
        setPasscodeErrorMsg(
          "⚠️ Trial code has already been used on this device and cannot be redeemed again."
        );
        setAgeErrorNotice(false);
        setAgeLockError(false);
        setPasscodeInput("");
        return;
      }

      localStorage.setItem(DISCLAIMER_ACCEPTED_KEY, "true");
      localStorage.setItem("rabtv_access_status", "trial");
      localStorage.setItem("rabtv_trial_start_timestamp", String(Date.now()));
      localStorage.setItem("rabtv_trial_used_flag", "true");
      localStorage.removeItem("rabtv_is_admin");

      saveAgeLockCode(ageLock);
      saveCardSize(cardSize);
      saveStreamQuality(streamQuality);
      saveTheme(appTheme);
      setHelpfulMouse(helpfulMouse);
      saveUserAge(parsedAge);
      localStorage.setItem("rabtv_profile_name", finalName);

      window.dispatchEvent(new Event("rabtv_settings_updated"));
      onAuthorized();
      return;
    }

    const isValidGitHubCode = await verifyUnlockCodeWithGitHub(finalName, parsedAge, enteredCode);
    if (isValidGitHubCode) {
      completePermanentLogin(finalName, parsedAge, ageLock);
      return;
    }

    setPasscodeError(true);
    setPasscodeErrorMsg(
      "⚠️ Invalid Passcode for this name and age."
    );
    setAgeErrorNotice(false);
    setAgeLockError(false);
    setPasscodeInput("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3 sm:p-6 backdrop-blur-xl overflow-y-auto">
      <form
        onSubmit={handleFirstTimeAuthorize}
        className={`relative w-full max-w-xl my-auto rounded-3xl border text-white shadow-2xl ${getCardBackground(appTheme)} backdrop-blur-2xl max-h-[92vh] overflow-hidden`}
      >
        {/* Banner Image Background with Overlay */}
        <div className="absolute inset-0 pointer-events-none z-0">
          <img
            src={BANNER_IMAGE_URL}
            alt="Splash Banner"
            className="w-full h-full object-cover opacity-20 filter blur-xs scale-105"
          />
          <div className="absolute inset-0 bg-slate-950/85" />
        </div>

        <div className="relative z-10 p-5 sm:p-8 space-y-4 sm:space-y-5 max-h-[92vh] overflow-y-auto">
          <div className="text-center space-y-2">
            <div className="mx-auto flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl overflow-hidden border border-white/20 shadow-lg bg-black">
              <img
                src={headerIconUrl}
                alt="RABBiT TV Logo"
                className="h-full w-full object-fill"
              />
            </div>
            <h2
              className={`text-xl sm:text-2xl font-bold ${getPrimaryAccentColor(appTheme)}`}
            >
              Welcome to RABBiT TV
            </h2>
          </div>

          <div className="space-y-2.5 text-xs sm:text-sm leading-relaxed text-slate-300 text-center">
            <p className="font-medium text-white">
              Get ready for top movies, trending series, and live TV—all tuned and ready to stream.
            </p>
            <p>
              Since we are currently in soft launch, you might run into a few minor bumps. You can easily report any bugs directly to us so we can keep improving your experience.
            </p>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-300">
              <strong>⏳ Trial:</strong> Enter <strong>`9654`</strong>{" "}
              for a free 7-day trial (one-time per device). Need an activation key to get started? Check the contact details below to grab yours.
            </div>
            <p className="text-xs text-slate-300 font-semibold">
              Sit back, pick a channel or show, and enjoy!
            </p>
          </div>

          <div className="space-y-1.5 border-t border-white/10 pt-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              What&apos;s your name?{" "}
              <span className="text-slate-400 font-normal lowercase">
                (Used for your unlock verification)
              </span>
            </label>
            <input
              type="text"
              maxLength={25}
              value={profileNameInput}
              onChange={(e) => {
                const val = e.target.value;
                setProfileNameInput(val);
                localStorage.setItem(
                  "rabtv_profile_name",
                  val.trim()
                );
              }}
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
              <p className="text-xs font-semibold text-red-400 text-center">
                ⚠️ Please enter your age.
              </p>
            )}
          </div>

          {/* Mandatory 4-digit age lock */}
          <div className="space-y-1.5 border-t border-white/10 pt-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Create Age-Lock Code{" "}
              <span className="text-red-400">*</span>
            </label>
            <p className="text-[11px] text-slate-300 text-center">
              Choose a 4-digit PIN parents can use later to change the
              age setting. Required.
            </p>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={ageLockInput}
              onChange={(e) =>
                setAgeLockInput(
                  e.target.value.replace(/\D/g, "").slice(0, 4)
                )
              }
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
                  onClick={() => onThemeChange(t.id)}
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
              {(["small", "medium", "large"] as CardSize[]).map(
                (size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => onSizeChange(size)}
                    className={`rounded-xl border py-2 px-1 text-[11px] sm:text-xs font-bold transition focus:outline-none ${
                      cardSize === size
                        ? `border-white/30 ${getPrimaryBgColor(appTheme)} text-white shadow-lg`
                        : "border-white/10 bg-slate-800/60 text-slate-300 hover:bg-slate-700/60"
                    }`}
                  >
                    {size === "small"
                      ? "Small (25%)"
                      : size === "medium"
                      ? "Medium (60%)"
                      : "Large (100%)"}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-white/10 pt-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                XL Mouse Pointer
              </label>
              <p className="text-[11px] text-slate-300">
                Enlarges cursor 3x for projector/TV use.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onMouseToggle(!helpfulMouse)}
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
                <p className="text-xs font-semibold text-red-400">
                  {passcodeErrorMsg}
                </p>
                <p className="text-[11px] text-slate-300">
                  Need help? Message{" "}
                  <button
                    type="button"
                    onClick={(e) => handleOpenExternal("[https://wa.me/?text=Hi%20Rabbit,%20I%20need%20help%20with%20my%20passcode%20on%20RABBiT%20TV](https://wa.me/?text=Hi%20Rabbit,%20I%20need%20help%20with%20my%20passcode%20on%20RABBiT%20TV)", e)}
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
                  </button>.
                </p>
              </div>
            )}

            {/* Contact Me info */}
            <div className="rounded-xl border border-white/10 bg-black/40 p-2.5 text-center text-xs text-slate-300 space-y-1 backdrop-blur-md">
              <p className="font-semibold text-white">Need an activation code or support?</p>
              <p className="text-[11px] text-slate-300">
                Message me on WhatsApp (
                <button
                  type="button"
                  onClick={(e) => handleOpenExternal("[https://wa.me/?text=Hi%20Rabbit,%20I%20need%20an%20activation%20code%20for%20RABBiT%20TV](https://wa.me/?text=Hi%20Rabbit,%20I%20need%20an%20activation%20code%20for%20RABBiT%20TV)", e)}
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
                </button>.
              </p>
            </div>

            <button
              type="submit"
              className={`w-full rounded-xl ${getPrimaryBgColor(appTheme)} py-3.5 text-sm sm:text-base font-bold text-white shadow-lg transition active:scale-95 focus:outline-none`}
            >
              Enter RABBiT TV
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
