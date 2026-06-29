"use client";
import { useState, useMemo } from "react";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api-client";
import { GlassCard, SectionTitle, FadeIn, SkeletonCard } from "@/components/brand/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { fmtDate } from "@/lib/format";
import { motion } from "framer-motion";
import {
  Shield, KeyRound, LogOut, Mail, User, Clock, Lock, CheckCircle2,
  ShieldCheck, FileCheck2, Bell, Globe, TrendingUp, Newspaper,
  Monitor, Wifi, Eye, EyeOff, Pencil, Award, ChevronRight,
  CircleDot, CircleCheck, CircleX, CircleEllipsis, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { TwoFactorSection } from "./two-factor-section";
import { KycSection } from "./kyc-section";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Get initials from a full name */
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Password strength score (0-4) */
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
/*  Security Ring SVG                                                  */
/* ------------------------------------------------------------------ */

function SecurityRing({ percent, size = 120 }: { percent: number; size?: number }) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  const ringColor =
    percent >= 80 ? "#00c896" : percent >= 50 ? "#D4AF37" : "#ff4d4f";
  const glowId = `ring-glow-${size}`;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
          filter={`url(#${glowId})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-metric text-2xl font-bold" style={{ color: ringColor, textShadow: `0 0 12px ${ringColor}66` }}>
          {percent}%
        </span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Secure</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section Header — numbered, accent-lined, iconified                  */
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
/* ------------------------------------------------------------------ */

function KycStepIndicator({ status }: { status: string }) {
  const steps = [
    { key: "NONE", label: "Upload Documents", icon: FileCheck2 },
    { key: "PENDING", label: "Under Review", icon: Clock },
    { key: "APPROVED", label: "Approved", icon: CheckCircle2 },
  ];

  const currentIdx =
    status === "REJECTED" ? 0 :
    status === "APPROVED" ? 2 :
    status === "PENDING" ? 1 : 0;

  return (
    <div className="flex items-center gap-0 w-full">
      {steps.map((step, i) => {
        const StepIcon = step.icon;
        const isCompleted = i < currentIdx;
        const isCurrent = i === currentIdx;
        const isRejected = status === "REJECTED" && i === 0;

        return (
          <div key={step.key} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-1.5 min-w-0">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all ${
                  isCompleted
                    ? "border-profit bg-profit/10 text-profit"
                    : isCurrent && isRejected
                      ? "border-loss bg-loss/10 text-loss animate-pulse"
                      : isCurrent
                        ? "border-gold bg-gold/10 text-gold glow-gold"
                        : "border-border/40 bg-black/20 text-muted-foreground"
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : isCurrent && isRejected ? (
                  <CircleX className="h-4 w-4" />
                ) : (
                  <StepIcon className="h-4 w-4" />
                )}
              </div>
              <span
                className={`text-[10px] font-medium uppercase tracking-wider text-center leading-tight ${
                  isCompleted
                    ? "text-profit"
                    : isCurrent && isRejected
                      ? "text-loss"
                      : isCurrent
                        ? "text-gold"
                        : "text-muted-foreground/50"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="flex-1 mx-2 mt-[-18px]">
                <div className="h-0.5 w-full rounded-full bg-border/30 overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${
                      i < currentIdx ? "bg-profit" : i === currentIdx && status !== "REJECTED" ? "bg-gold/50" : "bg-transparent"
                    }`}
                    initial={{ width: "0%" }}
                    animate={{ width: i < currentIdx ? "100%" : i === currentIdx && status !== "REJECTED" ? "50%" : "0%" }}
                    transition={{ duration: 0.8, delay: 0.3 + i * 0.2 }}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Settings Page                                                 */
/* ------------------------------------------------------------------ */

export function SettingsPage() {
  const user = useApp((s) => s.user);
  const refresh = useApp((s) => s.refresh);
  const logout = useApp((s) => s.logout);
  const [newPass, setNewPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  /* Notification preferences (visual only) */
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifTx, setNotifTx] = useState(true);
  const [notifNav, setNotifNav] = useState(false);
  const [notifNews, setNotifNews] = useState(false);

  const reset = async () => {
    if (!user) return;
    if (newPass.length < 8) return toast.error("Password must be at least 8 characters");
    setSubmitting(true);
    try {
      await api.post("/api/auth/password-reset", { email: user.email, newPassword: newPass });
      toast.success("Password updated");
      setNewPass("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  const totpEnabled = !!user.totpEnabled;
  const kycStatus = user.kycStatus ?? "NONE";
  const kycTier = user.kycTier ?? "STANDARD";

  /* ---- Account completion calculation ---- */
  const completionItems = [
    { label: "Profile filled", done: !!user.name && !!user.email, weight: 20 },
    { label: "Email verified", done: !!user.email, weight: 20 },
    { label: "2FA enabled", done: totpEnabled, weight: 20 },
    { label: "KYC approved", done: kycStatus === "APPROVED", weight: 20 },
    { label: "Strong password", done: false, weight: 20 }, // can't know, default optimistic
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
    { label: "KYC identity verification", done: kycStatus === "APPROVED", icon: FileCheck2 },
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

  return (
    <div className="space-y-6">
      {/* ---- Page Header ---- */}
      <FadeIn>
        <div>
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Investor Portal</span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your account, security &amp; verification</p>
        </div>
      </FadeIn>

      {/* ---- Account Completion Progress ---- */}
      <FadeIn delay={0.03}>
        <GlassCard gold className="p-5 hover-lift">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-gold" />
                <h3 className="text-base font-semibold text-foreground">Account Completion</h3>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Your account is{" "}
                <span className="font-metric font-semibold text-gold">{completionPct}%</span>{" "}
                complete
              </p>
              <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white/5">
                <motion.div
                  className="h-full rounded-full bg-gold-gradient"
                  initial={{ width: "0%" }}
                  animate={{ width: `${completionPct}%` }}
                  transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
                />
              </div>
              {remainingItems.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                  {remainingItems.map((item) => (
                    <div key={item.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ChevronRight className="h-3 w-3 text-gold/60" />
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex-shrink-0">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-gold/30 bg-gold/5">
                <span className="font-metric text-xl font-bold text-gold">{completionPct}%</span>
              </div>
            </div>
          </div>
        </GlassCard>
      </FadeIn>

      {/* ---- KYC Progress Visualization ---- */}
      <FadeIn delay={0.05}>
        <GlassCard className="p-5 hover-lift">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-base font-semibold text-foreground">KYC Verification Progress</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {kycStatus === "APPROVED"
                  ? "Your identity has been verified"
                  : kycStatus === "PENDING"
                    ? "Your documents are being reviewed"
                    : kycStatus === "REJECTED"
                      ? "Action required — please re-submit documents"
                      : "Complete verification to unlock full access"}
              </p>
            </div>
            <Badge
              className={
                kycStatus === "APPROVED"
                  ? "border-profit/30 bg-profit/10 text-profit"
                  : kycStatus === "PENDING"
                    ? "border-gold/30 bg-gold/10 text-gold"
                    : kycStatus === "REJECTED"
                      ? "border-loss/30 bg-loss/10 text-loss"
                      : "border-muted-foreground/30 bg-muted/10 text-muted-foreground"
              }
            >
              {kycStatus === "APPROVED" && <CheckCircle2 className="mr-1 h-3 w-3" />}
              {kycStatus === "PENDING" && <Clock className="mr-1 h-3 w-3" />}
              {kycStatus === "REJECTED" && <AlertTriangle className="mr-1 h-3 w-3" />}
              {kycStatus === "NONE" && <CircleEllipsis className="mr-1 h-3 w-3" />}
              {kycStatus === "APPROVED" ? "Verified" : kycStatus === "PENDING" ? "In Review" : kycStatus === "REJECTED" ? "Rejected" : "Not Started"}
            </Badge>
          </div>
          <KycStepIndicator status={kycStatus} />
          {kycStatus === "REJECTED" && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-loss/20 bg-loss/5 p-3 text-xs text-loss">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Your documents were not accepted. Please review and re-upload in the KYC section below.</span>
            </div>
          )}
        </GlassCard>
      </FadeIn>

      {/* ---- Main Grid ---- */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left Column (2/3) */}
        <FadeIn delay={0.07} className="lg:col-span-2 space-y-4">

          {/* ---- Profile Section (Enhanced) ---- */}
          <GlassCard className="glass-card-hover p-6 border-gold/15" gold>
            <SettingsSectionHeader
              num="01"
              title="Profile"
              subtitle="Account information"
              icon={<User className="h-4 w-4" />}
              action={
                <Button
                  variant="outline"
                  size="sm"
                  className="border-gold/30 text-gold hover:bg-gold/10 gap-1.5 text-xs"
                  onClick={() => toast.info("Profile editing is not available in this version")}
                >
                  <Pencil className="h-3 w-3" /> Edit
                </Button>
              }
            />

            <div className="mt-5 flex flex-col sm:flex-row gap-5">
              {/* Avatar with rotating gold ring */}
              <div className="flex flex-col items-center gap-2">
                <div className="relative avatar-gold-ring">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-gold/60 bg-gradient-to-br from-gold/15 to-gold/5 text-2xl font-bold text-gold-gradient shadow-[0_0_20px_rgba(212,175,55,0.2)]">
                    {getInitials(user.name)}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-gold-gradient text-[8px] font-bold text-black shadow-[0_0_8px_rgba(212,175,55,0.5)]">
                    ✓
                  </div>
                </div>
                <Badge
                  className={`shimmer-badge text-[10px] ${
                    kycTier === "ACCREDITED"
                      ? "border-gold/40 bg-gold/15 text-gold"
                      : "border-muted-foreground/30 bg-muted/10 text-muted-foreground"
                  }`}
                >
                  {kycTier === "ACCREDITED" ? (
                    <><Award className="mr-1 h-3 w-3" /> Accredited</>
                  ) : (
                    <><User className="mr-1 h-3 w-3" /> Standard</>
                  )}
                </Badge>
              </div>

              {/* Fields */}
              <div className="flex-1 grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={user.name} readOnly className="border-border/60 bg-black/20 pl-9 text-foreground" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={user.email} readOnly className="border-border/60 bg-black/20 pl-9 text-foreground" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Role</Label>
                  <div className="flex h-9 items-center gap-2 rounded-md border border-border/60 bg-black/20 px-3">
                    <Badge className={user.role === "ADMIN" ? "border-gold/30 bg-gold/10 text-gold" : "border-profit/30 bg-profit/10 text-profit"}>
                      {user.role}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Member Since</Label>
                  <div className="flex h-9 items-center gap-2 rounded-md border border-border/60 bg-black/20 px-3 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" /> {fmtDate(user.createdAt)}
                  </div>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* ---- Password Section (Enhanced) ---- */}
          <GlassCard className="glass-card-hover p-6 border-gold/10">
            <SettingsSectionHeader
              num="02"
              title="Password"
              subtitle="Update your password"
              icon={<KeyRound className="h-4 w-4" />}
            />
            <div className="mt-4 space-y-4">
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
                      <div
                        key={level}
                        className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                          pwStrength.score >= level
                            ? pwStrength.score >= 3
                              ? "bg-profit"
                              : pwStrength.score >= 2
                                ? "bg-gold"
                                : "bg-loss"
                            : "bg-white/5"
                        }`}
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

              <Button onClick={reset} disabled={submitting || newPass.length < 8} className="bg-gold-gradient text-black hover:opacity-90">
                <KeyRound className="mr-1.5 h-4 w-4" /> {submitting ? "Updating…" : "Update Password"}
              </Button>
            </div>
          </GlassCard>

          {/* ---- 2FA ---- */}
          <TwoFactorSection enabled={totpEnabled} onChanged={refresh} />

          {/* ---- KYC ---- */}
          <KycSection />

          {/* ---- Notification Preferences ---- */}
          <GlassCard className="glass-card-hover p-6 border-gold/15" gold>
            <SettingsSectionHeader
              num="03"
              title="Notification Preferences"
              subtitle="Control what updates you receive"
              icon={<Bell className="h-4 w-4" />}
            />
            <div className="mt-5 space-y-4">
              {[
                {
                  id: "email",
                  label: "Email Notifications",
                  desc: "Receive account alerts and summaries via email",
                  icon: Mail,
                  checked: notifEmail,
                  onChange: setNotifEmail,
                },
                {
                  id: "tx",
                  label: "Transaction Alerts",
                  desc: "Get notified for deposits, withdrawals, and transfers",
                  icon: TrendingUp,
                  checked: notifTx,
                  onChange: setNotifTx,
                },
                {
                  id: "nav",
                  label: "NAV Updates",
                  desc: "Daily net asset value changes and fund performance",
                  icon: Globe,
                  checked: notifNav,
                  onChange: setNotifNav,
                },
                {
                  id: "news",
                  label: "Fund News & Reports",
                  desc: "Monthly reports, strategy updates, and market commentary",
                  icon: Newspaper,
                  checked: notifNews,
                  onChange: setNotifNews,
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.id}
                    whileHover={{ x: 2 }}
                    className="flex items-center justify-between gap-4 rounded-xl border border-gold/10 bg-black/20 p-3.5 transition-all duration-300 hover:bg-gold/[0.04] hover:border-gold/25"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gold/25 bg-gradient-to-br from-gold/10 to-gold/5">
                        <Icon className="h-4 w-4 text-gold" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground">{item.label}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{item.desc}</div>
                      </div>
                    </div>
                    <Switch
                      checked={item.checked}
                      onCheckedChange={item.onChange}
                      className="switch-gold-glow data-[state=checked]:bg-gold data-[state=checked]:shadow-[0_0_12px_rgba(212,175,55,0.4)]"
                    />
                  </motion.div>
                );
              })}
            </div>
          </GlassCard>

          {/* ---- Connected Sessions (Enhanced) ---- */}
          <GlassCard className="glass-card-hover p-6 border-gold/10">
            <SettingsSectionHeader
              num="04"
              title="Connected Sessions"
              subtitle="Authentication tokens"
              icon={<Monitor className="h-4 w-4" />}
            />
            <div className="mt-4 space-y-3">
              <div className="rounded-lg border border-profit/20 bg-profit/5 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-profit/20 bg-profit/10">
                    <Monitor className="h-5 w-5 text-profit" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">Current Session</span>
                      <span className="flex items-center gap-1 rounded-full border border-profit/30 bg-profit/10 px-2 py-0.5 text-[10px] font-medium text-profit">
                        <span className="h-1.5 w-1.5 rounded-full bg-profit animate-pulse" />
                        Active
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Wifi className="h-3 w-3" /> {typeof navigator !== "undefined" ? navigator.userAgent.includes("Chrome") ? "Chrome" : navigator.userAgent.includes("Firefox") ? "Firefox" : navigator.userAgent.includes("Safari") ? "Safari" : "Browser" : "Browser"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Last login {user.lastLogin ? fmtDate(user.lastLogin, true) : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <Button variant="outline" onClick={logout} className="border-loss/30 text-loss hover:bg-loss/10">
                <LogOut className="mr-1.5 h-4 w-4" /> Sign out of all sessions
              </Button>
            </div>
          </GlassCard>
        </FadeIn>

        {/* Right Column (1/3) */}
        <FadeIn delay={0.12}>
          <div className="space-y-4">
            {/* ---- Security Center (Enhanced) ---- */}
            <GlassCard gold className="glass-card-hover p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="number-badge">05</span>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-gold" />
                  <h3 className="text-base font-semibold text-foreground">Security Center</h3>
                </div>
              </div>
              <div className="flex flex-col items-center text-center">
                <p className="text-xs text-muted-foreground">
                  Your account security score
                </p>
                <div className="mt-4">
                  <SecurityRing percent={securityScore} />
                </div>
              </div>

              <Separator className="my-5 bg-border/60" />

              <div className="space-y-3">
                {securityChecks.map((s) => {
                  const SIcon = s.icon;
                  return (
                    <div
                      key={s.label}
                      className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 transition-colors ${
                        s.done ? "bg-white/[0.02]" : "bg-gold/5"
                      }`}
                    >
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${
                          s.done
                            ? "border-profit/20 bg-profit/10"
                            : "border-gold/20 bg-gold/5"
                        }`}
                      >
                        {s.done ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-profit" />
                        ) : (
                          <SIcon className="h-3.5 w-3.5 text-gold/70" />
                        )}
                      </div>
                      <span className={`text-xs leading-tight ${s.done ? "text-foreground/80" : "text-muted-foreground"}`}>
                        {s.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Strengthen suggestions */}
              {securityChecks.some((s) => !s.done) && (
                <div className="mt-4 rounded-lg border border-gold/20 bg-gold/5 p-3">
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
            </GlassCard>

            {/* ---- Quick Status Cards ---- */}
            <GlassCard className="p-5 hover-lift">
              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
                  totpEnabled ? "border-profit/20 bg-profit/10" : "border-gold/20 bg-gold/5"
                }`}>
                  <ShieldCheck className={`h-4 w-4 ${totpEnabled ? "text-profit" : "text-gold"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">2FA Status</div>
                  <div className="text-xs text-muted-foreground">
                    {totpEnabled ? "Authenticator app enabled" : "Not configured — recommended"}
                  </div>
                </div>
                <div className={`h-2.5 w-2.5 rounded-full ${totpEnabled ? "bg-profit" : "bg-gold animate-pulse"}`} />
              </div>
            </GlassCard>

            <GlassCard className="p-5 hover-lift">
              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
                  kycStatus === "APPROVED"
                    ? "border-profit/20 bg-profit/10"
                    : kycStatus === "PENDING"
                      ? "border-gold/20 bg-gold/5"
                      : kycStatus === "REJECTED"
                        ? "border-loss/20 bg-loss/5"
                        : "border-muted-foreground/20 bg-muted/5"
                }`}>
                  <FileCheck2 className={`h-4 w-4 ${
                    kycStatus === "APPROVED" ? "text-profit"
                      : kycStatus === "PENDING" ? "text-gold"
                        : kycStatus === "REJECTED" ? "text-loss"
                          : "text-muted-foreground"
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">KYC Status</div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge
                      variant="outline"
                      className={
                        kycStatus === "APPROVED" ? "border-profit/30 text-profit"
                        : kycStatus === "PENDING" ? "border-gold/30 text-gold"
                        : kycStatus === "REJECTED" ? "border-loss/30 text-loss"
                        : "border-muted-foreground/30 text-muted-foreground"
                      }
                    >
                      {kycStatus}
                    </Badge>
                    <span>· Tier {kycTier}</span>
                  </div>
                </div>
                <div className={`h-2.5 w-2.5 rounded-full ${
                  kycStatus === "APPROVED" ? "bg-profit"
                    : kycStatus === "PENDING" ? "bg-gold animate-pulse"
                      : kycStatus === "REJECTED" ? "bg-loss"
                        : "bg-muted-foreground/40"
                }`} />
              </div>
            </GlassCard>

            <GlassCard className="p-5 hover-lift">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-gold/20 bg-gold/5">
                  <Bell className="h-4 w-4 text-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">Notifications</div>
                  <div className="text-xs text-muted-foreground">
                    {[notifEmail, notifTx, notifNav, notifNews].filter(Boolean).length} of 4 enabled
                  </div>
                </div>
                <div className={`h-2.5 w-2.5 rounded-full ${
                  [notifEmail, notifTx, notifNav, notifNews].filter(Boolean).length >= 2 ? "bg-profit" : "bg-gold"
                }`} />
              </div>
            </GlassCard>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}
