"use client";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api-client";
import { GlassCard, SectionTitle } from "@/components/brand/primitives";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, KeyRound, QrCode, Loader2, ShieldAlert, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";

interface TwoFactorSectionProps {
  enabled: boolean;
  onChanged: () => void;
}

export function TwoFactorSection({ enabled, onChanged }: TwoFactorSectionProps) {
  const [stage, setStage] = useState<"idle" | "setup" | "disabling">("idle");
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const startSetup = async () => {
    setBusy(true);
    try {
      const res = await api.post<{ qr: string; secret: string; uri: string }>("/api/auth/2fa/setup");
      setQr(res.qr);
      setSecret(res.secret);
      setStage("setup");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start 2FA setup");
    } finally {
      setBusy(false);
    }
  };

  const cancelSetup = async () => {
    try {
      await api.del("/api/auth/2fa/setup");
    } catch {
      /* ignore */
    }
    setQr(null);
    setSecret(null);
    setCode("");
    setStage("idle");
  };

  const verify = async () => {
    if (code.length !== 6) {
      toast.error("Enter the 6-digit code");
      return;
    }
    setBusy(true);
    try {
      await api.post("/api/auth/2fa/verify", { code });
      toast.success("Two-factor authentication enabled");
      setQr(null);
      setSecret(null);
      setCode("");
      setStage("idle");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invalid verification code");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (code.length !== 6) {
      toast.error("Enter your current 6-digit code to disable");
      return;
    }
    setBusy(true);
    try {
      await api.post("/api/auth/2fa/disable", { code });
      toast.success("Two-factor authentication disabled");
      setCode("");
      setStage("idle");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invalid verification code");
    } finally {
      setBusy(false);
    }
  };

  return (
    <GlassCard className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <SectionTitle
            title="Two-Factor Authentication"
            subtitle="Add an authenticator-based second factor"
          />
          <div className="mt-3 flex items-center gap-2">
            {enabled ? (
              <Badge className="border-profit/30 bg-profit/10 text-profit">
                <ShieldCheck className="mr-1 h-3 w-3" /> Enabled
              </Badge>
            ) : (
              <Badge className="border-gold/30 bg-gold/10 text-gold">
                <ShieldAlert className="mr-1 h-3 w-3" /> Recommended
              </Badge>
            )}
          </div>
        </div>
        <div className="hidden sm:block">
          <div className={`flex h-12 w-12 items-center justify-center rounded-full border ${enabled ? "border-profit/30 bg-profit/5" : "border-gold/30 bg-gold/5"}`}>
            {enabled ? <ShieldCheck className="h-6 w-6 text-profit" /> : <KeyRound className="h-6 w-6 text-gold" />}
          </div>
        </div>
      </div>

      <div className="mt-5">
        {enabled ? (
          stage === "disabling" ? (
            <div className="space-y-4 rounded-lg border border-loss/20 bg-loss/5 p-4">
              <div className="text-sm text-foreground/90">
                Enter your current 6-digit code to disable 2FA. <span className="text-loss">This will reduce account security.</span>
              </div>
              <InputOTP maxLength={6} value={code} onChange={setCode}>
                <InputOTPGroup className="gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <InputOTPSlot key={i} index={i} className="h-11 w-11 border-loss/30 bg-black/40 text-gold" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setStage("idle"); setCode(""); }} className="border-border/60">
                  Cancel
                </Button>
                <Button onClick={disable} disabled={busy || code.length !== 6} className="bg-loss/90 text-white hover:bg-loss">
                  {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                  Disable 2FA
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setStage("disabling")} className="border-loss/30 text-loss hover:bg-loss/10">
              Disable 2FA
            </Button>
          )
        ) : stage === "setup" ? (
          <div className="space-y-5">
            <div className="flex flex-col items-center gap-4 rounded-lg border border-gold/20 bg-gold/5 p-5 sm:flex-row sm:items-start">
              {qr ? (
                <div className="rounded-lg border border-gold/30 bg-white p-2">
                  <img src={qr} alt="2FA QR code" className="h-40 w-40" />
                </div>
              ) : (
                <div className="flex h-40 w-40 items-center justify-center rounded-lg border border-gold/30 bg-black/40">
                  <QrCode className="h-12 w-12 text-gold/50" />
                </div>
              )}
              <div className="flex-1 text-center sm:text-left">
                <h4 className="text-sm font-semibold text-foreground">Scan with your authenticator app</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  Use Google Authenticator, Authy, 1Password or any TOTP-compatible app.
                </p>
                {secret && (
                  <div className="mt-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Or enter manually</div>
                    <code className="mt-1 block rounded bg-black/50 px-2 py-1.5 font-mono text-xs text-gold break-all border border-gold/20">
                      {secret}
                    </code>
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
                Enter the 6-digit code shown in your app
              </div>
              <InputOTP maxLength={6} value={code} onChange={setCode}>
                <InputOTPGroup className="gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <InputOTPSlot key={i} index={i} className="h-11 w-11 border-gold/30 bg-black/40 text-lg text-gold" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={cancelSetup} className="border-border/60">
                <X className="mr-1.5 h-4 w-4" /> Cancel
              </Button>
              <Button onClick={verify} disabled={busy || code.length !== 6} className="bg-gold-gradient text-black hover:opacity-90">
                {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
                Verify & Enable
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Add an extra layer of security. After enabling, you&apos;ll need a 6-digit code from your authenticator app at every login.
            </p>
            <Button onClick={startSetup} disabled={busy} className="bg-gold-gradient text-black hover:opacity-90">
              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <KeyRound className="mr-1.5 h-4 w-4" />}
              Setup 2FA
            </Button>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
