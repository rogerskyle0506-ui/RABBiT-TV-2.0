// src/routes/admin.tsx
// RABBiT TV Full-Screen Admin Command Center (100% GitHub-Backed, Zero External Servers)
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { AppWallpaper } from "@/components/AppWallpaper";
import { AdminBugInbox } from "@/components/AdminBugInbox";
import { AdminReferralModal } from "@/components/AdminReferralModal";
import {
  AppTheme,
  getSavedTheme,
  getHardwareLimits,
  verifyAgeLockPin,
  getPinLockoutState,
  recordPinFailure,
  resetPinFailures,
  isValidAgeLockPin,
} from "@/lib/settings";
import {
  getBrokenLinksCount,
  clearAllBrokenLinks,
} from "@/lib/broken-links";
import {
  fetchReferralSystemData,
  computeFleetReferralTotals,
  type FleetReferralTotals,
} from "@/lib/referrals";
import {
  fetchPublicProfiles,
  fetchLatestCommunityReviews,
  blockCommunityUser,
  reportCommunityItem,
  type CommunityProfile,
  type CommunityReview,
} from "@/lib/community-service";
import {
  fetchFullAdminSnapshot,
  commitAdminGistFiles,
  probeProviderHealth,
  triggerGithubApkRebuild,
  getLocalVaultCredentials,
  saveLocalVaultCredentials,
  resolveAdminGistConfig,
  getAdminActorName,
  sanitizeAdminText,
  isSafeHttpsUrl,
  normalizeBlockDomain,
  isDomainProtected,
  createDefaultSourcesManifest,
  DEFAULT_BRANDING_CONFIG,
  type FullAdminSnapshot,
  type StreamProviderConfig,
  type TitleSourceOverride,
  type UserEnforcementRecord,
  type EnforcementType,
  type EnforcementReasonCode,
  type AdBlockRule,
  type BrandingAndFlagsConfig,
} from "@/lib/admin-store";

export const Route = createFileRoute("/admin")({
  component: AdminCommandCenterPage,
});

const ADMIN_VAULT_LOCKED_KEY = "rabtv_admin_vault_locked";

type AdminModuleTab =
  | "overview"
  | "streams"
  | "users"
  | "community"
  | "adblock"
  | "branding"
  | "alerts"
  | "audit";

type ToastSeverity = "info" | "warning" | "critical";
type KeyFilterMode = "all" | "active" | "used";

interface StepUpRequest {
  title: string;
  description: string;
  confirmWord?: string;
  requireReason?: boolean;
  defaultReason?: string;
  danger?: boolean;
  onConfirm: (reason: string) => Promise<void>;
}

const ADMIN_MODULES: { id: AdminModuleTab; icon: string; label: string }[] = [
  { id: "overview", icon: "📊", label: "Overview & Panic" },
  { id: "streams", icon: "🎬", label: "Streams & Sources" },
  { id: "users", icon: "🔑", label: "Users, Keys & Bans" },
  { id: "community", icon: "🎭", label: "Community Mod" },
  { id: "adblock", icon: "🛡️", label: "Ad Blocklist" },
  { id: "branding", icon: "🎨", label: "Branding & Flags" },
  { id: "alerts", icon: "📢", label: "Alerts & Inbox" },
  { id: "audit", icon: "📜", label: "Audit & Vault" },
];

const REASON_CODE_LABELS: Record<EnforcementReasonCode, string> = {
  fraud: "Fraud / Key Sharing",
  scam: "Scam / Impersonation",
  chargeback: "Payment Chargeback",
  tos_violation: "ToS Violation",
  attack: "Spam / Bot Attack",
  abuse: "Harassment / Abuse",
  other: "Other Reason",
};

function formatDateTime(ts: number | null | undefined): string {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function AdminCommandCenterPage() {
  const navigate = useNavigate();
  const [isAdminDevice, setIsAdminDevice] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("rabtv_is_admin") === "true";
  });
  const [isLowRam, setIsLowRam] = useState<boolean>(
    () => getHardwareLimits().effectiveMode === "low"
  );

  // Vault PIN Lock State
  const [isVaultLocked, setIsVaultLocked] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem(ADMIN_VAULT_LOCKED_KEY) === "true";
    }
    return false;
  });
  const [vaultPinInput, setVaultPinInput] = useState("");
  const [vaultError, setVaultError] = useState<string | null>(null);

  // Active Navigation Tab & Global Sync States
  const [activeTab, setActiveTab] = useState<AdminModuleTab>("overview");
  const [snapshot, setSnapshot] = useState<FullAdminSnapshot>(() => ({
    keys: [],
    notifications: [],
    manifest: createDefaultSourcesManifest(),
    branding: { ...DEFAULT_BRANDING_CONFIG },
    enforcement: [],
    adblockRules: [],
    adTickets: [],
    auditLog: [],
    fetchedAt: 0,
  }));
  const [loading, setLoading] = useState<boolean>(true);
  const [busy, setBusy] = useState<boolean>(false);
  const [statusToast, setStatusToast] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  // Step-Up Confirmation Modal State
  const [stepUp, setStepUp] = useState<StepUpRequest | null>(null);
  const [stepUpReason, setStepUpReason] = useState("");
  const [stepUpConfirmText, setStepUpConfirmText] = useState("");

  // Referral Ledger Modal
  const [isReferralModalOpen, setIsReferralModalOpen] = useState(false);
  const [referralTotals, setReferralTotals] =
    useState<FleetReferralTotals | null>(null);

  // Streams & Overrides Forms
  const [probingId, setProbingId] = useState<string | null>(null);
  const [probingAll, setProbingAll] = useState<boolean>(false);
  const [newProvName, setNewProvName] = useState("");
  const [newProvOrigin, setNewProvOrigin] = useState("");
  const [newProvMovieTpl, setNewProvMovieTpl] = useState("");
  const [newProvTvTpl, setNewProvTvTpl] = useState("");
  const [newProvTier, setNewProvTier] = useState<1 | 2>(2);

  const [ovMediaType, setOvMediaType] = useState<"movie" | "tv">("movie");
  const [ovMediaId, setOvMediaId] = useState("");
  const [ovTitle, setOvTitle] = useState("");
  const [ovAction, setOvAction] =
    useState<TitleSourceOverride["action"]>("override_stream");
  const [ovDirectUrl, setOvDirectUrl] = useState("");
  const [ovPublishAt, setOvPublishAt] = useState("");
  const [ovExpireAt, setOvExpireAt] = useState("");
  const [ovReason, setOvReason] = useState("");

  // Keys & User Enforcement Forms
  const [keygenName, setKeygenName] = useState("");
  const [keygenAge, setKeygenAge] = useState("");
  const [lastGeneratedKey, setLastGeneratedKey] = useState<string | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [keySearchQuery, setKeySearchQuery] = useState("");
  const [keyFilterMode, setKeyFilterMode] = useState<KeyFilterMode>("all");

  const [enfTarget, setEnfTarget] = useState("");
  const [enfType, setEnfType] = useState<EnforcementType>("ban");
  const [enfReasonCode, setEnfReasonCode] =
    useState<EnforcementReasonCode>("abuse");
  const [enfDurationDays, setEnfDurationDays] = useState<string>("0"); // 0 = Permanent
  const [enfNote, setEnfNote] = useState("");

  // Community Moderation State
  const [commProfiles, setCommProfiles] = useState<CommunityProfile[]>([]);
  const [commReviews, setCommReviews] = useState<CommunityReview[]>([]);
  const [commSearch, setCommSearch] = useState("");
  const [loadingComm, setLoadingComm] = useState(false);

  // Ad Blocklist Form
  const [newAdDomain, setNewAdDomain] = useState("");
  const [newAdReason, setNewAdReason] = useState("");
  const [adSearch, setAdSearch] = useState("");

  // Branding & Flags Draft
  const [brandingDraft, setBrandingDraft] = useState<BrandingAndFlagsConfig>({
    ...DEFAULT_BRANDING_CONFIG,
  });
  const [brokenLinksCount, setBrokenLinksCount] = useState<number>(() =>
    getBrokenLinksCount()
  );

  // Alerts / Toasts Form
  const [targetQuery, setTargetQuery] = useState("ALL");
  const [targetMessage, setTargetMessage] = useState("");
  const [toastSeverity, setToastSeverity] = useState<ToastSeverity>("info");

  // Audit & Split-Gist Vault State
  const [auditSearch, setAuditSearch] = useState("");
  const localVaultInit = useMemo(() => getLocalVaultCredentials(), []);
  const [vaultGistIdInput, setVaultGistIdInput] = useState(
    localVaultInit.customGistId
  );
  const [vaultPatInput, setVaultPatInput] = useState(localVaultInit.customPat);

  const inactivityTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((ok: boolean, text: string) => {
    setStatusToast({ ok, text });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setStatusToast(null);
      toastTimerRef.current = null;
    }, 4000);
  }, []);

  const resetInactivityTimer = useCallback(() => {
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
  }, [isVaultLocked]);

  useEffect(() => {
    resetInactivityTimer();
    return () => {
      if (inactivityTimerRef.current) {
        window.clearTimeout(inactivityTimerRef.current);
      }
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, [resetInactivityTimer, activeTab, isReferralModalOpen]);

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchFullAdminSnapshot();
      setSnapshot(res.snapshot);
      setBrandingDraft(res.snapshot.branding);
      if (!res.ok && res.error) {
        showToast(false, res.error);
      }
      void fetchReferralSystemData(false)
        .then((d) => setReferralTotals(computeFleetReferralTotals(d)))
        .catch(() => {});
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const loadCommunityModData = useCallback(async (force = false) => {
    setLoadingComm(true);
    try {
      const [pList, rList] = await Promise.all([
        fetchPublicProfiles(force),
        fetchLatestCommunityReviews(40, force),
      ]);
      setCommProfiles(pList);
      setCommReviews(rList);
    } catch {
      // ignore if community relay is unconfigured
    } finally {
      setLoadingComm(false);
    }
  }, []);

  useEffect(() => {
    const syncLocal = () => {
      setIsAdminDevice(localStorage.getItem("rabtv_is_admin") === "true");
      setIsLowRam(getHardwareLimits().effectiveMode === "low");
      setBrokenLinksCount(getBrokenLinksCount());
    };
    syncLocal();
    void loadSnapshot();
    void loadCommunityModData(false);

    window.addEventListener("rabtv_settings_updated", syncLocal);
    window.addEventListener("rabtv_broken_links_updated", syncLocal);
    return () => {
      window.removeEventListener("rabtv_settings_updated", syncLocal);
      window.removeEventListener("rabtv_broken_links_updated", syncLocal);
    };
  }, [loadSnapshot, loadCommunityModData]);

  // Escape key closes Step-Up modal cleanly
  useEffect(() => {
    if (!stepUp) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setStepUp(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stepUp]);

  const requestStepUp = (req: StepUpRequest) => {
    setStepUpReason(req.defaultReason || "");
    setStepUpConfirmText("");
    setStepUp(req);
  };

  // ===========================================================================
  // VAULT LOCK / UNLOCK HANDLERS
  // ===========================================================================
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
      setVaultError(
        next.isLocked
          ? `🚨 Vault locked for ${next.remainingSeconds}s.`
          : `❌ Incorrect PIN (${next.attemptsLeft} attempts left).`
      );
    }
  };

  const handleExitAdmin = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("rabtv_is_admin", "false");
      window.dispatchEvent(new Event("rabtv_settings_updated"));
    }
    navigate({ to: "/" });
  };

  // ===========================================================================
  // 1. STREAM & SOURCE MANAGEMENT HANDLERS
  // ===========================================================================
  const saveManifestWithRevision = async (
    nextProviders: StreamProviderConfig[],
    nextOverrides: TitleSourceOverride[],
    action: string,
    target: string,
    reason: string,
    summary: string
  ) => {
    setBusy(true);
    try {
      const prev = snapshot.manifest;
      const revEntry = {
        version: prev.version,
        savedAt: Date.now(),
        actor: getAdminActorName(),
        summary,
        providers: prev.providers,
        overrides: prev.overrides,
      };
      const normalizedProviders = nextProviders.map((p, i) => ({
        ...p,
        priority: i + 1,
      }));
      const nextManifest = {
        version: prev.version + 1,
        updatedAt: Date.now(),
        providers: normalizedProviders,
        overrides: nextOverrides,
        revisions: [revEntry, ...(prev.revisions || [])].slice(0, 10),
      };

      const res = await commitAdminGistFiles({
        filesToUpdate: { "sources_manifest.json": nextManifest },
        audit: {
          action,
          target,
          reason,
          beforeSummary: `v${prev.version} (${prev.providers.filter((p) => p.enabled).length}/${prev.providers.length} enabled)`,
          afterSummary: `v${nextManifest.version} (${normalizedProviders.filter((p) => p.enabled).length}/${normalizedProviders.length} enabled)`,
        },
      });
      if (res.ok) {
        setSnapshot((s) => ({ ...s, manifest: nextManifest }));
        showToast(true, `✓ ${summary}`);
        void loadSnapshot();
      } else {
        showToast(false, res.error || "Failed to update sources_manifest.json");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleMoveProvider = async (index: number, delta: -1 | 1) => {
    const list = [...snapshot.manifest.providers];
    const targetIdx = index + delta;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const [moved] = list.splice(index, 1);
    list.splice(targetIdx, 0, moved);
    await saveManifestWithRevision(
      list,
      snapshot.manifest.overrides,
      "STREAM_REORDER",
      moved.name,
      `Moved priority #${index + 1} → #${targetIdx + 1}`,
      `Reordered ${moved.name} to #${targetIdx + 1}`
    );
  };

  const handleToggleProvider = async (prov: StreamProviderConfig) => {
    const nextList = snapshot.manifest.providers.map((p) =>
      p.id === prov.id ? { ...p, enabled: !p.enabled } : p
    );
    await saveManifestWithRevision(
      nextList,
      snapshot.manifest.overrides,
      prov.enabled ? "STREAM_KILL_SWITCH" : "STREAM_ENABLE",
      prov.name,
      prov.enabled ? "Disabled provider remotely" : "Re-enabled provider",
      `${prov.enabled ? "Disabled" : "Enabled"} ${prov.name}`
    );
  };

  const handleToggleProviderTier = async (prov: StreamProviderConfig) => {
    const nextTier: 1 | 2 = prov.tier === 1 ? 2 : 1;
    const nextList = snapshot.manifest.providers.map((p) =>
      p.id === prov.id ? { ...p, tier: nextTier } : p
    );
    await saveManifestWithRevision(
      nextList,
      snapshot.manifest.overrides,
      "STREAM_TIER_UPDATE",
      prov.name,
      `Set to Tier ${nextTier}`,
      `${prov.name} moved to Tier ${nextTier}`
    );
  };

  const handleProbeSingle = async (prov: StreamProviderConfig) => {
    setProbingId(prov.id);
    try {
      const result = await probeProviderHealth(prov);
      setSnapshot((s) => ({
        ...s,
        manifest: {
          ...s.manifest,
          providers: s.manifest.providers.map((p) =>
            p.id === prov.id
              ? {
                  ...p,
                  healthStatus: result.status,
                  lastLatencyMs: result.latencyMs,
                  lastCheckedAt: Date.now(),
                }
              : p
          ),
        },
      }));
      showToast(
        result.status !== "down",
        `${prov.name}: ${result.status.toUpperCase()} (${result.latencyMs}ms)`
      );
    } finally {
      setProbingId(null);
    }
  };

  const handleProbeAllProviders = async () => {
    setProbingAll(true);
    try {
      const list = [...snapshot.manifest.providers];
      const updated = await Promise.all(
        list.map(async (p) => {
          const r = await probeProviderHealth(p);
          return {
            ...p,
            healthStatus: r.status,
            lastLatencyMs: r.latencyMs,
            lastCheckedAt: Date.now(),
          };
        })
      );
      setSnapshot((s) => ({
        ...s,
        manifest: { ...s.manifest, providers: updated },
      }));
      const downCount = updated.filter((p) => p.healthStatus === "down").length;
      showToast(
        downCount === 0,
        `Health scan complete: ${updated.length - downCount} reachable, ${downCount} down.`
      );
    } finally {
      setProbingAll(false);
    }
  };

  const handleAddCustomProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = sanitizeAdminText(newProvName, 40);
    const origin = newProvOrigin.trim().replace(/\/+$/, "");
    const movieTpl = newProvMovieTpl.trim();
    const tvTpl = newProvTvTpl.trim();

    if (!name || !isSafeHttpsUrl(origin) || !isSafeHttpsUrl(movieTpl.replace(/\{[^}]+\}/g, "1"))) {
      showToast(false, "Enter a valid name and HTTPS origin/URL templates.");
      return;
    }

    const customId = `custom-${Date.now().toString(36)}`;
    const nextProv: StreamProviderConfig = {
      id: customId,
      name,
      origin,
      movieTemplate: movieTpl,
      tvTemplate: tvTpl || movieTpl,
      enabled: true,
      priority: snapshot.manifest.providers.length + 1,
      tier: newProvTier,
      isBuiltIn: false,
      healthStatus: "unknown",
    };

    await saveManifestWithRevision(
      [...snapshot.manifest.providers, nextProv],
      snapshot.manifest.overrides,
      "STREAM_PROVIDER_ADD",
      name,
      `Added custom provider (${origin})`,
      `Added custom provider ${name}`
    );
    setNewProvName("");
    setNewProvOrigin("");
    setNewProvMovieTpl("");
    setNewProvTvTpl("");
  };

  const handleDeleteCustomProvider = (prov: StreamProviderConfig) => {
    requestStepUp({
      title: `Delete Provider "${prov.name}"`,
      description:
        "This removes the custom provider from the global sources manifest. You can still roll back from Revision History.",
      danger: true,
      requireReason: true,
      defaultReason: "Dead or ad-heavy source",
      onConfirm: async (reason) => {
        const nextList = snapshot.manifest.providers.filter(
          (p) => p.id !== prov.id
        );
        await saveManifestWithRevision(
          nextList,
          snapshot.manifest.overrides,
          "STREAM_PROVIDER_DELETE",
          prov.name,
          reason,
          `Removed custom provider ${prov.name}`
        );
      },
    });
  };

  const handleAddTitleOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = ovMediaId.replace(/\D/g, "").slice(0, 12);
    const cleanTitle = sanitizeAdminText(ovTitle, 80);
    const cleanUrl = ovDirectUrl.trim();
    if (!cleanId || !cleanTitle) {
      showToast(false, "Enter a valid numeric TMDB ID and Title.");
      return;
    }
    if (ovAction === "override_stream" && !isSafeHttpsUrl(cleanUrl)) {
      showToast(false, "Direct stream override requires a valid HTTPS URL.");
      return;
    }

    const entry: TitleSourceOverride = {
      id: `${ovMediaType}-${cleanId}`,
      mediaId: cleanId,
      mediaType: ovMediaType,
      title: cleanTitle,
      action: ovAction,
      directUrl: ovAction === "override_stream" ? cleanUrl : undefined,
      publishAt: ovPublishAt || undefined,
      expireAt: ovExpireAt || undefined,
      reason: sanitizeAdminText(ovReason, 120) || undefined,
      updatedAt: Date.now(),
    };

    const nextOverrides = [
      entry,
      ...snapshot.manifest.overrides.filter((o) => o.id !== entry.id),
    ];

    await saveManifestWithRevision(
      snapshot.manifest.providers,
      nextOverrides,
      "TITLE_OVERRIDE_SET",
      `${cleanTitle} (${entry.id})`,
      ovReason || `Set action ${ovAction}`,
      `Saved title rule for ${cleanTitle}`
    );
    setOvMediaId("");
    setOvTitle("");
    setOvDirectUrl("");
    setOvPublishAt("");
    setOvExpireAt("");
    setOvReason("");
  };

  const handleRemoveTitleOverride = async (ov: TitleSourceOverride) => {
    const nextOverrides = snapshot.manifest.overrides.filter(
      (o) => o.id !== ov.id
    );
    await saveManifestWithRevision(
      snapshot.manifest.providers,
      nextOverrides,
      "TITLE_OVERRIDE_REMOVE",
      `${ov.title} (${ov.id})`,
      "Removed custom title override",
      `Removed rule for ${ov.title}`
    );
  };

  const handleRollbackRevision = (revVersion: number) => {
    const rev = snapshot.manifest.revisions.find(
      (r) => r.version === revVersion
    );
    if (!rev) return;
    requestStepUp({
      title: `Rollback Sources to v${rev.version}`,
      description: `Restores ${rev.providers.length} providers and ${rev.overrides.length} title rules from ${formatDateTime(rev.savedAt)}.`,
      requireReason: true,
      defaultReason: `Rollback to manifest v${rev.version}`,
      onConfirm: async (reason) => {
        await saveManifestWithRevision(
          rev.providers,
          rev.overrides,
          "STREAM_MANIFEST_ROLLBACK",
          `v${rev.version}`,
          reason,
          `Rolled back manifest to v${rev.version}`
        );
      },
    });
  };

  // ===========================================================================
  // 2. KEYS & USER ENFORCEMENT HANDLERS
  // ===========================================================================
  const handleKeygen = async (e: React.FormEvent) => {
    e.preventDefault();
    const age = parseInt(keygenAge.trim(), 10);
    const cleanName = sanitizeAdminText(keygenName, 40);
    if (!cleanName || isNaN(age) || age < 1 || age > 120) {
      showToast(false, "Enter a valid name and age (1–120).");
      return;
    }

    setBusy(true);
    try {
      const entropy =
        typeof window !== "undefined" && window.crypto
          ? window.crypto.getRandomValues(new Uint32Array(1))[0]
          : Math.floor(Math.random() * 1000000);
      const rawStr = `${cleanName.toLowerCase()}-${age}-${Date.now()}-${entropy}`;
      const generatedKey = Math.abs(
        rawStr
          .split("")
          .reduce((acc, ch) => (acc << 5) - acc + ch.charCodeAt(0), 0)
      ).toString();

      const nextKeys = [
        ...snapshot.keys,
        {
          key: generatedKey,
          active: true,
          owner: `${cleanName} (${age})`,
          createdAt: new Date().toISOString(),
        },
      ];

      const res = await commitAdminGistFiles({
        filesToUpdate: { "keys.json": nextKeys },
        audit: {
          action: "KEY_GENERATE",
          target: `${cleanName} (${age})`,
          reason: `Issued activation key ${generatedKey}`,
        },
      });
      if (res.ok) {
        setLastGeneratedKey(generatedKey);
        setKeygenName("");
        setKeygenAge("");
        showToast(true, `✅ Key [${generatedKey}] generated & pushed!`);
        await loadSnapshot();
      } else {
        showToast(false, res.error || "Keygen commit failed.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleToggleKey = async (targetKey: string) => {
    setBusy(true);
    try {
      const targetObj = snapshot.keys.find((k) => k.key === targetKey);
      const nextKeys = snapshot.keys.map((k) =>
        k.key === targetKey ? { ...k, active: !k.active } : k
      );
      const res = await commitAdminGistFiles({
        filesToUpdate: { "keys.json": nextKeys },
        audit: {
          action: targetObj?.active ? "KEY_REVOKE" : "KEY_ACTIVATE",
          target: targetKey,
          reason: `Owner: ${targetObj?.owner || "Unassigned"}`,
        },
      });
      if (res.ok) {
        showToast(
          true,
          targetObj?.active ? `Revoked key ${targetKey}` : `Activated key ${targetKey}`
        );
        await loadSnapshot();
      } else {
        showToast(false, res.error || "Failed to update key.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteKey = (targetKey: string, owner?: string) => {
    requestStepUp({
      title: `Permanently Delete Key ${targetKey}`,
      description: `Removes license key owned by "${owner || "Unassigned"}" from GitHub Gist.`,
      danger: true,
      confirmWord: "DELETE",
      requireReason: true,
      defaultReason: "Key revoked / terminated",
      onConfirm: async (reason) => {
        setBusy(true);
        try {
          const nextKeys = snapshot.keys.filter((k) => k.key !== targetKey);
          const res = await commitAdminGistFiles({
            filesToUpdate: { "keys.json": nextKeys },
            audit: {
              action: "KEY_DELETE",
              target: `${targetKey} (${owner || "Unassigned"})`,
              reason,
            },
          });
          if (res.ok) {
            showToast(true, `Deleted key ${targetKey}`);
            await loadSnapshot();
          } else {
            showToast(false, res.error || "Delete failed.");
          }
        } finally {
          setBusy(false);
        }
      },
    });
  };

  const handleApplyEnforcement = (e: React.FormEvent) => {
    e.preventDefault();
    const target = sanitizeAdminText(enfTarget, 60);
    if (!target) {
      showToast(false, "Enter a user handle, owner name, or license key.");
      return;
    }
    const days = parseInt(enfDurationDays, 10) || 0;
    const expiresAt = days > 0 ? Date.now() + days * 24 * 60 * 60 * 1000 : null;

    requestStepUp({
      title: `${enfType.toUpperCase()}: ${target}`,
      description: `Applies ${days > 0 ? `${days}-day` : "permanent"} ${enfType} (${REASON_CODE_LABELS[enfReasonCode]}).`,
      danger: enfType === "ban" || enfType === "suspend",
      confirmWord: enfType === "ban" ? "BAN" : undefined,
      requireReason: true,
      defaultReason: enfNote || REASON_CODE_LABELS[enfReasonCode],
      onConfirm: async (reason) => {
        setBusy(true);
        try {
          const rec: UserEnforcementRecord = {
            id: `enf_${Date.now().toString(36)}`,
            target,
            type: enfType,
            reasonCode: enfReasonCode,
            note: reason,
            active: true,
            createdAt: Date.now(),
            expiresAt,
            actor: getAdminActorName(),
          };
          const nextEnf = [rec, ...snapshot.enforcement];
          const res = await commitAdminGistFiles({
            filesToUpdate: { "user_enforcement.json": nextEnf },
            audit: {
              action: `USER_${enfType.toUpperCase()}`,
              target,
              reason: `[${enfReasonCode}] ${reason}`,
            },
          });
          if (res.ok) {
            setEnfTarget("");
            setEnfNote("");
            showToast(true, `✓ Applied ${enfType} to ${target}`);
            await loadSnapshot();
          } else {
            showToast(false, res.error || "Failed to save enforcement.");
          }
        } finally {
          setBusy(false);
        }
      },
    });
  };

  const handleLiftEnforcement = async (rec: UserEnforcementRecord) => {
    setBusy(true);
    try {
      const nextEnf = snapshot.enforcement.map((r) =>
        r.id === rec.id ? { ...r, active: false } : r
      );
      const res = await commitAdminGistFiles({
        filesToUpdate: { "user_enforcement.json": nextEnf },
        audit: {
          action: "USER_ENFORCEMENT_LIFT",
          target: rec.target,
          reason: `Lifted ${rec.type} (${rec.reasonCode})`,
        },
      });
      if (res.ok) {
        showToast(true, `↺ Lifted ${rec.type} for ${rec.target}`);
        await loadSnapshot();
      } else {
        showToast(false, res.error || "Failed to lift enforcement.");
      }
    } finally {
      setBusy(false);
    }
  };

  // ===========================================================================
  // 3. AD BLOCKLIST HANDLERS (SHARED WITH STEP 2 PLAYER AD INSPECTOR)
  // ===========================================================================
  const handleAddAdBlockDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    const domain = normalizeBlockDomain(newAdDomain);
    if (!domain) {
      showToast(false, "Enter a valid domain (e.g. popads.net).");
      return;
    }
    if (isDomainProtected(domain)) {
      showToast(
        false,
        `🛡️ Blocked: "${domain}" is a protected core app domain and cannot be blacklisted.`
      );
      return;
    }
    if (snapshot.adblockRules.some((r) => r.domain === domain)) {
      showToast(false, `${domain} is already in the global blocklist.`);
      return;
    }

    setBusy(true);
    try {
      const rule: AdBlockRule = {
        id: `ad_${Date.now().toString(36)}`,
        domain,
        reason: sanitizeAdminText(newAdReason, 120) || "Popup / Ad network",
        source: "manual",
        active: true,
        addedBy: getAdminActorName(),
        addedAt: Date.now(),
      };
      const nextRules = [rule, ...snapshot.adblockRules];
      const res = await commitAdminGistFiles({
        filesToUpdate: { "adblock_overrides.json": nextRules },
        audit: {
          action: "ADBLOCK_DOMAIN_ADD",
          target: domain,
          reason: rule.reason,
        },
      });
      if (res.ok) {
        setNewAdDomain("");
        setNewAdReason("");
        showToast(true, `🛡️ Blocked ${domain} globally!`);
        await loadSnapshot();
      } else {
        showToast(false, res.error || "Failed to save ad blocklist.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleToggleAdRule = async (rule: AdBlockRule) => {
    setBusy(true);
    try {
      const nextRules = snapshot.adblockRules.map((r) =>
        r.id === rule.id ? { ...r, active: !r.active } : r
      );
      const res = await commitAdminGistFiles({
        filesToUpdate: { "adblock_overrides.json": nextRules },
        audit: {
          action: rule.active ? "ADBLOCK_DISABLE" : "ADBLOCK_ENABLE",
          target: rule.domain,
          reason: rule.reason,
        },
      });
      if (res.ok) {
        showToast(true, `${rule.active ? "Paused" : "Activated"} ${rule.domain}`);
        await loadSnapshot();
      } else {
        showToast(false, res.error || "Update failed.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteAdRule = async (rule: AdBlockRule) => {
    setBusy(true);
    try {
      const nextRules = snapshot.adblockRules.filter((r) => r.id !== rule.id);
      const res = await commitAdminGistFiles({
        filesToUpdate: { "adblock_overrides.json": nextRules },
        audit: {
          action: "ADBLOCK_REMOVE",
          target: rule.domain,
          reason: "Removed domain from global overrides",
        },
      });
      if (res.ok) {
        showToast(true, `Removed ${rule.domain}`);
        await loadSnapshot();
      } else {
        showToast(false, res.error || "Delete failed.");
      }
    } finally {
      setBusy(false);
    }
  };

  // ===========================================================================
  // 4. BRANDING, FEATURE FLAGS & PANIC MODE HANDLERS
  // ===========================================================================
  const commitBrandingConfig = async (
    nextCfg: BrandingAndFlagsConfig,
    action: string,
    reason: string
  ) => {
    if (nextCfg.customWallpaperUrl && !isSafeHttpsUrl(nextCfg.customWallpaperUrl)) {
      showToast(false, "Custom Wallpaper URL must be a valid HTTPS link.");
      return;
    }
    if (nextCfg.customSplashUrl && !isSafeHttpsUrl(nextCfg.customSplashUrl)) {
      showToast(false, "Custom Splash URL must be a valid HTTPS link.");
      return;
    }

    setBusy(true);
    try {
      const payload: BrandingAndFlagsConfig = {
        ...nextCfg,
        motdBanner: sanitizeAdminText(nextCfg.motdBanner, 180),
        minAppVersion: sanitizeAdminText(nextCfg.minAppVersion, 20) || "1.2.0",
        updatedAt: Date.now(),
      };
      // Write BOTH branding_config.json AND legacy admin_config.json so older APKs stay 100% compatible!
      const res = await commitAdminGistFiles({
        filesToUpdate: {
          "branding_config.json": payload,
          "admin_config.json": {
            allowTrials: payload.allowTrials,
            maintenanceMode: payload.maintenanceMode,
            motdBanner: payload.motdBanner,
            minAppVersion: payload.minAppVersion,
            updatedAt: payload.updatedAt,
          },
        },
        audit: {
          action,
          target: "branding_config.json",
          reason,
        },
      });
      if (res.ok) {
        setBrandingDraft(payload);
        showToast(true, `✅ ${reason}`);
        await loadSnapshot();
      } else {
        showToast(false, res.error || "Failed to publish branding config.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handlePanicToggle = (
    key:
      | "maintenanceMode"
      | "panicReadOnlyCommunity"
      | "panicStrictTier1Only"
      | "allowTrials",
    label: string
  ) => {
    const nextVal = !brandingDraft[key];
    requestStepUp({
      title: `${nextVal ? "Activate" : "Deactivate"}: ${label}`,
      description:
        "This immediately updates remote fleet policies across all active RABBiT TV apps.",
      danger: true,
      requireReason: true,
      defaultReason: `Panic control toggled: ${label}`,
      onConfirm: async (reason) => {
        const nextCfg = { ...brandingDraft, [key]: nextVal };
        await commitBrandingConfig(nextCfg, `PANIC_${key.toUpperCase()}`, reason);
      },
    });
  };

  const handleDispatchApkBuild = () => {
    requestStepUp({
      title: "Trigger GitHub Actions APK Build",
      description:
        "Dispatches main.yml on branch main to build & publish a new nightly APK with your latest committed icons/banners.",
      requireReason: true,
      defaultReason: "Manual admin APK rebuild",
      onConfirm: async (reason) => {
        setBusy(true);
        try {
          const res = await triggerGithubApkRebuild();
          if (res.ok) {
            await commitAdminGistFiles({
              filesToUpdate: {},
              audit: {
                action: "GITHUB_APK_REBUILD_DISPATCH",
                target: "main.yml (main)",
                reason,
              },
            });
            showToast(true, "🚀 GitHub Actions nightly APK build started!");
            await loadSnapshot();
          } else {
            showToast(false, res.error || "Could not trigger workflow.");
          }
        } finally {
          setBusy(false);
        }
      },
    });
  };

  // ===========================================================================
  // 5. BROADCAST TOASTS & QUEUE HANDLERS
  // ===========================================================================
  const handlePushToast = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = sanitizeAdminText(targetQuery, 50);
    const msg = sanitizeAdminText(targetMessage, 240);
    if (!target || !msg) {
      showToast(false, "Provide both target and message.");
      return;
    }
    setBusy(true);
    try {
      const prefix =
        toastSeverity === "critical"
          ? "🚨 [URGENT] "
          : toastSeverity === "warning"
            ? "⚠️ "
            : "";
      const newToast = {
        id: Math.random().toString(36).slice(2, 9),
        target,
        message: `${prefix}${msg}`,
        severity: toastSeverity,
        timestamp: Date.now(),
      };
      const nextNotifs = [...snapshot.notifications, newToast];
      const res = await commitAdminGistFiles({
        filesToUpdate: { "notifications.json": nextNotifs },
        audit: {
          action: "TOAST_BROADCAST",
          target,
          reason: `${toastSeverity.toUpperCase()}: ${msg.slice(0, 80)}`,
        },
      });
      if (res.ok) {
        setTargetMessage("");
        showToast(true, `🚀 Broadcast pushed to [${target}]`);
        await loadSnapshot();
      } else {
        showToast(false, res.error || "Failed to push toast.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteToast = async (id?: string, clearAll = false) => {
    setBusy(true);
    try {
      const nextNotifs = clearAll
        ? []
        : snapshot.notifications.filter((n) => n.id !== id);
      const res = await commitAdminGistFiles({
        filesToUpdate: { "notifications.json": nextNotifs },
        audit: {
          action: clearAll ? "TOAST_PURGE_ALL" : "TOAST_DELETE",
          target: clearAll ? "ALL" : id || "toast",
          reason: clearAll ? "Cleared queued toasts" : "Removed single toast",
        },
      });
      if (res.ok) {
        showToast(true, clearAll ? "Purged all queued toasts." : "Removed toast.");
        await loadSnapshot();
      } else {
        showToast(false, res.error || "Failed to update notifications.");
      }
    } finally {
      setBusy(false);
    }
  };

  // ===========================================================================
  // DERIVED METRICS & FILTERS
  // ===========================================================================
  const gistInfo = useMemo(() => resolveAdminGistConfig(), [vaultGistIdInput, vaultPatInput]);

  const keyStats = useMemo(() => {
    let active = 0;
    let used = 0;
    for (const k of snapshot.keys) {
      if (k.active) active++;
      else used++;
    }
    return { total: snapshot.keys.length, active, used };
  }, [snapshot.keys]);

  const filteredKeys = useMemo(() => {
    const q = keySearchQuery.trim().toLowerCase();
    return snapshot.keys.filter((k) => {
      if (keyFilterMode === "active" && !k.active) return false;
      if (keyFilterMode === "used" && k.active) return false;
      if (!q) return true;
      return (
        k.key.toLowerCase().includes(q) ||
        String(k.owner || k.usedBy || "")
          .toLowerCase()
          .includes(q)
      );
    });
  }, [snapshot.keys, keyFilterMode, keySearchQuery]);

  const uniqueOwners = useMemo(
    () =>
      Array.from(
        new Set(
          snapshot.keys
            .map((k) => k.owner || k.usedBy)
            .filter(
              (u): u is string =>
                Boolean(u) &&
                u !== "Legacy" &&
                u !== "Admin Recycled" &&
                u !== "Unassigned"
            )
        )
      ),
    [snapshot.keys]
  );

  const enabledProvidersCount = useMemo(
    () => snapshot.manifest.providers.filter((p) => p.enabled).length,
    [snapshot.manifest.providers]
  );

  const activeEnforcementsCount = useMemo(
    () => snapshot.enforcement.filter((e) => e.active).length,
    [snapshot.enforcement]
  );

  const activeAdDomainsCount = useMemo(
    () => snapshot.adblockRules.filter((r) => r.active).length,
    [snapshot.adblockRules]
  );

  const filteredAdRules = useMemo(() => {
    const q = adSearch.trim().toLowerCase();
    if (!q) return snapshot.adblockRules;
    return snapshot.adblockRules.filter(
      (r) =>
        r.domain.toLowerCase().includes(q) ||
        r.reason.toLowerCase().includes(q)
    );
  }, [snapshot.adblockRules, adSearch]);

  const filteredAudit = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    if (!q) return snapshot.auditLog;
    return snapshot.auditLog.filter(
      (a) =>
        a.action.toLowerCase().includes(q) ||
        a.target.toLowerCase().includes(q) ||
        a.actor.toLowerCase().includes(q) ||
        a.reason.toLowerCase().includes(q)
    );
  }, [snapshot.auditLog, auditSearch]);

  const filteredCommProfiles = useMemo(() => {
    const q = commSearch.trim().toLowerCase();
    if (!q) return commProfiles;
    return commProfiles.filter(
      (p) =>
        p.handle.toLowerCase().includes(q) ||
        (p.bio || "").toLowerCase().includes(q)
    );
  }, [commProfiles, commSearch]);

  const filteredCommReviews = useMemo(() => {
    const q = commSearch.trim().toLowerCase();
    if (!q) return commReviews;
    return commReviews.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.authorHandle.toLowerCase().includes(q) ||
        (r.comment || "").toLowerCase().includes(q)
    );
  }, [commReviews, commSearch]);

  const exportJsonFile = (filename: string, data: unknown) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyText = async (val: string) => {
    try {
      await navigator.clipboard.writeText(val);
      setCopiedKeyId(val);
      window.setTimeout(() => setCopiedKeyId(null), 2000);
    } catch {
      // ignore on TV WebViews
    }
  };

  // Non-Admin Access Guard
  if (!isAdminDevice) {
    return (
      <main className="min-h-screen bg-[#0c0a09] text-[#E8DCC8] p-6 flex items-center justify-center relative">
        <AppWallpaper />
        <div className="relative z-10 max-w-md w-full rounded-3xl border border-[#C4282A]/45 bg-[#141210]/95 p-7 text-center space-y-4 shadow-2xl">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-[#C4282A]/20 border border-[#C4282A]/50 flex items-center justify-center text-2xl">
            🔒
          </div>
          <h1 className="text-lg font-black text-white">
            Admin Authorization Required
          </h1>
          <p className="text-xs text-[#8C8175] leading-relaxed">
            This command center is restricted to authenticated RABBiT TV
            administrators.
          </p>
          <Link
            to="/"
            className="inline-block rounded-xl bg-[#C4282A] hover:bg-red-600 px-5 py-2.5 text-xs font-extrabold text-white transition"
          >
            ← Return to Home
          </Link>
        </div>
      </main>
    );
  }

  // PIN Vault Lock Screen
  if (isVaultLocked) {
    return (
      <main className="min-h-screen bg-[#0c0a09] text-[#E8DCC8] p-6 flex items-center justify-center relative">
        <AppWallpaper />
        <div className="relative z-10 max-w-sm w-full rounded-3xl border border-[#C4282A]/50 bg-[#141210]/95 p-7 text-center space-y-4 shadow-2xl">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-[#C4282A]/20 border border-[#C4282A]/50 flex items-center justify-center text-2xl">
            🛡️
          </div>
          <h1 className="text-base font-black uppercase tracking-wider text-white">
            Admin Vault Locked
          </h1>
          <p className="text-xs text-[#8C8175] leading-relaxed">
            Enter your 4–6 digit security PIN to unlock Stream Controls, User
            Enforcement, Ad Blocklist, and Branding.
          </p>
          <form onSubmit={handleUnlockVault} className="space-y-3">
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="••••••"
              value={vaultPinInput}
              onChange={(e) =>
                setVaultPinInput(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              className="w-44 mx-auto block text-center rounded-xl border border-[#C4282A]/45 bg-[#0c0a09] px-4 py-2.5 text-base font-black text-white tracking-[0.35em] focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#C4282A] to-rose-700 text-white text-xs font-extrabold uppercase tracking-wider shadow-lg cursor-pointer"
            >
              🔓 Unlock Command Center
            </button>
          </form>
          {vaultError && (
            <p className="text-xs font-bold text-amber-300">{vaultError}</p>
          )}
          <Link
            to="/"
            className="inline-block text-[11px] font-bold text-[#8C8175] hover:text-white"
          >
            ← Back to Home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full max-w-full bg-[#0c0a09] text-[#E8DCC8] px-3 sm:px-6 py-4 pb-16 relative overflow-x-clip">
      <AppWallpaper />

      <div className="relative z-10 max-w-7xl mx-auto space-y-4 min-w-0">
        {/* TOP PERSISTENT COMMAND BAR */}
        <header
          className={`rounded-2xl border border-white/10 bg-[#141210]/95 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-2xl ${
            isLowRam ? "" : "backdrop-blur-md"
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/"
              className="rounded-xl border border-white/15 bg-black/70 hover:bg-white/10 px-3 py-2 text-xs font-extrabold text-white transition shrink-0"
            >
              ← Home
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm sm:text-lg font-black tracking-tight text-white truncate">
                  RABBiT TV Command Center
                </h1>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wider ${
                    gistInfo.usingPersonalVault
                      ? "border-emerald-400/45 bg-emerald-950/75 text-emerald-300"
                      : "border-amber-400/45 bg-amber-950/75 text-amber-200"
                  }`}
                >
                  {gistInfo.usingPersonalVault
                    ? "🛡️ Personal Vault PAT"
                    : "GitHub Gist Relay"}
                </span>
              </div>
              <p className="text-[10.5px] text-[#8C8175] truncate">
                100% GitHub-Backed • Manifest v{snapshot.manifest.version} •{" "}
                {enabledProvidersCount}/{snapshot.manifest.providers.length}{" "}
                Streams Active
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2 shrink-0">
            <button
              type="button"
              disabled={loading || busy}
              onClick={() => void loadSnapshot()}
              className="rounded-xl border border-white/15 bg-black/75 hover:bg-white/10 px-3 py-1.5 text-xs font-bold text-white cursor-pointer disabled:opacity-45"
            >
              ↻ {loading ? "Syncing…" : "Sync Gist"}
            </button>
            <button
              type="button"
              onClick={() => setIsReferralModalOpen(true)}
              className="rounded-xl border border-amber-400/40 bg-amber-950/60 hover:bg-amber-900/70 px-3 py-1.5 text-xs font-extrabold text-amber-200 cursor-pointer"
            >
              💰 Referrals
              {referralTotals && referralTotals.totalOwedNow > 0
                ? ` ($${referralTotals.totalOwedNow.toFixed(0)})`
                : ""}
            </button>
            <button
              type="button"
              onClick={handleLockVault}
              className="rounded-xl border border-[#C4282A]/50 bg-[#C4282A]/20 hover:bg-[#C4282A]/40 px-3 py-1.5 text-xs font-extrabold text-red-200 cursor-pointer"
            >
              🔒 Lock
            </button>
            <button
              type="button"
              onClick={handleExitAdmin}
              className="rounded-xl border border-white/15 bg-black/75 hover:bg-red-700 px-3 py-1.5 text-xs font-bold text-zinc-300 hover:text-white cursor-pointer"
            >
              Exit
            </button>
          </div>
        </header>

        {/* INLINE STATUS TOAST */}
        {statusToast && (
          <div
            className={`rounded-2xl border px-4 py-2.5 text-center text-xs font-extrabold shadow-xl ${
              statusToast.ok
                ? "border-emerald-400/50 bg-emerald-950/90 text-emerald-200"
                : "border-red-400/50 bg-red-950/90 text-red-200"
            }`}
          >
            {statusToast.text}
          </div>
        )}

        {/* MOBILE MODULE TAB STRIP */}
        <nav
          aria-label="Admin Modules"
          className="flex lg:hidden items-center gap-2 overflow-x-auto scrollbar-none pb-1"
        >
          {ADMIN_MODULES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setActiveTab(m.id)}
              className={`shrink-0 rounded-xl border px-3.5 py-2 text-xs font-extrabold whitespace-nowrap cursor-pointer transition ${
                activeTab === m.id
                  ? "border-[#C4282A] bg-[#C4282A] text-white shadow-lg"
                  : "border-white/10 bg-[#141210]/90 text-[#E8DCC8] hover:border-white/25"
              }`}
            >
              {m.icon} {m.label}
            </button>
          ))}
        </nav>

        {/* MAIN WORKSPACE: LEFT SIDEBAR (DESKTOP) + ACTIVE MODULE STAGE */}
        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4 items-start">
          {/* Desktop Vertical Navigation */}
          <aside className="hidden lg:flex flex-col gap-1.5 rounded-3xl border border-white/10 bg-[#141210]/95 p-3 sticky top-4">
            <span className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-[#8C8175]">
              Command Modules
            </span>
            {ADMIN_MODULES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setActiveTab(m.id)}
                className={`w-full flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-xs font-extrabold cursor-pointer transition ${
                  activeTab === m.id
                    ? "border-[#C4282A] bg-[#C4282A]/90 text-white shadow-[0_0_20px_rgba(196,40,42,0.35)]"
                    : "border-transparent bg-transparent text-[#E8DCC8] hover:bg-white/5 hover:border-white/10"
                }`}
              >
                <span className="text-sm shrink-0">{m.icon}</span>
                <span className="truncate">{m.label}</span>
              </button>
            ))}
          </aside>

          {/* RIGHT WORKSPACE STAGE */}
          <section className="min-w-0 space-y-4">
            {/* ============================================================= */}
            {/* TAB 1: OVERVIEW & EMERGENCY PANIC CONTROLS                    */}
            {/* ============================================================= */}
            {activeTab === "overview" && (
              <div className="space-y-4">
                {/* 6 Fleet KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    {
                      label: "Stream Providers",
                      value: `${enabledProvidersCount} / ${snapshot.manifest.providers.length}`,
                      sub: `Manifest v${snapshot.manifest.version}`,
                      accent: "text-cyan-300",
                      tab: "streams" as AdminModuleTab,
                    },
                    {
                      label: "Active License Keys",
                      value: `${keyStats.active}`,
                      sub: `${keyStats.used} claimed • ${keyStats.total} total`,
                      accent: "text-emerald-300",
                      tab: "users" as AdminModuleTab,
                    },
                    {
                      label: "Blocked Ad Domains",
                      value: `${activeAdDomainsCount}`,
                      sub: "+ baked-in HaGeZi list",
                      accent: "text-amber-300",
                      tab: "adblock" as AdminModuleTab,
                    },
                    {
                      label: "Active Bans / Mutes",
                      value: `${activeEnforcementsCount}`,
                      sub: `${snapshot.enforcement.length} historical rules`,
                      accent: "text-red-400",
                      tab: "users" as AdminModuleTab,
                    },
                    {
                      label: "Queued Broadcasts",
                      value: `${snapshot.notifications.length}`,
                      sub: brandingDraft.maintenanceMode
                        ? "Maintenance ON"
                        : "Normal Operation",
                      accent: "text-[#E8DCC8]",
                      tab: "alerts" as AdminModuleTab,
                    },
                    {
                      label: "Audit Trail Entries",
                      value: `${snapshot.auditLog.length}`,
                      sub: "SHA-256 hash-chained",
                      accent: "text-cyan-300",
                      tab: "audit" as AdminModuleTab,
                    },
                  ].map((kpi) => (
                    <button
                      key={kpi.label}
                      type="button"
                      onClick={() => setActiveTab(kpi.tab)}
                      className="rounded-2xl border border-white/10 bg-[#141210]/95 hover:border-white/25 p-4 text-left space-y-1 transition cursor-pointer"
                    >
                      <span className="block text-[10px] font-extrabold uppercase tracking-wider text-[#8C8175]">
                        {kpi.label}
                      </span>
                      <p className={`text-xl sm:text-2xl font-black ${kpi.accent}`}>
                        {kpi.value}
                      </p>
                      <span className="block text-[10.5px] text-[#8C8175] truncate">
                        {kpi.sub}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Emergency Panic Console */}
                <div className="rounded-3xl border border-[#C4282A]/50 bg-gradient-to-b from-[#1d1010]/95 to-[#141210]/95 p-5 space-y-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <h2 className="text-sm sm:text-base font-black text-red-300 uppercase tracking-wider">
                        🚨 Emergency Panic & Incident Playbooks
                      </h2>
                      <p className="text-xs text-[#8C8175] mt-0.5">
                        Every toggle requires step-up confirmation and logs to
                        the audit trail.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      {
                        key: "maintenanceMode" as const,
                        title: "Global Maintenance Banner",
                        desc: "Displays an urgent service notice across all active apps.",
                        active: brandingDraft.maintenanceMode,
                      },
                      {
                        key: "panicReadOnlyCommunity" as const,
                        title: "Freeze Community (Read-Only)",
                        desc: "Stops all new reviews, profiles & buddy chats during spam waves.",
                        active: brandingDraft.panicReadOnlyCommunity,
                      },
                      {
                        key: "panicStrictTier1Only" as const,
                        title: "Strict Tier-1 Streams Only",
                        desc: "Locks player rotation to verified Tier-1 providers only.",
                        active: brandingDraft.panicStrictTier1Only,
                      },
                      {
                        key: "allowTrials" as const,
                        title: "Allow 7-Day Free Trials",
                        desc: "Turn OFF to require an activation key on every new install.",
                        active: brandingDraft.allowTrials,
                      },
                    ].map((ctrl) => (
                      <div
                        key={ctrl.key}
                        className="rounded-2xl border border-white/10 bg-black/65 p-3.5 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-extrabold text-white">
                            {ctrl.title}
                          </p>
                          <p className="text-[10.5px] text-[#8C8175] mt-0.5 leading-snug">
                            {ctrl.desc}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handlePanicToggle(ctrl.key, ctrl.title)}
                          className={`shrink-0 rounded-xl px-3 py-1.5 text-[10.5px] font-black uppercase cursor-pointer transition ${
                            ctrl.active
                              ? "bg-[#C4282A] text-white"
                              : "bg-white/10 text-[#E8DCC8] hover:bg-white/20"
                          }`}
                        >
                          {ctrl.active ? "ON" : "OFF"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================= */}
            {/* TAB 2: STREAMS, PROVIDERS, OVERRIDES & REVISION ROLLBACK      */}
            {/* ============================================================= */}
            {activeTab === "streams" && (
              <div className="space-y-4">
                {/* Provider Priority & Health Monitor */}
                <div className="rounded-3xl border border-white/10 bg-[#141210]/95 p-4 sm:p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-black text-white">
                        🎬 Remote Cinema Stream Providers ({enabledProvidersCount} Active)
                      </h2>
                      <p className="text-xs text-[#8C8175] mt-0.5">
                        Reorder priority, toggle instant kill switches, or ping
                        live availability. Player syncs automatically.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={probingAll}
                      onClick={() => void handleProbeAllProviders()}
                      className="rounded-xl border border-cyan-400/40 bg-cyan-950/60 hover:bg-cyan-900/70 px-3.5 py-2 text-xs font-extrabold text-cyan-200 cursor-pointer disabled:opacity-45"
                    >
                      {probingAll ? "⏳ Probing All..." : "📡 Health Scan All"}
                    </button>
                  </div>

                  <div className="space-y-2">
                    {snapshot.manifest.providers.map((prov, idx) => (
                      <div
                        key={prov.id}
                        className={`rounded-2xl border p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                          prov.enabled
                            ? "border-white/10 bg-black/65"
                            : "border-red-500/30 bg-red-950/20 opacity-75"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="h-7 w-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-xs font-black text-cyan-300 shrink-0">
                            #{idx + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs sm:text-sm font-black text-white">
                                {prov.name}
                              </span>
                              <span
                                className={`rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase ${
                                  prov.tier === 1
                                    ? "border-emerald-400/40 bg-emerald-950/75 text-emerald-300"
                                    : "border-white/15 bg-white/5 text-[#8C8175]"
                                }`}
                              >
                                Tier {prov.tier}
                              </span>
                              {prov.healthStatus && prov.healthStatus !== "unknown" && (
                                <span
                                  className={`rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase ${
                                    prov.healthStatus === "healthy"
                                      ? "bg-emerald-500/20 text-emerald-300"
                                      : prov.healthStatus === "degraded"
                                        ? "bg-amber-500/20 text-amber-300"
                                        : "bg-red-500/25 text-red-300"
                                  }`}
                                >
                                  {prov.healthStatus}
                                  {prov.lastLatencyMs
                                    ? ` • ${prov.lastLatencyMs}ms`
                                    : ""}
                                </span>
                              )}
                            </div>
                            <p className="text-[10.5px] font-mono text-[#8C8175] truncate">
                              {prov.origin}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center flex-wrap gap-1.5 shrink-0">
                          <button
                            type="button"
                            disabled={busy || idx === 0}
                            onClick={() => void handleMoveProvider(idx, -1)}
                            className="rounded-lg border border-white/15 bg-white/5 hover:bg-white/15 px-2 py-1 text-xs font-bold disabled:opacity-30 cursor-pointer"
                            title="Move Up Priority"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            disabled={
                              busy || idx === snapshot.manifest.providers.length - 1
                            }
                            onClick={() => void handleMoveProvider(idx, 1)}
                            className="rounded-lg border border-white/15 bg-white/5 hover:bg-white/15 px-2 py-1 text-xs font-bold disabled:opacity-30 cursor-pointer"
                            title="Move Down Priority"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            disabled={probingId === prov.id}
                            onClick={() => void handleProbeSingle(prov)}
                            className="rounded-lg border border-cyan-500/35 bg-cyan-950/50 hover:bg-cyan-900/70 px-2.5 py-1 text-[10.5px] font-bold text-cyan-200 cursor-pointer"
                          >
                            {probingId === prov.id ? "..." : "Ping"}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleToggleProviderTier(prov)}
                            className="rounded-lg border border-white/15 bg-white/5 hover:bg-white/15 px-2.5 py-1 text-[10.5px] font-bold text-[#E8DCC8] cursor-pointer"
                          >
                            T{prov.tier === 1 ? "2" : "1"}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleToggleProvider(prov)}
                            className={`rounded-lg px-2.5 py-1 text-[10.5px] font-extrabold cursor-pointer ${
                              prov.enabled
                                ? "bg-emerald-600/25 border border-emerald-400/45 text-emerald-200 hover:bg-red-700 hover:text-white"
                                : "bg-red-600/40 border border-red-400/50 text-red-100 hover:bg-emerald-600"
                            }`}
                          >
                            {prov.enabled ? "Active" : "Disabled"}
                          </button>
                          {!prov.isBuiltIn && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleDeleteCustomProvider(prov)}
                              className="rounded-lg border border-red-500/40 bg-red-950/70 hover:bg-red-700 px-2 py-1 text-[10.5px] font-bold text-red-200 cursor-pointer"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Add Custom Stream Provider */}
                <form
                  onSubmit={handleAddCustomProvider}
                  className="rounded-3xl border border-white/10 bg-[#141210]/95 p-4 sm:p-6 space-y-3"
                >
                  <h3 className="text-sm font-black text-white">
                    + Add New Stream Provider
                  </h3>
                  <p className="text-[11px] text-[#8C8175]">
                    Use tokens <code className="text-cyan-300">{"{id}"}</code>,{" "}
                    <code className="text-cyan-300">{"{season}"}</code>,{" "}
                    <code className="text-cyan-300">{"{episode}"}</code>,{" "}
                    <code className="text-cyan-300">{"{accent}"}</code> in URL
                    templates.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <input
                      type="text"
                      dir="ltr"
                      placeholder="Provider Name (e.g. StreamHub)"
                      value={newProvName}
                      onChange={(e) => setNewProvName(e.target.value)}
                      className="rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-xs font-bold text-white"
                    />
                    <input
                      type="url"
                      dir="ltr"
                      placeholder="Origin (https://example.com)"
                      value={newProvOrigin}
                      onChange={(e) => setNewProvOrigin(e.target.value)}
                      className="rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-xs font-bold text-white"
                    />
                    <select
                      value={newProvTier}
                      onChange={(e) =>
                        setNewProvTier(Number(e.target.value) === 1 ? 1 : 2)
                      }
                      className="rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-xs font-bold text-white"
                    >
                      <option value={1}>Tier 1 (Priority Clean)</option>
                      <option value={2}>Tier 2 (Standby Fallback)</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="url"
                      dir="ltr"
                      placeholder="Movie URL: https://example.com/movie/{id}"
                      value={newProvMovieTpl}
                      onChange={(e) => setNewProvMovieTpl(e.target.value)}
                      className="rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-xs font-mono text-white"
                    />
                    <input
                      type="url"
                      dir="ltr"
                      placeholder="TV URL: https://example.com/tv/{id}/{season}/{episode}"
                      value={newProvTvTpl}
                      onChange={(e) => setNewProvTvTpl(e.target.value)}
                      className="rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-xs font-mono text-white"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-xl bg-[#C4282A] hover:bg-red-600 px-5 py-2.5 text-xs font-extrabold text-white cursor-pointer disabled:opacity-45"
                  >
                    ⚡ Add Provider & Publish
                  </button>
                </form>

                {/* Custom Title Overrides & Scheduled Releases */}
                <div className="rounded-3xl border border-white/10 bg-[#141210]/95 p-4 sm:p-6 space-y-4">
                  <div>
                    <h3 className="text-sm font-black text-white">
                      🎯 Title Overrides, Quarantine & Scheduling
                    </h3>
                    <p className="text-[11px] text-[#8C8175] mt-0.5">
                      Pin a direct stream URL for a specific TMDB title, schedule
                      availability windows, or quarantine a broken title globally.
                    </p>
                  </div>

                  <form onSubmit={handleAddTitleOverride} className="space-y-2.5">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <select
                        value={ovMediaType}
                        onChange={(e) =>
                          setOvMediaType(e.target.value === "tv" ? "tv" : "movie")
                        }
                        className="rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-xs font-bold text-white"
                      >
                        <option value="movie">Movie</option>
                        <option value="tv">TV Show</option>
                      </select>
                      <input
                        type="text"
                        dir="ltr"
                        placeholder="TMDB ID (e.g. 550)"
                        value={ovMediaId}
                        onChange={(e) => setOvMediaId(e.target.value)}
                        className="rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-xs font-bold text-white"
                      />
                      <input
                        type="text"
                        dir="ltr"
                        placeholder="Title Name"
                        value={ovTitle}
                        onChange={(e) => setOvTitle(e.target.value)}
                        className="col-span-2 rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-xs font-bold text-white"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <select
                        value={ovAction}
                        onChange={(e) =>
                          setOvAction(
                            e.target.value as TitleSourceOverride["action"]
                          )
                        }
                        className="rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-xs font-bold text-white"
                      >
                        <option value="override_stream">
                          Override Stream URL
                        </option>
                        <option value="quarantine_hide">
                          Global Quarantine / Hide
                        </option>
                      </select>
                      <input
                        type="url"
                        dir="ltr"
                        disabled={ovAction !== "override_stream"}
                        placeholder="Custom HTTPS Embed / Direct Stream URL"
                        value={ovDirectUrl}
                        onChange={(e) => setOvDirectUrl(e.target.value)}
                        className="sm:col-span-2 rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-xs font-mono text-white disabled:opacity-40"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="datetime-local"
                        value={ovPublishAt}
                        onChange={(e) => setOvPublishAt(e.target.value)}
                        title="Optional Start Date/Time"
                        className="rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-xs font-bold text-white"
                      />
                      <input
                        type="datetime-local"
                        value={ovExpireAt}
                        onChange={(e) => setOvExpireAt(e.target.value)}
                        title="Optional Expire Date/Time"
                        className="rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-xs font-bold text-white"
                      />
                      <input
                        type="text"
                        dir="ltr"
                        placeholder="Reason / Admin Note"
                        value={ovReason}
                        onChange={(e) => setOvReason(e.target.value)}
                        className="rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-xs font-bold text-white"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={busy}
                      className="rounded-xl bg-[#C4282A] hover:bg-red-600 px-5 py-2 text-xs font-extrabold text-white cursor-pointer disabled:opacity-45"
                    >
                      Save Title Rule
                    </button>
                  </form>

                  {snapshot.manifest.overrides.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-white/10">
                      {snapshot.manifest.overrides.map((ov) => (
                        <div
                          key={ov.id}
                          className="rounded-2xl border border-white/10 bg-black/65 p-3 flex flex-wrap items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-black text-white">
                              {ov.title}{" "}
                              <span className="font-mono text-[10px] text-cyan-300">
                                ({ov.id})
                              </span>
                            </p>
                            <p className="text-[10.5px] text-[#8C8175] truncate">
                              {ov.action === "quarantine_hide"
                                ? "🚫 Globally Quarantined"
                                : `▶ ${ov.directUrl}`}
                              {ov.reason ? ` • ${ov.reason}` : ""}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleRemoveTitleOverride(ov)}
                            className="rounded-lg border border-red-500/40 bg-red-950/60 hover:bg-red-700 px-2.5 py-1 text-[10.5px] font-bold text-red-200 cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Manifest Revision History & One-Click Rollback */}
                {snapshot.manifest.revisions.length > 0 && (
                  <div className="rounded-3xl border border-white/10 bg-[#141210]/95 p-4 sm:p-6 space-y-3">
                    <h3 className="text-sm font-black text-white">
                      ⏪ Stream Manifest Revision History (Rollback)
                    </h3>
                    <div className="space-y-2">
                      {snapshot.manifest.revisions.map((rev) => (
                        <div
                          key={`${rev.version}-${rev.savedAt}`}
                          className="rounded-xl border border-white/10 bg-black/65 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <span className="font-black text-cyan-300">
                              v{rev.version}
                            </span>{" "}
                            <span className="text-white font-bold">
                              — {rev.summary}
                            </span>
                            <span className="block text-[10px] text-[#8C8175]">
                              {rev.actor} • {formatDateTime(rev.savedAt)} •{" "}
                              {rev.providers.length} providers
                            </span>
                          </div>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleRollbackRevision(rev.version)}
                            className="rounded-lg border border-amber-400/45 bg-amber-950/60 hover:bg-amber-800 px-3 py-1 text-[10.5px] font-extrabold text-amber-200 cursor-pointer"
                          >
                            ↺ Rollback
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ============================================================= */}
            {/* TAB 3: USERS, LICENSE KEYS & ENFORCEMENT (BANS / MUTES)       */}
            {/* ============================================================= */}
            {activeTab === "users" && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                {/* License Key Generator & Manager */}
                <div className="rounded-3xl border border-white/10 bg-[#141210]/95 p-4 sm:p-6 space-y-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h2 className="text-base font-black text-white">
                      🔑 License Key Manager ({keyStats.total})
                    </h2>
                    <button
                      type="button"
                      onClick={() =>
                        exportJsonFile(
                          `rabtv_keys_${new Date().toISOString().slice(0, 10)}.json`,
                          snapshot.keys
                        )
                      }
                      className="rounded-lg border border-white/15 bg-black/75 hover:bg-white/10 px-2.5 py-1 text-[10.5px] font-bold text-amber-300 cursor-pointer"
                    >
                      💾 Export JSON
                    </button>
                  </div>

                  <form onSubmit={handleKeygen} className="space-y-2.5">
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        dir="ltr"
                        placeholder="Recipient Name"
                        value={keygenName}
                        onChange={(e) => setKeygenName(e.target.value)}
                        className="col-span-2 rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-xs font-bold text-white"
                      />
                      <input
                        type="number"
                        min={1}
                        max={120}
                        placeholder="Age"
                        value={keygenAge}
                        onChange={(e) => setKeygenAge(e.target.value)}
                        className="rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-center text-xs font-bold text-white"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={busy}
                      className="w-full py-2.5 rounded-xl bg-[#C4282A] hover:bg-red-600 text-white text-xs font-extrabold cursor-pointer disabled:opacity-45"
                    >
                      ⚡ Generate & Push License Key
                    </button>
                  </form>

                  {lastGeneratedKey && (
                    <div className="rounded-xl border border-emerald-400/40 bg-emerald-950/40 p-3 flex items-center justify-between gap-2">
                      <span className="font-mono text-sm font-black text-emerald-300">
                        {lastGeneratedKey}
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleCopyText(lastGeneratedKey)}
                        className="rounded-lg bg-emerald-600 px-3 py-1 text-[10.5px] font-extrabold text-white cursor-pointer"
                      >
                        {copiedKeyId === lastGeneratedKey ? "✓ Copied" : "Copy"}
                      </button>
                    </div>
                  )}

                  <div className="space-y-2 pt-2 border-t border-white/10">
                    <input
                      type="search"
                      dir="ltr"
                      placeholder="Search by key or owner..."
                      value={keySearchQuery}
                      onChange={(e) => setKeySearchQuery(e.target.value)}
                      className="w-full rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-xs font-bold text-white"
                    />
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { id: "all", label: `All (${keyStats.total})` },
                          { id: "active", label: `Active (${keyStats.active})` },
                          { id: "used", label: `Claimed (${keyStats.used})` },
                        ] as { id: KeyFilterMode; label: string }[]
                      ).map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setKeyFilterMode(m.id)}
                          className={`rounded-xl py-1.5 text-[10.5px] font-extrabold cursor-pointer ${
                            keyFilterMode === m.id
                              ? "bg-[#C4282A] text-white"
                              : "bg-black/65 border border-white/10 text-[#8C8175]"
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>

                    <div className="max-h-96 overflow-y-auto space-y-2 pr-1 scrollbar-none">
                      {filteredKeys.map((kObj) => (
                        <div
                          key={kObj.key}
                          className="rounded-2xl border border-white/10 bg-black/65 p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs font-black text-amber-300 truncate">
                              {kObj.key}
                            </span>
                            <span
                              className={`rounded-md px-2 py-0.5 text-[9px] font-black uppercase ${
                                kObj.active
                                  ? "bg-emerald-500/20 text-emerald-300"
                                  : "bg-red-500/20 text-red-300"
                              }`}
                            >
                              {kObj.active ? "Active" : "Claimed"}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#E8DCC8] truncate">
                            👤 {kObj.owner || kObj.usedBy || "Unassigned"}
                          </p>
                          <div className="grid grid-cols-3 gap-1.5">
                            <button
                              type="button"
                              onClick={() => void handleCopyText(kObj.key)}
                              className="rounded-lg bg-white/10 hover:bg-white/20 py-1 text-[10px] font-bold text-white cursor-pointer"
                            >
                              {copiedKeyId === kObj.key ? "✓ Copied" : "Copy"}
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleToggleKey(kObj.key)}
                              className="rounded-lg bg-amber-600/30 hover:bg-amber-600/55 py-1 text-[10px] font-bold text-amber-200 cursor-pointer"
                            >
                              {kObj.active ? "Revoke" : "Activate"}
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleDeleteKey(kObj.key, kObj.owner)}
                              className="rounded-lg bg-red-600/35 hover:bg-red-600 py-1 text-[10px] font-bold text-red-100 cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* User Enforcement (Suspend / Ban / Shadow-Ban / Mute) */}
                <div className="rounded-3xl border border-white/10 bg-[#141210]/95 p-4 sm:p-6 space-y-4">
                  <div>
                    <h2 className="text-base font-black text-white">
                      ⚖️ Account Bans, Suspensions & Mutes
                    </h2>
                    <p className="text-xs text-[#8C8175] mt-0.5">
                      Enforce fraud, scam, chargeback, or abuse actions across
                      handles, owners, or license keys.
                    </p>
                  </div>

                  <form onSubmit={handleApplyEnforcement} className="space-y-2.5">
                    <input
                      type="text"
                      dir="ltr"
                      placeholder="Handle, Owner Name, or License Key"
                      value={enfTarget}
                      onChange={(e) => setEnfTarget(e.target.value)}
                      className="w-full rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-xs font-bold text-white"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        value={enfType}
                        onChange={(e) =>
                          setEnfType(e.target.value as EnforcementType)
                        }
                        className="rounded-xl border border-white/15 bg-black/80 px-2.5 py-2 text-xs font-bold text-white"
                      >
                        <option value="ban">Permanent Ban</option>
                        <option value="suspend">Suspend</option>
                        <option value="shadow_ban">Shadow-Ban</option>
                        <option value="mute">Community Mute</option>
                      </select>
                      <select
                        value={enfReasonCode}
                        onChange={(e) =>
                          setEnfReasonCode(
                            e.target.value as EnforcementReasonCode
                          )
                        }
                        className="rounded-xl border border-white/15 bg-black/80 px-2.5 py-2 text-xs font-bold text-white"
                      >
                        {Object.entries(REASON_CODE_LABELS).map(([k, lbl]) => (
                          <option key={k} value={k}>
                            {lbl}
                          </option>
                        ))}
                      </select>
                      <select
                        value={enfDurationDays}
                        onChange={(e) => setEnfDurationDays(e.target.value)}
                        className="rounded-xl border border-white/15 bg-black/80 px-2.5 py-2 text-xs font-bold text-white"
                      >
                        <option value="0">Permanent</option>
                        <option value="1">24 Hours</option>
                        <option value="7">7 Days</option>
                        <option value="30">30 Days</option>
                      </select>
                    </div>
                    <input
                      type="text"
                      dir="ltr"
                      placeholder="Internal admin note / evidence..."
                      value={enfNote}
                      onChange={(e) => setEnfNote(e.target.value)}
                      className="w-full rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-xs font-bold text-white"
                    />
                    <button
                      type="submit"
                      disabled={busy}
                      className="w-full py-2.5 rounded-xl bg-[#C4282A] hover:bg-red-600 text-white text-xs font-extrabold cursor-pointer disabled:opacity-45"
                    >
                      🔨 Apply Enforcement Action
                    </button>
                  </form>

                  <div className="space-y-2 pt-2 border-t border-white/10 max-h-96 overflow-y-auto pr-1 scrollbar-none">
                    {snapshot.enforcement.length === 0 ? (
                      <p className="text-xs text-[#8C8175] text-center py-4">
                        No enforcement records logged.
                      </p>
                    ) : (
                      snapshot.enforcement.map((rec) => (
                        <div
                          key={rec.id}
                          className={`rounded-2xl border p-3 space-y-1.5 ${
                            rec.active
                              ? "border-red-500/40 bg-red-950/25"
                              : "border-white/10 bg-black/50 opacity-60"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-black text-white truncate">
                              {rec.target}
                            </span>
                            <span className="rounded-md bg-red-600/30 border border-red-400/40 px-2 py-0.5 text-[9px] font-black uppercase text-red-200">
                              {rec.active ? rec.type : "Lifted"}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#E8DCC8]">
                            {REASON_CODE_LABELS[rec.reasonCode]} — {rec.note}
                          </p>
                          <div className="flex items-center justify-between text-[10px] text-[#8C8175]">
                            <span>
                              By {rec.actor} •{" "}
                              {rec.expiresAt
                                ? `Until ${formatDateTime(rec.expiresAt)}`
                                : "Permanent"}
                            </span>
                            {rec.active && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void handleLiftEnforcement(rec)}
                                className="text-emerald-300 hover:underline font-extrabold cursor-pointer"
                              >
                                ↺ Lift
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================= */}
            {/* TAB 4: COMMUNITY MODERATION (PROFILES & REVIEWS)              */}
            {/* ============================================================= */}
            {activeTab === "community" && (
              <div className="rounded-3xl border border-white/10 bg-[#141210]/95 p-4 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-black text-white">
                      🎭 Movie Club Moderation ({commProfiles.length} Buffs •{" "}
                      {commReviews.length} Reviews)
                    </h2>
                    <p className="text-xs text-[#8C8175]">
                      Review public handles and comments, flag/hide offensive
                      UGC, or jump straight to enforcing a global mute/ban.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={loadingComm}
                    onClick={() => void loadCommunityModData(true)}
                    className="rounded-xl border border-white/15 bg-black/75 px-3 py-1.5 text-xs font-bold text-white cursor-pointer"
                  >
                    ↻ {loadingComm ? "Loading..." : "Refresh Feed"}
                  </button>
                </div>

                <input
                  type="search"
                  dir="ltr"
                  placeholder="Filter handles, movies, or review text..."
                  value={commSearch}
                  onChange={(e) => setCommSearch(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-black/80 px-3.5 py-2 text-xs font-bold text-white"
                />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Public Profiles */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-cyan-300">
                      Public Profiles ({filteredCommProfiles.length})
                    </h3>
                    <div className="max-h-96 overflow-y-auto space-y-2 pr-1 scrollbar-none">
                      {filteredCommProfiles.map((p) => (
                        <div
                          key={p.publicId}
                          className="rounded-2xl border border-white/10 bg-black/65 p-3 space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-black text-white">
                              {p.handle}
                            </span>
                            <span className="text-[10px] text-[#8C8175]">
                              {p.moviesWatched}M / {p.showsWatched}TV
                            </span>
                          </div>
                          {p.bio && (
                            <p className="text-[11px] text-[#E8DCC8] italic">
                              “{p.bio}”
                            </p>
                          )}
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEnfTarget(p.handle);
                                setEnfType("mute");
                                setActiveTab("users");
                              }}
                              className="rounded-lg border border-amber-400/40 bg-amber-950/60 px-2.5 py-1 text-[10px] font-bold text-amber-200 cursor-pointer"
                            >
                              Mute / Ban
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                blockCommunityUser(p.publicId);
                                await reportCommunityItem("profile", p.publicId);
                                showToast(true, `Blocked & flagged ${p.handle}`);
                                void loadCommunityModData(true);
                              }}
                              className="rounded-lg border border-red-500/40 bg-red-950/60 px-2.5 py-1 text-[10px] font-bold text-red-200 cursor-pointer"
                            >
                              🚫 Hide Profile
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Latest Reviews */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                      Recent Reviews ({filteredCommReviews.length})
                    </h3>
                    <div className="max-h-96 overflow-y-auto space-y-2 pr-1 scrollbar-none">
                      {filteredCommReviews.map((r) => (
                        <div
                          key={r.reviewId}
                          className="rounded-2xl border border-white/10 bg-black/65 p-3 space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-black text-white truncate">
                              {r.title}
                            </span>
                            <span className="text-xs text-amber-400 shrink-0">
                              {"★".repeat(r.rating)}
                            </span>
                          </div>
                          <p className="text-[10.5px] text-cyan-300 font-bold">
                            {r.authorHandle} • {formatDateTime(r.updatedAt)}
                          </p>
                          {r.comment && (
                            <p className="text-[11px] text-[#E8DCC8] leading-snug">
                              {r.comment}
                            </p>
                          )}
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={async () => {
                                const res = await reportCommunityItem(
                                  "review",
                                  r.reviewId
                                );
                                showToast(
                                  res.ok,
                                  res.ok
                                    ? "🚩 Review flagged for removal."
                                    : res.error || "Failed"
                                );
                                void loadCommunityModData(true);
                              }}
                              className="rounded-lg border border-red-500/40 bg-red-950/60 px-2.5 py-1 text-[10px] font-bold text-red-200 cursor-pointer"
                            >
                              🚩 Flag / Hide
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEnfTarget(r.authorHandle);
                                setEnfType("mute");
                                setActiveTab("users");
                              }}
                              className="rounded-lg border border-amber-400/40 bg-amber-950/60 px-2.5 py-1 text-[10px] font-bold text-amber-200 cursor-pointer"
                            >
                              Mute Author
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================= */}
            {/* TAB 5: GLOBAL AD BLOCKLIST & PLAYER INSPECTOR TICKETS         */}
            {/* ============================================================= */}
            {activeTab === "adblock" && (
              <div className="space-y-4">
                <div className="rounded-3xl border border-white/10 bg-[#141210]/95 p-4 sm:p-6 space-y-4">
                  <div>
                    <h2 className="text-base font-black text-white">
                      🛡️ Global Ad & Popup Blocklist Overrides (
                      {activeAdDomainsCount} Active)
                    </h2>
                    <p className="text-xs text-[#8C8175] mt-0.5">
                      Domains added here merge on top of the APK&apos;s baked-in
                      HaGeZi blocklist. Core streaming/TMDB/GitHub domains are
                      protected from accidental blocking.
                    </p>
                  </div>

                  <form
                    onSubmit={handleAddAdBlockDomain}
                    className="grid grid-cols-1 sm:grid-cols-3 gap-2"
                  >
                    <input
                      type="text"
                      dir="ltr"
                      placeholder="Domain (e.g. bad-popunder.com)"
                      value={newAdDomain}
                      onChange={(e) => setNewAdDomain(e.target.value)}
                      className="rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-xs font-mono text-white"
                    />
                    <input
                      type="text"
                      dir="ltr"
                      placeholder="Reason / Provider (e.g. Popunder on VidRock)"
                      value={newAdReason}
                      onChange={(e) => setNewAdReason(e.target.value)}
                      className="rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-xs font-bold text-white"
                    />
                    <button
                      type="submit"
                      disabled={busy}
                      className="rounded-xl bg-[#C4282A] hover:bg-red-600 px-4 py-2 text-xs font-extrabold text-white cursor-pointer disabled:opacity-45"
                    >
                      🛡️ Block Domain Globally
                    </button>
                  </form>

                  <input
                    type="search"
                    dir="ltr"
                    placeholder="Filter blocked domains..."
                    value={adSearch}
                    onChange={(e) => setAdSearch(e.target.value)}
                    className="w-full rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-xs font-bold text-white"
                  />

                  <div className="max-h-80 overflow-y-auto space-y-2 pr-1 scrollbar-none">
                    {filteredAdRules.length === 0 ? (
                      <p className="text-xs text-[#8C8175] text-center py-6">
                        No custom ad-block overrides yet. Add one above or
                        capture directly from the Player Ad Inspector (Step 2).
                      </p>
                    ) : (
                      filteredAdRules.map((rule) => (
                        <div
                          key={rule.id}
                          className="rounded-2xl border border-white/10 bg-black/65 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <p className="font-mono text-xs font-black text-red-300">
                              {rule.domain}
                            </p>
                            <p className="text-[10.5px] text-[#8C8175]">
                              {rule.reason} • {rule.addedBy} •{" "}
                              {formatDateTime(rule.addedAt)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleToggleAdRule(rule)}
                              className={`rounded-lg px-2.5 py-1 text-[10px] font-extrabold cursor-pointer ${
                                rule.active
                                  ? "bg-emerald-600/25 text-emerald-300 border border-emerald-400/40"
                                  : "bg-white/10 text-[#8C8175]"
                              }`}
                            >
                              {rule.active ? "Blocking" : "Paused"}
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleDeleteAdRule(rule)}
                              className="rounded-lg bg-red-950/75 hover:bg-red-700 border border-red-500/40 px-2 py-1 text-[10px] font-bold text-red-200 cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Ad Injection Tickets Queue (Populated by Step 2 Player Ad Inspector) */}
                <div className="rounded-3xl border border-cyan-500/30 bg-[#141210]/95 p-4 sm:p-6 space-y-2">
                  <h3 className="text-sm font-black text-cyan-300">
                    🔍 Player Ad-Inspector Tickets ({snapshot.adTickets.length})
                  </h3>
                  {snapshot.adTickets.length === 0 ? (
                    <p className="text-xs text-[#8C8175]">
                      Captures reported from the live Player Ad Inspector overlay
                      will appear here with full DOM selector, provider ID, and
                      one-click blocking.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {snapshot.adTickets.map((tk) => (
                        <div
                          key={tk.id}
                          className="rounded-xl border border-white/10 bg-black/65 p-3 text-xs space-y-1"
                        >
                          <p className="font-black text-white">
                            {tk.domain} on {tk.title} ({tk.providerId})
                          </p>
                          <p className="font-mono text-[10px] text-cyan-300 truncate">
                            {tk.selector}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ============================================================= */}
            {/* TAB 6: BRANDING, FEATURE FLAGS & APK REBUILD                  */}
            {/* ============================================================= */}
            {activeTab === "branding" && (
              <div className="space-y-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void commitBrandingConfig(
                      brandingDraft,
                      "BRANDING_FLAGS_PUBLISH",
                      "Published Branding & Feature Flags"
                    );
                  }}
                  className="rounded-3xl border border-white/10 bg-[#141210]/95 p-4 sm:p-6 space-y-4"
                >
                  <div>
                    <h2 className="text-base font-black text-white">
                      🎨 Appearance, Feature Flags & Fleet Policies
                    </h2>
                    <p className="text-xs text-[#8C8175] mt-0.5">
                      Changes publish immediately to GitHub Gist (
                      <code>branding_config.json</code> +{" "}
                      <code>admin_config.json</code>) without needing an APK
                      rebuild.
                    </p>
                  </div>

                  {/* Feature Flag Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {(
                      [
                        { key: "movieClubEnabled", label: "Movie Club Tab" },
                        {
                          key: "watchBuddiesEnabled",
                          label: "Watch Buddies Chat",
                        },
                        { key: "liveTvEnabled", label: "Live TV & Sports" },
                        {
                          key: "holidayOverlayEnabled",
                          label: "Seasonal Holiday Overlay",
                        },
                      ] as const
                    ).map((flag) => (
                      <label
                        key={flag.key}
                        className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/65 px-3.5 py-3 cursor-pointer"
                      >
                        <span className="text-xs font-extrabold text-white">
                          {flag.label}
                        </span>
                        <input
                          type="checkbox"
                          checked={brandingDraft[flag.key]}
                          onChange={(e) =>
                            setBrandingDraft((prev) => ({
                              ...prev,
                              [flag.key]: e.target.checked,
                            }))
                          }
                          className="h-4 w-4"
                        />
                      </label>
                    ))}
                  </div>

                  {/* OTA Branding Overrides */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/10">
                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-[#8C8175]">
                        Global MOTD Banner Message
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        placeholder="e.g. New movies added tonight!"
                        value={brandingDraft.motdBanner}
                        onChange={(e) =>
                          setBrandingDraft((prev) => ({
                            ...prev,
                            motdBanner: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-xs font-bold text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-[#8C8175]">
                        Minimum App Version
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        placeholder="1.2.0"
                        value={brandingDraft.minAppVersion}
                        onChange={(e) =>
                          setBrandingDraft((prev) => ({
                            ...prev,
                            minAppVersion: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-xs font-bold text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-[#8C8175]">
                        OTA Custom Wallpaper HTTPS URL (Optional)
                      </label>
                      <input
                        type="url"
                        dir="ltr"
                        placeholder="https://raw.githubusercontent.com/..."
                        value={brandingDraft.customWallpaperUrl}
                        onChange={(e) =>
                          setBrandingDraft((prev) => ({
                            ...prev,
                            customWallpaperUrl: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-xs font-mono text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-[#8C8175]">
                        Default Theme Override (Optional)
                      </label>
                      <select
                        value={brandingDraft.forceDefaultTheme}
                        onChange={(e) =>
                          setBrandingDraft((prev) => ({
                            ...prev,
                            forceDefaultTheme: e.target.value as "" | AppTheme,
                          }))
                        }
                        className="w-full rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-xs font-bold text-white"
                      >
                        <option value="">Keep User Choice (Default)</option>
                        <option value="violet">Violet</option>
                        <option value="red">Crimson Red</option>
                        <option value="midnight">Midnight Blue</option>
                        <option value="emerald">Emerald</option>
                        <option value="amber">Amber</option>
                        <option value="cyan">Cyan</option>
                      </select>
                    </div>
                  </div>

                  {brandingDraft.customWallpaperUrl &&
                    isSafeHttpsUrl(brandingDraft.customWallpaperUrl) && (
                      <div className="rounded-2xl border border-white/15 overflow-hidden max-w-sm aspect-video bg-black">
                        <img
                          src={brandingDraft.customWallpaperUrl}
                          alt="Wallpaper Live Preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-xl bg-[#C4282A] hover:bg-red-600 px-6 py-2.5 text-xs font-extrabold text-white cursor-pointer disabled:opacity-45"
                  >
                    ⚡ Publish Branding & Flags to Fleet
                  </button>
                </form>

                {/* Local Quarantine Reset & GitHub Actions APK Rebuild Trigger */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-3xl border border-white/10 bg-[#141210]/95 p-5 space-y-3">
                    <h3 className="text-sm font-black text-white">
                      🧹 Local Broken-Link Quarantine ({brokenLinksCount})
                    </h3>
                    <p className="text-xs text-[#8C8175]">
                      Restore titles hidden locally on this device.
                    </p>
                    <button
                      type="button"
                      disabled={brokenLinksCount === 0}
                      onClick={() => {
                        clearAllBrokenLinks();
                        setBrokenLinksCount(0);
                        window.dispatchEvent(new Event("rabtv_catalog_updated"));
                        showToast(true, "✓ Cleared local broken-link quarantine.");
                      }}
                      className="w-full rounded-xl border border-white/15 bg-white/10 hover:bg-white/20 disabled:opacity-40 py-2 text-xs font-extrabold text-white cursor-pointer"
                    >
                      ↺ Restore Local Quarantined Titles
                    </button>
                  </div>

                  <div className="rounded-3xl border border-cyan-500/35 bg-[#141210]/95 p-5 space-y-3">
                    <h3 className="text-sm font-black text-cyan-300">
                      🤖 Rebuild Native APK via GitHub Actions
                    </h3>
                    <p className="text-xs text-[#8C8175]">
                      Needed after committing a new Android App Icon or TV
                      Launcher Banner to <code>assets/</code>.
                    </p>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleDispatchApkBuild}
                      className="w-full rounded-xl bg-cyan-700 hover:bg-cyan-600 py-2 text-xs font-extrabold text-white cursor-pointer"
                    >
                      🚀 Trigger main.yml Nightly Build
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================= */}
            {/* TAB 7: ALERTS, BROADCAST TOASTS & BUG REPORTS INBOX           */}
            {/* ============================================================= */}
            {activeTab === "alerts" && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                <div className="rounded-3xl border border-white/10 bg-[#141210]/95 p-4 sm:p-6 space-y-4">
                  <h2 className="text-base font-black text-white">
                    📢 Push Toasts & Broadcasts ({snapshot.notifications.length})
                  </h2>

                  <form onSubmit={handlePushToast} className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        dir="ltr"
                        placeholder="Target: ALL, Name, or Key"
                        value={targetQuery}
                        onChange={(e) => setTargetQuery(e.target.value)}
                        className="flex-1 rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-xs font-bold text-white"
                      />
                      <button
                        type="button"
                        onClick={() => setTargetQuery("ALL")}
                        className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-extrabold text-white cursor-pointer"
                      >
                        ALL
                      </button>
                    </div>
                    {uniqueOwners.length > 0 && (
                      <select
                        value={
                          uniqueOwners.includes(targetQuery) ? targetQuery : ""
                        }
                        onChange={(e) =>
                          e.target.value && setTargetQuery(e.target.value)
                        }
                        className="w-full rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-xs font-bold text-white"
                      >
                        <option value="">Pick active user...</option>
                        {uniqueOwners.map((u) => (
                          <option key={u} value={u}>
                            👤 {u}
                          </option>
                        ))}
                      </select>
                    )}

                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { id: "info", label: "🔔 Info" },
                          { id: "warning", label: "⚠️ Warn" },
                          { id: "critical", label: "🚨 Urgent" },
                        ] as { id: ToastSeverity; label: string }[]
                      ).map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setToastSeverity(s.id)}
                          className={`rounded-xl py-1.5 text-[11px] font-extrabold cursor-pointer ${
                            toastSeverity === s.id
                              ? "bg-[#C4282A] text-white"
                              : "bg-black/65 border border-white/10 text-[#8C8175]"
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>

                    <textarea
                      rows={3}
                      dir="ltr"
                      placeholder="Announcement message..."
                      value={targetMessage}
                      onChange={(e) => setTargetMessage(e.target.value)}
                      className="w-full rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-xs font-bold text-white resize-none"
                    />
                    <button
                      type="submit"
                      disabled={busy}
                      className="w-full py-2.5 rounded-xl bg-[#C4282A] hover:bg-red-600 text-white text-xs font-extrabold cursor-pointer disabled:opacity-45"
                    >
                      🚀 Push Toast Notification
                    </button>
                  </form>

                  <div className="space-y-2 pt-2 border-t border-white/10">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-[#8C8175]">
                        Active Queue ({snapshot.notifications.length})
                      </span>
                      {snapshot.notifications.length > 0 && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleDeleteToast(undefined, true)}
                          className="text-[10.5px] font-extrabold text-red-400 hover:underline cursor-pointer"
                        >
                          Purge All
                        </button>
                      )}
                    </div>
                    <div className="max-h-56 overflow-y-auto space-y-1.5 scrollbar-none">
                      {snapshot.notifications.map((n) => (
                        <div
                          key={n.id || n.timestamp}
                          className="rounded-xl border border-white/10 bg-black/65 px-3 py-2 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <span className="font-black text-amber-300">
                              [{n.target}]
                            </span>{" "}
                            <span className="text-white">{n.message}</span>
                          </div>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleDeleteToast(n.id, false)}
                            className="text-red-400 hover:text-red-200 font-black shrink-0 cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Embedded Existing Admin Bug Inbox */}
                <div className="rounded-3xl border border-white/10 bg-[#141210]/95 p-4 sm:p-6 space-y-3">
                  <h2 className="text-base font-black text-white">
                    🐞 User Bug Reports Inbox
                  </h2>
                  <AdminBugInbox />
                </div>
              </div>
            )}

            {/* ============================================================= */}
            {/* TAB 8: IMMUTABLE AUDIT LOG & SPLIT-GIST VAULT SECURITY        */}
            {/* ============================================================= */}
            {activeTab === "audit" && (
              <div className="space-y-4">
                {/* Split-Gist Security Vault (Keep Admin PAT off public APKs!) */}
                <div className="rounded-3xl border border-emerald-500/35 bg-[#141210]/95 p-4 sm:p-6 space-y-3">
                  <h2 className="text-base font-black text-emerald-300">
                    🔐 Split-Gist Admin Vault (Device-Only Write Token)
                  </h2>
                  <p className="text-xs text-[#8C8175] leading-relaxed">
                    Optional zero-server security upgrade: save your personal
                    GitHub PAT and Master Admin Gist ID directly on this device.
                    That way you can remove write tokens from public APK builds
                    while keeping full write control here.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      dir="ltr"
                      placeholder="Master Admin Gist ID (leave blank to use build default)"
                      value={vaultGistIdInput}
                      onChange={(e) => setVaultGistIdInput(e.target.value)}
                      className="rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-xs font-mono text-white"
                    />
                    <input
                      type="password"
                      dir="ltr"
                      placeholder="Personal GitHub PAT (stored only on this device)"
                      value={vaultPatInput}
                      onChange={(e) => setVaultPatInput(e.target.value)}
                      className="rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-xs font-mono text-white"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        saveLocalVaultCredentials(
                          vaultGistIdInput,
                          vaultPatInput
                        );
                        showToast(
                          true,
                          "🛡️ Saved local device Vault credentials. Syncing..."
                        );
                        void loadSnapshot();
                      }}
                      className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-extrabold text-white cursor-pointer"
                    >
                      Save Local Vault Credentials
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setVaultGistIdInput("");
                        setVaultPatInput("");
                        saveLocalVaultCredentials("", "");
                        showToast(true, "Cleared local override (using build default).");
                        void loadSnapshot();
                      }}
                      className="rounded-xl border border-white/15 bg-white/5 hover:bg-white/15 px-4 py-2 text-xs font-bold text-[#E8DCC8] cursor-pointer"
                    >
                      Reset to Default
                    </button>
                  </div>
                </div>

                {/* Hash-Chained Audit Log */}
                <div className="rounded-3xl border border-white/10 bg-[#141210]/95 p-4 sm:p-6 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-base font-black text-white">
                      📜 Hash-Chained Audit Log ({snapshot.auditLog.length})
                    </h2>
                    <button
                      type="button"
                      onClick={() =>
                        exportJsonFile(
                          `rabtv_audit_log_${new Date().toISOString().slice(0, 10)}.json`,
                          snapshot.auditLog
                        )
                      }
                      className="rounded-lg border border-white/15 bg-black/75 px-3 py-1 text-[10.5px] font-bold text-cyan-300 cursor-pointer"
                    >
                      💾 Export Audit JSON
                    </button>
                  </div>

                  <input
                    type="search"
                    dir="ltr"
                    placeholder="Filter by action, target, actor, or reason..."
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    className="w-full rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-xs font-bold text-white"
                  />

                  <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1 scrollbar-none">
                    {filteredAudit.length === 0 ? (
                      <p className="text-xs text-[#8C8175] text-center py-6">
                        No audit entries recorded yet.
                      </p>
                    ) : (
                      filteredAudit.map((entry) => (
                        <div
                          key={entry.id}
                          className="rounded-2xl border border-white/10 bg-black/65 p-3 space-y-1 text-xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-mono font-black text-cyan-300">
                              {entry.action}
                            </span>
                            <span className="text-[10px] text-[#8C8175]">
                              {formatDateTime(entry.timestamp)}
                            </span>
                          </div>
                          <p className="text-white font-bold">
                            Target: {entry.target} —{" "}
                            <span className="font-normal text-[#E8DCC8]">
                              {entry.reason}
                            </span>
                          </p>
                          {(entry.beforeSummary || entry.afterSummary) && (
                            <p className="text-[10.5px] font-mono text-[#8C8175]">
                              {entry.beforeSummary} → {entry.afterSummary}
                            </p>
                          )}
                          <p className="text-[9.5px] font-mono text-[#8C8175]">
                            Actor: {entry.actor} • Hash: {entry.entryHash}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* STEP-UP CONFIRMATION MODAL (HIGH-RISK / DESTRUCTIVE ACTIONS) */}
      {stepUp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
          onClick={() => setStepUp(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`max-w-md w-full rounded-3xl border p-6 space-y-4 shadow-2xl bg-[#141210] ${
              stepUp.danger ? "border-[#C4282A]" : "border-cyan-500/50"
            }`}
          >
            <h3 className="text-base font-black text-white">{stepUp.title}</h3>
            <p className="text-xs text-[#E8DCC8] leading-relaxed">
              {stepUp.description}
            </p>

            {stepUp.requireReason && (
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-[#8C8175]">
                  Audit Log Reason (Required)
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={stepUpReason}
                  onChange={(e) => setStepUpReason(e.target.value)}
                  placeholder="Enter reason for audit log..."
                  className="w-full rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-xs font-bold text-white"
                />
              </div>
            )}

            {stepUp.confirmWord && (
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-red-300">
                  Type {stepUp.confirmWord} to confirm
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={stepUpConfirmText}
                  onChange={(e) => setStepUpConfirmText(e.target.value)}
                  placeholder={stepUp.confirmWord}
                  className="w-full rounded-xl border border-red-500/45 bg-black/80 px-3 py-2 text-xs font-mono font-black text-white"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setStepUp(null)}
                className="rounded-xl border border-white/15 bg-white/5 hover:bg-white/15 py-2.5 text-xs font-bold text-[#E8DCC8] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  busy ||
                  (stepUp.requireReason && !stepUpReason.trim()) ||
                  (Boolean(stepUp.confirmWord) &&
                    stepUpConfirmText.trim().toUpperCase() !==
                      stepUp.confirmWord)
                }
                onClick={async () => {
                  const current = stepUp;
                  const reason = stepUpReason.trim() || "Admin confirmed";
                  setStepUp(null);
                  await current.onConfirm(reason);
                }}
                className={`rounded-xl py-2.5 text-xs font-extrabold text-white cursor-pointer disabled:opacity-40 ${
                  stepUp.danger
                    ? "bg-[#C4282A] hover:bg-red-600"
                    : "bg-cyan-600 hover:bg-cyan-500"
                }`}
              >
                Confirm Action
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-Screen Portal for Referral Payouts Ledger */}
      {isReferralModalOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <AdminReferralModal
            isOpen={isReferralModalOpen}
            onClose={() => {
              setIsReferralModalOpen(false);
              void fetchReferralSystemData(false).then((d) =>
                setReferralTotals(computeFleetReferralTotals(d))
              );
            }}
          />,
          document.body
        )}
    </main>
  );
}