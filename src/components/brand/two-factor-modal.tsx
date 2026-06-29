"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp";
import { api } from "@/lib/api-client";
import { ShieldCheck, ShieldAlert, Loader2, ShieldX } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface TwoFactorModalProps {
  open: boolean;
  onClose: () => void;
  onVerified: () => void;
  /** Whether the user has 2FA enabled. If false, show enable prompt instead. */
  userHas2FA: boolean;
  /** Context description shown in the modal */
  purpose?: string;
}

export function TwoFactorModal({ open, onClose, onVerified, userHas2FA, purpose }: TwoFactorModalProps) {
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");

  const handleVerify = async () => {
    if (code.length !== 6) {
      setError("Please enter all 6 digits");
      return;
    }
    setVerifying(true);
    setError("");
    try {
      const result = await api.post<{ verified?: boolean; enabled?: boolean }>("/api/auth/2fa/verify", {
        code,
        purpose: purpose || "high-value-operation",
      });
      if (result.verified || result.enabled) {
        toast.success("2FA verification successful");
        setCode("");
        onVerified();
      } else {
        setError("Verification failed. Please try again.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid verification code");
    } finally {
      setVerifying(false);
    }
  };

  const handleClose = () => {
    if (!verifying) {
      setCode("");
      setError("");
      onClose();
    }
  };

  // If user doesn't have 2FA enabled, show enable prompt
  if (!userHas2FA) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="border-loss/20 bg-card/95 backdrop-blur-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldX className="h-5 w-5 text-loss" />
              2FA Required
            </DialogTitle>
            <DialogDescription>
              Two-factor authentication must be enabled to perform high-value operations (over $50,000).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3 rounded-lg border border-loss/20 bg-loss/5 p-4">
              <ShieldAlert className="h-8 w-8 shrink-0 text-loss" />
              <div>
                <div className="text-sm font-medium text-foreground">2FA Not Enabled</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Please enable two-factor authentication in your account settings before performing transactions exceeding $50,000.
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={handleClose}>Cancel</Button>
            <Button onClick={handleClose} className="bg-gold-gradient text-black hover:opacity-90">
              Go to Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="border-gold/20 bg-card/95 backdrop-blur-xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-gold" />
            Security Verification Required
          </DialogTitle>
          <DialogDescription>
            {purpose || "Verify your identity to proceed with this high-value operation."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          {/* Lock icon animation */}
          <div className="flex justify-center">
            <motion.div
              className="flex h-16 w-16 items-center justify-center rounded-full border border-gold/30 bg-gold/5"
              animate={{ boxShadow: ["0 0 0px rgba(212,175,55,0)", "0 0 20px rgba(212,175,55,0.2)", "0 0 0px rgba(212,175,55,0)"] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <ShieldCheck className="h-8 w-8 text-gold" />
            </motion.div>
          </div>

          {/* OTP Input */}
          <div className="flex flex-col items-center gap-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Enter 6-digit code
            </label>
            <InputOTP
              maxLength={6}
              value={code}
              onChange={(val) => { setCode(val); setError(""); }}
              disabled={verifying}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} className="h-12 w-12 border-border/60 bg-black/30 text-lg font-mono data-[active=true]:border-gold/50 data-[active=true]:ring-gold/20" />
                <InputOTPSlot index={1} className="h-12 w-12 border-border/60 bg-black/30 text-lg font-mono data-[active=true]:border-gold/50 data-[active=true]:ring-gold/20" />
                <InputOTPSlot index={2} className="h-12 w-12 border-border/60 bg-black/30 text-lg font-mono data-[active=true]:border-gold/50 data-[active=true]:ring-gold/20" />
              </InputOTPGroup>
              <InputOTPSeparator className="text-muted-foreground/30" />
              <InputOTPGroup>
                <InputOTPSlot index={3} className="h-12 w-12 border-border/60 bg-black/30 text-lg font-mono data-[active=true]:border-gold/50 data-[active=true]:ring-gold/20" />
                <InputOTPSlot index={4} className="h-12 w-12 border-border/60 bg-black/30 text-lg font-mono data-[active=true]:border-gold/50 data-[active=true]:ring-gold/20" />
                <InputOTPSlot index={5} className="h-12 w-12 border-border/60 bg-black/30 text-lg font-mono data-[active=true]:border-gold/50 data-[active=true]:ring-gold/20" />
              </InputOTPGroup>
            </InputOTP>
          </div>

          {/* Error message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="rounded-lg border border-loss/20 bg-loss/5 px-3 py-2 text-center text-xs text-loss"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="text-center text-[11px] text-muted-foreground">
            Open your authenticator app and enter the code to verify your identity.
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={handleClose} disabled={verifying}>Cancel</Button>
          <Button
            onClick={handleVerify}
            disabled={verifying || code.length !== 6}
            className="bg-gold-gradient text-black hover:opacity-90 press-scale"
          >
            {verifying ? (
              <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Verifying…</>
            ) : (
              <><ShieldCheck className="mr-1.5 h-4 w-4" /> Verify</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
