"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api-client";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GlassCard } from "@/components/brand/primitives";
import { ArrowLeft, ArrowRight, Lock, Mail, Shield, User } from "lucide-react";
import { toast } from "sonner";

type Mode = "login" | "signup" | "forgot";

export function AuthScreen({ mode }: { mode: Mode }) {
  const setRoute = useApp((s) => s.setRoute);
  const refresh = useApp((s) => s.refresh);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        await api.post("/api/auth/signup", form);
        toast.success("Account created. Welcome to Nightmare Invest.");
      } else if (mode === "login") {
        await api.post("/api/auth/login", { email: form.email, password: form.password });
        toast.success("Authenticated. Accessing your portal.");
      } else {
        await api.post("/api/auth/password-reset", { email: form.email, newPassword: form.password || undefined });
        toast.success("If the account exists, your password has been updated.");
        setRoute({ name: "login" });
        setLoading(false);
        return;
      }
      await refresh();
      // Navigate to the appropriate portal
      const me = useApp.getState().user;
      setRoute(me?.role === "ADMIN" ? { name: "admin-dashboard" } : { name: "dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const titles = {
    login: { title: "Investor Login", sub: "Access your private portal" },
    signup: { title: "Request Access", sub: "Create your investor account" },
    forgot: { title: "Reset Password", sub: "Recover access to your account" },
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12">
      <div className="absolute inset-0 bg-grid bg-grid-fade opacity-40" />
      <div className="absolute -top-32 left-1/2 h-80 w-[600px] -translate-x-1/2 rounded-full bg-gold/10 blur-[120px]" />

      <button
        onClick={() => setRoute({ name: "landing" })}
        className="absolute left-4 top-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground sm:left-6 sm:top-6"
      >
        <ArrowLeft className="h-4 w-4" /> Back to home
      </button>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size={40} />
          <h1 className="mt-6 text-2xl font-bold tracking-tight">{titles[mode].title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{titles[mode].sub}</p>
        </div>

        <GlassCard gold glow className="p-7">
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
                    className="border-border/60 bg-black/30 pl-9"
                  />
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs uppercase tracking-wider text-muted-foreground">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@family-office.com"
                  className="border-border/60 bg-black/30 pl-9"
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
                    className="border-border/60 bg-black/30 pl-9"
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
                    className="border-border/60 bg-black/30 pl-9"
                  />
                </div>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gold-gradient text-black hover:opacity-90"
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

          <div className="mt-5 flex items-center justify-between text-xs">
            {mode === "login" ? (
              <>
                <button onClick={() => setRoute({ name: "forgot" })} className="text-muted-foreground hover:text-gold">
                  Forgot password?
                </button>
                <button onClick={() => setRoute({ name: "signup" })} className="text-gold hover:underline">
                  Request access →
                </button>
              </>
            ) : mode === "signup" ? (
              <button onClick={() => setRoute({ name: "login" })} className="mx-auto text-muted-foreground hover:text-gold">
                Already an investor? <span className="text-gold">Login →</span>
              </button>
            ) : (
              <button onClick={() => setRoute({ name: "login" })} className="mx-auto text-muted-foreground hover:text-gold">
                Back to login
              </button>
            )}
          </div>
        </GlassCard>

        <div className="mt-5 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
          <Shield className="h-3.5 w-3.5 text-gold/60" />
          <span>Protected by 256-bit encryption · Session secured with JWT</span>
        </div>

        {mode === "login" && (
          <div className="mt-4 rounded-lg border border-gold/15 bg-gold/5 p-3 text-center text-[11px] text-muted-foreground">
            <span className="text-gold">Demo investor:</span> investor@nightmare.invest · investor123
          </div>
        )}
      </motion.div>
    </div>
  );
}
