"use client";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api-client";
import { GlassCard, SectionTitle, FadeIn } from "@/components/brand/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { fmtDate } from "@/lib/format";
import { Shield, KeyRound, LogOut, Mail, User, Clock, Lock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export function SettingsPage() {
  const user = useApp((s) => s.user);
  const logout = useApp((s) => s.logout);
  const [newPass, setNewPass] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  return (
    <div className="space-y-6">
      <FadeIn>
        <div>
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Investor Portal</span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your account and security</p>
        </div>
      </FadeIn>

      <div className="grid gap-4 lg:grid-cols-3">
        <FadeIn delay={0.05} className="lg:col-span-2 space-y-4">
          {/* Profile */}
          <GlassCard className="p-6">
            <SectionTitle title="Profile" subtitle="Account information" />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
          </GlassCard>

          {/* Security */}
          <GlassCard className="p-6">
            <SectionTitle title="Security" subtitle="Update your password" />
            <div className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="newpass" className="text-xs uppercase tracking-wider text-muted-foreground">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="newpass"
                    type="password"
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    placeholder="••••••••"
                    className="border-border/60 bg-black/30 pl-9"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">Minimum 8 characters</p>
              </div>
              <Button onClick={reset} disabled={submitting} className="bg-gold-gradient text-black hover:opacity-90">
                <KeyRound className="mr-1.5 h-4 w-4" /> {submitting ? "Updating…" : "Update Password"}
              </Button>
            </div>
          </GlassCard>

          {/* Session */}
          <GlassCard className="p-6">
            <SectionTitle title="Session" subtitle="Authentication tokens" />
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-3 rounded-lg border border-profit/20 bg-profit/5 p-3">
                <CheckCircle2 className="h-5 w-5 text-profit" />
                <div>
                  <div className="text-sm font-medium text-foreground">Active session</div>
                  <div className="text-xs text-muted-foreground">Last login {user.lastLogin ? fmtDate(user.lastLogin, true) : "—"}</div>
                </div>
              </div>
              <Button variant="outline" onClick={logout} className="border-loss/30 text-loss hover:bg-loss/10">
                <LogOut className="mr-1.5 h-4 w-4" /> Sign out of all sessions
              </Button>
            </div>
          </GlassCard>
        </FadeIn>

        <FadeIn delay={0.1}>
          <GlassCard gold className="h-full p-6">
            <Shield className="h-8 w-8 text-gold" />
            <h3 className="mt-3 text-base font-semibold">Security Center</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Your account is protected by industry-grade encryption and JWT-based session management.
            </p>
            <Separator className="my-4 bg-border/60" />
            <ul className="space-y-3 text-sm">
              {[
                "256-bit encryption in transit (TLS 1.3)",
                "bcrypt password hashing (cost 12)",
                "HttpOnly secure session cookies",
                "Role-based access control (RBAC)",
                "Full audit trail of account activity",
              ].map((s) => (
                <li key={s} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                  <span className="text-foreground/90">{s}</span>
                </li>
              ))}
            </ul>
          </GlassCard>
        </FadeIn>
      </div>
    </div>
  );
}
