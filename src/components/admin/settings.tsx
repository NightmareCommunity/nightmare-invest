"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { GlassCard, SectionTitle, FadeIn, MetricTile, SkeletonCard } from "@/components/brand/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Settings as SettingsIcon, Shield, DollarSign, Bell, Server, Save,
  Loader2, CheckCircle2, AlertTriangle, Globe, Lock, Mail, Power,
  KeyRound, Clock, Eye, EyeOff, Database, Users, Activity, Cpu,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { fmtDate } from "@/lib/format";

/* ──────────────────────────────────────────────────────────────────────────────
   ADMIN SETTINGS — Platform configuration console
   ────────────────────────────────────────────────────────────────────────────── */

type Settings = Record<string, string | number | boolean>;

export function AdminSettings() {
  const qc = useQueryClient();
  // Track only the user's edits (diff) against the server-provided base settings.
  // The "form" is computed as a merge of base + edits — no setState-in-effect needed.
  const [edits, setEdits] = useState<Record<string, string | number | boolean>>({});

  const { data, isLoading } = useQuery<{ settings: Settings }>({
    queryKey: ["admin-settings"],
    queryFn: () => api.get<{ settings: Settings }>("/api/admin/settings"),
  });

  const { data: stats } = useQuery<{ admins: number; investors: number; transactions: number; navPoints: number; dbSizeBytes: number }>({
    queryKey: ["admin-settings-stats"],
    queryFn: () => api.get("/api/admin/settings/stats"),
    retry: 1,
  });

  const saveMutation = useMutation({
    mutationFn: (settings: Settings) => api.put("/api/admin/settings", { settings }),
    onSuccess: () => {
      toast.success("Settings saved successfully");
      setEdits({});
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to save settings"),
  });

  const base = data?.settings ?? {};
  const form: Settings = { ...base, ...edits };
  const hasChanges = Object.keys(edits).length > 0;

  const update = (key: string, value: string | number | boolean) => {
    setEdits((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    if (!hasChanges) return;
    saveMutation.mutate(edits);
  };

  const handleReset = () => {
    setEdits({});
    toast.info("Changes discarded");
  };

  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <FadeIn>
          <div className="min-w-0">
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Admin Console</span>
            <h1 className="h2-responsive mt-1 font-bold tracking-tight">Settings</h1>
            <p className="body-responsive text-muted-foreground">Platform configuration & security policy</p>
          </div>
        </FadeIn>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <FadeIn>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Admin Console</span>
            <h1 className="h2-responsive mt-1 font-bold tracking-tight">Settings</h1>
            <p className="body-responsive text-muted-foreground">Platform configuration & security policy</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {hasChanges && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                <Badge className="border-gold/30 bg-gold/10 text-gold shimmer-badge">
                  Unsaved changes
                </Badge>
              </motion.div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={!hasChanges || saveMutation.isPending}
              className="border-border/60 tap-target-sm"
            >
              Reset
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!hasChanges || saveMutation.isPending}
              className="bg-gold-gradient text-black hover:opacity-90 gap-1.5 tap-target-sm"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save Changes
            </Button>
          </div>
        </div>
      </FadeIn>

      {/* System Stats Row */}
      <FadeIn delay={0.03}>
        <div className="grid grid-cols-2 gap-3 sm:gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <MetricTile
            label="Admins"
            value={stats?.admins ?? "—"}
            icon={<Shield className="h-4 w-4" />}
            accent="gold"
          />
          <MetricTile
            label="Investors"
            value={stats?.investors ?? "—"}
            icon={<Users className="h-4 w-4" />}
            accent="profit"
          />
          <MetricTile
            label="Transactions"
            value={stats?.transactions ?? "—"}
            icon={<Activity className="h-4 w-4" />}
            accent="gold"
          />
          <MetricTile
            label="NAV Points"
            value={stats?.navPoints ?? "—"}
            icon={<Database className="h-4 w-4" />}
            accent="profit"
          />
          <MetricTile
            label="DB Size"
            value={stats ? formatBytes(stats.dbSizeBytes) : "—"}
            icon={<Cpu className="h-4 w-4" />}
            accent="gold"
          />
        </div>
      </FadeIn>

      {/* General Settings */}
      <FadeIn delay={0.05}>
        <GlassCard gold className="p-3 sm:p-4 lg:p-6">
          <SettingsSectionHeader
            num="01"
            title="General Configuration"
            subtitle="Platform identity and operational settings"
            icon={<SettingsIcon className="h-4 w-4" />}
          />
          <div className="mt-5 grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2">
            <Field label="Platform Name" icon={<Globe className="h-3.5 w-3.5" />}>
              <Input
                value={String(form.platformName ?? "")}
                onChange={(e) => update("platformName", e.target.value)}
                className="border-border/60 bg-black/30"
              />
            </Field>
            <Field label="Support Email" icon={<Mail className="h-3.5 w-3.5" />}>
              <Input
                type="email"
                value={String(form.supportEmail ?? "")}
                onChange={(e) => update("supportEmail", e.target.value)}
                className="border-border/60 bg-black/30"
              />
            </Field>
            <Field label="Environment" icon={<Server className="h-3.5 w-3.5" />}>
              <div className="flex gap-2">
                {["production", "staging", "development"].map((env) => (
                  <button
                    key={env}
                    onClick={() => update("environment", env)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium capitalize transition-all ${
                      form.environment === env
                        ? "border-gold/50 bg-gold/10 text-gold shadow-[0_0_12px_rgba(212,175,55,0.15)]"
                        : "border-border/40 bg-black/20 text-muted-foreground hover:border-gold/30 hover:text-foreground"
                    }`}
                  >
                    {env}
                  </button>
                ))}
              </div>
            </Field>
            <ToggleField
              label="Maintenance Mode"
              description="Temporarily disable investor access for updates"
              icon={<Power className="h-3.5 w-3.5" />}
              checked={Boolean(form.maintenanceMode)}
              onChange={(v) => update("maintenanceMode", v)}
              danger
            />
          </div>
        </GlassCard>
      </FadeIn>

      {/* Security Policy */}
      <FadeIn delay={0.07}>
        <GlassCard gold glow className="p-3 sm:p-4 lg:p-6">
          <SettingsSectionHeader
            num="02"
            title="Security Policy"
            subtitle="Authentication, session, and access controls"
            icon={<Shield className="h-4 w-4" />}
          />
          <div className="mt-5 grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2">
            <Field label="Minimum Password Length" icon={<KeyRound className="h-3.5 w-3.5" />}>
              <Input
                type="number"
                min={6}
                max={32}
                value={Number(form.passwordMinLength ?? 8)}
                onChange={(e) => update("passwordMinLength", parseInt(e.target.value) || 8)}
                className="border-border/60 bg-black/30"
              />
            </Field>
            <Field label="Session Timeout (minutes)" icon={<Clock className="h-3.5 w-3.5" />}>
              <Input
                type="number"
                min={5}
                max={1440}
                value={Number(form.sessionTimeoutMin ?? 30)}
                onChange={(e) => update("sessionTimeoutMin", parseInt(e.target.value) || 30)}
                className="border-border/60 bg-black/30"
              />
            </Field>
            <Field label="Max Login Attempts" icon={<Lock className="h-3.5 w-3.5" />}>
              <Input
                type="number"
                min={3}
                max={10}
                value={Number(form.maxLoginAttempts ?? 5)}
                onChange={(e) => update("maxLoginAttempts", parseInt(e.target.value) || 5)}
                className="border-border/60 bg-black/30"
              />
            </Field>
            <Field label="IP Allowlist (comma-separated)" icon={<Eye className="h-3.5 w-3.5" />}>
              <Input
                value={String(form.ipAllowlist ?? "")}
                onChange={(e) => update("ipAllowlist", e.target.value)}
                placeholder="e.g. 192.168.1.0/24, 10.0.0.5"
                className="border-border/60 bg-black/30 font-mono text-xs"
              />
            </Field>
            <ToggleField
              label="Enforce 2FA for all users"
              description="Require two-factor authentication platform-wide"
              icon={<Shield className="h-3.5 w-3.5" />}
              checked={Boolean(form.enforce2FA)}
              onChange={(v) => update("enforce2FA", v)}
            />
          </div>
          {Boolean(form.enforce2FA) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-4 flex items-start gap-2 rounded-lg border border-gold/20 bg-gold/5 p-3 text-xs text-muted-foreground"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
              <span>
                <span className="text-gold font-semibold">2FA enforcement is active.</span> All users
                will be required to set up two-factor authentication on their next login. Ensure
                users have authenticator apps ready before enabling.
              </span>
            </motion.div>
          )}
        </GlassCard>
      </FadeIn>

      {/* Fee Configuration */}
      <FadeIn delay={0.09}>
        <GlassCard className="p-3 sm:p-4 lg:p-6">
          <SettingsSectionHeader
            num="03"
            title="Fee Structure"
            subtitle="Fund management and performance fees"
            icon={<DollarSign className="h-4 w-4" />}
          />
          <div className="mt-5 grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2">
            <Field label="Management Fee (% annualized)" icon={<DollarSign className="h-3.5 w-3.5" />}>
              <div className="relative">
                <Input
                  type="number"
                  step="0.1"
                  min={0}
                  max={10}
                  value={Number(form.managementFeePct ?? 2)}
                  onChange={(e) => update("managementFeePct", parseFloat(e.target.value) || 0)}
                  className="border-border/60 bg-black/30 pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
              </div>
            </Field>
            <Field label="Performance Fee (% of profits)" icon={<DollarSign className="h-3.5 w-3.5" />}>
              <div className="relative">
                <Input
                  type="number"
                  step="0.1"
                  min={0}
                  max={50}
                  value={Number(form.performanceFeePct ?? 20)}
                  onChange={(e) => update("performanceFeePct", parseFloat(e.target.value) || 0)}
                  className="border-border/60 bg-black/30 pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
              </div>
            </Field>
            <Field label="Minimum Investment (USD)" icon={<DollarSign className="h-3.5 w-3.5" />}>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <Input
                  type="number"
                  step="1000"
                  min={0}
                  value={Number(form.minInvestment ?? 50000)}
                  onChange={(e) => update("minInvestment", parseInt(e.target.value) || 0)}
                  className="border-border/60 bg-black/30 pl-7"
                />
              </div>
            </Field>
            <ToggleField
              label="High-Water Mark"
              description="Performance fee only charged on new profits above previous peak"
              icon={<Activity className="h-3.5 w-3.5" />}
              checked={Boolean(form.highWaterMark)}
              onChange={(v) => update("highWaterMark", v)}
            />
          </div>
          <Separator className="my-5 bg-border/40" />
          <div className="rounded-lg border border-gold/15 bg-gold/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-4 w-4 text-gold" />
              <span className="text-sm font-semibold text-gold">Fee Preview</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              <FeePreview label="On $100K" mgmtFee={Number(form.managementFeePct ?? 2)} perfFee={Number(form.performanceFeePct ?? 20)} amount={100000} />
              <FeePreview label="On $500K" mgmtFee={Number(form.managementFeePct ?? 2)} perfFee={Number(form.performanceFeePct ?? 20)} amount={500000} />
              <FeePreview label="On $1M" mgmtFee={Number(form.managementFeePct ?? 2)} perfFee={Number(form.performanceFeePct ?? 20)} amount={1000000} />
              <FeePreview label="On $5M" mgmtFee={Number(form.managementFeePct ?? 2)} perfFee={Number(form.performanceFeePct ?? 20)} amount={5000000} />
            </div>
          </div>
        </GlassCard>
      </FadeIn>

      {/* Deposit Limits */}
      <FadeIn delay={0.11}>
        <GlassCard className="p-3 sm:p-4 lg:p-6">
          <SettingsSectionHeader
            num="04"
            title="Deposit Limits"
            subtitle="Minimum deposit thresholds for INR and crypto"
            icon={<DollarSign className="h-4 w-4" />}
          />
          <div className="mt-5 grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2">
            <Field label="Minimum INR Deposit (UPI)" icon={<DollarSign className="h-3.5 w-3.5" />}>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                <Input
                  type="number"
                  step={100}
                  min={0}
                  value={Number(form.minInrDeposit ?? 1000)}
                  onChange={(e) => update("minInrDeposit", parseInt(e.target.value) || 0)}
                  className="border-border/60 bg-black/30 pl-7 font-metric"
                />
              </div>
            </Field>
            <Field label="Minimum Crypto Deposit (USD equivalent)" icon={<DollarSign className="h-3.5 w-3.5" />}>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <Input
                  type="number"
                  step={1}
                  min={0}
                  value={Number(form.minCryptoDepositUsd ?? 10)}
                  onChange={(e) => update("minCryptoDepositUsd", parseFloat(e.target.value) || 0)}
                  className="border-border/60 bg-black/30 pl-7 font-metric"
                />
              </div>
            </Field>
          </div>
          <Separator className="my-5 bg-border/40" />
          <div className="rounded-lg border border-gold/15 bg-gold/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-4 w-4 text-gold" />
              <span className="text-sm font-semibold text-gold">Supported Methods</span>
            </div>
            <div className="text-xs text-muted-foreground leading-relaxed">
              <span className="text-foreground">Supported Crypto:</span>{" "}
              <span className="font-mono text-gold/90">BTC · LTC · USDT (TRC20)</span>
              <br />
              Validation uses live CoinGecko prices. USDT validated 1:1 against USD.
            </div>
          </div>
        </GlassCard>
      </FadeIn>

      {/* Notification Settings */}
      <FadeIn delay={0.13}>
        <GlassCard className="p-3 sm:p-4 lg:p-6">
          <SettingsSectionHeader
            num="05"
            title="Notifications"
            subtitle="Admin alert routing and investor notifications"
            icon={<Bell className="h-4 w-4" />}
          />
          <div className="mt-5 grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2">
            <Field label="Admin Alert Email" icon={<Mail className="h-3.5 w-3.5" />}>
              <Input
                type="email"
                value={String(form.adminAlertEmail ?? "")}
                onChange={(e) => update("adminAlertEmail", e.target.value)}
                className="border-border/60 bg-black/30"
              />
            </Field>
            <div className="flex items-end">
              <ToggleField
                label="Email Notifications"
                description="Send transactional emails to investors"
                icon={<Mail className="h-3.5 w-3.5" />}
                checked={Boolean(form.emailNotifications)}
                onChange={(v) => update("emailNotifications", v)}
              />
            </div>
            <ToggleField
              label="Deposit Alerts"
              description="Notify admins when new deposits are requested"
              icon={<DollarSign className="h-3.5 w-3.5" />}
              checked={Boolean(form.depositAlertEnabled)}
              onChange={(v) => update("depositAlertEnabled", v)}
            />
            <ToggleField
              label="Withdrawal Alerts"
              description="Notify admins when withdrawals are requested"
              icon={<DollarSign className="h-3.5 w-3.5" />}
              checked={Boolean(form.withdrawalAlertEnabled)}
              onChange={(v) => update("withdrawalAlertEnabled", v)}
            />
          </div>
        </GlassCard>
      </FadeIn>

      {/* Danger Zone */}
      <FadeIn delay={0.15}>
        <GlassCard className="border-loss/20 p-3 sm:p-4 lg:p-6">
          <SettingsSectionHeader
            num="06"
            title="Danger Zone"
            subtitle="Irreversible platform operations"
            icon={<AlertTriangle className="h-4 w-4" />}
            danger
          />
          <div className="mt-5 space-y-3">
            <DangerRow
              title="Clear Application Cache"
              description="Purge in-memory caches and force data refresh. No data is lost."
              actionLabel="Clear Cache"
              onAction={() => toast.success("Application cache cleared")}
            />
            <Separator className="bg-border/40" />
            <DangerRow
              title="Re-seed Demo Data"
              description="Re-run the seed script to restore demo investor, fund data, and documents."
              actionLabel="Re-seed"
              onAction={() => toast.info("Use the seed API endpoint to re-seed demo data")}
            />
          </div>
        </GlassCard>
      </FadeIn>

      {/* Sticky save bar */}
      <AnimatePresence>
        {hasChanges && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-3 left-3 right-3 sm:bottom-4 sm:left-1/2 sm:right-auto z-50 sm:-translate-x-1/2 safe-area-bottom"
          >
            <div className="flex items-center gap-2 sm:gap-3 rounded-2xl sm:rounded-full border border-gold/30 bg-popover/95 px-3 sm:px-5 py-2.5 shadow-[0_0_24px_rgba(212,175,55,0.2)] backdrop-blur-md">
              <span className="hidden sm:inline text-xs text-muted-foreground">You have unsaved changes</span>
              <span className="sm:hidden text-xs text-muted-foreground flex-1">Unsaved changes</span>
              <Button size="sm" variant="ghost" onClick={handleReset} className="h-8 sm:h-7 text-xs tap-target-sm">
                Discard
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="h-8 sm:h-7 bg-gold-gradient text-black hover:opacity-90 tap-target-sm"
              >
                {saveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Save
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
   Sub-components
   ────────────────────────────────────────────────────────────────────────────── */

function SettingsSectionHeader({
  num, title, subtitle, icon, danger,
}: {
  num: string; title: string; subtitle: string; icon?: React.ReactNode; danger?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className={`number-badge ${danger ? "border-loss/30 bg-loss/10 text-loss" : ""}`}>{num}</span>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          {icon && <span className={danger ? "text-loss" : "text-gold"}>{icon}</span>}
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        {icon} {label}
      </Label>
      {children}
    </div>
  );
}

function ToggleField({
  label, description, icon, checked, onChange, danger,
}: {
  label: string; description: string; icon?: React.ReactNode;
  checked: boolean; onChange: (v: boolean) => void; danger?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-3 rounded-lg border p-3.5 transition-colors ${
      danger && checked
        ? "border-loss/30 bg-loss/5"
        : checked
          ? "border-gold/20 bg-gold/5"
          : "border-border/40 bg-black/20"
    }`}>
      <div className="flex items-start gap-2.5">
        {icon && (
          <div className={`mt-0.5 ${danger && checked ? "text-loss" : checked ? "text-gold" : "text-muted-foreground"}`}>
            {icon}
          </div>
        )}
        <div>
          <div className="text-sm font-medium text-foreground">{label}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{description}</div>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function FeePreview({ label, mgmtFee, perfFee, amount }: { label: string; mgmtFee: number; perfFee: number; amount: number }) {
  const annual = (amount * mgmtFee) / 100;
  const perf = (amount * 0.15 * perfFee) / 100; // assume 15% gain
  return (
    <div className="rounded-lg border border-border/40 bg-black/30 p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-metric text-sm font-semibold text-gold">
        ${annual.toLocaleString("en-US", { maximumFractionDigits: 0 })}
        <span className="text-[10px] text-muted-foreground font-normal">/yr mgmt</span>
      </div>
      <div className="text-[11px] text-profit">
        +${perf.toLocaleString("en-US", { maximumFractionDigits: 0 })} perf*
      </div>
    </div>
  );
}

function DangerRow({ title, description, actionLabel, onAction }: { title: string; description: string; actionLabel: string; onAction: () => void }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-sm font-medium text-foreground">{title}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">{description}</div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onAction}
        className="border-loss/30 text-loss hover:bg-loss/10 hover:text-loss gap-1.5 shrink-0"
      >
        {actionLabel}
      </Button>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
