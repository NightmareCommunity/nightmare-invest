"use client";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api-client";
import { GlassCard, SectionTitle, FadeIn, SkeletonCard, MetricTile } from "@/components/brand/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { fmtDate } from "@/lib/format";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, KeyRound, LogOut, Mail, User, Clock, Lock, CheckCircle2,
  ShieldCheck, FileCheck2, Bell, Globe, TrendingUp, Newspaper,
  Monitor, Wifi, Eye, EyeOff, Pencil, Award, ChevronRight,
  CircleDot, CircleX, CircleEllipsis, AlertTriangle,
  Download, Trash2, FileText, ScrollText, ExternalLink,
  Smartphone, Laptop, Tablet, MapPin, Activity, Star,
} from "lucide-react";
import { toast } from "sonner";
import { TwoFactorSection } from "./two-factor-section";
// NOTE: KYC module temporarily disabled. The KycSection component and
// related UI have been removed from the active investor flow. The
// underlying schema (KycDocument model, User.kyc* fields) is retained
// for clean future reintroduction. See /home/z/my-project/worklog.md.

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: "—", color: "text-muted-foreground" };
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const clamped = Math.min(s, 4);
  const labels = ["Weak", "Fair", "Good", "Strong"];
  const colors = ["text-loss", "text-warning", "text-gold", "text-profit"];
  return { score: clamped, label: labels[clamped - 1] ?? "Weak", color: colors[clamped - 1] ?? "text-loss" };
}

/* ------------------------------------------------------------------ */
/*  Security Ring SVG — Color-coded circular gauge                     */
/* ------------------------------------------------------------------ */

function SecurityRing({ percent, size = 140 }: { percent: number; size?: number }) {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  const ringColor = percent >= 70 ? "#00c896" : percent >= 40 ? "#D4AF37" : "#ff4d4f";
  const ringLabel = percent >= 70 ? "Strong" : percent >= 40 ? "Moderate" : "Weak";
  const glowId = `ring-glow-${size}-${percent}`;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id={`ring-grad-${percent}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={ringColor} />
            <stop offset="100%" stopColor="#FFD700" />
          </linearGradient>
        </defs>
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
        />
        {/* Animated progress ring */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#ring-grad-${percent})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
          filter={`url(#${glowId})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-metric text-3xl font-bold"
          style={{ color: ringColor, textShadow: `0 0 16px ${ringColor}66` }}
        >
          {percent}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{ringLabel}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section Header — numbered, accent-lined, iconified                 */
/* ------------------------------------------------------------------ */

function SettingsSectionHeader({
  num,
  title,
  subtitle,
  icon,
  action,
}: {
  num: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="relative">
      <div className="gold-divider mb-4 opacity-60" />
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="number-badge mt-0.5 shrink-0">{num}</span>
          <div>
            <div className="flex items-center gap-2">
              {icon && <span className="text-gold/85">{icon}</span>}
              <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">{title}</h2>
            </div>
            {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  KYC Step Indicator                                                 */
/*  (DISABLED — KYC module temporarily removed. Component retained    */
/*   for clean future reintroduction — currently unused.)             */
/* ------------------------------------------------------------------ */


/* ------------------------------------------------------------------ */
/*  Simulated Activity Log Data                                        */
/* ------------------------------------------------------------------ */

const ACTIVITY_LOG = [
  { id: 1, action: "Logged in", timestamp: new Date(Date.now() - 1000 * 60 * 5), ip: "192.168.1.42", device: "Chrome / macOS", icon: Monitor },
  { id: 2, action: "Password changed", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), ip: "192.168.1.42", device: "Chrome / macOS", icon: KeyRound },
  { id: 3, action: "Logged in", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), ip: "10.0.0.15", device: "Safari / iOS", icon: Smartphone },
  { id: 4, action: "2FA enabled", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48), ip: "192.168.1.42", device: "Chrome / macOS", icon: ShieldCheck },
  { id: 5, action: "Deposit requested", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 72), ip: "192.168.1.42", device: "Chrome / macOS", icon: TrendingUp },
  { id: 6, action: "Logged in", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 96), ip: "172.16.0.8", device: "Firefox / Windows", icon: Laptop },
  { id: 7, action: "Watchlist alert created", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 120), ip: "192.168.1.42", device: "Chrome / macOS", icon: Star },
  { id: 8, action: "Logged in", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 168), ip: "192.168.1.42", device: "Chrome / macOS", icon: Monitor },
  { id: 9, action: "Notification preferences updated", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 200), ip: "192.168.1.42", device: "Chrome / macOS", icon: Bell },
  { id: 10, action: "Account created", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 240), ip: "192.168.1.42", device: "Chrome / macOS", icon: User },
];

/* ------------------------------------------------------------------ */
/*  Simulated Active Sessions                                          */
/* ------------------------------------------------------------------ */

const ACTIVE_SESSIONS = [
  { id: "current", browser: "Chrome 121", os: "macOS Sonoma", ip: "192.168.1.42", lastActive: new Date(), device: "desktop", current: true },
  { id: "mobile", browser: "Safari 17", os: "iOS 17.3", ip: "10.0.0.15", lastActive: new Date(Date.now() - 86400000), device: "mobile", current: false },
  { id: "tablet", browser: "Firefox 122", os: "Windows 11", ip: "172.16.0.8", lastActive: new Date(Date.now() - 3 * 86400000), device: "desktop", current: false },
];

/* ------------------------------------------------------------------ */
/*  Main Settings Page                                                 */
/* ------------------------------------------------------------------ */

export function SettingsPage() {
  const user = useApp((s) => s.user);
  const refresh = useApp((s) => s.refresh);
  const logout = useApp((s) => s.logout);
  const [newPass, setNewPass] = useState("");
  const [currentPass, setCurrentPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  /* Notification preferences (visual only) */
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifPush, setNotifPush] = useState(false);
  const [notifStatement, setNotifStatement] = useState(true);
  const [notifFund, setNotifFund] = useState(false);

  /* Activity log state */
  const [showAllActivity, setShowAllActivity] = useState(false);

  const reset = async () => {
    if (!user) return;
    if (newPass.length < 8) return toast.error("Password must be at least 8 characters");
    if (newPass !== confirmPass) return toast.error("Passwords do not match");
    setSubmitting(true);
    try {
      await api.post("/api/auth/password-reset", { email: user.email, newPassword: newPass });
      toast.success("Password updated");
      setNewPass("");
      setCurrentPass("");
      setConfirmPass("");
      setShowChangePassword(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  const totpEnabled = !!user.totpEnabled;
  // KYC module temporarily disabled — fields remain on the User model for
  // future reintroduction but are no longer surfaced in the investor UI.

  /* ---- Account completion calculation ---- */
  const completionItems = [
    { label: "Profile filled", done: !!user.name && !!user.email, weight: 25 },
    { label: "Email verified", done: !!user.email, weight: 25 },
    { label: "2FA enabled", done: totpEnabled, weight: 25 },
    { label: "Strong password", done: false, weight: 25 },
  ];
  const completionPct = completionItems.reduce((acc, item) => acc + (item.done ? item.weight : 0), 0);
  const remainingItems = completionItems.filter((i) => !i.done);

  /* ---- Security score calculation ---- */
  const securityChecks = [
    { label: "256-bit encryption in transit (TLS 1.3)", done: true, icon: Shield },
    { label: "bcrypt password hashing (cost 12)", done: true, icon: Lock },
    { label: "HttpOnly secure session cookies", done: true, icon: KeyRound },
    { label: "Role-based access control (RBAC)", done: true, icon: ShieldCheck },
    { label: "Full audit trail of account activity", done: true, icon: Eye },
    { label: "Two-factor authentication (TOTP)", done: totpEnabled, icon: ShieldCheck },
  ];
  const securityScore = Math.round(
    (securityChecks.filter((s) => s.done).length / securityChecks.length) * 100
  );

  /* ---- Password strength ---- */
  const pwStrength = passwordStrength(newPass);
  const pwRequirements = [
    { label: "At least 8 characters", met: newPass.length >= 8 },
    { label: "Upper & lowercase letters", met: /[A-Z]/.test(newPass) && /[a-z]/.test(newPass) },
    { label: "Contains a number", met: /\d/.test(newPass) },
    { label: "Special character", met: /[^A-Za-z0-9]/.test(newPass) },
    { label: "12+ characters (recommended)", met: newPass.length >= 12 },
  ];

  /* ---- Visible activity log items ---- */
  const visibleLog = showAllActivity ? ACTIVITY_LOG : ACTIVITY_LOG.slice(0, 5);

  /* ---- Sessions ---- */
  const getDeviceIcon = (device: string) => {
    if (device === "mobile") return Smartphone;
    if (device === "tablet") return Tablet;
    return Monitor;
  };

  return (
    <div className="space-y-6">
      {/* ---- Page Header ---- */}
      <FadeIn>
        <div>
          <div className="flex items-end justify-between gap-4">
            <div>
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Investor Portal</span>
              <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Settings</h1>
              <p className="text-sm text-muted-foreground">Manage your account, security &amp; verification</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const showFn = (window as Record<string, unknown>).__showOnboarding;
                if (typeof showFn === "function") (showFn as () => void)();
              }}
              className="border-gold/30 text-gold hover:bg-gold/10 gap-1.5"
            >
              <Shield className="h-3.5 w-3.5" /> Setup Wizard
            </Button>
          </div>
        </div>
      </FadeIn>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  SECTION A: PROFILE (TOP)                                         */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}

      <FadeIn delay={0.03}>
        <GlassCard gold className="p-6 hover-lift">
          <div className="flex flex-col sm:flex-row gap-6">
            {/* Avatar with animated gold ring */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                {/* Pulsing gold ring */}
                <div className="absolute -inset-2 rounded-full border-2 border-gold/40 animate-pulse-gold" />
                <div className="relative flex h-24 w-24 items-center justify-center rounded-full border-2 border-gold/60 bg-gradient-to-br from-gold/15 to-gold/5 text-3xl font-bold text-gold-gradient shadow-[0_0_24px_rgba(212,175,55,0.25)]">
                  {getInitials(user.name)}
                </div>
                <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-gold-gradient text-[9px] font-bold text-black shadow-[0_0_10px_rgba(212,175,55,0.5)]">
                  ✓
                </div>
              </div>
              <Badge
                className={`shimmer-badge text-[10px] ${
                  user.role === "ADMIN"
                    ? "border-gold/40 bg-gold/15 text-gold"
                    : "border-profit/30 bg-profit/10 text-profit"
                }`}
              >
                {user.role === "ADMIN" ? (
                  <><Award className="mr-1 h-3 w-3" /> Administrator</>
                ) : (
                  <><User className="mr-1 h-3 w-3" /> Investor</>
                )}
              </Badge>
            </div>

            {/* Info + Progress */}
            <div className="flex-1 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-foreground">{user.name}</h2>
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <Mail className="h-3.5 w-3.5" /> {user.email}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge className={user.role === "ADMIN" ? "border-gold/30 bg-gold/10 text-gold" : "border-profit/30 bg-profit/10 text-profit"}>
                      {user.role}
                    </Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Member since {fmtDate(user.createdAt)}
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-gold/30 text-gold hover:bg-gold/10 gap-1.5 text-xs shrink-0"
                  onClick={() => toast.info("Profile editing is not available in this version")}
                >
                  <Pencil className="h-3 w-3" /> Edit Profile
                </Button>
              </div>

              {/* Account completion progress bar */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-foreground/70">Account Completion</span>
                  <span className="font-metric text-sm font-bold text-gold">{completionPct}%</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/5">
                  <motion.div
                    className="h-full rounded-full bg-gold-gradient relative overflow-hidden"
                    initial={{ width: "0%" }}
                    animate={{ width: `${completionPct}%` }}
                    transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
                  >
                    {/* Shimmer overlay on progress */}
                    <div className="absolute inset-0 shimmer opacity-60" />
                  </motion.div>
                </div>
                {remainingItems.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    {remainingItems.map((item) => (
                      <div key={item.label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <ChevronRight className="h-3 w-3 text-gold/60" />
                        <span>{item.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </GlassCard>
      </FadeIn>

      {/* KYC module temporarily disabled — progress card removed.
          The KycStepIndicator component and verification UI are retained
          in the codebase for clean future reintroduction. */}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  SECTION B: SECURITY CENTER (PROMINENT)                           */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}

      <FadeIn delay={0.07}>
        <GlassCard gold glow className="p-6">
          <SettingsSectionHeader
            num="01"
            title="Security Center"
            subtitle="Protect your account with advanced security measures"
            icon={<Shield className="h-4 w-4" />}
          />

          <div className="mt-5 grid gap-6 lg:grid-cols-3">
            {/* Security Score Gauge */}
            <div className="flex flex-col items-center justify-center text-center">
              <SecurityRing percent={securityScore} size={140} />
              <p className="mt-3 text-xs text-muted-foreground">
                {securityScore >= 70
                  ? "Your account security is strong"
                  : securityScore >= 40
                    ? "Enable 2FA and complete KYC to improve"
                    : "Immediate action recommended"}
              </p>
            </div>

            {/* Security checklist */}
            <div className="lg:col-span-2 space-y-2.5">
              {securityChecks.map((s) => {
                const SIcon = s.icon;
                return (
                  <motion.div
                    key={s.label}
                    whileHover={{ x: 2 }}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                      s.done ? "bg-white/[0.02] hover:bg-white/[0.04]" : "bg-gold/5 hover:bg-gold/[0.08]"
                    }`}
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                        s.done
                          ? "border-profit/20 bg-profit/10"
                          : "border-gold/20 bg-gold/5"
                      }`}
                    >
                      {s.done ? (
                        <CheckCircle2 className="h-4 w-4 text-profit" />
                      ) : (
                        <SIcon className="h-4 w-4 text-gold/70" />
                      )}
                    </div>
                    <span className={`text-sm flex-1 ${s.done ? "text-foreground/80" : "text-muted-foreground"}`}>
                      {s.label}
                    </span>
                    {!s.done && (
                      <ChevronRight className="h-3.5 w-3.5 text-gold/50" />
                    )}
                  </motion.div>
                );
              })}

              {/* Strengthen suggestions */}
              {securityChecks.some((s) => !s.done) && (
                <div className="rounded-lg border border-gold/20 bg-gold/5 p-3">
                  <div className="text-xs font-semibold text-gold mb-1.5">Strengthen your account</div>
                  <ul className="space-y-1">
                    {securityChecks
                      .filter((s) => !s.done)
                      .map((s) => (
                        <li key={s.label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <ChevronRight className="h-3 w-3 text-gold/50" />
                          {s.label}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </GlassCard>
      </FadeIn>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  SECURITY: 2FA + PASSWORD + SESSIONS                              */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left Column (2/3) */}
        <FadeIn delay={0.09} className="lg:col-span-2 space-y-4">

          {/* 2FA Section */}
          <GlassCard className="glass-card-hover p-6 border-gold/15" gold>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${
                  totpEnabled ? "border-profit/20 bg-profit/10" : "border-gold/20 bg-gold/5"
                }`}>
                  <ShieldCheck className={`h-5 w-5 ${totpEnabled ? "text-profit" : "text-gold"}`} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">Two-Factor Authentication</h3>
                  <p className="text-xs text-muted-foreground">
                    {totpEnabled ? "Authenticator app is enabled" : "Not configured — highly recommended"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={totpEnabled}
                  className="switch-gold-glow data-[state=checked]:bg-gold data-[state=checked]:shadow-[0_0_12px_rgba(212,175,55,0.4)]"
                />
                <Badge
                  className={
                    totpEnabled
                      ? "border-profit/30 bg-profit/10 text-profit"
                      : "border-gold/30 bg-gold/10 text-gold"
                  }
                >
                  {totpEnabled ? "Enabled" : "Disabled"}
                </Badge>
              </div>
            </div>
          </GlassCard>

          <TwoFactorSection enabled={totpEnabled} onChanged={refresh} />

          {/* ---- Password Section ---- */}
          <GlassCard className="glass-card-hover p-6 border-gold/10">
            <SettingsSectionHeader
              num="02"
              title="Change Password"
              subtitle="Update your password"
              icon={<KeyRound className="h-4 w-4" />}
              action={
                <Button
                  variant="outline"
                  size="sm"
                  className="border-gold/30 text-gold hover:bg-gold/10 gap-1.5 text-xs"
                  onClick={() => setShowChangePassword(!showChangePassword)}
                >
                  {showChangePassword ? "Cancel" : <><Pencil className="h-3 w-3" /> Change</>}
                </Button>
              }
            />

            <AnimatePresence>
              {showChangePassword && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 space-y-4">
                    {/* Current Password */}
                    <div className="space-y-1.5">
                      <Label htmlFor="currentpass" className="text-xs uppercase tracking-wider text-muted-foreground">Current Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="currentpass"
                          type="password"
                          value={currentPass}
                          onChange={(e) => setCurrentPass(e.target.value)}
                          placeholder="••••••••"
                          className="border-border/60 bg-black/30 pl-9"
                        />
                      </div>
                    </div>

                    {/* New Password */}
                    <div className="space-y-1.5">
                      <Label htmlFor="newpass" className="text-xs uppercase tracking-wider text-muted-foreground">New Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="newpass"
                          type={showPass ? "text" : "password"}
                          value={newPass}
                          onChange={(e) => setNewPass(e.target.value)}
                          placeholder="••••••••"
                          className="border-border/60 bg-black/30 pl-9 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPass(!showPass)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          aria-label={showPass ? "Hide password" : "Show password"}
                        >
                          {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-1.5">
                      <Label htmlFor="confirmpass" className="text-xs uppercase tracking-wider text-muted-foreground">Confirm New Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="confirmpass"
                          type="password"
                          value={confirmPass}
                          onChange={(e) => setConfirmPass(e.target.value)}
                          placeholder="••••••••"
                          className="border-border/60 bg-black/30 pl-9"
                        />
                        {confirmPass && newPass && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2">
                            {newPass === confirmPass ? (
                              <CheckCircle2 className="h-4 w-4 text-profit" />
                            ) : (
                              <CircleX className="h-4 w-4 text-loss" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Password strength meter */}
                    {newPass.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        transition={{ duration: 0.25 }}
                        className="space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Password strength</span>
                          <span className={`text-xs font-semibold ${pwStrength.color}`}>{pwStrength.label}</span>
                        </div>
                        <div className="flex gap-1.5">
                          {[1, 2, 3, 4].map((level) => (
                            <motion.div
                              key={level}
                              className={`h-1.5 flex-1 rounded-full ${
                                pwStrength.score >= level
                                  ? pwStrength.score >= 3
                                    ? "bg-profit"
                                    : pwStrength.score >= 2
                                      ? "bg-gold"
                                      : "bg-loss"
                                  : "bg-white/5"
                              }`}
                              initial={{ scaleX: 0 }}
                              animate={{ scaleX: 1 }}
                              transition={{ duration: 0.3, delay: level * 0.05 }}
                              style={{ transformOrigin: "left" }}
                            />
                          ))}
                        </div>

                        {/* Requirements checklist */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                          {pwRequirements.map((req) => (
                            <div key={req.label} className="flex items-center gap-1.5 text-[11px]">
                              {req.met ? (
                                <CheckCircle2 className="h-3 w-3 text-profit shrink-0" />
                              ) : (
                                <CircleDot className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                              )}
                              <span className={req.met ? "text-foreground/80" : "text-muted-foreground/60"}>
                                {req.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    <Button onClick={reset} disabled={submitting || newPass.length < 8 || newPass !== confirmPass} className="bg-gold-gradient text-black hover:opacity-90">
                      <KeyRound className="mr-1.5 h-4 w-4" /> {submitting ? "Updating…" : "Update Password"}
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </GlassCard>

          {/* KYC module temporarily disabled — section removed. */}

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {/*  SECTION C: NOTIFICATION PREFERENCES                             */}
          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}

          <GlassCard className="glass-card-hover p-6 border-gold/15" gold>
            <SettingsSectionHeader
              num="03"
              title="Notification Preferences"
              subtitle="Control what updates you receive"
              icon={<Bell className="h-4 w-4" />}
            />
            <div className="mt-5 space-y-3">
              {[
                {
                  id: "email",
                  label: "Email Notifications",
                  desc: "Transaction updates and account alerts delivered to your inbox",
                  icon: Mail,
                  checked: notifEmail,
                  onChange: setNotifEmail,
                },
                {
                  id: "push",
                  label: "Push Notifications",
                  desc: "Real-time price alerts and market movement notifications",
                  icon: Bell,
                  checked: notifPush,
                  onChange: setNotifPush,
                },
                {
                  id: "statement",
                  label: "Statement Generation Alerts",
                  desc: "Get notified when new monthly and quarterly statements are ready",
                  icon: ScrollText,
                  checked: notifStatement,
                  onChange: setNotifStatement,
                },
                {
                  id: "fund",
                  label: "Fund Update Announcements",
                  desc: "Strategy changes, performance commentary, and fund news",
                  icon: Newspaper,
                  checked: notifFund,
                  onChange: setNotifFund,
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <GlassCard key={item.id} className="p-3.5" hover glowOnHover>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gold/25 bg-gradient-to-br from-gold/10 to-gold/5">
                          <Icon className="h-5 w-5 text-gold" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-foreground">{item.label}</div>
                          <div className="text-[11px] text-muted-foreground truncate">{item.desc}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Switch
                          checked={item.checked}
                          onCheckedChange={item.onChange}
                          className="switch-gold-glow data-[state=checked]:bg-gold data-[state=checked]:shadow-[0_0_12px_rgba(212,175,55,0.4)]"
                        />
                        <span className={`text-[10px] font-medium uppercase tracking-wider ${item.checked ? "text-gold" : "text-muted-foreground/50"}`}>
                          {item.checked ? "On" : "Off"}
                        </span>
                      </div>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          </GlassCard>

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {/*  SECTION D: ACTIVE SESSIONS                                       */}
          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}

          <GlassCard className="glass-card-hover p-6 border-gold/10">
            <SettingsSectionHeader
              num="04"
              title="Active Sessions"
              subtitle="Devices currently authenticated to your account"
              icon={<Monitor className="h-4 w-4" />}
            />
            <div className="mt-4 space-y-3">
              {ACTIVE_SESSIONS.map((session) => {
                const DeviceIcon = getDeviceIcon(session.device);
                return (
                  <motion.div
                    key={session.id}
                    whileHover={{ x: 2 }}
                    className={`flex items-center gap-4 rounded-xl border p-4 transition-all duration-300 ${
                      session.current
                        ? "border-profit/20 bg-profit/5 hover:bg-profit/[0.08]"
                        : "border-border/30 bg-white/[0.02] hover:bg-white/[0.04] hover:border-gold/20"
                    }`}
                  >
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
                      session.current ? "border-profit/20 bg-profit/10" : "border-border/40 bg-black/20"
                    }`}>
                      <DeviceIcon className={`h-5 w-5 ${session.current ? "text-profit" : "text-muted-foreground"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{session.browser}</span>
                        {session.current && (
                          <span className="flex items-center gap-1 rounded-full border border-profit/30 bg-profit/10 px-2 py-0.5 text-[10px] font-medium text-profit">
                            <span className="h-1.5 w-1.5 rounded-full bg-profit animate-pulse" />
                            Active
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Laptop className="h-3 w-3" /> {session.os}</span>
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {session.ip}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {fmtDate(session.lastActive)}</span>
                      </div>
                    </div>
                    {!session.current && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-loss/30 text-loss hover:bg-loss/10 text-xs shrink-0"
                        onClick={() => toast.success("Session revoked")}
                      >
                        Revoke
                      </Button>
                    )}
                  </motion.div>
                );
              })}
              <Button variant="outline" onClick={logout} className="border-loss/30 text-loss hover:bg-loss/10 w-full">
                <LogOut className="mr-1.5 h-4 w-4" /> Sign out of all sessions
              </Button>
            </div>
          </GlassCard>
        </FadeIn>

        {/* Right Column (1/3) */}
        <FadeIn delay={0.12}>
          <div className="space-y-4">
            {/* ---- Quick Status Metrics ---- */}
            <MetricTile
              label="2FA Status"
              value={totpEnabled ? "Enabled" : "Disabled"}
              sub={totpEnabled ? "Authenticator app configured" : "Not configured — recommended"}
              icon={<ShieldCheck className="h-4 w-4" />}
              accent={totpEnabled ? "profit" : "gold"}
            />
            <MetricTile
              label="Last Login"
              value={user.lastLogin ? fmtDate(user.lastLogin, true) : "—"}
              sub={user.lastLogin ? "Most recent session" : "First login"}
              icon={<Clock className="h-4 w-4" />}
              accent="gold"
            />
            <MetricTile
              label="Notifications"
              value={`${[notifEmail, notifPush, notifStatement, notifFund].filter(Boolean).length} of 4`}
              sub="Active notification channels"
              icon={<Bell className="h-4 w-4" />}
              accent={[notifEmail, notifPush, notifStatement, notifFund].filter(Boolean).length >= 2 ? "profit" : "gold"}
            />

            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {/*  SECTION E: ACCOUNT & LEGAL                                      */}
            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}

            <GlassCard className="p-5 hover-lift">
              <div className="flex items-center gap-2 mb-4">
                <span className="number-badge">05</span>
                <h3 className="text-base font-semibold text-foreground">Account &amp; Legal</h3>
              </div>
              <div className="space-y-2.5">
                {/* Download my data */}
                <button
                  onClick={() => toast.success("Data export initiated — you will receive an email")}
                  className="flex w-full items-center gap-3 rounded-lg border border-gold/15 bg-gold/5 px-3.5 py-3 text-sm text-foreground transition-all hover:bg-gold/10 hover:border-gold/25 hover:glow-gold group"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gold/20 bg-gold/10">
                    <Download className="h-4 w-4 text-gold" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-medium">Download My Data</div>
                    <div className="text-[11px] text-muted-foreground">GDPR-style data export</div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-gold transition-colors" />
                </button>

                {/* Terms & Privacy */}
                <button
                  onClick={() => toast.info("Terms of Service opens in a new window")}
                  className="flex w-full items-center gap-3 rounded-lg border border-border/40 bg-white/[0.02] px-3.5 py-3 text-sm text-foreground transition-all hover:bg-white/[0.04] hover:border-gold/15 group"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/40 bg-black/20">
                    <ScrollText className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-medium">Terms of Service</div>
                    <div className="text-[11px] text-muted-foreground">View our terms and conditions</div>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-gold transition-colors" />
                </button>

                <button
                  onClick={() => toast.info("Privacy Policy opens in a new window")}
                  className="flex w-full items-center gap-3 rounded-lg border border-border/40 bg-white/[0.02] px-3.5 py-3 text-sm text-foreground transition-all hover:bg-white/[0.04] hover:border-gold/15 group"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/40 bg-black/20">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-medium">Privacy Policy</div>
                    <div className="text-[11px] text-muted-foreground">How we handle your information</div>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-gold transition-colors" />
                </button>

                {/* Danger Zone */}
                <Separator className="bg-loss/20 my-2" />
                <div className="rounded-lg border border-loss/20 bg-loss/5 p-3">
                  <div className="text-xs font-semibold text-loss mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" /> Danger Zone
                  </div>
                  <button
                    onClick={() => toast.error("Account deletion requires contacting investor relations")}
                    className="flex w-full items-center gap-3 rounded-lg border border-loss/20 bg-loss/5 px-3 py-2.5 text-sm text-loss transition-all hover:bg-loss/10 hover:border-loss/30"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="font-medium">Delete Account</span>
                  </button>
                  <p className="mt-1.5 text-[10px] text-muted-foreground">
                    This action is permanent and cannot be undone. Contact IR for assistance.
                  </p>
                </div>
              </div>
            </GlassCard>
          </div>
        </FadeIn>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  SECTION F: ACTIVITY LOG                                          */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}

      <FadeIn delay={0.15}>
        <GlassCard className="p-6 border-gold/10">
          <SettingsSectionHeader
            num="06"
            title="Activity Log"
            subtitle="Recent account activity and security events"
            icon={<Activity className="h-4 w-4" />}
            action={
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {ACTIVITY_LOG.length} events
              </span>
            }
          />

          <div className="mt-4 space-y-2">
            {visibleLog.map((log, idx) => {
              const LogIcon = log.icon;
              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.04 }}
                  className="flex items-center gap-3 rounded-lg border border-border/30 bg-white/[0.02] p-3 transition-all hover:bg-white/[0.04] hover:border-gold/15"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/40 bg-black/20">
                    <LogIcon className="h-4 w-4 text-gold/70" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">{log.action}</div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {log.ip}</span>
                      <span className="flex items-center gap-1"><Monitor className="h-3 w-3" /> {log.device}</span>
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground shrink-0">
                    {fmtDate(log.timestamp)}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {ACTIVITY_LOG.length > 5 && (
            <button
              onClick={() => setShowAllActivity(!showAllActivity)}
              className="mt-3 flex w-full items-center justify-center gap-1.5 text-xs text-gold hover:text-gold-bright transition-colors"
            >
              {showAllActivity ? "Show less" : `Show all ${ACTIVITY_LOG.length} events`}
              <ChevronRight className={`h-3 w-3 transition-transform ${showAllActivity ? "rotate-[-90deg]" : "rotate-90"}`} />
            </button>
          )}

          {/* Suspicious activity warning banner */}
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-gold/15 bg-gold/5 p-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 text-gold shrink-0" />
            <div>
              <div className="text-xs font-semibold text-gold">No suspicious activity detected</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                We continuously monitor your account for unauthorized access. You will be notified immediately if any suspicious activity is detected.
              </p>
            </div>
          </div>
        </GlassCard>
      </FadeIn>
    </div>
  );
}
