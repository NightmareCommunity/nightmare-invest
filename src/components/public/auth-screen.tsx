"use client";
import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api-client";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { GlassCard } from "@/components/brand/primitives";
import { ArrowLeft, ArrowRight, Lock, Mail, Shield, ShieldCheck, User } from "lucide-react";
import { toast } from "sonner";

type Mode = "login" | "signup" | "forgot";

export function AuthScreen({ mode }: { mode: Mode }) {
  const setRoute = useApp((s) => s.setRoute);
  const refresh = useApp((s) => s.refresh);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  // 2FA challenge state
  const [challenge, setChallenge] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");

  // Ensure the platform admin account exists (idempotent bootstrap).
  // Fires once on mount so a fresh database always has the seeded admin.
  useEffect(() => {
    api.get("/api/bootstrap").catch(() => {
      /* silent — best-effort */
    });
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        await api.post("/api/auth/signup", form);
        toast.success("Account created. Welcome to Nightmare Invest.");
        await refresh();
        const me = useApp.getState().user;
        setRoute(me?.role === "ADMIN" ? { name: "admin-dashboard" } : { name: "dashboard" });
      } else if (mode === "login") {
        const res = await api.post<{ requiresTwoFactor?: boolean; challenge?: string }>(
          "/api/auth/login",
          { email: form.email, password: form.password }
        );
        if (res.requiresTwoFactor && res.challenge) {
          setChallenge(res.challenge);
          toast.info("Two-factor authentication required");
        } else {
          toast.success("Authenticated. Accessing your portal.");
          await refresh();
          const me = useApp.getState().user;
          setRoute(me?.role === "ADMIN" ? { name: "admin-dashboard" } : { name: "dashboard" });
        }
      } else {
        await api.post("/api/auth/password-reset", { email: form.email, newPassword: form.password || undefined });
        toast.success("If the account exists, your password has been updated.");
        setRoute({ name: "login" });
        setLoading(false);
        return;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const submit2fa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totpCode.length !== 6) {
      toast.error("Enter the 6-digit code");
      return;
    }
    setLoading(true);
    try {
      await api.post("/api/auth/login", { challenge, totpCode });
      toast.success("Authenticated. Accessing your portal.");
      await refresh();
      const me = useApp.getState().user;
      setRoute(me?.role === "ADMIN" ? { name: "admin-dashboard" } : { name: "dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid verification code");
    } finally {
      setLoading(false);
    }
  };

  const titles = {
    login: { title: "Investor Login", sub: "Access your private portal" },
    signup: { title: "Request Access", sub: "Create your investor account" },
    forgot: { title: "Reset Password", sub: "Recover access to your account" },
  };

  if (challenge) {
    return (
      <TwoFactorChallenge
        code={totpCode}
        setCode={setTotpCode}
        onSubmit={submit2fa}
        onCancel={() => {
          setChallenge(null);
          setTotpCode("");
        }}
        loading={loading}
      />
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-16 sm:py-12 safe-area-top safe-area-bottom">
      <div className="absolute inset-0 bg-grid bg-grid-fade opacity-40" />
      <div className="absolute -top-32 left-1/2 h-80 w-[600px] -translate-x-1/2 rounded-full bg-gold/10 blur-[120px]" />

      <button
        onClick={() => setRoute({ name: "landing" })}
        className="absolute left-4 top-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground sm:left-6 sm:top-6 tap-target-sm"
      >
        <ArrowLeft className="h-4 w-4" /> Back to home
      </button>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-[95vw] sm:max-w-md"
      >
        <div className="mb-6 sm:mb-8 flex flex-col items-center text-center">
          <Logo size={40} />
          <h1 className="mt-5 sm:mt-6 h2-responsive font-bold tracking-tight">{titles[mode].title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{titles[mode].sub}</p>
        </div>

        <GlassCard gold glow className="p-5 sm:p-7">
          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs uppercase tracking-wider text-muted-foreground">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="name"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Alexander Whitmore"
                    className="border-border/60 bg-black/30 pl-9 h-12"
                  />
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs uppercase tracking-wider text-muted-foreground">
                {mode === "login" ? "Email or Username" : "Email"}
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type={mode === "login" ? "text" : "email"}
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder={mode === "login" ? "ojas1234 or you@family-office.com" : "you@family-office.com"}
                  className="border-border/60 bg-black/30 pl-9 h-12"
                  autoComplete={mode === "login" ? "username" : "email"}
                />
              </div>
            </div>
            {mode !== "forgot" && (
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs uppercase tracking-wider text-muted-foreground">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    required
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="••••••••"
                    className="border-border/60 bg-black/30 pl-9 h-12"
                  />
                </div>
                {mode === "signup" && <p className="text-[11px] text-muted-foreground">Minimum 8 characters</p>}
              </div>
            )}
            {mode === "forgot" && (
              <div className="space-y-1.5">
                <Label htmlFor="newpass" className="text-xs uppercase tracking-wider text-muted-foreground">New Password (optional)</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="newpass"
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Leave blank to email reset link"
                    className="border-border/60 bg-black/30 pl-9 h-12"
                  />
                </div>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-gold-gradient text-black hover:opacity-90 tap-target"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-black/40 border-t-black" />
                  Processing…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  {mode === "login" ? "Access Portal" : mode === "signup" ? "Create Account" : "Reset Password"}
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </form>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-xs">
            {mode === "login" ? (
              <>
                <button onClick={() => setRoute({ name: "forgot" })} className="text-muted-foreground hover:text-gold tap-target-sm">
                  Forgot password?
                </button>
                <button onClick={() => setRoute({ name: "signup" })} className="text-gold hover:underline tap-target-sm">
                  Request access →
                </button>
              </>
            ) : mode === "signup" ? (
              <button onClick={() => setRoute({ name: "login" })} className="mx-auto text-muted-foreground hover:text-gold tap-target-sm">
                Already an investor? <span className="text-gold">Login →</span>
              </button>
            ) : (
              <button onClick={() => setRoute({ name: "login" })} className="mx-auto text-muted-foreground hover:text-gold tap-target-sm">
                Back to login
              </button>
            )}
          </div>
        </GlassCard>

        <div className="mt-5 flex items-center justify-center gap-2 text-[11px] text-muted-foreground text-center px-2">
          <Shield className="h-3.5 w-3.5 shrink-0 text-gold/60" />
          <span>Protected by 256-bit encryption · Session secured with JWT</span>
        </div>

        {mode === "login" && (
          <div className="mt-4 space-y-2">
            <div className="rounded-lg border border-gold/20 bg-gold/5 p-3 text-center text-[11px] text-muted-foreground break-words-mobile">
              <span className="text-gold">Admin:</span> ojas1234 · user1122
            </div>
            <div className="rounded-lg border border-border/40 bg-black/20 p-3 text-center text-[11px] text-muted-foreground break-words-mobile">
              <span className="text-foreground/70">Demo investor:</span> investor@nightmare.invest · investor123
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function TwoFactorChallenge({
  code,
  setCode,
  onSubmit,
  onCancel,
  loading,
}: {
  code: string;
  setCode: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const setRoute = useApp((s) => s.setRoute);
  const otpRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Focus the OTP input shortly after mount
    const t = setTimeout(() => {
      const input = otpRef.current?.querySelector("input");
      input?.focus();
    }, 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-16 sm:py-12 safe-area-top safe-area-bottom">
      <div className="absolute inset-0 bg-grid bg-grid-fade opacity-40" />
      <div className="absolute -top-32 left-1/2 h-80 w-[600px] -translate-x-1/2 rounded-full bg-gold/10 blur-[120px]" />

      <button
        onClick={() => setRoute({ name: "landing" })}
        className="absolute left-4 top-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground sm:left-6 sm:top-6 tap-target-sm"
      >
        <ArrowLeft className="h-4 w-4" /> Back to home
      </button>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-[95vw] sm:max-w-md"
      >
        <div className="mb-6 sm:mb-8 flex flex-col items-center text-center">
          <Logo size={40} />
          <div className="mt-5 sm:mt-6 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full border border-gold/30 bg-gold/5">
            <ShieldCheck className="h-6 w-6 sm:h-7 sm:w-7 text-gold" />
          </div>
          <h1 className="mt-3 sm:mt-4 h2-responsive font-bold tracking-tight">Two-Factor Verification</h1>
          <p className="mt-1 text-sm text-muted-foreground px-2">
            Enter the 6-digit code from your authenticator app
          </p>
        </div>

        <GlassCard gold glow className="p-5 sm:p-7">
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="flex justify-center overflow-x-auto scroll-row py-2" ref={otpRef}>
              <InputOTP
                maxLength={6}
                value={code}
                onChange={(v) => setCode(v)}
              >
                <InputOTPGroup className="gap-1.5 sm:gap-2">
                  <InputOTPSlot index={0} className="h-10 w-10 sm:h-12 sm:w-12 border-gold/30 bg-black/40 text-base sm:text-lg text-gold" />
                  <InputOTPSlot index={1} className="h-10 w-10 sm:h-12 sm:w-12 border-gold/30 bg-black/40 text-base sm:text-lg text-gold" />
                  <InputOTPSlot index={2} className="h-10 w-10 sm:h-12 sm:w-12 border-gold/30 bg-black/40 text-base sm:text-lg text-gold" />
                  <InputOTPSlot index={3} className="h-10 w-10 sm:h-12 sm:w-12 border-gold/30 bg-black/40 text-base sm:text-lg text-gold" />
                  <InputOTPSlot index={4} className="h-10 w-10 sm:h-12 sm:w-12 border-gold/30 bg-black/40 text-base sm:text-lg text-gold" />
                  <InputOTPSlot index={5} className="h-10 w-10 sm:h-12 sm:w-12 border-gold/30 bg-black/40 text-base sm:text-lg text-gold" />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full h-12 bg-gold-gradient text-black hover:opacity-90 tap-target"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-black/40 border-t-black" />
                  Verifying…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Verify & Continue
                </span>
              )}
            </Button>

            <button
              type="button"
              onClick={onCancel}
              className="w-full text-center text-xs text-muted-foreground hover:text-gold tap-target-sm"
            >
              Use a different account
            </button>
          </form>
        </GlassCard>

        <div className="mt-5 flex items-center justify-center gap-2 text-[11px] text-muted-foreground text-center px-2">
          <Shield className="h-3.5 w-3.5 shrink-0 text-gold/60" />
          <span>Two-factor authentication protects your institutional account</span>
        </div>
      </motion.div>
    </div>
  );
}
