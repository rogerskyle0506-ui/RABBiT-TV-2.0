// src/components/ActivationModal.tsx
import React, { useState, useEffect } from "react";
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
  setRamMode,
  getRamMode,
  saveAgeLockPinSecure,
  isValidAgeLockPin,
  applyAllSettingsToDocument,
} from "@/lib/settings";
import { sendPermanentActivationAlert } from "@/lib/report";

// ——— Private GitHub Gist Key Verification & Fleet Policy Management ———
const GIST_ID = ((import.meta as any).env?.VITE_GIST_ID as string) || "";
const GITHUB_TOKEN = ((import.meta as any).env?.VITE_GH_PAT as string) || "";
const GIST_API_URL = GIST_ID ? `https://api.github.com/gists/${GIST_ID}` : "";

const ADMIN_NAME = "Rabbit";
const ADMIN_BIRTH_YEAR = 1988;
const TRIAL_CODE = "9654";
const AUTH_LOCKOUT_KEY = "rabtv_activation_lockout_until";

const BANNER_IMAGE_URL =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/HeaderFamily.jpg";
const RABBIT_HEADER_PILL =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/rabbit-header-pill.jpg";
const RABBIT_DIVIDER =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/rabbit-divider.jpg";

function getExpectedAdminAge(): number {
  return new Date().getFullYear() - ADMIN_BIRTH_YEAR;
}

function isAdminCredentials(name: string, age: number): boolean {
  return (
    name.trim().toLowerCase() === ADMIN_NAME.toLowerCase() &&
    age === getExpectedAdminAge()
  );
}

/**
 * Checks remote `admin_config.json` on Gist to see if 7-day trials are currently allowed.
 */
async function checkRemoteTrialAllowed(): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  if (!GIST_ID || !GITHUB_TOKEN || !GIST_API_URL) return { allowed: true };
  try {
    const res = await fetch(GIST_API_URL, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "RabbitTV-App",
      },
      cache: "no-store",
    });
    if (!res.ok) return { allowed: true };
    const gistData = await res.json();
    const rawConfig = gistData.files?.["admin_config.json"]?.content;
    if (!rawConfig) return { allowed: true };

    const parsed = JSON.parse(rawConfig);
    if (parsed && parsed.allowTrials === false) {
      return {
        allowed: false,
        reason:
          "⚠️ 7-Day Free Trials are currently paused by the administrator. Please request a full activation code below.",
      };
    }
    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}

/**
 * Verifies and consumes a single-use unlock key from `keys.json` on Gist.
 */
async function verifyUnlockCodeWithGitHub(
  name: string,
  age: number,
  securityKey: string
): Promise<{ valid: boolean; errorMsg?: string }> {
  if (!GIST_ID || !GITHUB_TOKEN || !GIST_API_URL) {
    return {
      valid: false,
      errorMsg: "⚠️ Verification service unavailable. Check connection.",
    };
  }
  const cleanKey = String(securityKey || "").trim();
  if (!cleanKey) {
    return { valid: false, errorMsg: "⚠️ Please enter an unlock code." };
  }

  try {
    const res = await fetch(GIST_API_URL, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "RabbitTV-App",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        valid: false,
        errorMsg: "⚠️ Could not reach verification server. Try again.",
      };
    }

    const gistData = await res.json();
    const rawContent = gistData.files?.["keys.json"]?.content;
    if (!rawContent) {
      return { valid: false, errorMsg: "⚠️ Invalid Passcode." };
    }

    const keysList = JSON.parse(rawContent);
    if (!Array.isArray(keysList)) {
      return { valid: false, errorMsg: "⚠️ Invalid Passcode." };
    }

    const matchedIndex = keysList.findIndex((item: any) => {
      if (typeof item === "object" && item !== null) {
        return String(item.key).trim() === cleanKey && item.active === true;
      }
      return String(item).trim() === cleanKey;
    });

    if (matchedIndex === -1) {
      const alreadyUsed = keysList.some(
        (item: any) =>
          typeof item === "object" &&
          item !== null &&
          String(item.key).trim() === cleanKey &&
          item.active === false
      );
      if (alreadyUsed) {
        return {
          valid: false,
          errorMsg:
            "⚠️ This unlock key has already been redeemed and cannot be reused.",
        };
      }
      return {
        valid: false,
        errorMsg: "⚠️ Invalid Passcode for this name and age.",
      };
    }

    const matchedItem = keysList[matchedIndex];

    // Validate owner name & age binding if key was generated for a specific user
    if (
      typeof matchedItem === "object" &&
      matchedItem !== null &&
      typeof matchedItem.owner === "string"
    ) {
      const ownerStr = matchedItem.owner.trim();
      const isGenericOwner =
        !ownerStr ||
        ownerStr === "Legacy" ||
        ownerStr === "Unassigned" ||
        ownerStr === "Admin Recycled";

      if (!isGenericOwner) {
        const ownerMatch = ownerStr.match(/^(.*?)\s*\((\d+)\)$/);
        if (ownerMatch) {
          const expectedName = ownerMatch[1].trim().toLowerCase();
          const expectedAge = parseInt(ownerMatch[2], 10);
          const enteredNameLower = name.trim().toLowerCase();

          const nameMatches =
            expectedName === enteredNameLower ||
            expectedName.includes(enteredNameLower) ||
            enteredNameLower.includes(expectedName);
          const ageMatches = !isNaN(expectedAge) && expectedAge === age;

          if (!nameMatches || !ageMatches) {
            return {
              valid: false,
              errorMsg:
                "⚠️ This key is registered to a different Name or Age. Please enter the exact Name and Age given to Rabbit.",
            };
          }
        }
      }
    }

    // Single-use enforcement
    if (typeof matchedItem === "object" && matchedItem !== null) {
      keysList[matchedIndex] = {
        ...matchedItem,
        active: false,
        usedBy: `${name} (Age: ${age})`,
        claimedAt: new Date().toISOString(),
      };
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

    return { valid: true };
  } catch (error) {
    console.error("Failed to verify and consume key with Gist:", error);
    return {
      valid: false,
      errorMsg: "⚠️ Network error while verifying key. Please try again.",
    };
  }
}

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
  const [nameErrorNotice, setNameErrorNotice] = useState(false);
  const [ageErrorNotice, setAgeErrorNotice] = useState(false);
  const [ageLockError, setAgeLockError] = useState(false);
  const [ageLockInput, setAgeLockInput] = useState("");
  const [showPinDigits, setShowPinDigits] = useState(false);
  const [userAgeInput, setUserAgeInput] = useState("");
  const [profileNameInput, setProfileNameInput] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  // Brute-force protection states
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number>(() => {
    if (typeof window !== "undefined") {
      return Number(sessionStorage.getItem(AUTH_LOCKOUT_KEY) || 0);
    }
    return 0;
  });
  const [lockoutSecondsLeft, setLockoutSecondsLeft] = useState(0);

  // Hardware RAM Mode optimization synced cleanly through settings.ts
  const [ramMode, setRamModeLocal] = useState<"low" | "high">(() => {
    const saved = getRamMode();
    return saved === "high" ? "high" : "low";
  });

  useEffect(() => {
    if (!lockoutUntil || Date.now() >= lockoutUntil) {
      setLockoutSecondsLeft(0);
      return;
    }
    const updateRemaining = () => {
      const rem = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000));
      setLockoutSecondsLeft(rem);
      if (rem <= 0 && typeof window !== "undefined") {
        sessionStorage.removeItem(AUTH_LOCKOUT_KEY);
      }
    };
    updateRemaining();
    const interval = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(interval);
  }, [lockoutUntil]);

  if (!isOpen) return null;

  const handleRamModeSelect = (mode: "low" | "high") => {
    setRamModeLocal(mode);
    setRamMode(mode);
  };

  const registerFailedAttempt = (msg: string) => {
    const nextCount = failedAttempts + 1;
    setFailedAttempts(nextCount);
    setPasscodeError(true);
    setAgeErrorNotice(false);
    setAgeLockError(false);
    setNameErrorNotice(false);
    setPasscodeInput("");

    if (nextCount >= 4) {
      const until = Date.now() + 30000;
      setLockoutUntil(until);
      if (typeof window !== "undefined") {
        sessionStorage.setItem(AUTH_LOCKOUT_KEY, String(until));
      }
      setPasscodeErrorMsg(
        "🚨 Too many failed attempts. Security cooldown active for 30 seconds."
      );
    } else {
      setPasscodeErrorMsg(msg);
    }
  };

  const completePermanentLogin = async (
    finalName: string,
    parsedAge: number,
    ageLockCode: string,
    options?: { admin?: boolean; forceTheme?: AppTheme; forceSize?: CardSize }
  ) => {
    localStorage.setItem(DISCLAIMER_ACCEPTED_KEY, "true");
    localStorage.setItem("rabtv_access_status", "permanent");
    localStorage.removeItem("rabtv_trial_start_timestamp");

    sessionStorage.setItem("rabtv_session_verified", "true");
    sessionStorage.removeItem(AUTH_LOCKOUT_KEY);

    // Save hashed PIN & RAM mode through settings.ts so memoryCache stays 100% synced
    await saveAgeLockPinSecure(ageLockCode);
    setRamMode(ramMode);

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
    applyAllSettingsToDocument();

    if (!options?.admin) {
      sendPermanentActivationAlert(finalName);
    }

    setPasscodeError(false);
    setAgeErrorNotice(false);
    setAgeLockError(false);
    setNameErrorNotice(false);
    window.dispatchEvent(new Event("rabtv_settings_updated"));
    onAuthorized();
  };

  const handleFirstTimeAuthorize = async (e: React.FormEvent) => {
    e.preventDefault();

    if (lockoutSecondsLeft > 0) {
      setPasscodeError(true);
      setPasscodeErrorMsg(
        `⏳ Security cooldown active. Please wait ${lockoutSecondsLeft}s before trying again.`
      );
      return;
    }

    const cleanName = profileNameInput.trim();
    if (!cleanName || cleanName.length < 2) {
      setNameErrorNotice(true);
      setAgeErrorNotice(false);
      setAgeLockError(false);
      setPasscodeError(false);
      return;
    }

    const trimmedAge = userAgeInput.trim();
    const parsedAge = parseInt(trimmedAge, 10);
    if (!trimmedAge || isNaN(parsedAge) || parsedAge < 1 || parsedAge > 120) {
      setAgeErrorNotice(true);
      setNameErrorNotice(false);
      setPasscodeError(false);
      setAgeLockError(false);
      return;
    }

    // 4 to 6 digit PIN check (Fire TV Stick compatible)
    const ageLock = ageLockInput.trim();
    if (!isValidAgeLockPin(ageLock)) {
      setAgeLockError(true);
      setNameErrorNotice(false);
      setAgeErrorNotice(false);
      setPasscodeError(false);
      return;
    }

    const enteredCode = passcodeInput.trim();

    // 1. Admin Direct Authentication
    if (isAdminCredentials(cleanName, parsedAge)) {
      await completePermanentLogin(ADMIN_NAME, parsedAge, ageLock, {
        admin: true,
        forceTheme: "red",
        forceSize: "small",
      });
      return;
    }

    setIsVerifying(true);
    try {
      // 2. 7-Day Free Trial Flow (9654)
      if (enteredCode === TRIAL_CODE) {
        const trialAlreadyUsed =
          localStorage.getItem("rabtv_trial_used_flag") === "true";
        if (trialAlreadyUsed) {
          registerFailedAttempt(
            "⚠️ Trial code has already been used on this device and cannot be redeemed again."
          );
          return;
        }

        const remoteTrialCheck = await checkRemoteTrialAllowed();
        if (!remoteTrialCheck.allowed) {
          registerFailedAttempt(
            remoteTrialCheck.reason ||
              "⚠️ Free trials are currently unavailable."
          );
          return;
        }

        localStorage.setItem(DISCLAIMER_ACCEPTED_KEY, "true");
        localStorage.setItem("rabtv_access_status", "trial");
        localStorage.setItem("rabtv_trial_start_timestamp", String(Date.now()));
        localStorage.setItem("rabtv_trial_used_flag", "true");
        localStorage.removeItem("rabtv_is_admin");

        sessionStorage.setItem("rabtv_session_verified", "true");
        sessionStorage.removeItem(AUTH_LOCKOUT_KEY);

        await saveAgeLockPinSecure(ageLock);
        setRamMode(ramMode);
        saveCardSize(cardSize);
        saveStreamQuality(streamQuality);
        saveTheme(appTheme);
        setHelpfulMouse(helpfulMouse);
        saveUserAge(parsedAge);
        localStorage.setItem("rabtv_profile_name", cleanName);
        applyAllSettingsToDocument();

        window.dispatchEvent(new Event("rabtv_settings_updated"));
        onAuthorized();
        return;
      }

      // 3. Permanent Single-Use Gist Key Flow
      const verification = await verifyUnlockCodeWithGitHub(
        cleanName,
        parsedAge,
        enteredCode
      );
      if (verification.valid) {
        await completePermanentLogin(cleanName, parsedAge, ageLock);
        return;
      }

      registerFailedAttempt(
        verification.errorMsg || "⚠️ Invalid Passcode for this name and age."
      );
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="rabtv-vidsrc-protected fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-5 backdrop-blur-xl overflow-y-auto">
      <form
        onSubmit={handleFirstTimeAuthorize}
        className={`relative w-full max-w-xl my-auto rounded-[28px] border-2 border-cyan-400/35 text-white shadow-[0_25px_80px_rgba(0,0,0,0.95),0_0_35px_rgba(56,189,248,0.2),0_0_25px_rgba(239,68,68,0.18)] ${getCardBackground(
          appTheme
        )} backdrop-blur-2xl max-h-[94dvh] overflow-hidden flex flex-col`}
      >
        {/* Clean Top & Bottom Neon Laser Accents (Never Collides with Inner Elements) */}
        <div className="absolute inset-x-10 top-0 h-[2px] bg-gradient-to-r from-cyan-400 via-violet-400 to-red-500 opacity-90 z-20 pointer-events-none" />
        <div className="absolute inset-x-10 bottom-0 h-[2px] bg-gradient-to-r from-red-500 via-violet-400 to-cyan-400 opacity-90 z-20 pointer-events-none" />

        {/* Subtle Splash Banner Background */}
        <div className="absolute inset-0 pointer-events-none z-0">
          <img
            src={BANNER_IMAGE_URL}
            alt="Splash Banner"
            className="w-full h-full object-cover opacity-20 filter blur-[2px] scale-105"
          />
          <div className="absolute inset-0 bg-slate-950/85" />
        </div>

        <div className="relative z-10 p-4 sm:p-7 space-y-4 overflow-y-auto scrollbar-none max-h-[94dvh]">
          {/* Header Identity */}
          <div className="text-center space-y-2.5">
            <div className="mx-auto flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl overflow-hidden border-2 border-cyan-400/50 shadow-[0_0_25px_rgba(56,189,248,0.35)] bg-black">
              <img
                src={headerIconUrl}
                alt="RABBiT TV Logo"
                className="h-full w-full object-cover"
              />
            </div>

            <div className="relative inline-flex max-w-full items-center justify-center px-4 sm:px-6 py-1.5 rounded-2xl overflow-hidden border border-white/15">
              <div
                className="absolute inset-0 pointer-events-none opacity-80"
                style={{
                  backgroundImage: `url(${RABBIT_HEADER_PILL})`,
                  backgroundSize: "115% 360%",
                  backgroundPosition: "center center",
                }}
              />
              <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" />
              <h2
                className={`relative z-10 whitespace-nowrap text-base sm:text-xl font-black tracking-wide drop-shadow ${getPrimaryAccentColor(
                  appTheme
                )}`}
              >
                Welcome to RABBiT TV
              </h2>
            </div>

            <p className="text-xs sm:text-sm font-medium text-slate-200 max-w-md mx-auto leading-relaxed">
              Top movies, trending series, and 280+ live TV channels—zero ads,
              zero recurring subscriptions.
            </p>
          </div>

          {/* Trial Notice Banner */}
          <div className="rounded-2xl border border-amber-400/35 bg-gradient-to-r from-amber-500/15 via-black/65 to-amber-500/15 p-3 text-xs text-amber-200 shadow-inner text-center backdrop-blur-md">
            <p>
              <strong>⏳ Free 7-Day Trial:</strong> Enter{" "}
              <strong className="text-white font-mono bg-black/65 px-1.5 py-0.5 rounded border border-amber-400/40">
                9654
              </strong>{" "}
              below for a one-time 7-day trial on this device, or enter your
              lifetime unlock key.
            </p>
          </div>

          {/* 1. Name & Age Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-white/15 pt-3.5">
            <div className="sm:col-span-2 space-y-1">
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-200">
                Your Name{" "}
                <span className="text-cyan-300 font-normal lowercase">
                  (For key verification)
                </span>
              </label>
              <input
                type="text"
                maxLength={25}
                value={profileNameInput}
                onChange={(e) => {
                  setProfileNameInput(e.target.value);
                  if (nameErrorNotice) setNameErrorNotice(false);
                }}
                placeholder="Enter Name"
                className="w-full rounded-xl border border-white/15 bg-black/75 px-3.5 py-2.5 text-sm font-bold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition"
              />
              {nameErrorNotice && (
                <p className="text-[11px] font-bold text-red-400">
                  ⚠️ Please enter your name (at least 2 characters).
                </p>
              )}
            </div>

            <div className="sm:col-span-1 space-y-1">
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-200">
                Your Age <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                min={1}
                max={120}
                value={userAgeInput}
                onChange={(e) => {
                  setUserAgeInput(e.target.value);
                  if (ageErrorNotice) setAgeErrorNotice(false);
                }}
                placeholder="Age"
                className="w-full rounded-xl border border-white/15 bg-black/75 px-3.5 py-2.5 text-center text-sm font-bold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition"
              />
              {ageErrorNotice && (
                <p className="text-[11px] font-bold text-red-400">
                  ⚠️ Enter age (1–120).
                </p>
              )}
            </div>
          </div>

          {/* 2. Mandatory 4 to 6 Digit Age-Lock PIN (Fire TV Stick Ready) */}
          <div className="space-y-1.5 border-t border-white/15 pt-3.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-200 truncate">
                Age-Lock PIN (4–6 Digits){" "}
                <span className="text-red-400">*</span>
              </label>
              <span
                className={`whitespace-nowrap shrink-0 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                  isValidAgeLockPin(ageLockInput)
                    ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-300"
                    : "bg-white/5 border-white/15 text-cyan-300"
                }`}
              >
                {ageLockInput.length}/6 • Fire TV OK
              </span>
            </div>

            <p className="text-[11px] text-slate-300">
              Choose a <strong>4, 5, or 6 digit PIN</strong> for parental age
              locks and profile updates.
            </p>

            <div className="relative flex items-center">
              <input
                type={showPinDigits ? "text" : "password"}
                inputMode="numeric"
                maxLength={6}
                value={ageLockInput}
                onChange={(e) => {
                  setAgeLockInput(
                    e.target.value.replace(/\D/g, "").slice(0, 6)
                  );
                  if (ageLockError) setAgeLockError(false);
                }}
                placeholder="••••••"
                className="w-full rounded-xl border border-white/15 bg-black/75 pl-14 pr-14 py-2.5 text-center text-lg font-black tracking-[0.3em] text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition"
              />
              <button
                type="button"
                onClick={() => setShowPinDigits((prev) => !prev)}
                className="absolute right-2.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-bold text-slate-200 transition cursor-pointer"
                title={showPinDigits ? "Hide PIN" : "Show PIN"}
              >
                {showPinDigits ? "Hide" : "Show"}
              </button>
            </div>

            {ageLockError && (
              <p className="text-xs font-bold text-red-400 text-center">
                ⚠️ Please enter a 4 to 6 digit numeric PIN code (numbers only).
              </p>
            )}
          </div>

          {/* 3. Startup Theme & Display Size */}
          <div className="space-y-3 border-t border-white/15 pt-3.5">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-200">
                Select Neon Console Theme:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {allThemesList.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onThemeChange(t.id)}
                    className={`rounded-xl border py-2 px-2 text-xs font-bold whitespace-nowrap truncate transition-all cursor-pointer hover:scale-[1.03] focus:scale-[1.03] focus:outline-none ${
                      appTheme === t.id
                        ? `border-white/40 ${getPrimaryBgColor(
                            t.id
                          )} text-white shadow-lg`
                        : "border-white/10 bg-black/60 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-200">
                Select Poster Grid Size:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: "small", title: "Small", sub: "TV Grid" },
                    { id: "medium", title: "Medium", sub: "Balanced" },
                    { id: "large", title: "Large", sub: "Cinema" },
                  ] as { id: CardSize; title: string; sub: string }[]
                ).map((size) => (
                  <button
                    key={size.id}
                    type="button"
                    onClick={() => onSizeChange(size.id)}
                    className={`rounded-xl border py-2 px-1.5 text-center transition-all cursor-pointer hover:scale-[1.03] focus:scale-[1.03] focus:outline-none ${
                      cardSize === size.id
                        ? `border-white/40 ${getPrimaryBgColor(
                            appTheme
                          )} text-white shadow-lg`
                        : "border-white/10 bg-black/60 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    <span className="block text-xs font-extrabold">
                      {size.title}
                    </span>
                    <span className="block text-[9px] opacity-85">
                      {size.sub}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 4. Hardware Optimization & XL TV Mouse Pointer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 border-t border-white/15 pt-3.5">
            <div className="flex items-center justify-between gap-2 rounded-xl bg-black/65 border border-white/15 px-3 py-2.5">
              <div className="min-w-0">
                <span className="block text-[11px] font-extrabold uppercase tracking-wider text-cyan-300">
                  📟 Low RAM Stick Mode
                </span>
                <span className="block text-[10px] text-slate-300">
                  Anti-crash buffer cap for 1–2GB sticks.
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleRamModeSelect(ramMode === "low" ? "high" : "low")
                }
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                  ramMode === "low" ? "bg-emerald-600" : "bg-slate-700"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    ramMode === "low" ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 rounded-xl bg-black/65 border border-white/15 px-3 py-2.5">
              <div className="min-w-0">
                <span className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-200">
                  🖱️ XL Mouse Pointer
                </span>
                <span className="block text-[10px] text-slate-300">
                  Enlarges cursor 3x for TVs/projectors.
                </span>
              </div>
              <button
                type="button"
                onClick={() => onMouseToggle(!helpfulMouse)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
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
          </div>

          {/* 5. Unlock Code or Trial (9654) */}
          <div className="space-y-2.5 border-t border-white/15 pt-3.5">
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-200">
              Lifetime Unlock Key or Trial Code (9654):
            </label>
            <input
              type="text"
              maxLength={20}
              disabled={isVerifying || lockoutSecondsLeft > 0}
              value={passcodeInput}
              onChange={(e) => {
                setPasscodeInput(e.target.value);
                if (passcodeError) setPasscodeError(false);
              }}
              placeholder="Unlock key or 9654"
              className="w-full rounded-xl border border-cyan-400/40 bg-black/80 px-3 py-3 text-center text-sm sm:text-base font-black tracking-wider text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 disabled:opacity-50 transition"
            />

            {passcodeError && (
              <div className="rounded-xl bg-red-950/70 border border-red-500/45 p-2.5 space-y-1 text-center">
                <p className="text-xs font-bold text-red-300">
                  {passcodeErrorMsg}
                </p>
                <p className="text-[11px] text-slate-200">
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
                    WhatsApp (@RabbitProductions)
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

            {/* Direct Contact Support Card */}
            <div className="rounded-xl border border-white/15 bg-black/60 p-2.5 text-center text-xs text-slate-300 space-y-1 backdrop-blur-md">
              <p className="font-bold text-white">
                Need an activation code or support?
              </p>
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
              disabled={isVerifying || lockoutSecondsLeft > 0}
              className={`w-full rounded-2xl ${getPrimaryBgColor(
                appTheme
              )} py-3.5 text-sm sm:text-base font-black tracking-wide text-white shadow-xl transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 focus:outline-none focus:ring-4 focus:ring-cyan-400 cursor-pointer`}
            >
              {lockoutSecondsLeft > 0
                ? `⏳ Security Cooldown (${lockoutSecondsLeft}s)`
                : isVerifying
                  ? "⚡ Verifying Credentials..."
                  : "🚀 Enter RABBiT TV"}
            </button>

            <div className="pt-1 text-center">
              <img
                src={RABBIT_DIVIDER}
                alt=""
                className="w-1/2 mx-auto h-1.5 object-contain opacity-75"
              />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
