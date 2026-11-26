// src/routes/admin.tsx
// RABBiT TV Standalone Admin Control Application (100% GitHub-Backed, Zero External Servers)
// Redesigned with an Extended, Granular, Dense Collapsible Admin Sidebar (30 Tools across 8 Groups)
// Distinct from the Customer/Client Sidebar — reuses existing committed RABBiT TV background & button assets.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import React, { useState, useEffect, useMemo, useCallback, useRef, memo } from "react";
import { createPortal } from "react-dom";
import { AppWallpaper } from "@/components/AppWallpaper";
import { AdminBugInbox } from "@/components/AdminBugInbox";
import { AdminReferralModal } from "@/components/AdminReferralModal";
import {
  AppTheme,
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
  PROTECTED_WHITELIST_DOMAINS,
  fetchFullAdminSnapshot,
  commitAdminGistFiles,
  resolveAdInjectionTicket,
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
  getNativeInspectorBridge,
  syncRemoteAdblockToNativeBridge,
  type FullAdminSnapshot,
  type StreamProviderConfig,
  type TitleSourceOverride,
  type UserEnforcementRecord,
  type EnforcementType,
  type EnforcementReasonCode,
  type AdBlockRule,
  type BrandingAndFlagsConfig,
} from "@/lib/admin-store";

// =============================================================================
// REUSED COMMITTED RABBiT TV ASSETS (ZERO NEW IMAGES REQUIRED)
// =============================================================================
const IMG_CARD_FRAME =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-community-card-frame.jpg";
const IMG_SECTION_BANNER =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-community-section-banner.jpg";
const IMG_GREETING_BG =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-greeting-background.jpg";
const IMG_DETAILS_PANEL =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-details-panel-background.jpg";
const IMG_STAT_CARD =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-stat-card-background.jpg";
const IMG_EMPTY_STATE =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-community-empty-state.jpg";
const IMG_PILL_ACTIVE =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-pill-active-crimson.jpg";
const IMG_PILL_INACTIVE =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-pill-inactive-dark.jpg";
const IMG_BTN_PRIMARY =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-button-play-primary.jpg";
const IMG_BTN_ACTIVE =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-player-button-action-active.jpg";
const IMG_BTN_IDLE =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-player-button-action-idle.jpg";
const IMG_BTN_DANGER =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-player-button-action-danger.jpg";
const IMG_INPUT_BAR =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-search-input-bar-background.jpg";

const ADMIN_APP_STYLES = `
  /* 6-Theme Hue-Shift Sync Matching All Overhauled RABBiT TV Screens */
  :root,
  html[data-theme="violet"] {
    --rabtv-adm-plate-filter: hue-rotate(-78deg) saturate(1.12) brightness(1.02);
    --rabtv-adm-play-filter: hue-rotate(-74deg) saturate(1.16) brightness(1.05);
  }
  html[data-theme="red"] {
    --rabtv-adm-plate-filter: hue-rotate(0deg) saturate(1.08) brightness(1.0);
    --rabtv-adm-play-filter: hue-rotate(0deg) saturate(1.14) brightness(1.04);
  }
  html[data-theme="midnight"] {
    --rabtv-adm-plate-filter: hue-rotate(-132deg) saturate(1.14) brightness(1.04);
    --rabtv-adm-play-filter: hue-rotate(-128deg) saturate(1.18) brightness(1.06);
  }
  html[data-theme="emerald"] {
    --rabtv-adm-plate-filter: hue-rotate(154deg) saturate(1.10) brightness(1.02);
    --rabtv-adm-play-filter: hue-rotate(150deg) saturate(1.15) brightness(1.04);
  }
  html[data-theme="amber"] {
    --rabtv-adm-plate-filter: hue-rotate(28deg) saturate(1.14) brightness(1.04);
    --rabtv-adm-play-filter: hue-rotate(24deg) saturate(1.18) brightness(1.06);
  }
  html[data-theme="cyan"] {
    --rabtv-adm-plate-filter: hue-rotate(-154deg) saturate(1.12) brightness(1.04);
    --rabtv-adm-play-filter: hue-rotate(-150deg) saturate(1.16) brightness(1.06);
  }

  /* Top Control App Bar (Reuses rabbit-tv-greeting-background.jpg) */
  .rabtv-adm-topbar {
    position: relative;
    overflow: hidden;
    background-color: #0c0a09;
    contain: layout paint;
  }
  .rabtv-adm-topbar-bg {
    position: absolute;
    inset: 0;
    background-size: cover;
    background-position: center center;
    opacity: 0.56;
    filter: var(--rabtv-adm-plate-filter);
    pointer-events: none;
    z-index: 0;
  }
  .rabtv-adm-topbar-scrim {
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, rgba(12,10,9,0.88) 0%, rgba(12,10,9,0.68) 50%, rgba(12,10,9,0.88) 100%);
    pointer-events: none;
    z-index: 1;
  }

  /* 9-Sliced Armored Admin Sidebar Shell (Dense & Zero Border Distortion) */
  .rabtv-adm-sidebar-shell {
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
    padding: 20px 18px !important;
    background-color: rgba(12, 10, 9, 0.94);
    contain: layout paint;
  }
  .rabtv-adm-sidebar-9slice {
    position: absolute;
    inset: 0;
    box-sizing: border-box;
    border-style: solid;
    border-color: transparent;
    border-width: 22px 18px;
    border-image-source: url("${IMG_CARD_FRAME}");
    border-image-slice: 13% 11% fill;
    border-image-repeat: stretch;
    filter: var(--rabtv-adm-plate-filter);
    pointer-events: none;
    z-index: 0;
  }

  /* Compact Sidebar Group Dropdown Header */
  .rabtv-adm-group-hdr {
    position: relative;
    overflow: hidden;
    background-color: #0c0a09;
    contain: layout paint;
  }
  .rabtv-adm-group-hdr-bg {
    position: absolute;
    inset: 0;
    background-size: 100% 100%;
    opacity: 0.84;
    filter: var(--rabtv-adm-plate-filter);
    pointer-events: none;
    z-index: 0;
  }

  /* Active Dense Sidebar Leaf Item */
  .rabtv-adm-leaf-active {
    position: relative;
    overflow: hidden;
    background-color: #0c0a09;
    contain: layout paint;
  }
  .rabtv-adm-leaf-active-bg {
    position: absolute;
    inset: 0;
    background-size: 100% 100%;
    opacity: 0.94;
    filter: var(--rabtv-adm-play-filter);
    pointer-events: none;
    z-index: 0;
  }

  /* 9-Sliced Main Stage Panel (Reuses rabbit-tv-community-card-frame.jpg + details-panel overlay) */
  .rabtv-adm-panel {
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
    padding: 28px 24px !important;
    background-color: rgba(12, 10, 9, 0.90);
    contain: layout paint;
  }
  @media (min-width: 640px) {
    .rabtv-adm-panel {
      padding: 32px 32px !important;
    }
  }
  .rabtv-adm-panel-9slice {
    position: absolute;
    inset: 0;
    box-sizing: border-box;
    border-style: solid;
    border-color: transparent;
    border-width: 22px 20px;
    border-image-source: url("${IMG_CARD_FRAME}");
    border-image-slice: 13% 11% fill;
    border-image-repeat: stretch;
    filter: var(--rabtv-adm-plate-filter);
    pointer-events: none;
    z-index: 0;
  }
  .rabtv-adm-panel-backdrop {
    position: absolute;
    inset: 18px 16px;
    border-radius: 14px;
    background-size: cover;
    background-position: center center;
    opacity: 0.24;
    filter: var(--rabtv-adm-plate-filter);
    pointer-events: none;
    z-index: 0;
  }
  .rabtv-adm-panel-scrim {
    position: absolute;
    inset: 18px 16px;
    border-radius: 14px;
    background: linear-gradient(180deg, rgba(12,10,9,0.72) 0%, rgba(12,10,9,0.82) 100%);
    pointer-events: none;
    z-index: 1;
  }

  /* 9-Sliced Section Header Banner (Reuses rabbit-tv-community-section-banner.jpg) */
  .rabtv-adm-banner {
    position: relative;
    width: 100%;
    min-height: 54px;
    box-sizing: border-box;
    padding: 14px 52px !important;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border-radius: 18px;
    overflow: hidden;
    background-color: #0c0a09;
    contain: layout paint;
  }
  @media (min-width: 640px) {
    .rabtv-adm-banner {
      min-height: 62px;
      padding: 16px 68px !important;
    }
  }
  .rabtv-adm-banner-9slice {
    position: absolute;
    inset: 0;
    box-sizing: border-box;
    border-style: solid;
    border-color: transparent;
    border-width: 10px 44px;
    border-image-source: url("${IMG_SECTION_BANNER}");
    border-image-slice: 18% 20% fill;
    border-image-repeat: stretch;
    filter: var(--rabtv-adm-plate-filter);
    pointer-events: none;
    z-index: 0;
  }

  /* 9-Sliced Stat Card (Reuses rabbit-tv-stat-card-background.jpg) */
  .rabtv-adm-stat {
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
    padding: 18px 20px !important;
    background-color: #0c0a09;
    contain: layout paint;
  }
  .rabtv-adm-stat-9slice {
    position: absolute;
    inset: 0;
    box-sizing: border-box;
    border-style: solid;
    border-color: transparent;
    border-width: 14px 16px;
    border-image-source: url("${IMG_STAT_CARD}");
    border-image-slice: 20% 14% fill;
    border-image-repeat: stretch;
    filter: var(--rabtv-adm-plate-filter);
    pointer-events: none;
    z-index: 0;
  }

  /* Empty State Showcase (Reuses rabbit-tv-community-empty-state.jpg) */
  .rabtv-adm-empty {
    position: relative;
    overflow: hidden;
    padding: 36px 28px !important;
    background-color: #0c0a09;
    contain: layout paint;
  }
  .rabtv-adm-empty-bg {
    position: absolute;
    inset: 0;
    background-size: cover;
    background-position: center center;
    opacity: 0.45;
    pointer-events: none;
    z-index: 0;
  }
  .rabtv-adm-empty-scrim {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 80% 76% at 50% 45%, rgba(12,10,9,0.78) 0%, rgba(12,10,9,0.90) 100%);
    pointer-events: none;
    z-index: 1;
  }

  /* Large Click-and-Point Armored Action Buttons */
  .rabtv-adm-btn {
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
    padding-inline: 18px;
    background-color: #0c0a09;
    border: 0 !important;
    contain: layout paint;
    transition: transform 140ms ease, opacity 140ms ease;
  }
  .rabtv-adm-btn:hover:not(:disabled) { transform: scale(1.02); }
  .rabtv-adm-btn:active:not(:disabled) { transform: scale(0.97); }
  .rabtv-adm-btn-art {
    position: absolute;
    inset: 0;
    background-size: 100% 100%;
    pointer-events: none;
    z-index: 0;
  }
  .rabtv-adm-btn-art--primary { opacity: 0.96; filter: var(--rabtv-adm-play-filter); }
  .rabtv-adm-btn-art--active { opacity: 0.98; filter: saturate(1.1) brightness(1.04); }
  .rabtv-adm-btn-art--idle { opacity: 0.90; filter: var(--rabtv-adm-plate-filter) brightness(0.94); }
  .rabtv-adm-btn-art--danger { opacity: 0.96; filter: saturate(1.12) brightness(1.02); }
  .rabtv-adm-btn-scrim {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 76% 68% at 50% 50%, rgba(12,10,9,0.42) 0%, rgba(12,10,9,0.16) 100%);
    pointer-events: none;
    z-index: 1;
  }
  .rabtv-adm-btn-label {
    position: relative;
    z-index: 2;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    text-shadow: 0 1px 4px rgba(12,10,9,0.96);
  }
`;

export type AdminViewId =
  | "live_dashboard"
  | "panic_switches"
  | "motd_banners"
  | "min_version_gate"
  | "provider_priority"
  | "provider_health"
  | "add_provider"
  | "title_overrides"
  | "title_quarantine"
  | "manifest_rollback"
  | "key_generator"
  | "key_directory"
  | "user_enforcement"
  | "enforcement_log"
  | "referral_ledger"
  | "ad_blocklist"
  | "ad_tickets"
  | "ad_whitelist"
  | "mod_profiles"
  | "mod_reviews"
  | "mod_flags"
  | "feature_flags"
  | "ota_wallpaper"
  | "theme_override"
  | "broadcast_push"
  | "broadcast_queue"
  | "bug_inbox"
  | "apk_builds"
  | "audit_trail"
  | "gist_vault";

type AdminGroupId =
  | "command"
  | "streams"
  | "licenses"
  | "adfirewall"
  | "community"
  | "branding"
  | "alerts"
  | "system";

interface AdminSidebarItem {
  id: AdminViewId;
  label: string;
  icon: string;
  keywords: string;
}

interface AdminSidebarGroup {
  id: AdminGroupId;
  title: string;
  icon: string;
  items: AdminSidebarItem[];
}

const ADMIN_SIDEBAR_GROUPS: AdminSidebarGroup[] = [
  {
    id: "command",
    title: "Command & Emergencies",
    icon: "⚡",
    items: [
      { id: "live_dashboard", label: "Live Fleet Dashboard", icon: "📊", keywords: "overview kpi metrics home status" },
      { id: "panic_switches", label: "Emergency Panic Switches", icon: "🚨", keywords: "maintenance freeze tier1 lock emergency" },
      { id: "motd_banners", label: "Maintenance & MOTD Banners", icon: "🏷️", keywords: "banner notice announcement maintaining clear" },
      { id: "min_version_gate", label: "App Version & Update Gate", icon: "📲", keywords: "version minimum apk update gate" },
    ],
  },
  {
    id: "streams",
    title: "Streams & Playback",
    icon: "🎬",
    items: [
      { id: "provider_priority", label: "Provider Priority Queue", icon: "↕️", keywords: "servers order tier kill switch enable disable" },
      { id: "provider_health", label: "Live Stream Health Scan", icon: "📡", keywords: "ping latency uptime status check" },
      { id: "add_provider", label: "Add Custom Stream Source", icon: "➕", keywords: "new server template url embed" },
      { id: "title_overrides", label: "Title Stream Overrides", icon: "🎯", keywords: "tmdb direct url schedule pin movie tv" },
      { id: "title_quarantine", label: "Global Title Quarantine", icon: "🧹", keywords: "hide broken links restore quarantine" },
      { id: "manifest_rollback", label: "Manifest Revisions & Rollback", icon: "⏪", keywords: "history undo version restore" },
    ],
  },
  {
    id: "licenses",
    title: "Licenses & Users",
    icon: "🔑",
    items: [
      { id: "key_generator", label: "Generate Activation Keys", icon: "⚡", keywords: "create issue key new user license" },
      { id: "key_directory", label: "Active & Claimed Keys", icon: "🗂️", keywords: "search revoke delete export keys" },
      { id: "user_enforcement", label: "Apply Ban / Suspend / Mute", icon: "🔨", keywords: "punish fraud scam chargeback shadowban" },
      { id: "enforcement_log", label: "Active Enforcement List", icon: "⚖️", keywords: "unban lift muted banned users" },
      { id: "referral_ledger", label: "Referral Payouts Ledger", icon: "💰", keywords: "cash owed invites payouts" },
    ],
  },
  {
    id: "adfirewall",
    title: "Ad Firewall & Inspector",
    icon: "🛡️",
    items: [
      { id: "ad_blocklist", label: "Global Ad Domain Blocklist", icon: "🚫", keywords: "popup popunder domains blocklist gist" },
      { id: "ad_tickets", label: "Player Inspector Tickets", icon: "🔍", keywords: "reported ads inspector resolve" },
      { id: "ad_whitelist", label: "Protected Core Whitelist", icon: "✅", keywords: "safe domains native bridge hagezi stats" },
    ],
  },
  {
    id: "community",
    title: "Movie Club Moderation",
    icon: "🎭",
    items: [
      { id: "mod_profiles", label: "Public Buff Profiles", icon: "👥", keywords: "handles bios hide users" },
      { id: "mod_reviews", label: "Community Reviews Queue", icon: "💬", keywords: "comments ratings flag moderate" },
      { id: "mod_flags", label: "Community & Buddy Switches", icon: "🎛️", keywords: "readonly watch buddies freeze club" },
    ],
  },
  {
    id: "branding",
    title: "Branding, Visuals & Flags",
    icon: "🎨",
    items: [
      { id: "feature_flags", label: "App Feature Flags", icon: "🚩", keywords: "livetv holiday overlay trials toggles" },
      { id: "ota_wallpaper", label: "OTA Wallpaper & Splash", icon: "🖼️", keywords: "background splash video custom url" },
      { id: "theme_override", label: "Default Theme Override", icon: "🌈", keywords: "violet red midnight emerald amber cyan" },
    ],
  },
  {
    id: "alerts",
    title: "Alerts & Bug Reports",
    icon: "📢",
    items: [
      { id: "broadcast_push", label: "Push Toast Broadcasts", icon: "🚀", keywords: "message notify all user popup" },
      { id: "broadcast_queue", label: "Active Toast Queue", icon: "📋", keywords: "delete purge notifications" },
      { id: "bug_inbox", label: "User Bug Reports Inbox", icon: "🐞", keywords: "issues feedback tickets inbox" },
    ],
  },
  {
    id: "system",
    title: "System, Builds & Vault",
    icon: "⚙️",
    items: [
      { id: "apk_builds", label: "GitHub APK Build Trigger", icon: "🤖", keywords: "actions workflow nightly rebuild main.yml" },
      { id: "audit_trail", label: "Hash-Chained Audit Log", icon: "📜", keywords: "logs sha256 security history export" },
      { id: "gist_vault", label: "Split-Gist Vault & Backup", icon: "🔐", keywords: "pat token gist id credentials backup" },
    ],
  },
];

const ALL_VIEW_IDS = new Set<string>(
  ADMIN_SIDEBAR_GROUPS.flatMap((g) => g.items.map((i) => i.id))
);

export const Route = createFileRoute("/admin")({
  component: AdminCommandCenterPage,
  validateSearch: (search: Record<string, unknown>): { view?: AdminViewId } => {
    const raw = typeof search.view === "string" ? search.view : "";
    return {
      view: ALL_VIEW_IDS.has(raw) ? (raw as AdminViewId) : undefined,
    };
  },
});

const ADMIN_VAULT_LOCKED_KEY = "rabtv_admin_vault_locked";

type ToastSeverity = "info" | "warning" | "critical";
type KeyFilterMode = "all" | "active" | "used";
type ProviderFilterMode = "all" | "enabled" | "disabled" | "tier1" | "tier2" | "issues";

interface StepUpRequest {
  title: string;
  description: string;
  confirmWord?: string;
  requireReason?: boolean;
  defaultReason?: string;
  danger?: boolean;
  onConfirm: (reason: string) => Promise<void>;
}

const REASON_CODE_LABELS: Record<EnforcementReasonCode, string> = {
  fraud: "Fraud / Key Sharing",
  scam: "Scam / Impersonation",
  chargeback: "Payment Chargeback",
  tos_violation: "ToS Violation",
  attack: "Spam / Bot Attack",
  abuse: "Harassment / Abuse",
  other: "Other Reason",
};

const THEME_PICKER_OPTIONS: { id: "" | AppTheme; label: string; swatch: string }[] = [
  { id: "", label: "Keep User Choice", swatch: "from-zinc-700 to-zinc-900" },
  { id: "violet", label: "Violet Neon", swatch: "from-violet-600 to-purple-900" },
  { id: "red", label: "Crimson Red", swatch: "from-red-600 to-rose-950" },
  { id: "midnight", label: "Midnight Blue", swatch: "from-sky-500 to-blue-950" },
  { id: "emerald", label: "Emerald Teal", swatch: "from-emerald-500 to-teal-950" },
  { id: "amber", label: "Amber Gold", swatch: "from-amber-500 to-yellow-950" },
  { id: "cyan", label: "Cyber Cyan", swatch: "from-cyan-500 to-slate-950" },
];

const MOTD_QUICK_PRESETS = [
  "New movies & episodes added tonight — enjoy!",
  "Scheduled server maintenance in progress. Streams will resume shortly.",
  "New RABBiT TV APK update available — check Sidebar → Check for Updates!",
];

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

type AdmBtnVariant = "primary" | "active" | "idle" | "danger";

const AdminArmoredBtn = memo(function AdminArmoredBtn({
  variant = "idle",
  className = "",
  children,
  onClick,
  type = "button",
  disabled = false,
  title,
}: {
  variant?: AdmBtnVariant;
  className?: string;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: "button" | "submit";
  disabled?: boolean;
  title?: string;
}) {
  const bgUrl =
    variant === "primary"
      ? IMG_BTN_PRIMARY
      : variant === "active"
        ? IMG_BTN_ACTIVE
        : variant === "danger"
          ? IMG_BTN_DANGER
          : IMG_BTN_IDLE;
  const artMod =
    variant === "primary"
      ? "rabtv-adm-btn-art--primary"
      : variant === "active"
        ? "rabtv-adm-btn-art--active"
        : variant === "danger"
          ? "rabtv-adm-btn-art--danger"
          : "rabtv-adm-btn-art--idle";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rabtv-adm-btn rounded-xl text-white font-extrabold cursor-pointer disabled:opacity-40 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-cyan-400 ${className}`}
    >
      <span
        className={`rabtv-adm-btn-art ${artMod}`}
        aria-hidden="true"
        style={{ backgroundImage: `url(${bgUrl})` }}
      />
      <span className="rabtv-adm-btn-scrim" aria-hidden="true" />
      <span className="rabtv-adm-btn-label">{children}</span>
    </button>
  );
});

const AdminSectionBanner = memo(function AdminSectionBanner({
  title,
  subtitle,
  rightSlot,
}: {
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="rabtv-adm-banner shadow-xl">
      <div className="rabtv-adm-banner-9slice" aria-hidden="true" />
      <div className="relative z-10 min-w-0 flex-1 text-left">
        <h2 className="text-sm sm:text-base font-black text-white tracking-wide truncate drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]">
          {title}
        </h2>
        {subtitle && (
          <p className="text-[10.5px] sm:text-xs text-[#E8DCC8]/85 truncate">
            {subtitle}
          </p>
        )}
      </div>
      {rightSlot && <div className="relative z-10 shrink-0">{rightSlot}</div>}
    </div>
  );
});

const AdminPanelCard = memo(function AdminPanelCard({
  children,
  className = "",
  withBackdrop = true,
}: {
  children: React.ReactNode;
  className?: string;
  withBackdrop?: boolean;
}) {
  return (
    <div className={`rabtv-adm-panel rounded-3xl shadow-2xl ${className}`}>
      <div className="rabtv-adm-panel-9slice" aria-hidden="true" />
      {withBackdrop && (
        <div
          className="rabtv-adm-panel-backdrop"
          aria-hidden="true"
          style={{ backgroundImage: `url(${IMG_DETAILS_PANEL})` }}
        />
      )}
      <div className="rabtv-adm-panel-scrim" aria-hidden="true" />
      <div className="relative z-10 space-y-4">{children}</div>
    </div>
  );
});

function AdminCommandCenterPage() {
  const navigate = useNavigate();
  const routeSearch = Route.useSearch();

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

  // Dedicated Admin Sidebar Navigation State
  const [activeView, setActiveView] = useState<AdminViewId>(
    () => routeSearch.view || "live_dashboard"
  );
  const [mobileAdminDrawerOpen, setMobileAdminDrawerOpen] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<
    Record<AdminGroupId, boolean>
  >({
    command: true,
    streams: true,
    licenses: true,
    adfirewall: false,
    community: false,
    branding: false,
    alerts: false,
    system: false,
  });

  // Global Snapshot & Sync States
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

  // Referral Ledger Modal & Fleet Totals
  const [isReferralModalOpen, setIsReferralModalOpen] = useState(false);
  const [referralTotals, setReferralTotals] =
    useState<FleetReferralTotals | null>(null);

  // Streams & Overrides Forms
  const [providerFilter, setProviderFilter] =
    useState<ProviderFilterMode>("all");
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
  const [ovDirectUrl, setOvDirectUrl] = useState("");
  const [ovPublishAt, setOvPublishAt] = useState("");
  const [ovExpireAt, setOvExpireAt] = useState("");
  const [ovReason, setOvReason] = useState("");

  const [qMediaType, setQMediaType] = useState<"movie" | "tv">("movie");
  const [qMediaId, setQMediaId] = useState("");
  const [qTitle, setQTitle] = useState("");
  const [qReason, setQReason] = useState("");

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
  const [enfDurationDays, setEnfDurationDays] = useState<string>("0");
  const [enfNote, setEnfNote] = useState("");
  const [enfListFilter, setEnfListFilter] = useState<"active" | "all">("active");

  // Community Moderation State
  const [commProfiles, setCommProfiles] = useState<CommunityProfile[]>([]);
  const [commReviews, setCommReviews] = useState<CommunityReview[]>([]);
  const [commSearch, setCommSearch] = useState("");
  const [loadingComm, setLoadingComm] = useState(false);

  // Ad Blocklist Form & Native Bridge Stats
  const [newAdDomain, setNewAdDomain] = useState("");
  const [newAdReason, setNewAdReason] = useState("");
  const [adSearch, setAdSearch] = useState("");
  const [ticketFilter, setTicketFilter] = useState<"open" | "all">("open");
  const [nativeStats, setNativeStats] = useState<{
    baselineCount?: number;
    bundledHageziCount?: number;
    remoteOverrideCount?: number;
    sessionBlockCount?: number;
  } | null>(null);

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
  const [auditActionFilter, setAuditActionFilter] = useState("ALL");
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
  }, [resetInactivityTimer, activeView, isReferralModalOpen]);

  // Sync deep-link ?view= changes cleanly
  useEffect(() => {
    if (routeSearch.view && ALL_VIEW_IDS.has(routeSearch.view)) {
      setActiveView(routeSearch.view);
      const ownerGroup = ADMIN_SIDEBAR_GROUPS.find((g) =>
        g.items.some((i) => i.id === routeSearch.view)
      );
      if (ownerGroup) {
        setExpandedGroups((prev) => ({ ...prev, [ownerGroup.id]: true }));
      }
    }
  }, [routeSearch.view]);

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchFullAdminSnapshot();
      setSnapshot(res.snapshot);
      setBrandingDraft(res.snapshot.branding);
      if (!res.ok && res.error) {
        showToast(false, res.error);
      }
      const bridge = getNativeInspectorBridge();
      if (bridge?.getBlocklistStatsJson) {
        try {
          setNativeStats(JSON.parse(bridge.getBlocklistStatsJson()));
        } catch {
          setNativeStats(null);
        }
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

  // Escape closes Step-Up modal or mobile Admin Sidebar drawer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (stepUp) setStepUp(null);
        else if (mobileAdminDrawerOpen) setMobileAdminDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stepUp, mobileAdminDrawerOpen]);

  const requestStepUp = (req: StepUpRequest) => {
    setStepUpReason(req.defaultReason || "");
    setStepUpConfirmText("");
    setStepUp(req);
  };

  const selectAdminView = useCallback((viewId: AdminViewId) => {
    setActiveView(viewId);
    setMobileAdminDrawerOpen(false);
    const parentGroup = ADMIN_SIDEBAR_GROUPS.find((g) =>
      g.items.some((i) => i.id === viewId)
    );
    if (parentGroup) {
      setExpandedGroups((prev) => ({ ...prev, [parentGroup.id]: true }));
    }
  }, []);

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
  // STREAM & MANIFEST HANDLERS
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

  const handleMoveProvider = async (providerId: string, delta: -1 | 1) => {
    const list = [...snapshot.manifest.providers];
    const index = list.findIndex((p) => p.id === providerId);
    const targetIdx = index + delta;
    if (index < 0 || targetIdx < 0 || targetIdx >= list.length) return;
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

    if (
      !name ||
      !isSafeHttpsUrl(origin) ||
      !isSafeHttpsUrl(movieTpl.replace(/\{[^}]+\}/g, "1"))
    ) {
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
        "This removes the custom provider from the global sources manifest. You can roll back anytime from Revisions.",
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

  const handleSaveStreamOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = ovMediaId.replace(/\D/g, "").slice(0, 12);
    const cleanTitle = sanitizeAdminText(ovTitle, 80);
    const cleanUrl = ovDirectUrl.trim();
    if (!cleanId || !cleanTitle || !isSafeHttpsUrl(cleanUrl)) {
      showToast(false, "Enter numeric TMDB ID, Title, and valid HTTPS stream URL.");
      return;
    }
    const entry: TitleSourceOverride = {
      id: `${ovMediaType}-${cleanId}`,
      mediaId: cleanId,
      mediaType: ovMediaType,
      title: cleanTitle,
      action: "override_stream",
      directUrl: cleanUrl,
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
      ovReason || "Pinned custom direct stream URL",
      `Pinned direct stream for ${cleanTitle}`
    );
    setOvMediaId("");
    setOvTitle("");
    setOvDirectUrl("");
    setOvPublishAt("");
    setOvExpireAt("");
    setOvReason("");
  };

  const handleSaveGlobalQuarantine = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = qMediaId.replace(/\D/g, "").slice(0, 12);
    const cleanTitle = sanitizeAdminText(qTitle, 80);
    if (!cleanId || !cleanTitle) {
      showToast(false, "Enter numeric TMDB ID and Title to quarantine globally.");
      return;
    }
    const entry: TitleSourceOverride = {
      id: `${qMediaType}-${cleanId}`,
      mediaId: cleanId,
      mediaType: qMediaType,
      title: cleanTitle,
      action: "quarantine_hide",
      reason:
        sanitizeAdminText(qReason, 120) ||
        "Hidden globally due to broken stream",
      updatedAt: Date.now(),
    };
    const nextOverrides = [
      entry,
      ...snapshot.manifest.overrides.filter((o) => o.id !== entry.id),
    ];
    await saveManifestWithRevision(
      snapshot.manifest.providers,
      nextOverrides,
      "TITLE_QUARANTINE_ADD",
      `${cleanTitle} (${entry.id})`,
      entry.reason || "Global quarantine",
      `Globally quarantined ${cleanTitle}`
    );
    setQMediaId("");
    setQTitle("");
    setQReason("");
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
      "Removed title rule",
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
  // LICENSE KEYS & USER ENFORCEMENT HANDLERS
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
      showToast(false, "Enter or pick a user handle, owner name, or license key.");
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
  // AD BLOCKLIST HANDLERS
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
        `🛡️ Protected core domain "${domain}" cannot be blacklisted.`
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
        syncRemoteAdblockToNativeBridge(
          nextRules.filter((r) => r.active).map((r) => r.domain)
        );
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
        syncRemoteAdblockToNativeBridge(
          nextRules.filter((r) => r.active).map((r) => r.domain)
        );
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
        syncRemoteAdblockToNativeBridge(
          nextRules.filter((r) => r.active).map((r) => r.domain)
        );
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
  // BRANDING, BANNERS, FEATURE FLAGS & PANIC MODE HANDLERS
  // ===========================================================================
  const commitBrandingConfig = async (
    nextCfg: BrandingAndFlagsConfig,
    action: string,
    reason: string
  ) => {
    if (
      nextCfg.customWallpaperUrl &&
      !isSafeHttpsUrl(nextCfg.customWallpaperUrl)
    ) {
      showToast(false, "Custom Wallpaper URL must be a valid HTTPS link.");
      return;
    }
    if (nextCfg.customSplashUrl && !isSafeHttpsUrl(nextCfg.customSplashUrl)) {
      showToast(false, "Custom Splash URL must be a valid HTTPS link.");
      return;
    }

    setBusy(true);
    try {
      const now = Date.now();
      const payload: BrandingAndFlagsConfig = {
        ...nextCfg,
        motdBanner: sanitizeAdminText(nextCfg.motdBanner, 180),
        minAppVersion: sanitizeAdminText(nextCfg.minAppVersion, 20) || "1.2.0",
        updatedAt: now,
      };
      // Write BOTH branding_config.json AND admin_config.json with matching timestamps!
      const res = await commitAdminGistFiles({
        filesToUpdate: {
          "branding_config.json": payload,
          "admin_config.json": {
            allowTrials: payload.allowTrials,
            maintenanceMode: payload.maintenanceMode,
            motdBanner: payload.motdBanner,
            minAppVersion: payload.minAppVersion,
            updatedAt: now,
          },
        },
        audit: {
          action,
          target: "branding_config.json + admin_config.json",
          reason,
        },
      });
      if (res.ok) {
        setBrandingDraft(payload);
        showToast(true, `✅ ${reason}`);
        await loadSnapshot();
      } else {
        showToast(false, res.error || "Failed to publish config.");
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
        "Immediately updates remote fleet policies across all active RABBiT TV apps.",
      danger: true,
      requireReason: true,
      defaultReason: `Panic control toggled: ${label} -> ${nextVal ? "ON" : "OFF"}`,
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
        "Dispatches main.yml on branch main to build & publish a new nightly APK.",
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
  // BROADCAST TOASTS HANDLERS
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
  // DERIVED METRICS, COUNTERS & FILTERED DATA LISTS (ALL BEFORE EARLY RETURNS!)
  // ===========================================================================
  const gistInfo = useMemo(
    () => resolveAdminGistConfig(),
    [vaultGistIdInput, vaultPatInput]
  );

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

  const downProvidersCount = useMemo(
    () =>
      snapshot.manifest.providers.filter(
        (p) => p.healthStatus === "down" || p.healthStatus === "degraded"
      ).length,
    [snapshot.manifest.providers]
  );

  const filteredProviders = useMemo(() => {
    return snapshot.manifest.providers.filter((p) => {
      if (providerFilter === "enabled") return p.enabled;
      if (providerFilter === "disabled") return !p.enabled;
      if (providerFilter === "tier1") return p.tier === 1;
      if (providerFilter === "tier2") return p.tier === 2;
      if (providerFilter === "issues")
        return p.healthStatus === "down" || p.healthStatus === "degraded";
      return true;
    });
  }, [snapshot.manifest.providers, providerFilter]);

  const streamOverridesOnly = useMemo(
    () =>
      snapshot.manifest.overrides.filter((o) => o.action === "override_stream"),
    [snapshot.manifest.overrides]
  );

  const quarantinedTitlesOnly = useMemo(
    () =>
      snapshot.manifest.overrides.filter((o) => o.action === "quarantine_hide"),
    [snapshot.manifest.overrides]
  );

  const activeEnforcementsCount = useMemo(
    () => snapshot.enforcement.filter((e) => e.active).length,
    [snapshot.enforcement]
  );

  const filteredEnforcements = useMemo(
    () =>
      enfListFilter === "active"
        ? snapshot.enforcement.filter((e) => e.active)
        : snapshot.enforcement,
    [snapshot.enforcement, enfListFilter]
  );

  const activeAdDomainsCount = useMemo(
    () => snapshot.adblockRules.filter((r) => r.active).length,
    [snapshot.adblockRules]
  );

  const openAdTicketsCount = useMemo(
    () => snapshot.adTickets.filter((t) => t.status === "open").length,
    [snapshot.adTickets]
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

  const filteredAdTickets = useMemo(
    () =>
      ticketFilter === "open"
        ? snapshot.adTickets.filter((t) => t.status === "open")
        : snapshot.adTickets,
    [snapshot.adTickets, ticketFilter]
  );

  const auditActionTypes = useMemo(() => {
    const set = new Set<string>();
    for (const a of snapshot.auditLog) {
      if (a.action) set.add(a.action);
    }
    return Array.from(set).sort();
  }, [snapshot.auditLog]);

  const filteredAudit = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    return snapshot.auditLog.filter((a) => {
      if (auditActionFilter !== "ALL" && a.action !== auditActionFilter) {
        return false;
      }
      if (!q) return true;
      return (
        a.action.toLowerCase().includes(q) ||
        a.target.toLowerCase().includes(q) ||
        a.actor.toLowerCase().includes(q) ||
        a.reason.toLowerCase().includes(q)
      );
    });
  }, [snapshot.auditLog, auditSearch, auditActionFilter]);

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

  const activePanicCount = useMemo(() => {
    let n = 0;
    if (brandingDraft.maintenanceMode) n++;
    if (brandingDraft.panicReadOnlyCommunity) n++;
    if (brandingDraft.panicStrictTier1Only) n++;
    if (!brandingDraft.allowTrials) n++;
    return n;
  }, [brandingDraft]);

  // Live per-item badge map for the dense Admin Sidebar
  const sidebarBadges = useMemo<Partial<Record<AdminViewId, { text: string; alert?: boolean }>>>(() => {
    const b: Partial<Record<AdminViewId, { text: string; alert?: boolean }>> = {
      provider_priority: {
        text: `${enabledProvidersCount}/${snapshot.manifest.providers.length}`,
      },
      title_overrides: { text: `${streamOverridesOnly.length}` },
      title_quarantine: {
        text: `${quarantinedTitlesOnly.length + brokenLinksCount}`,
      },
      manifest_rollback: { text: `v${snapshot.manifest.version}` },
      key_directory: { text: `${keyStats.active}/${keyStats.total}` },
      enforcement_log: {
        text: `${activeEnforcementsCount}`,
        alert: activeEnforcementsCount > 0,
      },
      ad_blocklist: { text: `${activeAdDomainsCount}` },
      ad_tickets: {
        text: `${openAdTicketsCount}`,
        alert: openAdTicketsCount > 0,
      },
      mod_profiles: { text: `${commProfiles.length}` },
      mod_reviews: { text: `${commReviews.length}` },
      broadcast_queue: { text: `${snapshot.notifications.length}` },
      audit_trail: { text: `${snapshot.auditLog.length}` },
    };
    if (activePanicCount > 0) {
      b.panic_switches = { text: `${activePanicCount} ON`, alert: true };
    }
    if (brandingDraft.maintenanceMode) {
      b.motd_banners = { text: "MAINT", alert: true };
    } else if (brandingDraft.motdBanner) {
      b.motd_banners = { text: "MOTD" };
    }
    if (downProvidersCount > 0) {
      b.provider_health = { text: `${downProvidersCount} !`, alert: true };
    }
    if (referralTotals && referralTotals.totalOwedNow > 0) {
      b.referral_ledger = {
        text: `$${referralTotals.totalOwedNow.toFixed(0)}`,
        alert: true,
      };
    }
    return b;
  }, [
    enabledProvidersCount,
    snapshot.manifest.providers.length,
    snapshot.manifest.version,
    streamOverridesOnly.length,
    quarantinedTitlesOnly.length,
    brokenLinksCount,
    keyStats.active,
    keyStats.total,
    activeEnforcementsCount,
    activeAdDomainsCount,
    openAdTicketsCount,
    commProfiles.length,
    commReviews.length,
    snapshot.notifications.length,
    snapshot.auditLog.length,
    activePanicCount,
    brandingDraft.maintenanceMode,
    brandingDraft.motdBanner,
    downProvidersCount,
    referralTotals,
  ]);

  const filteredSidebarGroups = useMemo(() => {
    const q = sidebarSearch.trim().toLowerCase();
    if (!q) return ADMIN_SIDEBAR_GROUPS;
    return ADMIN_SIDEBAR_GROUPS.map((g) => ({
      ...g,
      items: g.items.filter(
        (it) =>
          it.label.toLowerCase().includes(q) ||
          it.keywords.toLowerCase().includes(q) ||
          g.title.toLowerCase().includes(q)
      ),
    })).filter((g) => g.items.length > 0);
  }, [sidebarSearch]);

  const activeViewMeta = useMemo(() => {
    for (const g of ADMIN_SIDEBAR_GROUPS) {
      const found = g.items.find((i) => i.id === activeView);
      if (found) return { group: g, item: found };
    }
    return {
      group: ADMIN_SIDEBAR_GROUPS[0],
      item: ADMIN_SIDEBAR_GROUPS[0].items[0],
    };
  }, [activeView]);

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

  const setAllGroupsExpanded = (open: boolean) => {
    setExpandedGroups({
      command: open,
      streams: open,
      licenses: open,
      adfirewall: open,
      community: open,
      branding: open,
      alerts: open,
      system: open,
    });
  };

  // ===========================================================================
  // EARLY SECURITY GUARDS (AFTER ALL HOOKS!)
  // ===========================================================================
  if (!isAdminDevice) {
    return (
      <main className="min-h-screen bg-[#0c0a09] text-[#E8DCC8] p-6 flex items-center justify-center relative">
        <style>{ADMIN_APP_STYLES}</style>
        <AppWallpaper />
        <div className="relative z-10 max-w-md w-full">
          <AdminPanelCard className="text-center">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-[#C4282A]/20 border border-[#C4282A]/50 flex items-center justify-center text-2xl">
              🔒
            </div>
            <h1 className="text-lg font-black text-white">
              Admin Authorization Required
            </h1>
            <p className="text-xs text-[#8C8175] leading-relaxed">
              This standalone Control App is restricted to authenticated RABBiT
              TV administrators.
            </p>
            <Link to="/" className="inline-block">
              <AdminArmoredBtn variant="primary" className="py-2.5 text-xs">
                ← Return to Home
              </AdminArmoredBtn>
            </Link>
          </AdminPanelCard>
        </div>
      </main>
    );
  }

  if (isVaultLocked) {
    return (
      <main className="min-h-screen bg-[#0c0a09] text-[#E8DCC8] p-6 flex items-center justify-center relative">
        <style>{ADMIN_APP_STYLES}</style>
        <AppWallpaper />
        <div className="relative z-10 max-w-sm w-full">
          <AdminPanelCard className="text-center">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-[#C4282A]/20 border border-[#C4282A]/50 flex items-center justify-center text-2xl">
              🛡️
            </div>
            <h1 className="text-base font-black uppercase tracking-wider text-white">
              Admin Vault Locked
            </h1>
            <p className="text-xs text-[#8C8175] leading-relaxed">
              Enter your 4–6 digit security PIN to unlock the RABBiT TV Admin
              Control App.
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
              <AdminArmoredBtn
                type="submit"
                variant="primary"
                className="w-full py-2.5 text-xs uppercase tracking-wider"
              >
                🔓 Unlock Control App
              </AdminArmoredBtn>
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
          </AdminPanelCard>
        </div>
      </main>
    );
  }

  // Reusable Dense Admin Sidebar Tree (Rendered on Desktop Left Rail + Mobile Drawer)
  const renderAdminSidebarContent = (isDrawer = false) => (
    <div className="rabtv-adm-sidebar-shell rounded-3xl h-full flex flex-col gap-2.5 shadow-2xl">
      <div className="rabtv-adm-sidebar-9slice" aria-hidden="true" />

      {/* Compact Sidebar Header + Search Filter */}
      <div className="relative z-10 space-y-2 pb-2 border-b border-white/10">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="block text-[10px] font-black uppercase tracking-widest text-cyan-300 truncate">
              ⚙️ Admin Control Tree
            </span>
            <span className="block text-[9.5px] text-[#8C8175]">
              30 Tools • 8 Dropdown Groups
            </span>
          </div>
          {isDrawer && (
            <button
              type="button"
              onClick={() => setMobileAdminDrawerOpen(false)}
              className="rounded-lg border border-red-500/45 bg-red-950/80 px-2 py-1 text-[10px] font-black text-red-100 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Fast Tool Filter Input */}
        <div className="relative">
          <input
            type="search"
            dir="ltr"
            placeholder="Find tool (e.g. banner, ban, ad)..."
            value={sidebarSearch}
            onChange={(e) => setSidebarSearch(e.target.value)}
            style={{
              backgroundImage: `url(${IMG_INPUT_BAR})`,
              backgroundSize: "100% 100%",
            }}
            className="w-full rounded-xl border border-white/15 bg-black/85 px-3 py-1.5 text-[11px] font-bold text-white placeholder-[#8C8175] focus:outline-none focus:ring-1 focus:ring-cyan-400"
          />
        </div>

        <div className="flex items-center justify-between gap-1.5 text-[9.5px]">
          <button
            type="button"
            onClick={() => setAllGroupsExpanded(true)}
            className="flex-1 rounded-lg border border-white/10 bg-black/65 hover:bg-white/10 py-1 font-extrabold text-[#E8DCC8] cursor-pointer"
          >
            ▾ Expand All
          </button>
          <button
            type="button"
            onClick={() => setAllGroupsExpanded(false)}
            className="flex-1 rounded-lg border border-white/10 bg-black/65 hover:bg-white/10 py-1 font-extrabold text-[#E8DCC8] cursor-pointer"
          >
            ▸ Collapse All
          </button>
        </div>
      </div>

      {/* Dense Scrollable Collapsible Dropdown Groups */}
      <div className="relative z-10 flex-1 overflow-y-auto space-y-1.5 pr-0.5 scrollbar-none">
        {filteredSidebarGroups.length === 0 ? (
          <p className="text-[11px] text-[#8C8175] text-center py-6">
            No admin tools match &ldquo;{sidebarSearch}&rdquo;.
          </p>
        ) : (
          filteredSidebarGroups.map((group) => {
            const isOpen =
              Boolean(sidebarSearch.trim()) || expandedGroups[group.id];
            const hasActiveChild = group.items.some((i) => i.id === activeView);

            return (
              <div
                key={group.id}
                className="rounded-2xl border border-white/10 bg-black/45 overflow-hidden"
              >
                {/* Compact Dropdown Header */}
                <button
                  type="button"
                  onClick={() =>
                    setExpandedGroups((prev) => ({
                      ...prev,
                      [group.id]: !prev[group.id],
                    }))
                  }
                  aria-expanded={isOpen}
                  className={`rabtv-adm-group-hdr w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 text-left cursor-pointer transition ${
                    hasActiveChild ? "border-b border-red-500/35" : ""
                  }`}
                >
                  <span
                    className="rabtv-adm-group-hdr-bg"
                    aria-hidden="true"
                    style={{ backgroundImage: `url(${IMG_PILL_INACTIVE})` }}
                  />
                  <span className="relative z-10 flex items-center gap-1.5 min-w-0">
                    <span className="text-xs shrink-0">{group.icon}</span>
                    <span
                      className={`text-[10.5px] font-black uppercase tracking-wider truncate ${
                        hasActiveChild ? "text-cyan-300" : "text-[#E8DCC8]"
                      }`}
                    >
                      {group.title}
                    </span>
                  </span>
                  <span className="relative z-10 flex items-center gap-1 shrink-0">
                    <span className="text-[9px] font-bold text-[#8C8175]">
                      {group.items.length}
                    </span>
                    <span
                      className={`text-[9px] text-cyan-300 transition-transform duration-150 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    >
                      ▼
                    </span>
                  </span>
                </button>

                {/* Dense Granular Items List */}
                {isOpen && (
                  <div className="p-1 space-y-0.5 bg-black/55">
                    {group.items.map((item) => {
                      const isActive = activeView === item.id;
                      const badge = sidebarBadges[item.id];
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => selectAdminView(item.id)}
                          className={`w-full flex items-center justify-between gap-1.5 rounded-xl px-2 py-1.5 text-left text-[11px] font-bold cursor-pointer transition ${
                            isActive
                              ? "rabtv-adm-leaf-active text-white font-black shadow-md"
                              : "text-[#E8DCC8]/90 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          {isActive && (
                            <span
                              className="rabtv-adm-leaf-active-bg"
                              aria-hidden="true"
                              style={{
                                backgroundImage: `url(${IMG_PILL_ACTIVE})`,
                              }}
                            />
                          )}
                          <span className="relative z-10 flex items-center gap-1.5 min-w-0">
                            <span className="text-[11px] shrink-0">
                              {item.icon}
                            </span>
                            <span className="truncate">{item.label}</span>
                          </span>
                          {badge && (
                            <span
                              className={`relative z-10 shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-black leading-none ${
                                badge.alert
                                  ? "bg-[#C4282A] text-white"
                                  : isActive
                                    ? "bg-black/65 text-cyan-200"
                                    : "bg-white/10 text-[#E8DCC8]"
                              }`}
                            >
                              {badge.text}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <main className="min-h-screen w-full max-w-full bg-[#0c0a09] text-[#E8DCC8] px-2.5 sm:px-5 py-3 pb-16 relative overflow-x-clip">
      <style>{ADMIN_APP_STYLES}</style>
      <AppWallpaper />

      <div className="relative z-10 max-w-[1440px] mx-auto space-y-3.5 min-w-0">
        {/* TOP PERSISTENT CONTROL APP BAR (Reuses rabbit-tv-greeting-background.jpg) */}
        <header
          className={`rabtv-adm-topbar rounded-2xl border border-white/15 px-3.5 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-3 shadow-2xl ${
            isLowRam ? "" : "backdrop-blur-md"
          }`}
        >
          <div
            className="rabtv-adm-topbar-bg"
            aria-hidden="true"
            style={{ backgroundImage: `url(${IMG_GREETING_BG})` }}
          />
          <div className="rabtv-adm-topbar-scrim" aria-hidden="true" />

          <div className="relative z-10 flex items-center gap-2.5 min-w-0 flex-1">
            {/* Mobile / Tablet Admin Sidebar Drawer Toggle */}
            <AdminArmoredBtn
              variant="primary"
              onClick={() => setMobileAdminDrawerOpen(true)}
              className="lg:hidden py-2 px-3 text-xs shrink-0"
            >
              ☰ Menu
            </AdminArmoredBtn>

            <Link to="/" className="shrink-0">
              <AdminArmoredBtn variant="idle" className="py-2 px-3 text-xs">
                ← App
              </AdminArmoredBtn>
            </Link>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm sm:text-base font-black text-white tracking-tight truncate">
                  RABBiT TV Control App
                </h1>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wider ${
                    gistInfo.usingPersonalVault
                      ? "border-emerald-400/50 bg-emerald-950/80 text-emerald-300"
                      : "border-cyan-400/45 bg-cyan-950/80 text-cyan-200"
                  }`}
                >
                  {gistInfo.usingPersonalVault
                    ? "🛡️ Vault PAT"
                    : "GitHub Gist"}
                </span>
              </div>
              <p className="text-[10.5px] text-[#E8DCC8]/80 truncate">
                {activeViewMeta.group.icon} {activeViewMeta.group.title} →{" "}
                <strong className="text-white">
                  {activeViewMeta.item.label}
                </strong>
              </p>
            </div>
          </div>

          <div className="relative z-10 flex items-center flex-wrap gap-2 shrink-0">
            <AdminArmoredBtn
              variant="idle"
              disabled={loading || busy}
              onClick={() => void loadSnapshot()}
              className="py-2 text-xs"
            >
              ↻ {loading ? "Syncing…" : "Sync Gist"}
            </AdminArmoredBtn>
            <AdminArmoredBtn
              variant="danger"
              onClick={handleLockVault}
              className="py-2 text-xs"
            >
              🔒 Lock
            </AdminArmoredBtn>
            <AdminArmoredBtn
              variant="idle"
              onClick={handleExitAdmin}
              className="py-2 text-xs"
            >
              Exit
            </AdminArmoredBtn>
          </div>
        </header>

        {/* MOBILE QUICK-JUMP TOOL DROPDOWN (Data List Selector when Drawer is closed) */}
        <div className="lg:hidden flex items-center gap-2">
          <select
            aria-label="Jump to Admin Tool"
            value={activeView}
            onChange={(e) => selectAdminView(e.target.value as AdminViewId)}
            className="flex-1 rounded-xl border border-cyan-500/35 bg-[#141210]/95 px-3 py-2.5 text-xs font-extrabold text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
          >
            {ADMIN_SIDEBAR_GROUPS.map((g) => (
              <optgroup key={g.id} label={`${g.icon} ${g.title}`}>
                {g.items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.icon} {it.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* INLINE STATUS TOAST */}
        {statusToast && (
          <div
            className={`rounded-2xl border px-4 py-2.5 text-center text-xs font-extrabold shadow-xl ${
              statusToast.ok
                ? "border-emerald-400/50 bg-emerald-950/92 text-emerald-200"
                : "border-red-400/50 bg-red-950/92 text-red-200"
            }`}
          >
            {statusToast.text}
          </div>
        )}

        {/* MAIN APP SHELL: PERSISTENT EXTENDED ADMIN SIDEBAR (LEFT) + CLICK-AND-POINT STAGE (RIGHT) */}
        <div className="grid grid-cols-1 lg:grid-cols-[276px_1fr] gap-4 items-start">
          {/* Desktop Persistent Dense Admin Sidebar */}
          <aside
            aria-label="Admin Panel Sidebar"
            className="hidden lg:block sticky top-3 h-[calc(100dvh-116px)]"
          >
            {renderAdminSidebarContent(false)}
          </aside>

          {/* MAIN WORKSPACE STAGE */}
          <section className="min-w-0 space-y-4">
            {/* =============================================================== */}
            {/* 1. LIVE FLEET DASHBOARD                                         */}
            {/* =============================================================== */}
            {activeView === "live_dashboard" && (
              <div className="space-y-4">
                <AdminSectionBanner
                  title="📊 Live Fleet Dashboard"
                  subtitle={`Manifest v${snapshot.manifest.version} • Last synced ${formatDateTime(snapshot.fetchedAt)}`}
                  rightSlot={
                    <AdminArmoredBtn
                      variant="primary"
                      disabled={probingAll}
                      onClick={() => {
                        selectAdminView("provider_health");
                        void handleProbeAllProviders();
                      }}
                      className="py-2 text-xs"
                    >
                      📡 Scan Streams
                    </AdminArmoredBtn>
                  }
                />

                {/* 6 Stat-Card KPI Tiles (Reusing rabbit-tv-stat-card-background.jpg) */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    {
                      label: "Active Streams",
                      value: `${enabledProvidersCount} / ${snapshot.manifest.providers.length}`,
                      sub:
                        downProvidersCount > 0
                          ? `${downProvidersCount} degraded/down`
                          : `Manifest v${snapshot.manifest.version}`,
                      accent: "text-cyan-300",
                      target: "provider_priority" as AdminViewId,
                    },
                    {
                      label: "Activation Keys",
                      value: `${keyStats.active} Active`,
                      sub: `${keyStats.used} claimed • ${keyStats.total} total`,
                      accent: "text-emerald-300",
                      target: "key_directory" as AdminViewId,
                    },
                    {
                      label: "Banner Status",
                      value: brandingDraft.maintenanceMode
                        ? "MAINT ON"
                        : brandingDraft.motdBanner
                          ? "MOTD LIVE"
                          : "ALL CLEAR",
                      sub:
                        brandingDraft.motdBanner || "No banner text active",
                      accent: brandingDraft.maintenanceMode
                        ? "text-red-400"
                        : "text-amber-300",
                      target: "motd_banners" as AdminViewId,
                    },
                    {
                      label: "Global Ad Blocks",
                      value: `${activeAdDomainsCount}`,
                      sub: `${openAdTicketsCount} open inspector tickets`,
                      accent: "text-amber-300",
                      target: "ad_blocklist" as AdminViewId,
                    },
                    {
                      label: "Active Bans / Mutes",
                      value: `${activeEnforcementsCount}`,
                      sub: `${snapshot.enforcement.length} total enforcement records`,
                      accent: "text-red-400",
                      target: "enforcement_log" as AdminViewId,
                    },
                    {
                      label: "Referral Owed",
                      value: referralTotals
                        ? `$${referralTotals.totalOwedNow.toFixed(0)}`
                        : "$0",
                      sub: `${snapshot.notifications.length} queued toasts • ${snapshot.auditLog.length} logs`,
                      accent: "text-emerald-300",
                      target: "referral_ledger" as AdminViewId,
                    },
                  ].map((kpi) => (
                    <button
                      key={kpi.label}
                      type="button"
                      onClick={() => selectAdminView(kpi.target)}
                      className="rabtv-adm-stat rounded-2xl text-left transition hover:scale-[1.02] cursor-pointer shadow-xl"
                    >
                      <div className="rabtv-adm-stat-9slice" aria-hidden="true" />
                      <div className="relative z-10 space-y-1">
                        <span className="block text-[10px] font-extrabold uppercase tracking-wider text-[#8C8175]">
                          {kpi.label}
                        </span>
                        <p className={`text-lg sm:text-2xl font-black ${kpi.accent} truncate`}>
                          {kpi.value}
                        </p>
                        <span className="block text-[10.5px] text-[#E8DCC8]/75 truncate">
                          {kpi.sub}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Large Click-and-Point Quick Launch Grid */}
                <AdminPanelCard>
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">
                    ⚡ Instant Click-and-Point Actions
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {(
                      [
                        { view: "motd_banners", label: "🏷️ Manage Banners", variant: "primary" },
                        { view: "key_generator", label: "🔑 Issue License Key", variant: "active" },
                        { view: "provider_priority", label: "🎬 Stream Priority", variant: "idle" },
                        { view: "ad_tickets", label: `🔍 Ad Tickets (${openAdTicketsCount})`, variant: openAdTicketsCount > 0 ? "danger" : "idle" },
                        { view: "broadcast_push", label: "📢 Push User Toast", variant: "idle" },
                        { view: "panic_switches", label: `🚨 Panic Controls (${activePanicCount})`, variant: activePanicCount > 0 ? "danger" : "idle" },
                      ] as { view: AdminViewId; label: string; variant: AdmBtnVariant }[]
                    ).map((qa) => (
                      <AdminArmoredBtn
                        key={qa.view}
                        variant={qa.variant}
                        onClick={() => selectAdminView(qa.view)}
                        className="w-full py-3.5 text-xs"
                      >
                        {qa.label}
                      </AdminArmoredBtn>
                    ))}
                  </div>
                </AdminPanelCard>
              </div>
            )}

            {/* =============================================================== */}
            {/* 2. EMERGENCY PANIC SWITCHES                                     */}
            {/* =============================================================== */}
            {activeView === "panic_switches" && (
              <div className="space-y-4">
                <AdminSectionBanner
                  title="🚨 Emergency Panic Switches"
                  subtitle="Step-up confirmed global kill-switches synced instantly to all devices"
                />
                <AdminPanelCard>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {[
                      {
                        key: "maintenanceMode" as const,
                        title: "Red Maintenance Banner",
                        desc: "Displays an urgent crimson maintenance bar across every active app.",
                        active: brandingDraft.maintenanceMode,
                      },
                      {
                        key: "panicReadOnlyCommunity" as const,
                        title: "Freeze Movie Club (Read-Only)",
                        desc: "Halts all new profiles, reviews, and Watch Buddy messages immediately.",
                        active: brandingDraft.panicReadOnlyCommunity,
                      },
                      {
                        key: "panicStrictTier1Only" as const,
                        title: "Strict Tier-1 Streams Only",
                        desc: "Restricts player failover strictly to verified Tier-1 sources.",
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
                        className="rounded-2xl border border-white/15 bg-black/75 p-4 flex flex-col justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-black text-white">
                              {ctrl.title}
                            </p>
                            <span
                              className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase ${
                                ctrl.active
                                  ? "bg-[#C4282A] text-white"
                                  : "bg-white/10 text-[#8C8175]"
                              }`}
                            >
                              {ctrl.active ? "ACTIVE" : "OFF"}
                            </span>
                          </div>
                          <p className="text-xs text-[#8C8175] mt-1 leading-relaxed">
                            {ctrl.desc}
                          </p>
                        </div>
                        <AdminArmoredBtn
                          variant={ctrl.active ? "danger" : "idle"}
                          disabled={busy}
                          onClick={() => handlePanicToggle(ctrl.key, ctrl.title)}
                          className="w-full py-2.5 text-xs"
                        >
                          {ctrl.active ? `Turn OFF ${ctrl.title}` : `Activate ${ctrl.title}`}
                        </AdminArmoredBtn>
                      </div>
                    ))}
                  </div>
                </AdminPanelCard>
              </div>
            )}

            {/* =============================================================== */}
            {/* 3. MAINTENANCE & MOTD BANNERS (DIRECT BANNER CONTROL STUDIO)    */}
            {/* =============================================================== */}
            {activeView === "motd_banners" && (
              <div className="space-y-4">
                <AdminSectionBanner
                  title="🏷️ Maintenance & MOTD Banners"
                  subtitle="Writes both branding_config.json & admin_config.json together so status never gets stuck"
                />

                <AdminPanelCard>
                  {/* Live Top-Bar Preview */}
                  <div className="space-y-2">
                    <span className="block text-[10.5px] font-extrabold uppercase tracking-wider text-cyan-300">
                      Live App Top-Bar Preview
                    </span>
                    {brandingDraft.maintenanceMode ? (
                      <div className="rounded-xl bg-[#C4282A] border border-red-300/45 px-4 py-2.5 text-center text-xs font-extrabold text-white shadow-lg">
                        🛠️{" "}
                        {brandingDraft.motdBanner ||
                          "RABBiT TV Maintenance in Progress — Some streams may momentarily refresh."}
                      </div>
                    ) : brandingDraft.motdBanner ? (
                      <div className="rounded-xl bg-[#141210] border border-cyan-500/45 px-4 py-2.5 flex items-center justify-center gap-3 text-xs font-bold text-[#E8DCC8] shadow-lg">
                        <span>📢 {brandingDraft.motdBanner}</span>
                        <span className="text-cyan-300 font-black">✕</span>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-emerald-500/35 bg-emerald-950/35 px-4 py-2.5 text-center text-xs font-bold text-emerald-300">
                        ✅ Clean Header — No Maintenance or Announcement Banner Shown
                      </div>
                    )}
                  </div>

                  {/* Mode Selector Buttons (Large, Easy-to-Hit) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <AdminArmoredBtn
                      variant={
                        !brandingDraft.maintenanceMode && !brandingDraft.motdBanner
                          ? "active"
                          : "idle"
                      }
                      onClick={() =>
                        setBrandingDraft((prev) => ({
                          ...prev,
                          maintenanceMode: false,
                          motdBanner: "",
                        }))
                      }
                      className="w-full py-3 text-xs"
                    >
                      ✅ No Banner (Clear)
                    </AdminArmoredBtn>
                    <AdminArmoredBtn
                      variant={
                        !brandingDraft.maintenanceMode &&
                        Boolean(brandingDraft.motdBanner)
                          ? "active"
                          : "idle"
                      }
                      onClick={() =>
                        setBrandingDraft((prev) => ({
                          ...prev,
                          maintenanceMode: false,
                          motdBanner:
                            prev.motdBanner || MOTD_QUICK_PRESETS[0],
                        }))
                      }
                      className="w-full py-3 text-xs"
                    >
                      📢 Dismissible MOTD
                    </AdminArmoredBtn>
                    <AdminArmoredBtn
                      variant={brandingDraft.maintenanceMode ? "danger" : "idle"}
                      onClick={() =>
                        setBrandingDraft((prev) => ({
                          ...prev,
                          maintenanceMode: true,
                        }))
                      }
                      className="w-full py-3 text-xs"
                    >
                      🛠️ Red Maintenance Bar
                    </AdminArmoredBtn>
                  </div>

                  {/* Message Input + Quick Presets */}
                  <div className="space-y-2">
                    <label className="block text-[10.5px] font-extrabold uppercase tracking-wider text-[#8C8175]">
                      Banner Message Text
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        dir="ltr"
                        maxLength={180}
                        placeholder="Leave blank for no announcement banner..."
                        value={brandingDraft.motdBanner}
                        onChange={(e) =>
                          setBrandingDraft((prev) => ({
                            ...prev,
                            motdBanner: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-white/15 bg-black/80 pl-3.5 pr-10 py-2.5 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                      />
                      {brandingDraft.motdBanner && (
                        <button
                          type="button"
                          onClick={() =>
                            setBrandingDraft((prev) => ({
                              ...prev,
                              motdBanner: "",
                            }))
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-[#8C8175] hover:text-white cursor-pointer"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {MOTD_QUICK_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() =>
                            setBrandingDraft((prev) => ({
                              ...prev,
                              motdBanner: preset,
                            }))
                          }
                          className="rounded-lg border border-white/15 bg-black/70 hover:bg-white/10 px-2.5 py-1 text-[10.5px] font-bold text-[#E8DCC8] cursor-pointer"
                        >
                          + {preset.slice(0, 44)}…
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    <AdminArmoredBtn
                      variant="primary"
                      disabled={busy}
                      onClick={() =>
                        void commitBrandingConfig(
                          brandingDraft,
                          "BANNER_STATUS_PUBLISH",
                          `Published Banner (Maintenance=${brandingDraft.maintenanceMode ? "ON" : "OFF"}, MOTD="${brandingDraft.motdBanner || "NONE"}")`
                        )
                      }
                      className="w-full py-3 text-xs"
                    >
                      ⚡ Publish Banner Status to Fleet
                    </AdminArmoredBtn>
                    <AdminArmoredBtn
                      variant="danger"
                      disabled={busy}
                      onClick={() => {
                        const cleared = {
                          ...brandingDraft,
                          maintenanceMode: false,
                          motdBanner: "",
                        };
                        setBrandingDraft(cleared);
                        void commitBrandingConfig(
                          cleared,
                          "BANNER_FORCE_CLEAR",
                          "Cleared Maintenance Mode & MOTD Banner"
                        );
                      }}
                      className="w-full py-3 text-xs"
                    >
                      🧹 Clear All Banners Immediately
                    </AdminArmoredBtn>
                  </div>
                </AdminPanelCard>
              </div>
            )}

            {/* =============================================================== */}
            {/* 4. APP VERSION & UPDATE GATE                                    */}
            {/* =============================================================== */}
            {activeView === "min_version_gate" && (
              <div className="space-y-4">
                <AdminSectionBanner
                  title="📲 App Version & Update Gate"
                  subtitle="Control minimum supported APK version across all connected clients"
                />
                <AdminPanelCard>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void commitBrandingConfig(
                        brandingDraft,
                        "MIN_VERSION_UPDATE",
                        `Updated minimum app version to ${brandingDraft.minAppVersion}`
                      );
                    }}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#8C8175]">
                          Minimum Required Version
                        </label>
                        <input
                          type="text"
                          dir="ltr"
                          value={brandingDraft.minAppVersion}
                          onChange={(e) =>
                            setBrandingDraft((prev) => ({
                              ...prev,
                              minAppVersion: e.target.value,
                            }))
                          }
                          placeholder="1.2.0"
                          className="w-full rounded-xl border border-white/15 bg-black/80 px-3.5 py-2.5 text-sm font-mono font-black text-white"
                        />
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/65 p-3.5 flex flex-col justify-center">
                        <span className="text-[10px] font-extrabold uppercase text-[#8C8175]">
                          Last Policy Push
                        </span>
                        <strong className="text-sm text-cyan-300 mt-0.5">
                          {formatDateTime(snapshot.branding.updatedAt)}
                        </strong>
                      </div>
                    </div>
                    <AdminArmoredBtn
                      type="submit"
                      variant="primary"
                      disabled={busy}
                      className="w-full sm:w-auto py-3 px-6 text-xs"
                    >
                      ⚡ Save Version Gate
                    </AdminArmoredBtn>
                  </form>
                </AdminPanelCard>
              </div>
            )}

            {/* =============================================================== */}
            {/* 5. PROVIDER PRIORITY QUEUE                                      */}
            {/* =============================================================== */}
            {activeView === "provider_priority" && (
              <div className="space-y-4">
                <AdminSectionBanner
                  title={`↕️ Provider Priority Queue (${enabledProvidersCount}/${snapshot.manifest.providers.length} Active)`}
                  subtitle="Click arrows to reorder failover, flip Tier 1/2, or kill-switch broken servers"
                  rightSlot={
                    <AdminArmoredBtn
                      variant="primary"
                      onClick={() => selectAdminView("add_provider")}
                      className="py-2 text-xs"
                    >
                      ➕ Add Source
                    </AdminArmoredBtn>
                  }
                />

                <AdminPanelCard>
                  {/* Data-List Filter Dropdown */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <select
                      value={providerFilter}
                      onChange={(e) =>
                        setProviderFilter(e.target.value as ProviderFilterMode)
                      }
                      className="rounded-xl border border-white/15 bg-black/85 px-3.5 py-2 text-xs font-extrabold text-white"
                    >
                      <option value="all">
                        All Providers ({snapshot.manifest.providers.length})
                      </option>
                      <option value="enabled">
                        Enabled Only ({enabledProvidersCount})
                      </option>
                      <option value="disabled">
                        Disabled Only (
                        {snapshot.manifest.providers.length -
                          enabledProvidersCount}
                        )
                      </option>
                      <option value="tier1">Tier 1 Priority Clean</option>
                      <option value="tier2">Tier 2 Standby Fallback</option>
                      <option value="issues">
                        Degraded / Down ({downProvidersCount})
                      </option>
                    </select>
                    <AdminArmoredBtn
                      variant="idle"
                      disabled={probingAll}
                      onClick={() => void handleProbeAllProviders()}
                      className="py-2 text-xs"
                    >
                      {probingAll ? "⏳ Scanning..." : "📡 Ping All"}
                    </AdminArmoredBtn>
                  </div>

                  <div className="space-y-2">
                    {filteredProviders.map((prov) => {
                      const realIdx = snapshot.manifest.providers.findIndex(
                        (x) => x.id === prov.id
                      );
                      return (
                        <div
                          key={prov.id}
                          className={`rounded-2xl border p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            prov.enabled
                              ? "border-white/12 bg-black/75"
                              : "border-red-500/35 bg-red-950/25 opacity-75"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="h-8 w-8 rounded-xl bg-white/5 border border-white/15 flex items-center justify-center text-xs font-black text-cyan-300 shrink-0">
                              #{realIdx + 1}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm font-black text-white">
                                  {prov.name}
                                </span>
                                <span
                                  className={`rounded-md border px-1.5 py-0.5 text-[9.5px] font-black uppercase ${
                                    prov.tier === 1
                                      ? "border-emerald-400/45 bg-emerald-950/75 text-emerald-300"
                                      : "border-white/15 bg-white/5 text-[#8C8175]"
                                  }`}
                                >
                                  Tier {prov.tier}
                                </span>
                                {prov.healthStatus &&
                                  prov.healthStatus !== "unknown" && (
                                    <span
                                      className={`rounded-md px-1.5 py-0.5 text-[9.5px] font-black uppercase ${
                                        prov.healthStatus === "healthy"
                                          ? "bg-emerald-500/20 text-emerald-300"
                                          : prov.healthStatus === "degraded"
                                            ? "bg-amber-500/20 text-amber-300"
                                            : "bg-red-500/25 text-red-300"
                                      }`}
                                    >
                                      {prov.healthStatus}
                                      {prov.lastLatencyMs
                                        ? ` ${prov.lastLatencyMs}ms`
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
                              disabled={busy || realIdx <= 0}
                              onClick={() => void handleMoveProvider(prov.id, -1)}
                              className="rounded-xl border border-white/15 bg-white/10 hover:bg-white/20 px-2.5 py-1.5 text-xs font-black disabled:opacity-30 cursor-pointer"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              disabled={
                                busy ||
                                realIdx >= snapshot.manifest.providers.length - 1
                              }
                              onClick={() => void handleMoveProvider(prov.id, 1)}
                              className="rounded-xl border border-white/15 bg-white/10 hover:bg-white/20 px-2.5 py-1.5 text-xs font-black disabled:opacity-30 cursor-pointer"
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleToggleProviderTier(prov)}
                              className="rounded-xl border border-white/15 bg-white/10 hover:bg-white/20 px-3 py-1.5 text-[11px] font-extrabold text-[#E8DCC8] cursor-pointer"
                            >
                              Set T{prov.tier === 1 ? "2" : "1"}
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleToggleProvider(prov)}
                              className={`rounded-xl px-3.5 py-1.5 text-[11px] font-black cursor-pointer ${
                                prov.enabled
                                  ? "bg-emerald-600/30 border border-emerald-400/50 text-emerald-200 hover:bg-red-700 hover:text-white"
                                  : "bg-[#C4282A] text-white hover:bg-emerald-600"
                              }`}
                            >
                              {prov.enabled ? "Active" : "Disabled"}
                            </button>
                            {!prov.isBuiltIn && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleDeleteCustomProvider(prov)}
                                className="rounded-xl border border-red-500/45 bg-red-950/75 hover:bg-red-700 px-2.5 py-1.5 text-xs font-bold text-red-200 cursor-pointer"
                              >
                                🗑️
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </AdminPanelCard>
              </div>
            )}

            {/* =============================================================== */}
            {/* 6. LIVE STREAM HEALTH SCANNER                                   */}
            {/* =============================================================== */}
            {activeView === "provider_health" && (
              <div className="space-y-4">
                <AdminSectionBanner
                  title="📡 Live Stream Health Scanner"
                  subtitle="Probe response latency across all stream origins & disable dead servers"
                  rightSlot={
                    <AdminArmoredBtn
                      variant="primary"
                      disabled={probingAll}
                      onClick={() => void handleProbeAllProviders()}
                      className="py-2 text-xs"
                    >
                      {probingAll ? "⏳ Probing..." : "📡 Scan All Now"}
                    </AdminArmoredBtn>
                  }
                />
                <AdminPanelCard>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {snapshot.manifest.providers.map((prov) => (
                      <div
                        key={prov.id}
                        className="rounded-2xl border border-white/12 bg-black/75 p-3.5 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-black text-white truncate">
                            {prov.name}
                          </p>
                          <p className="text-[10px] font-mono text-[#8C8175] truncate">
                            {prov.origin}
                          </p>
                          <p className="text-[10.5px] font-bold mt-1">
                            Status:{" "}
                            <span
                              className={
                                prov.healthStatus === "healthy"
                                  ? "text-emerald-300"
                                  : prov.healthStatus === "degraded"
                                    ? "text-amber-300"
                                    : prov.healthStatus === "down"
                                      ? "text-red-400"
                                      : "text-[#8C8175]"
                              }
                            >
                              {(prov.healthStatus || "unknown").toUpperCase()}
                            </span>
                            {prov.lastLatencyMs ? ` • ${prov.lastLatencyMs}ms` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <AdminArmoredBtn
                            variant="idle"
                            disabled={probingId === prov.id}
                            onClick={() => void handleProbeSingle(prov)}
                            className="py-1.5 px-3 text-[11px]"
                          >
                            {probingId === prov.id ? "..." : "Ping"}
                          </AdminArmoredBtn>
                          {prov.healthStatus === "down" && prov.enabled && (
                            <AdminArmoredBtn
                              variant="danger"
                              disabled={busy}
                              onClick={() => void handleToggleProvider(prov)}
                              className="py-1.5 px-3 text-[11px]"
                            >
                              Disable
                            </AdminArmoredBtn>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </AdminPanelCard>
              </div>
            )}

            {/* =============================================================== */}
            {/* 7. ADD CUSTOM STREAM SOURCE                                     */}
            {/* =============================================================== */}
            {activeView === "add_provider" && (
              <div className="space-y-4">
                <AdminSectionBanner
                  title="➕ Add Custom Stream Source"
                  subtitle="Publish a new embed provider straight to sources_manifest.json without rebuilding the APK"
                />
                <AdminPanelCard>
                  <form onSubmit={handleAddCustomProvider} className="space-y-3.5">
                    <p className="text-xs text-[#E8DCC8]">
                      Supported tokens:{" "}
                      <code className="text-cyan-300 font-bold">{"{id}"}</code>{" "}
                      <code className="text-cyan-300 font-bold">{"{season}"}</code>{" "}
                      <code className="text-cyan-300 font-bold">{"{episode}"}</code>{" "}
                      <code className="text-cyan-300 font-bold">{"{accent}"}</code>
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input
                        type="text"
                        dir="ltr"
                        placeholder="Provider Name (e.g. StreamHub)"
                        value={newProvName}
                        onChange={(e) => setNewProvName(e.target.value)}
                        className="rounded-xl border border-white/15 bg-black/80 px-3.5 py-2.5 text-xs font-bold text-white"
                      />
                      <input
                        type="url"
                        dir="ltr"
                        placeholder="Origin (https://example.com)"
                        value={newProvOrigin}
                        onChange={(e) => setNewProvOrigin(e.target.value)}
                        className="rounded-xl border border-white/15 bg-black/80 px-3.5 py-2.5 text-xs font-bold text-white"
                      />
                      <select
                        value={newProvTier}
                        onChange={(e) =>
                          setNewProvTier(Number(e.target.value) === 1 ? 1 : 2)
                        }
                        className="rounded-xl border border-white/15 bg-black/80 px-3.5 py-2.5 text-xs font-bold text-white"
                      >
                        <option value={1}>Tier 1 (Priority Clean)</option>
                        <option value={2}>Tier 2 (Standby Fallback)</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="url"
                        dir="ltr"
                        placeholder="Movie Template: https://example.com/movie/{id}"
                        value={newProvMovieTpl}
                        onChange={(e) => setNewProvMovieTpl(e.target.value)}
                        className="rounded-xl border border-white/15 bg-black/80 px-3.5 py-2.5 text-xs font-mono text-white"
                      />
                      <input
                        type="url"
                        dir="ltr"
                        placeholder="TV Template: https://example.com/tv/{id}/{season}/{episode}"
                        value={newProvTvTpl}
                        onChange={(e) => setNewProvTvTpl(e.target.value)}
                        className="rounded-xl border border-white/15 bg-black/80 px-3.5 py-2.5 text-xs font-mono text-white"
                      />
                    </div>
                    <AdminArmoredBtn
                      type="submit"
                      variant="primary"
                      disabled={busy}
                      className="w-full sm:w-auto py-3 px-6 text-xs"
                    >
                      ⚡ Add Provider & Publish Live
                    </AdminArmoredBtn>
                  </form>
                </AdminPanelCard>
              </div>
            )}

            {/* =============================================================== */}
            {/* 8. TITLE STREAM OVERRIDES                                       */}
            {/* =============================================================== */}
            {activeView === "title_overrides" && (
              <div className="space-y-4">
                <AdminSectionBanner
                  title={`🎯 Title Stream Overrides (${streamOverridesOnly.length})`}
                  subtitle="Pin a direct HTTPS embed URL for a specific movie or show with optional schedule windows"
                />
                <AdminPanelCard>
                  <form onSubmit={handleSaveStreamOverride} className="space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <select
                        value={ovMediaType}
                        onChange={(e) =>
                          setOvMediaType(e.target.value === "tv" ? "tv" : "movie")
                        }
                        className="rounded-xl border border-white/15 bg-black/80 px-3 py-2.5 text-xs font-bold text-white"
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
                        className="rounded-xl border border-white/15 bg-black/80 px-3 py-2.5 text-xs font-bold text-white"
                      />
                      <input
                        type="text"
                        dir="ltr"
                        placeholder="Title Name"
                        value={ovTitle}
                        onChange={(e) => setOvTitle(e.target.value)}
                        className="col-span-2 rounded-xl border border-white/15 bg-black/80 px-3 py-2.5 text-xs font-bold text-white"
                      />
                    </div>
                    <input
                      type="url"
                      dir="ltr"
                      placeholder="Direct HTTPS Embed / Stream URL"
                      value={ovDirectUrl}
                      onChange={(e) => setOvDirectUrl(e.target.value)}
                      className="w-full rounded-xl border border-white/15 bg-black/80 px-3.5 py-2.5 text-xs font-mono text-white"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <input
                        type="datetime-local"
                        value={ovPublishAt}
                        onChange={(e) => setOvPublishAt(e.target.value)}
                        className="rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-xs font-bold text-white"
                      />
                      <input
                        type="datetime-local"
                        value={ovExpireAt}
                        onChange={(e) => setOvExpireAt(e.target.value)}
                        className="rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-xs font-bold text-white"
                      />
                      <input
                        type="text"
                        dir="ltr"
                        placeholder="Admin Note"
                        value={ovReason}
                        onChange={(e) => setOvReason(e.target.value)}
                        className="rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-xs font-bold text-white"
                      />
                    </div>
                    <AdminArmoredBtn
                      type="submit"
                      variant="primary"
                      disabled={busy}
                      className="w-full sm:w-auto py-3 px-6 text-xs"
                    >
                      🎯 Save Direct Stream Override
                    </AdminArmoredBtn>
                  </form>

                  {streamOverridesOnly.length > 0 && (
                    <div className="space-y-2 pt-3 border-t border-white/10">
                      {streamOverridesOnly.map((ov) => (
                        <div
                          key={ov.id}
                          className="rounded-2xl border border-white/12 bg-black/75 p-3.5 flex flex-wrap items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-black text-white">
                              {ov.title}{" "}
                              <span className="font-mono text-cyan-300">
                                ({ov.id})
                              </span>
                            </p>
                            <p className="text-[10.5px] font-mono text-[#8C8175] truncate">
                              ▶ {ov.directUrl}
                            </p>
                          </div>
                          <AdminArmoredBtn
                            variant="danger"
                            disabled={busy}
                            onClick={() => void handleRemoveTitleOverride(ov)}
                            className="py-1.5 px-3 text-[11px]"
                          >
                            Remove
                          </AdminArmoredBtn>
                        </div>
                      ))}
                    </div>
                  )}
                </AdminPanelCard>
              </div>
            )}

            {/* =============================================================== */}
            {/* 9. GLOBAL TITLE QUARANTINE                                      */}
            {/* =============================================================== */}
            {activeView === "title_quarantine" && (
              <div className="space-y-4">
                <AdminSectionBanner
                  title={`🧹 Title Quarantine (${quarantinedTitlesOnly.length} Global • ${brokenLinksCount} Local)`}
                  subtitle="Hide broken titles globally across all apps or clear your local broken-link list"
                />
                <AdminPanelCard>
                  <form
                    onSubmit={handleSaveGlobalQuarantine}
                    className="space-y-3"
                  >
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <select
                        value={qMediaType}
                        onChange={(e) =>
                          setQMediaType(e.target.value === "tv" ? "tv" : "movie")
                        }
                        className="rounded-xl border border-white/15 bg-black/80 px-3 py-2.5 text-xs font-bold text-white"
                      >
                        <option value="movie">Movie</option>
                        <option value="tv">TV Show</option>
                      </select>
                      <input
                        type="text"
                        dir="ltr"
                        placeholder="TMDB ID"
                        value={qMediaId}
                        onChange={(e) => setQMediaId(e.target.value)}
                        className="rounded-xl border border-white/15 bg-black/80 px-3 py-2.5 text-xs font-bold text-white"
                      />
                      <input
                        type="text"
                        dir="ltr"
                        placeholder="Title to Quarantine"
                        value={qTitle}
                        onChange={(e) => setQTitle(e.target.value)}
                        className="col-span-2 rounded-xl border border-white/15 bg-black/80 px-3 py-2.5 text-xs font-bold text-white"
                      />
                    </div>
                    <input
                      type="text"
                      dir="ltr"
                      placeholder="Reason (e.g. No working HD stream yet)"
                      value={qReason}
                      onChange={(e) => setQReason(e.target.value)}
                      className="w-full rounded-xl border border-white/15 bg-black/80 px-3.5 py-2.5 text-xs font-bold text-white"
                    />
                    <div className="flex flex-wrap gap-2.5">
                      <AdminArmoredBtn
                        type="submit"
                        variant="danger"
                        disabled={busy}
                        className="py-2.5 px-5 text-xs"
                      >
                        🚫 Quarantine Globally
                      </AdminArmoredBtn>
                      <AdminArmoredBtn
                        variant="idle"
                        disabled={brokenLinksCount === 0}
                        onClick={() => {
                          clearAllBrokenLinks();
                          setBrokenLinksCount(0);
                          window.dispatchEvent(
                            new Event("rabtv_catalog_updated")
                          );
                          showToast(true, "✓ Cleared local broken-link quarantine.");
                        }}
                        className="py-2.5 px-5 text-xs"
                      >
                        ↺ Clear Local Broken ({brokenLinksCount})
                      </AdminArmoredBtn>
                    </div>
                  </form>

                  {quarantinedTitlesOnly.length > 0 && (
                    <div className="space-y-2 pt-3 border-t border-white/10">
                      {quarantinedTitlesOnly.map((ov) => (
                        <div
                          key={ov.id}
                          className="rounded-2xl border border-red-500/35 bg-red-950/20 p-3.5 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-black text-white">
                              🚫 {ov.title}{" "}
                              <span className="font-mono text-red-300">
                                ({ov.id})
                              </span>
                            </p>
                            <p className="text-[10.5px] text-[#8C8175]">
                              {ov.reason || "Globally quarantined"}
                            </p>
                          </div>
                          <AdminArmoredBtn
                            variant="active"
                            disabled={busy}
                            onClick={() => void handleRemoveTitleOverride(ov)}
                            className="py-1.5 px-3 text-[11px]"
                          >
                            Restore
                          </AdminArmoredBtn>
                        </div>
                      ))}
                    </div>
                  )}
                </AdminPanelCard>
              </div>
            )}

            {/* =============================================================== */}
            {/* 10. MANIFEST REVISIONS & ROLLBACK                               */}
            {/* =============================================================== */}
            {activeView === "manifest_rollback" && (
              <div className="space-y-4">
                <AdminSectionBanner
                  title={`⏪ Manifest Revisions & Rollback (Current v${snapshot.manifest.version})`}
                  subtitle="One-click restore to any of the last 10 stream manifest snapshots"
                />
                <AdminPanelCard>
                  {snapshot.manifest.revisions.length === 0 ? (
                    <div className="rabtv-adm-empty rounded-2xl text-center">
                      <div
                        className="rabtv-adm-empty-bg"
                        style={{ backgroundImage: `url(${IMG_EMPTY_STATE})` }}
                      />
                      <div className="rabtv-adm-empty-scrim" />
                      <p className="relative z-10 text-xs font-bold text-[#E8DCC8]">
                        No previous revisions recorded yet. Every stream reorder
                        or override saves an automatic rollback checkpoint here.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {snapshot.manifest.revisions.map((rev) => (
                        <div
                          key={`${rev.version}-${rev.savedAt}`}
                          className="rounded-2xl border border-white/12 bg-black/75 px-4 py-3 flex flex-wrap items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-black text-white">
                              <span className="text-cyan-300">v{rev.version}</span>{" "}
                              — {rev.summary}
                            </p>
                            <p className="text-[10.5px] text-[#8C8175]">
                              {rev.actor} • {formatDateTime(rev.savedAt)} •{" "}
                              {rev.providers.length} providers •{" "}
                              {rev.overrides.length} rules
                            </p>
                          </div>
                          <AdminArmoredBtn
                            variant="danger"
                            disabled={busy}
                            onClick={() => handleRollbackRevision(rev.version)}
                            className="py-2 px-4 text-xs"
                          >
                            ↺ Rollback
                          </AdminArmoredBtn>
                        </div>
                      ))}
                    </div>
                  )}
                </AdminPanelCard>
              </div>
            )}

            {/* =============================================================== */}
            {/* 11. GENERATE ACTIVATION KEYS                                    */}
            {/* =============================================================== */}
            {activeView === "key_generator" && (
              <div className="space-y-4">
                <AdminSectionBanner
                  title="⚡ Generate Activation Keys"
                  subtitle="Create a one-time activation key & commit directly to keys.json on Gist"
                />
                <AdminPanelCard>
                  <form onSubmit={handleKeygen} className="space-y-3.5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input
                        type="text"
                        dir="ltr"
                        placeholder="Recipient Name (e.g. Sandor)"
                        value={keygenName}
                        onChange={(e) => setKeygenName(e.target.value)}
                        className="sm:col-span-2 rounded-xl border border-white/15 bg-black/80 px-3.5 py-3 text-xs font-bold text-white"
                      />
                      <input
                        type="number"
                        min={1}
                        max={120}
                        placeholder="Age"
                        value={keygenAge}
                        onChange={(e) => setKeygenAge(e.target.value)}
                        className="rounded-xl border border-white/15 bg-black/80 px-3.5 py-3 text-center text-xs font-bold text-white"
                      />
                    </div>
                    <AdminArmoredBtn
                      type="submit"
                      variant="primary"
                      disabled={busy}
                      className="w-full py-3.5 text-xs uppercase tracking-wider"
                    >
                      ⚡ Generate & Push License Key
                    </AdminArmoredBtn>
                  </form>

                  {lastGeneratedKey && (
                    <div className="rounded-2xl border border-emerald-400/50 bg-emerald-950/45 p-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <span className="block text-[10px] font-extrabold uppercase text-emerald-300">
                          Ready to Share Key
                        </span>
                        <span className="font-mono text-lg font-black text-white">
                          {lastGeneratedKey}
                        </span>
                      </div>
                      <AdminArmoredBtn
                        variant="active"
                        onClick={() => void handleCopyText(lastGeneratedKey)}
                        className="py-2.5 px-5 text-xs"
                      >
                        {copiedKeyId === lastGeneratedKey
                          ? "✓ Copied!"
                          : "📋 Copy Key"}
                      </AdminArmoredBtn>
                    </div>
                  )}
                </AdminPanelCard>
              </div>
            )}

            {/* =============================================================== */}
            {/* 12. ACTIVE & CLAIMED KEYS DIRECTORY                             */}
            {/* =============================================================== */}
            {activeView === "key_directory" && (
              <div className="space-y-4">
                <AdminSectionBanner
                  title={`🗂️ Active & Claimed Keys (${keyStats.total})`}
                  subtitle={`${keyStats.active} Active • ${keyStats.used} Claimed`}
                  rightSlot={
                    <AdminArmoredBtn
                      variant="idle"
                      onClick={() =>
                        exportJsonFile(
                          `rabtv_keys_${new Date().toISOString().slice(0, 10)}.json`,
                          snapshot.keys
                        )
                      }
                      className="py-2 text-xs"
                    >
                      💾 Export JSON
                    </AdminArmoredBtn>
                  }
                />
                <AdminPanelCard>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <input
                      type="search"
                      dir="ltr"
                      placeholder="Search by key or owner..."
                      value={keySearchQuery}
                      onChange={(e) => setKeySearchQuery(e.target.value)}
                      className="sm:col-span-2 rounded-xl border border-white/15 bg-black/80 px-3.5 py-2.5 text-xs font-bold text-white"
                    />
                    <select
                      value={keyFilterMode}
                      onChange={(e) =>
                        setKeyFilterMode(e.target.value as KeyFilterMode)
                      }
                      className="rounded-xl border border-white/15 bg-black/85 px-3 py-2.5 text-xs font-extrabold text-white"
                    >
                      <option value="all">All Keys ({keyStats.total})</option>
                      <option value="active">
                        Active Only ({keyStats.active})
                      </option>
                      <option value="used">
                        Claimed Only ({keyStats.used})
                      </option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[520px] overflow-y-auto pr-1 scrollbar-none">
                    {filteredKeys.map((kObj) => (
                      <div
                        key={kObj.key}
                        className="rounded-2xl border border-white/12 bg-black/75 p-3.5 space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-sm font-black text-amber-300 truncate">
                            {kObj.key}
                          </span>
                          <span
                            className={`rounded-md px-2 py-0.5 text-[9.5px] font-black uppercase ${
                              kObj.active
                                ? "bg-emerald-500/20 text-emerald-300"
                                : "bg-red-500/20 text-red-300"
                            }`}
                          >
                            {kObj.active ? "Active" : "Claimed"}
                          </span>
                        </div>
                        <p className="text-xs text-[#E8DCC8] truncate">
                          👤 {kObj.owner || kObj.usedBy || "Unassigned"}
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          <AdminArmoredBtn
                            variant="idle"
                            onClick={() => void handleCopyText(kObj.key)}
                            className="py-1.5 text-[11px]"
                          >
                            {copiedKeyId === kObj.key ? "✓ Copied" : "Copy"}
                          </AdminArmoredBtn>
                          <AdminArmoredBtn
                            variant={kObj.active ? "idle" : "active"}
                            disabled={busy}
                            onClick={() => void handleToggleKey(kObj.key)}
                            className="py-1.5 text-[11px]"
                          >
                            {kObj.active ? "Revoke" : "Activate"}
                          </AdminArmoredBtn>
                          <AdminArmoredBtn
                            variant="danger"
                            disabled={busy}
                            onClick={() => handleDeleteKey(kObj.key, kObj.owner)}
                            className="py-1.5 text-[11px]"
                          >
                            Delete
                          </AdminArmoredBtn>
                        </div>
                      </div>
                    ))}
                  </div>
                </AdminPanelCard>
              </div>
            )}

            {/* =============================================================== */}
            {/* 13. APPLY BAN / SUSPEND / MUTE                                  */}
            {/* =============================================================== */}
            {activeView === "user_enforcement" && (
              <div className="space-y-4">
                <AdminSectionBanner
                  title="🔨 Apply Ban, Suspension, Shadow-Ban or Mute"
                  subtitle="Enforce policies across handles, owners, or license keys (never locks admin devices)"
                />
                <AdminPanelCard>
                  <form onSubmit={handleApplyEnforcement} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <input
                        type="text"
                        dir="ltr"
                        placeholder="Target Handle, Owner Name, or License Key"
                        value={enfTarget}
                        onChange={(e) => setEnfTarget(e.target.value)}
                        className="rounded-xl border border-white/15 bg-black/80 px-3.5 py-2.5 text-xs font-bold text-white"
                      />
                      <select
                        value={uniqueOwners.includes(enfTarget) ? enfTarget : ""}
                        onChange={(e) =>
                          e.target.value && setEnfTarget(e.target.value)
                        }
                        className="rounded-xl border border-white/15 bg-black/85 px-3.5 py-2.5 text-xs font-bold text-white"
                      >
                        <option value="">
                          Or pick from active key owners ({uniqueOwners.length})…
                        </option>
                        {uniqueOwners.map((u) => (
                          <option key={u} value={u}>
                            👤 {u}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <select
                        value={enfType}
                        onChange={(e) =>
                          setEnfType(e.target.value as EnforcementType)
                        }
                        className="rounded-xl border border-white/15 bg-black/85 px-3 py-2.5 text-xs font-bold text-white"
                      >
                        <option value="ban">🚫 Permanent Ban</option>
                        <option value="suspend">⏸️ Suspend Account</option>
                        <option value="shadow_ban">👻 Shadow-Ban</option>
                        <option value="mute">🔇 Community Mute</option>
                      </select>
                      <select
                        value={enfReasonCode}
                        onChange={(e) =>
                          setEnfReasonCode(
                            e.target.value as EnforcementReasonCode
                          )
                        }
                        className="rounded-xl border border-white/15 bg-black/85 px-3 py-2.5 text-xs font-bold text-white"
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
                        className="rounded-xl border border-white/15 bg-black/85 px-3 py-2.5 text-xs font-bold text-white"
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
                      className="w-full rounded-xl border border-white/15 bg-black/80 px-3.5 py-2.5 text-xs font-bold text-white"
                    />

                    <AdminArmoredBtn
                      type="submit"
                      variant="danger"
                      disabled={busy}
                      className="w-full py-3.5 text-xs uppercase tracking-wider"
                    >
                      🔨 Apply Enforcement Action
                    </AdminArmoredBtn>
                  </form>
                </AdminPanelCard>
              </div>
            )}

            {/* =============================================================== */}
            {/* 14. ACTIVE ENFORCEMENT LIST                                     */}
            {/* =============================================================== */}
            {activeView === "enforcement_log" && (
              <div className="space-y-4">
                <AdminSectionBanner
                  title={`⚖️ Enforcement Records (${activeEnforcementsCount} Active)`}
                  subtitle="Review active bans/mutes or lift restrictions in one click"
                  rightSlot={
                    <select
                      value={enfListFilter}
                      onChange={(e) =>
                        setEnfListFilter(
                          e.target.value === "all" ? "all" : "active"
                        )
                      }
                      className="rounded-xl border border-white/20 bg-black/85 px-3 py-1.5 text-xs font-extrabold text-white"
                    >
                      <option value="active">Active Only</option>
                      <option value="all">All History</option>
                    </select>
                  }
                />
                <AdminPanelCard>
                  {filteredEnforcements.length === 0 ? (
                    <div className="rabtv-adm-empty rounded-2xl text-center">
                      <div
                        className="rabtv-adm-empty-bg"
                        style={{ backgroundImage: `url(${IMG_EMPTY_STATE})` }}
                      />
                      <div className="rabtv-adm-empty-scrim" />
                      <p className="relative z-10 text-xs font-bold text-[#E8DCC8]">
                        No enforcement records in this view.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {filteredEnforcements.map((rec) => (
                        <div
                          key={rec.id}
                          className={`rounded-2xl border p-3.5 flex flex-wrap items-center justify-between gap-3 ${
                            rec.active
                              ? "border-red-500/45 bg-red-950/25"
                              : "border-white/10 bg-black/50 opacity-65"
                          }`}
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-black text-white">
                                {rec.target}
                              </span>
                              <span className="rounded-md bg-[#C4282A]/35 border border-red-400/45 px-2 py-0.5 text-[9.5px] font-black uppercase text-red-200">
                                {rec.active ? rec.type : "Lifted"}
                              </span>
                            </div>
                            <p className="text-xs text-[#E8DCC8]">
                              {REASON_CODE_LABELS[rec.reasonCode]} — {rec.note}
                            </p>
                            <p className="text-[10.5px] text-[#8C8175]">
                              By {rec.actor} •{" "}
                              {rec.expiresAt
                                ? `Expires ${formatDateTime(rec.expiresAt)}`
                                : "Permanent"}
                            </p>
                          </div>
                          {rec.active && (
                            <AdminArmoredBtn
                              variant="active"
                              disabled={busy}
                              onClick={() => void handleLiftEnforcement(rec)}
                              className="py-2 px-4 text-xs"
                            >
                              ↺ Lift
                            </AdminArmoredBtn>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </AdminPanelCard>
              </div>
            )}

            {/* =============================================================== */}
            {/* 15. REFERRAL PAYOUTS LEDGER                                     */}
            {/* =============================================================== */}
            {activeView === "referral_ledger" && (
              <div className="space-y-4">
                <AdminSectionBanner
                  title="💰 Referral Payouts Ledger"
                  subtitle="Track pending invites, confirmed referrals & cash payouts"
                />
                <AdminPanelCard>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rabtv-adm-stat rounded-2xl">
                      <div className="rabtv-adm-stat-9slice" />
                      <div className="relative z-10">
                        <span className="text-[10px] font-extrabold uppercase text-[#8C8175]">
                          Total Owed Now
                        </span>
                        <p className="text-2xl font-black text-emerald-300">
                          ${(referralTotals?.totalOwedNow ?? 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <div className="rabtv-adm-stat rounded-2xl">
                      <div className="rabtv-adm-stat-9slice" />
                      <div className="relative z-10">
                        <span className="text-[10px] font-extrabold uppercase text-[#8C8175]">
                          Pending Approvals
                        </span>
                        <p className="text-2xl font-black text-amber-300">
                          {referralTotals?.pendingApprovals ?? 0}
                        </p>
                      </div>
                    </div>
                    <div className="rabtv-adm-stat rounded-2xl">
                      <div className="rabtv-adm-stat-9slice" />
                      <div className="relative z-10">
                        <span className="text-[10px] font-extrabold uppercase text-[#8C8175]">
                          Confirmed Paid Invites
                        </span>
                        <p className="text-2xl font-black text-cyan-300">
                          {referralTotals?.totalConfirmedPaid ?? 0}
                        </p>
                      </div>
                    </div>
                  </div>

                  <AdminArmoredBtn
                    variant="primary"
                    onClick={() => setIsReferralModalOpen(true)}
                    className="w-full py-3.5 text-sm"
                  >
                    💰 Open Full Referral Payouts Ledger ↗
                  </AdminArmoredBtn>
                </AdminPanelCard>
              </div>
            )}

            {/* =============================================================== */}
            {/* 16. GLOBAL AD DOMAIN BLOCKLIST                                  */}
            {/* =============================================================== */}
            {activeView === "ad_blocklist" && (
              <div className="space-y-4">
                <AdminSectionBanner
                  title={`🚫 Global Ad Domain Blocklist (${activeAdDomainsCount} Active)`}
                  subtitle="Merges live on top of MainActivity.java baseline + bundled HaGeZi popup list"
                />
                <AdminPanelCard>
                  <form
                    onSubmit={handleAddAdBlockDomain}
                    className="grid grid-cols-1 sm:grid-cols-3 gap-2.5"
                  >
                    <input
                      type="text"
                      dir="ltr"
                      placeholder="Domain (e.g. bad-popunder.com)"
                      value={newAdDomain}
                      onChange={(e) => setNewAdDomain(e.target.value)}
                      className="rounded-xl border border-white/15 bg-black/80 px-3.5 py-2.5 text-xs font-mono text-white"
                    />
                    <input
                      type="text"
                      dir="ltr"
                      placeholder="Reason / Provider"
                      value={newAdReason}
                      onChange={(e) => setNewAdReason(e.target.value)}
                      className="rounded-xl border border-white/15 bg-black/80 px-3.5 py-2.5 text-xs font-bold text-white"
                    />
                    <AdminArmoredBtn
                      type="submit"
                      variant="primary"
                      disabled={busy}
                      className="py-2.5 text-xs"
                    >
                      🛡️ Block Globally
                    </AdminArmoredBtn>
                  </form>

                  <input
                    type="search"
                    dir="ltr"
                    placeholder="Filter blocked domains..."
                    value={adSearch}
                    onChange={(e) => setAdSearch(e.target.value)}
                    className="w-full rounded-xl border border-white/15 bg-black/80 px-3.5 py-2 text-xs font-bold text-white"
                  />

                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1 scrollbar-none">
                    {filteredAdRules.length === 0 ? (
                      <div className="rabtv-adm-empty rounded-2xl text-center">
                        <div
                          className="rabtv-adm-empty-bg"
                          style={{ backgroundImage: `url(${IMG_EMPTY_STATE})` }}
                        />
                        <div className="rabtv-adm-empty-scrim" />
                        <p className="relative z-10 text-xs text-[#E8DCC8]">
                          No custom ad-block domains yet. Add one above or
                          capture straight from the Player Ad Inspector!
                        </p>
                      </div>
                    ) : (
                      filteredAdRules.map((rule) => (
                        <div
                          key={rule.id}
                          className="rounded-2xl border border-white/12 bg-black/75 px-3.5 py-3 flex flex-wrap items-center justify-between gap-2"
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
                          <div className="flex items-center gap-2 shrink-0">
                            <AdminArmoredBtn
                              variant={rule.active ? "active" : "idle"}
                              disabled={busy}
                              onClick={() => void handleToggleAdRule(rule)}
                              className="py-1.5 px-3 text-[11px]"
                            >
                              {rule.active ? "Blocking" : "Paused"}
                            </AdminArmoredBtn>
                            <AdminArmoredBtn
                              variant="danger"
                              disabled={busy}
                              onClick={() => void handleDeleteAdRule(rule)}
                              className="py-1.5 px-3 text-[11px]"
                            >
                              ✕
                            </AdminArmoredBtn>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </AdminPanelCard>
              </div>
            )}

            {/* =============================================================== */}
            {/* 17. PLAYER INSPECTOR AD TICKETS                                 */}
            {/* =============================================================== */}
            {activeView === "ad_tickets" && (
              <div className="space-y-4">
                <AdminSectionBanner
                  title={`🔍 Player Inspector Tickets (${openAdTicketsCount} Open)`}
                  subtitle="Forensic ad reports sent from /player → Inspect Ads"
                  rightSlot={
                    <select
                      value={ticketFilter}
                      onChange={(e) =>
                        setTicketFilter(
                          e.target.value === "all" ? "all" : "open"
                        )
                      }
                      className="rounded-xl border border-white/20 bg-black/85 px-3 py-1.5 text-xs font-extrabold text-white"
                    >
                      <option value="open">Open Only ({openAdTicketsCount})</option>
                      <option value="all">
                        All Tickets ({snapshot.adTickets.length})
                      </option>
                    </select>
                  }
                />
                <AdminPanelCard>
                  {filteredAdTickets.length === 0 ? (
                    <div className="rabtv-adm-empty rounded-2xl text-center">
                      <div
                        className="rabtv-adm-empty-bg"
                        style={{ backgroundImage: `url(${IMG_EMPTY_STATE})` }}
                      />
                      <div className="rabtv-adm-empty-scrim" />
                      <p className="relative z-10 text-xs text-[#E8DCC8]">
                        No ad tickets in this queue. Open any stream on{" "}
                        <strong>/player</strong> and tap{" "}
                        <strong>🛡️ Inspect Ads</strong> to capture and report
                        rogue ad sources.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {filteredAdTickets.map((tk) => (
                        <div
                          key={tk.id}
                          className={`rounded-2xl border p-4 text-xs space-y-2 ${
                            tk.status === "open"
                              ? "border-cyan-500/40 bg-black/80"
                              : "border-white/10 bg-black/50 opacity-65"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-black text-white text-sm">
                              <span className="font-mono text-red-300">
                                {tk.domain}
                              </span>{" "}
                              on {tk.title}
                            </p>
                            <span className="rounded-md bg-amber-500/25 px-2 py-0.5 text-[9.5px] font-black uppercase text-amber-200">
                              {tk.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#8C8175]">
                            Provider: <strong className="text-[#E8DCC8]">{tk.providerId}</strong> •{" "}
                            {tk.originType} • {tk.createdBy} •{" "}
                            {formatDateTime(tk.createdAt)}
                          </p>
                          <p className="font-mono text-[10.5px] text-cyan-300 break-all bg-black/70 rounded-xl px-3 py-2">
                            {tk.selector}
                          </p>
                          {tk.notes && (
                            <p className="text-xs text-[#E8DCC8]">{tk.notes}</p>
                          )}
                          {tk.status === "open" && (
                            <div className="flex flex-wrap gap-2 pt-1">
                              <AdminArmoredBtn
                                variant="primary"
                                disabled={busy}
                                onClick={async () => {
                                  setBusy(true);
                                  try {
                                    const res = await resolveAdInjectionTicket(
                                      tk.id,
                                      "blocked",
                                      true
                                    );
                                    showToast(
                                      res.ok,
                                      res.ok
                                        ? `🛡️ Blocked ${tk.domain} globally & closed ticket!`
                                        : res.error || "Failed"
                                    );
                                    await loadSnapshot();
                                  } finally {
                                    setBusy(false);
                                  }
                                }}
                                className="py-2 px-4 text-xs"
                              >
                                🛡️ Block Domain & Resolve
                              </AdminArmoredBtn>
                              <AdminArmoredBtn
                                variant="idle"
                                disabled={busy}
                                onClick={async () => {
                                  setBusy(true);
                                  try {
                                    const res = await resolveAdInjectionTicket(
                                      tk.id,
                                      "dismissed",
                                      false
                                    );
                                    showToast(
                                      res.ok,
                                      res.ok ? "Ticket dismissed." : res.error || "Failed"
                                    );
                                    await loadSnapshot();
                                  } finally {
                                    setBusy(false);
                                  }
                                }}
                                className="py-2 px-4 text-xs"
                              >
                                Dismiss
                              </AdminArmoredBtn>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </AdminPanelCard>
              </div>
            )}

            {/* =============================================================== */}
            {/* 18. PROTECTED CORE WHITELIST & NATIVE BRIDGE STATS              */}
            {/* =============================================================== */}
            {activeView === "ad_whitelist" && (
              <div className="space-y-4">
                <AdminSectionBanner
                  title="✅ Protected Core Whitelist & Native Firewall"
                  subtitle="Safeguards preventing accidental blocking of TMDB, GitHub, YouTube, or localhost"
                />
                <AdminPanelCard>
                  {nativeStats ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {[
                        { label: "Baseline Firewall", val: nativeStats.baselineCount ?? 0 },
                        { label: "Bundled HaGeZi", val: nativeStats.bundledHageziCount ?? 0 },
                        { label: "Remote Gist Rules", val: nativeStats.remoteOverrideCount ?? 0 },
                        { label: "Session Test Blocks", val: nativeStats.sessionBlockCount ?? 0 },
                      ].map((s) => (
                        <div key={s.label} className="rabtv-adm-stat rounded-2xl">
                          <div className="rabtv-adm-stat-9slice" />
                          <div className="relative z-10">
                            <span className="text-[9.5px] font-extrabold uppercase text-[#8C8175]">
                              {s.label}
                            </span>
                            <p className="text-xl font-black text-cyan-300">
                              {s.val}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/30 p-3.5 text-xs text-cyan-200">
                      Running in Browser Mode — Native Android WebView bridge
                      telemetry activates automatically inside your Android APK.
                    </div>
                  )}

                  <div className="space-y-2">
                    <span className="block text-[10.5px] font-extrabold uppercase tracking-wider text-[#8C8175]">
                      Locked Core Domains ({PROTECTED_WHITELIST_DOMAINS.size})
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {Array.from(PROTECTED_WHITELIST_DOMAINS).map((dom) => (
                        <span
                          key={dom}
                          className="rounded-xl border border-emerald-500/35 bg-emerald-950/40 px-3 py-1.5 font-mono text-xs font-bold text-emerald-200"
                        >
                          🔒 {dom}
                        </span>
                      ))}
                    </div>
                  </div>
                </AdminPanelCard>
              </div>
            )}

            {/* =============================================================== */}
            {/* 19. PUBLIC BUFF PROFILES MODERATION                             */}
            {/* =============================================================== */}
            {activeView === "mod_profiles" && (
              <div className="space-y-4">
                <AdminSectionBanner
                  title={`👥 Public Movie-Buff Profiles (${commProfiles.length})`}
                  subtitle="Inspect handles & taglines, hide offensive profiles, or jump straight to mute/ban"
                  rightSlot={
                    <AdminArmoredBtn
                      variant="idle"
                      disabled={loadingComm}
                      onClick={() => void loadCommunityModData(true)}
                      className="py-2 text-xs"
                    >
                      ↻ Refresh
                    </AdminArmoredBtn>
                  }
                />
                <AdminPanelCard>
                  <input
                    type="search"
                    dir="ltr"
                    placeholder="Filter profiles by handle or bio..."
                    value={commSearch}
                    onChange={(e) => setCommSearch(e.target.value)}
                    className="w-full rounded-xl border border-white/15 bg-black/80 px-3.5 py-2.5 text-xs font-bold text-white"
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[500px] overflow-y-auto pr-1 scrollbar-none">
                    {filteredCommProfiles.map((p) => (
                      <div
                        key={p.publicId}
                        className="rounded-2xl border border-white/12 bg-black/75 p-3.5 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-black text-white truncate">
                            {p.handle}
                          </span>
                          <span className="text-[10.5px] text-cyan-300 font-bold shrink-0">
                            {p.moviesWatched}M / {p.showsWatched}TV
                          </span>
                        </div>
                        {p.bio && (
                          <p className="text-xs text-[#E8DCC8] italic">
                            “{p.bio}”
                          </p>
                        )}
                        <div className="flex gap-2 pt-1">
                          <AdminArmoredBtn
                            variant="idle"
                            onClick={() => {
                              setEnfTarget(p.handle);
                              setEnfType("mute");
                              selectAdminView("user_enforcement");
                            }}
                            className="flex-1 py-1.5 text-[11px]"
                          >
                            Mute / Ban
                          </AdminArmoredBtn>
                          <AdminArmoredBtn
                            variant="danger"
                            onClick={async () => {
                              blockCommunityUser(p.publicId);
                              await reportCommunityItem("profile", p.publicId);
                              showToast(true, `Blocked & flagged ${p.handle}`);
                              void loadCommunityModData(true);
                            }}
                            className="flex-1 py-1.5 text-[11px]"
                          >
                            🚫 Hide Profile
                          </AdminArmoredBtn>
                        </div>
                      </div>
                    ))}
                  </div>
                </AdminPanelCard>
              </div>
            )}

            {/* =============================================================== */}
            {/* 20. COMMUNITY REVIEWS QUEUE                                     */}
            {/* =============================================================== */}
            {activeView === "mod_reviews" && (
              <div className="space-y-4">
                <AdminSectionBanner
                  title={`💬 Community Reviews Queue (${commReviews.length})`}
                  subtitle="Flag or remove offensive comments and mute repeat offenders"
                  rightSlot={
                    <AdminArmoredBtn
                      variant="idle"
                      disabled={loadingComm}
                      onClick={() => void loadCommunityModData(true)}
                      className="py-2 text-xs"
                    >
                      ↻ Refresh
                    </AdminArmoredBtn>
                  }
                />
                <AdminPanelCard>
                  <input
                    type="search"
                    dir="ltr"
                    placeholder="Filter reviews by title, author, or text..."
                    value={commSearch}
                    onChange={(e) => setCommSearch(e.target.value)}
                    className="w-full rounded-xl border border-white/15 bg-black/80 px-3.5 py-2.5 text-xs font-bold text-white"
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[500px] overflow-y-auto pr-1 scrollbar-none">
                    {filteredCommReviews.map((r) => (
                      <div
                        key={r.reviewId}
                        className="rounded-2xl border border-white/12 bg-black/75 p-3.5 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-black text-white truncate">
                            {r.title}
                          </span>
                          <span className="text-xs text-amber-400 shrink-0">
                            {"★".repeat(r.rating)}
                          </span>
                        </div>
                        <p className="text-[11px] text-cyan-300 font-bold">
                          {r.authorHandle} • {formatDateTime(r.updatedAt)}
                        </p>
                        {r.comment && (
                          <p className="text-xs text-[#E8DCC8] leading-snug">
                            {r.comment}
                          </p>
                        )}
                        <div className="flex gap-2 pt-1">
                          <AdminArmoredBtn
                            variant="danger"
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
                            className="flex-1 py-1.5 text-[11px]"
                          >
                            🚩 Flag / Hide
                          </AdminArmoredBtn>
                          <AdminArmoredBtn
                            variant="idle"
                            onClick={() => {
                              setEnfTarget(r.authorHandle);
                              setEnfType("mute");
                              selectAdminView("user_enforcement");
                            }}
                            className="flex-1 py-1.5 text-[11px]"
                          >
                            Mute Author
                          </AdminArmoredBtn>
                        </div>
                      </div>
                    ))}
                  </div>
                </AdminPanelCard>
              </div>
            )}

            {/* =============================================================== */}
            {/* 21. COMMUNITY & BUDDY SWITCHES                                  */}
            {/* =============================================================== */}
            {activeView === "mod_flags" && (
              <div className="space-y-4">
                <AdminSectionBanner
                  title="🎛️ Community & Watch Buddy Controls"
                  subtitle="Toggle Movie Club visibility, Watch Buddies chat, or Read-Only Freeze"
                />
                <AdminPanelCard>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {(
                      [
                        {
                          key: "movieClubEnabled" as const,
                          label: "Movie Club Tab",
                          desc: "Show or hide Movie Club across the entire app.",
                        },
                        {
                          key: "watchBuddiesEnabled" as const,
                          label: "Watch Buddies Chat",
                          desc: "Allow or pause Buddy invites & async movie chats.",
                        },
                        {
                          key: "panicReadOnlyCommunity" as const,
                          label: "Read-Only Freeze",
                          desc: "Pause all new posts while keeping existing content visible.",
                        },
                      ] as const
                    ).map((item) => (
                      <div
                        key={item.key}
                        className="rounded-2xl border border-white/12 bg-black/75 p-4 flex flex-col justify-between gap-3"
                      >
                        <div>
                          <p className="text-sm font-black text-white">
                            {item.label}
                          </p>
                          <p className="text-xs text-[#8C8175] mt-1">
                            {item.desc}
                          </p>
                        </div>
                        <AdminArmoredBtn
                          variant={brandingDraft[item.key] ? "active" : "idle"}
                          onClick={() =>
                            setBrandingDraft((prev) => ({
                              ...prev,
                              [item.key]: !prev[item.key],
                            }))
                          }
                          className="w-full py-2.5 text-xs"
                        >
                          {brandingDraft[item.key] ? "ON" : "OFF"}
                        </AdminArmoredBtn>
                      </div>
                    ))}
                  </div>
                  <AdminArmoredBtn
                    variant="primary"
                    disabled={busy}
                    onClick={() =>
                      void commitBrandingConfig(
                        brandingDraft,
                        "COMMUNITY_FLAGS_UPDATE",
                        "Updated Community & Watch Buddy Controls"
                      )
                    }
                    className="w-full sm:w-auto py-3 px-6 text-xs"
                  >
                    ⚡ Publish Community Controls
                  </AdminArmoredBtn>
                </AdminPanelCard>
              </div>
            )}

            {/* =============================================================== */}
            {/* 22. APP FEATURE FLAGS                                           */}
            {/* =============================================================== */}
            {activeView === "feature_flags" && (
              <div className="space-y-4">
                <AdminSectionBanner
                  title="🚩 App Feature Flags"
                  subtitle="Toggle major app modules live OTA without rebuilding an APK"
                />
                <AdminPanelCard>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(
                      [
                        { key: "liveTvEnabled" as const, label: "📡 Live TV & Sports Tab" },
                        { key: "movieClubEnabled" as const, label: "🎭 Movie Club Tab" },
                        { key: "watchBuddiesEnabled" as const, label: "🤝 Watch Buddies Chat" },
                        { key: "holidayOverlayEnabled" as const, label: "✨ 3D Seasonal Holiday Overlay" },
                        { key: "allowTrials" as const, label: "⏳ 7-Day Free Trials" },
                        { key: "panicStrictTier1Only" as const, label: "⚡ Strict Tier-1 Streams Only" },
                      ] as const
                    ).map((f) => (
                      <div
                        key={f.key}
                        className="rounded-2xl border border-white/12 bg-black/75 px-4 py-3.5 flex items-center justify-between gap-3"
                      >
                        <span className="text-xs sm:text-sm font-black text-white">
                          {f.label}
                        </span>
                        <AdminArmoredBtn
                          variant={brandingDraft[f.key] ? "active" : "idle"}
                          onClick={() =>
                            setBrandingDraft((prev) => ({
                              ...prev,
                              [f.key]: !prev[f.key],
                            }))
                          }
                          className="py-1.5 px-4 text-xs shrink-0"
                        >
                          {brandingDraft[f.key] ? "ON" : "OFF"}
                        </AdminArmoredBtn>
                      </div>
                    ))}
                  </div>
                  <AdminArmoredBtn
                    variant="primary"
                    disabled={busy}
                    onClick={() =>
                      void commitBrandingConfig(
                        brandingDraft,
                        "FEATURE_FLAGS_PUBLISH",
                        "Published App Feature Flags"
                      )
                    }
                    className="w-full sm:w-auto py-3 px-6 text-xs"
                  >
                    ⚡ Publish All Feature Flags
                  </AdminArmoredBtn>
                </AdminPanelCard>
              </div>
            )}

            {/* =============================================================== */}
            {/* 23. OTA WALLPAPER & SPLASH                                      */}
            {/* =============================================================== */}
            {activeView === "ota_wallpaper" && (
              <div className="space-y-4">
                <AdminSectionBanner
                  title="🖼️ OTA Wallpaper & Splash Overrides"
                  subtitle="Swap global background wallpaper or splash video live via HTTPS URL"
                />
                <AdminPanelCard>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                      <label className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#8C8175]">
                        Custom Wallpaper HTTPS URL
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
                        className="w-full rounded-xl border border-white/15 bg-black/80 px-3.5 py-2.5 text-xs font-mono text-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#8C8175]">
                        Custom Splash MP4 HTTPS URL
                      </label>
                      <input
                        type="url"
                        dir="ltr"
                        placeholder="https://raw.githubusercontent.com/.../intro.mp4"
                        value={brandingDraft.customSplashUrl}
                        onChange={(e) =>
                          setBrandingDraft((prev) => ({
                            ...prev,
                            customSplashUrl: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-white/15 bg-black/80 px-3.5 py-2.5 text-xs font-mono text-white"
                      />
                    </div>
                  </div>

                  {brandingDraft.customWallpaperUrl &&
                    isSafeHttpsUrl(brandingDraft.customWallpaperUrl) && (
                      <div className="rounded-2xl border border-white/15 overflow-hidden max-w-md aspect-video bg-black">
                        <img
                          src={brandingDraft.customWallpaperUrl}
                          alt="OTA Wallpaper Preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                  <div className="flex flex-wrap gap-2.5">
                    <AdminArmoredBtn
                      variant="primary"
                      disabled={busy}
                      onClick={() =>
                        void commitBrandingConfig(
                          brandingDraft,
                          "OTA_MEDIA_PUBLISH",
                          "Published OTA Wallpaper & Splash Overrides"
                        )
                      }
                      className="py-3 px-6 text-xs"
                    >
                      ⚡ Publish Media Overrides
                    </AdminArmoredBtn>
                    <AdminArmoredBtn
                      variant="idle"
                      disabled={busy}
                      onClick={() => {
                        const reset = {
                          ...brandingDraft,
                          customWallpaperUrl: "",
                          customSplashUrl: "",
                        };
                        setBrandingDraft(reset);
                        void commitBrandingConfig(
                          reset,
                          "OTA_MEDIA_RESET",
                          "Reset Wallpaper & Splash to Default"
                        );
                      }}
                      className="py-3 px-5 text-xs"
                    >
                      ↺ Reset to Default Art
                    </AdminArmoredBtn>
                  </div>
                </AdminPanelCard>
              </div>
            )}

            {/* =============================================================== */}
            {/* 24. DEFAULT THEME OVERRIDE                                      */}
            {/* =============================================================== */}
            {activeView === "theme_override" && (
              <div className="space-y-4">
                <AdminSectionBanner
                  title="🌈 Default Theme Override"
                  subtitle="Choose the default neon theme applied to fresh installs"
                />
                <AdminPanelCard>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                    {THEME_PICKER_OPTIONS.map((t) => {
                      const active = brandingDraft.forceDefaultTheme === t.id;
                      return (
                        <button
                          key={t.id || "default"}
                          type="button"
                          onClick={() =>
                            setBrandingDraft((prev) => ({
                              ...prev,
                              forceDefaultTheme: t.id,
                            }))
                          }
                          className={`rounded-2xl border p-3.5 text-left transition cursor-pointer bg-gradient-to-br ${t.swatch} ${
                            active
                              ? "border-cyan-300 ring-2 ring-cyan-400 scale-[1.02]"
                              : "border-white/15 opacity-80 hover:opacity-100"
                          }`}
                        >
                          <span className="block text-xs font-black text-white">
                            {t.label}
                          </span>
                          <span className="block text-[10px] text-white/75 mt-0.5">
                            {active ? "✓ Selected" : "Tap to select"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <AdminArmoredBtn
                    variant="primary"
                    disabled={busy}
                    onClick={() =>
                      void commitBrandingConfig(
                        brandingDraft,
                        "THEME_OVERRIDE_PUBLISH",
                        `Set Default Theme Override: ${brandingDraft.forceDefaultTheme || "User Choice"}`
                      )
                    }
                    className="w-full sm:w-auto py-3 px-6 text-xs"
                  >
                    ⚡ Publish Default Theme
                  </AdminArmoredBtn>
                </AdminPanelCard>
              </div>
            )}

            {/* =============================================================== */}
            {/* 25. PUSH TOAST BROADCASTS                                       */}
            {/* =============================================================== */}
            {activeView === "broadcast_push" && (
              <div className="space-y-4">
                <AdminSectionBanner
                  title="🚀 Push Toast Broadcasts"
                  subtitle="Deliver real-time popups to ALL users or a specific license holder"
                />
                <AdminPanelCard>
                  <form onSubmit={handlePushToast} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <input
                        type="text"
                        dir="ltr"
                        placeholder="Target: ALL, Name, or Key"
                        value={targetQuery}
                        onChange={(e) => setTargetQuery(e.target.value)}
                        className="rounded-xl border border-white/15 bg-black/80 px-3.5 py-2.5 text-xs font-bold text-white"
                      />
                      <select
                        value={
                          uniqueOwners.includes(targetQuery) ? targetQuery : ""
                        }
                        onChange={(e) =>
                          e.target.value && setTargetQuery(e.target.value)
                        }
                        className="rounded-xl border border-white/15 bg-black/85 px-3 py-2.5 text-xs font-bold text-white"
                      >
                        <option value="">Pick active user ({uniqueOwners.length})…</option>
                        {uniqueOwners.map((u) => (
                          <option key={u} value={u}>
                            👤 {u}
                          </option>
                        ))}
                      </select>
                      <AdminArmoredBtn
                        variant={targetQuery === "ALL" ? "active" : "idle"}
                        onClick={() => setTargetQuery("ALL")}
                        className="py-2.5 text-xs"
                      >
                        🌐 Target ALL Users
                      </AdminArmoredBtn>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          { id: "info", label: "🔔 Info" },
                          { id: "warning", label: "⚠️ Warning" },
                          { id: "critical", label: "🚨 Urgent" },
                        ] as { id: ToastSeverity; label: string }[]
                      ).map((s) => (
                        <AdminArmoredBtn
                          key={s.id}
                          variant={
                            toastSeverity === s.id
                              ? s.id === "critical"
                                ? "danger"
                                : "active"
                              : "idle"
                          }
                          onClick={() => setToastSeverity(s.id)}
                          className="py-2.5 text-xs"
                        >
                          {s.label}
                        </AdminArmoredBtn>
                      ))}
                    </div>

                    <textarea
                      rows={3}
                      dir="ltr"
                      placeholder="Write your announcement message..."
                      value={targetMessage}
                      onChange={(e) => setTargetMessage(e.target.value)}
                      className="w-full rounded-xl border border-white/15 bg-black/80 px-3.5 py-2.5 text-xs font-bold text-white resize-none"
                    />
                    <AdminArmoredBtn
                      type="submit"
                      variant="primary"
                      disabled={busy}
                      className="w-full py-3.5 text-xs uppercase tracking-wider"
                    >
                      🚀 Push Toast Notification Now
                    </AdminArmoredBtn>
                  </form>
                </AdminPanelCard>
              </div>
            )}

            {/* =============================================================== */}
            {/* 26. ACTIVE TOAST QUEUE                                          */}
            {/* =============================================================== */}
            {activeView === "broadcast_queue" && (
              <div className="space-y-4">
                <AdminSectionBanner
                  title={`📋 Active Toast Queue (${snapshot.notifications.length})`}
                  subtitle="Manage currently queued broadcasts in notifications.json"
                  rightSlot={
                    snapshot.notifications.length > 0 ? (
                      <AdminArmoredBtn
                        variant="danger"
                        disabled={busy}
                        onClick={() => void handleDeleteToast(undefined, true)}
                        className="py-2 text-xs"
                      >
                        🗑️ Purge All
                      </AdminArmoredBtn>
                    ) : undefined
                  }
                />
                <AdminPanelCard>
                  {snapshot.notifications.length === 0 ? (
                    <div className="rabtv-adm-empty rounded-2xl text-center">
                      <div
                        className="rabtv-adm-empty-bg"
                        style={{ backgroundImage: `url(${IMG_EMPTY_STATE})` }}
                      />
                      <div className="rabtv-adm-empty-scrim" />
                      <p className="relative z-10 text-xs text-[#E8DCC8]">
                        No active toast notifications queued on Gist.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {snapshot.notifications.map((n) => (
                        <div
                          key={n.id || n.timestamp}
                          className="rounded-2xl border border-white/12 bg-black/75 px-4 py-3 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0">
                            <span className="font-black text-amber-300">
                              [{n.target}]
                            </span>{" "}
                            <span className="text-white">{n.message}</span>
                            <span className="block text-[10px] text-[#8C8175] mt-0.5">
                              {formatDateTime(n.timestamp)}
                            </span>
                          </div>
                          <AdminArmoredBtn
                            variant="danger"
                            disabled={busy}
                            onClick={() => void handleDeleteToast(n.id, false)}
                            className="py-1.5 px-3 text-xs shrink-0"
                          >
                            ✕
                          </AdminArmoredBtn>
                        </div>
                      ))}
                    </div>
                  )}
                </AdminPanelCard>
              </div>
            )}

            {/* =============================================================== */}
            {/* 27. USER BUG REPORTS INBOX                                      */}
            {/* =============================================================== */}
            {activeView === "bug_inbox" && (
              <div className="space-y-4">
                <AdminSectionBanner
                  title="🐞 User Bug Reports Inbox"
                  subtitle="Review user-submitted issue reports directly from GitHub"
                />
                <AdminPanelCard>
                  <AdminBugInbox />
                </AdminPanelCard>
              </div>
            )}

            {/* =============================================================== */}
            {/* 28. GITHUB APK BUILD TRIGGER                                    */}
            {/* =============================================================== */}
            {activeView === "apk_builds" && (
              <div className="space-y-4">
                <AdminSectionBanner
                  title="🤖 GitHub Actions APK Build Trigger"
                  subtitle="Dispatch main.yml on branch main to compile & publish a fresh nightly APK"
                />
                <AdminPanelCard>
                  <p className="text-xs text-[#E8DCC8] leading-relaxed">
                    Use this whenever you update native Android files (like{" "}
                    <code className="text-cyan-300">MainActivity.java</code>,
                    app icons, or TV launcher banners). Regular stream changes,
                    ad blocks, banners, and feature flags update live OTA
                    without needing a rebuild.
                  </p>
                  <AdminArmoredBtn
                    variant="primary"
                    disabled={busy}
                    onClick={handleDispatchApkBuild}
                    className="w-full sm:w-auto py-3.5 px-8 text-xs uppercase tracking-wider"
                  >
                    🚀 Trigger Nightly APK Build (main.yml)
                  </AdminArmoredBtn>
                </AdminPanelCard>
              </div>
            )}

            {/* =============================================================== */}
            {/* 29. HASH-CHAINED AUDIT LOG                                      */}
            {/* =============================================================== */}
            {activeView === "audit_trail" && (
              <div className="space-y-4">
                <AdminSectionBanner
                  title={`📜 Hash-Chained Audit Log (${snapshot.auditLog.length})`}
                  subtitle="Every admin mutation is SHA-256 hash-chained & recorded in audit_log.json"
                  rightSlot={
                    <AdminArmoredBtn
                      variant="idle"
                      onClick={() =>
                        exportJsonFile(
                          `rabtv_audit_log_${new Date().toISOString().slice(0, 10)}.json`,
                          snapshot.auditLog
                        )
                      }
                      className="py-2 text-xs"
                    >
                      💾 Export JSON
                    </AdminArmoredBtn>
                  }
                />
                <AdminPanelCard>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <input
                      type="search"
                      dir="ltr"
                      placeholder="Search actor, target, or reason..."
                      value={auditSearch}
                      onChange={(e) => setAuditSearch(e.target.value)}
                      className="sm:col-span-2 rounded-xl border border-white/15 bg-black/80 px-3.5 py-2.5 text-xs font-bold text-white"
                    />
                    <select
                      value={auditActionFilter}
                      onChange={(e) => setAuditActionFilter(e.target.value)}
                      className="rounded-xl border border-white/15 bg-black/85 px-3 py-2.5 text-xs font-extrabold text-white"
                    >
                      <option value="ALL">All Actions ({snapshot.auditLog.length})</option>
                      {auditActionTypes.map((act) => (
                        <option key={act} value={act}>
                          {act}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="max-h-[480px] overflow-y-auto space-y-2 pr-1 scrollbar-none">
                    {filteredAudit.length === 0 ? (
                      <p className="text-xs text-[#8C8175] text-center py-6">
                        No audit entries match your filter.
                      </p>
                    ) : (
                      filteredAudit.map((entry) => (
                        <div
                          key={entry.id}
                          className="rounded-2xl border border-white/12 bg-black/75 p-3.5 space-y-1 text-xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-mono font-black text-cyan-300">
                              {entry.action}
                            </span>
                            <span className="text-[10.5px] text-[#8C8175]">
                              {formatDateTime(entry.timestamp)}
                            </span>
                          </div>
                          <p className="text-white font-bold">
                            {entry.target} —{" "}
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
                </AdminPanelCard>
              </div>
            )}

            {/* =============================================================== */}
            {/* 30. SPLIT-GIST VAULT & FULL SNAPSHOT BACKUP                     */}
            {/* =============================================================== */}
            {activeView === "gist_vault" && (
              <div className="space-y-4">
                <AdminSectionBanner
                  title="🔐 Split-Gist Vault & Full Backup"
                  subtitle="Store a device-only GitHub PAT & download a complete JSON backup of all admin tables"
                />
                <AdminPanelCard>
                  <p className="text-xs text-[#E8DCC8] leading-relaxed">
                    Save your personal GitHub PAT and Master Admin Gist ID
                    locally on this device so public APKs never need embedded
                    write credentials.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      dir="ltr"
                      placeholder="Master Admin Gist ID (blank = build default)"
                      value={vaultGistIdInput}
                      onChange={(e) => setVaultGistIdInput(e.target.value)}
                      className="rounded-xl border border-white/15 bg-black/80 px-3.5 py-2.5 text-xs font-mono text-white"
                    />
                    <input
                      type="password"
                      dir="ltr"
                      placeholder="Personal GitHub PAT (stored on this device only)"
                      value={vaultPatInput}
                      onChange={(e) => setVaultPatInput(e.target.value)}
                      className="rounded-xl border border-white/15 bg-black/80 px-3.5 py-2.5 text-xs font-mono text-white"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    <AdminArmoredBtn
                      variant="active"
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
                      className="py-2.5 px-5 text-xs"
                    >
                      Save Vault Credentials
                    </AdminArmoredBtn>
                    <AdminArmoredBtn
                      variant="idle"
                      onClick={() => {
                        setVaultGistIdInput("");
                        setVaultPatInput("");
                        saveLocalVaultCredentials("", "");
                        showToast(true, "Reset to build defaults.");
                        void loadSnapshot();
                      }}
                      className="py-2.5 px-5 text-xs"
                    >
                      Reset to Default
                    </AdminArmoredBtn>
                    <AdminArmoredBtn
                      variant="primary"
                      onClick={() =>
                        exportJsonFile(
                          `rabtv_full_admin_snapshot_${new Date().toISOString().slice(0, 10)}.json`,
                          snapshot
                        )
                      }
                      className="py-2.5 px-5 text-xs"
                    >
                      💾 Download Full Gist Backup
                    </AdminArmoredBtn>
                  </div>
                </AdminPanelCard>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* MOBILE / TABLET SLIDE-OUT ADMIN SIDEBAR DRAWER (Left Side — Distinct from Customer Sidebar!) */}
      {mobileAdminDrawerOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="rabtv-vidsrc-protected fixed inset-0 z-50 flex lg:hidden">
            <div
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setMobileAdminDrawerOpen(false)}
            />
            <div className="relative z-10 w-[min(300px,86vw)] h-[100dvh] p-2">
              {renderAdminSidebarContent(true)}
            </div>
          </div>,
          document.body
        )}

      {/* STEP-UP CONFIRMATION MODAL */}
      {stepUp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
          onClick={() => setStepUp(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-md w-full"
          >
            <AdminPanelCard>
              <h3 className="text-base font-black text-white">
                {stepUp.title}
              </h3>
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

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <AdminArmoredBtn
                  variant="idle"
                  onClick={() => setStepUp(null)}
                  className="py-2.5 text-xs"
                >
                  Cancel
                </AdminArmoredBtn>
                <AdminArmoredBtn
                  variant={stepUp.danger ? "danger" : "primary"}
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
                  className="py-2.5 text-xs"
                >
                  Confirm Action
                </AdminArmoredBtn>
              </div>
            </AdminPanelCard>
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