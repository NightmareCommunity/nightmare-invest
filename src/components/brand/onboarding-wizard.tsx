"use client";
import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard, FadeIn } from "@/components/brand/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  User, Shield, CreditCard, CheckCircle2, ChevronRight, ChevronLeft,
  Upload, FileText, Image as ImageIcon, Lock, Smartphone, Mail,
  DollarSign, X, ArrowRight, ArrowLeft, Loader2, AlertCircle,
  Globe, Briefcase, Phone, Check,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";

/* ──────────────────────────────────────────────────────────────────────────────
   ONBOARDING WIZARD — 4-step guided investor setup
   ────────────────────────────────────────────────────────────────────────────── */

interface OnboardingWizardProps {
  onComplete: () => void;
  onClose?: () => void;
}

const STEPS = [
  { id: 1, label: "Profile", icon: User, description: "Complete your profile" },
  // KYC step temporarily disabled — module removed from active onboarding.
  // The schema (KycDocument model, User.kyc* fields) is retained for clean
  // future reintroduction. See /home/z/my-project/worklog.md.
  { id: 2, label: "Security", icon: Lock, description: "Set up security" },
  { id: 3, label: "Deposit", icon: CreditCard, description: "Fund your account" },
];

export function OnboardingWizard({ onComplete, onClose }: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");

  // Step 1 state
  const [profile, setProfile] = useState({
    phone: "",
    country: "",
    investorType: "individual" as "individual" | "institutional" | "trust",
  });
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});

  // Step 2 state (Security) — formerly step 3; KYC step removed
  const [security, setSecurity] = useState({
    totpEnabled: false,
    recoveryEmail: "",
    verifyCode: "",
  });
  const [totpStep, setTotpStep] = useState<"setup" | "verify">("setup");

  // Step 3 state (Deposit) — formerly step 4
  const [depositAmount, setDepositAmount] = useState("");
  const [depositSubmitting, setDepositSubmitting] = useState(false);

  const goNext = useCallback(() => {
    if (step >= 3) return;
    setDirection("forward");
    setStep((s) => s + 1);
  }, [step]);

  const goBack = useCallback(() => {
    if (step <= 1) return;
    setDirection("backward");
    setStep((s) => s - 1);
  }, [step]);

  // Step validation
  const validateProfile = useCallback((): boolean => {
    const errors: Record<string, string> = {};
    if (!profile.phone.trim()) errors.phone = "Phone number is required";
    if (!profile.country.trim()) errors.country = "Country is required";
    setProfileErrors(errors);
    return Object.keys(errors).length === 0;
  }, [profile]);

  const handleStep1Next = useCallback(() => {
    if (validateProfile()) {
      goNext();
    }
  }, [validateProfile, goNext]);

  // KYC upload handler removed — module temporarily disabled.

  const handleDepositSubmit = useCallback(async () => {
    const amount = parseFloat(depositAmount.replace(/[^0-9.]/g, ""));
    if (!amount || amount < 1000) {
      toast.error("Minimum deposit is $1,000");
      return;
    }
    setDepositSubmitting(true);
    try {
      await api.post("/api/transactions/deposit", { amount, currency: "USD" });
      toast.success("Deposit request submitted!");
      onComplete();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Deposit failed");
    } finally {
      setDepositSubmitting(false);
    }
  }, [depositAmount, onComplete]);

  const slideVariants = {
    enter: (dir: "forward" | "backward") => ({
      x: dir === "forward" ? 80 : -80,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: "forward" | "backward") => ({
      x: dir === "forward" ? -80 : 80,
      opacity: 0,
    }),
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-2 sm:p-4 safe-area-top safe-area-bottom">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-[95vw] sm:max-w-2xl max-h-[94vh] flex flex-col"
      >
        <GlassCard gold glow className="overflow-hidden flex flex-col max-h-[94vh]">
          {/* Header with progress */}
          <div className="border-b border-gold/20 bg-gradient-to-r from-gold/5 via-transparent to-gold/5 px-4 sm:px-6 pt-5 sm:pt-6 pb-4 shrink-0">
            <div className="flex items-center justify-between mb-4 gap-2">
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-foreground truncate">Investor Onboarding</h2>
                <p className="text-xs text-muted-foreground">Complete setup to start investing</p>
              </div>
              {onClose && (
                <Button variant="ghost" size="sm" onClick={onClose} className="shrink-0 text-muted-foreground hover:text-foreground tap-target-sm">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Progress stepper — horizontal scroll on mobile */}
            <div className="scroll-row items-center justify-between">
              {STEPS.map((s, idx) => {
                const StepIcon = s.icon;
                const isCompleted = step > s.id;
                const isCurrent = step === s.id;

                return (
                  <div key={s.id} className="flex items-center shrink-0">
                    <div className="flex flex-col items-center">
                      <motion.div
                        className={`flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full border-2 transition-all ${
                          isCompleted
                            ? "border-gold bg-gold text-black"
                            : isCurrent
                            ? "border-gold bg-gold/15 text-gold shadow-[0_0_16px_rgba(212,175,55,0.3)]"
                            : "border-border/40 bg-black/30 text-muted-foreground"
                        }`}
                        animate={isCurrent ? { scale: [1, 1.05, 1] } : {}}
                        transition={isCurrent ? { duration: 2, repeat: Infinity, ease: "easeInOut" } : {}}
                      >
                        {isCompleted ? (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                          >
                            <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
                          </motion.div>
                        ) : (
                          <StepIcon className="h-4 w-4" />
                        )}
                      </motion.div>
                      <div className="mt-1.5 text-center">
                        <div className={`text-[10px] font-semibold whitespace-nowrap ${isCurrent ? "text-gold" : isCompleted ? "text-gold/70" : "text-muted-foreground"}`}>
                          {s.label}
                        </div>
                      </div>
                    </div>
                    {idx < STEPS.length - 1 && (
                      <div className="mx-2 mb-5 h-0.5 w-6 sm:w-16">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ backgroundColor: step > s.id ? "#D4AF37" : "rgba(255,255,255,0.1)" }}
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: step > s.id ? 1 : 0 }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step content with animated transitions */}
          <div className="p-4 sm:p-6 overflow-y-auto scroll-luxury flex-1 min-w-0">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={step}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                {step === 1 && (
                  <Step1Profile
                    profile={profile}
                    setProfile={setProfile}
                    errors={profileErrors}
                  />
                )}
                {step === 2 && (
                  <Step2Security
                    security={security}
                    setSecurity={setSecurity}
                    totpStep={totpStep}
                    setTotpStep={setTotpStep}
                  />
                )}
                {step === 3 && (
                  <Step3Deposit
                    amount={depositAmount}
                    setAmount={setDepositAmount}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer with navigation — sticky on mobile */}
          <div className="sticky-mobile-cta flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-2 border-t border-border/40 px-4 sm:px-6 py-3 sm:py-4 shrink-0 safe-area-bottom">
            <Button
              variant="outline"
              onClick={step === 1 ? (onClose ?? (() => {})) : goBack}
              className="border-border/60 h-12 tap-target btn-full-mobile"
            >
              {step === 1 ? (
                <>
                  <X className="mr-1 h-4 w-4" /> Cancel
                </>
              ) : (
                <>
                  <ChevronLeft className="mr-1 h-4 w-4" /> Back
                </>
              )}
            </Button>

            <div className="flex items-center justify-center gap-1.5 py-1 sm:py-0">
              {STEPS.map((s) => (
                <div
                  key={s.id}
                  className={`h-1.5 rounded-full transition-all ${
                    step === s.id ? "w-6 bg-gold" : step > s.id ? "w-1.5 bg-gold/50" : "w-1.5 bg-border/40"
                  }`}
                />
              ))}
            </div>

            <Button
              onClick={() => {
                if (step === 1) handleStep1Next();
                else if (step === 2) goNext();
                else if (step === 3) handleDepositSubmit();
              }}
              disabled={step === 3 && depositSubmitting}
              className="bg-gold-gradient text-black hover:opacity-90 h-12 tap-target btn-full-mobile"
            >
              {step === 3 && depositSubmitting ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : step === 3 ? (
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
              ) : null}
              {step === 3 ? "Submit Deposit" : "Continue"}
              {step < 3 && <ChevronRight className="ml-1 h-4 w-4" />}
            </Button>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
   STEP 1: COMPLETE PROFILE
   ────────────────────────────────────────────────────────────────────────────── */

function Step1Profile({
  profile,
  setProfile,
  errors,
}: {
  profile: { phone: string; country: string; investorType: "individual" | "institutional" | "trust" };
  setProfile: (p: typeof profile) => void;
  errors: Record<string, string>;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-foreground">Complete Your Profile</h3>
        <p className="text-xs text-muted-foreground mt-1">Provide your personal details to get started</p>
      </div>

      <div className="space-y-4">
        {/* Phone */}
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5" /> Phone Number
          </Label>
          <Input
            value={profile.phone}
            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            placeholder="+1 (555) 000-0000"
            className={`border-border/60 bg-black/30 focus-visible:ring-gold/50 h-12 ${errors.phone ? "border-loss/50" : ""}`}
          />
          {errors.phone && (
            <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-[11px] text-loss flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> {errors.phone}
            </motion.p>
          )}
        </div>

        {/* Country */}
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5" /> Country of Residence
          </Label>
          <Input
            value={profile.country}
            onChange={(e) => setProfile({ ...profile, country: e.target.value })}
            placeholder="United States"
            className={`border-border/60 bg-black/30 focus-visible:ring-gold/50 h-12 ${errors.country ? "border-loss/50" : ""}`}
          />
          {errors.country && (
            <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-[11px] text-loss flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> {errors.country}
            </motion.p>
          )}
        </div>

        {/* Investor Type */}
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Briefcase className="h-3.5 w-3.5" /> Investor Type
          </Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { value: "individual" as const, label: "Individual", desc: "Personal account" },
              { value: "institutional" as const, label: "Institutional", desc: "Fund or entity" },
              { value: "trust" as const, label: "Trust", desc: "Trust account" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setProfile({ ...profile, investorType: opt.value })}
                className={`rounded-lg border p-2.5 sm:p-3 text-left transition-all ${
                  profile.investorType === opt.value
                    ? "border-gold/50 bg-gold/10 shadow-[0_0_12px_rgba(212,175,55,0.15)]"
                    : "border-border/40 bg-black/20 hover:border-gold/30 hover:bg-gold/[0.03]"
                }`}
              >
                <div className={`text-xs font-semibold ${profile.investorType === opt.value ? "text-gold" : "text-foreground"}`}>
                  {opt.label}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
   STEP 2: SECURITY SETUP  (renumbered after KYC removal)
   ────────────────────────────────────────────────────────────────────────────── */

function Step2Security({
  security,
  setSecurity,
  totpStep,
  setTotpStep,
}: {
  security: { totpEnabled: boolean; recoveryEmail: string; verifyCode: string };
  setSecurity: (s: typeof security) => void;
  totpStep: "setup" | "verify";
  setTotpStep: (s: "setup" | "verify") => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-foreground">Security Setup</h3>
        <p className="text-xs text-muted-foreground mt-1">Secure your account with 2FA and recovery options</p>
      </div>

      {/* 2FA Section */}
      <GlassCard className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15">
            <Smartphone className="h-5 w-5 text-gold" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">Two-Factor Authentication</div>
            <div className="text-[11px] text-muted-foreground">Add an extra layer of security</div>
          </div>
          <div className="ml-auto">
            {security.totpEnabled ? (
              <Badge className="border-profit/30 bg-profit/10 text-profit text-[10px]">
                <Check className="mr-1 h-3 w-3" /> Enabled
              </Badge>
            ) : (
              <Badge className="border-gold/30 bg-gold/10 text-gold text-[10px]">Recommended</Badge>
            )}
          </div>
        </div>

        {!security.totpEnabled ? (
          <div className="space-y-3">
            {totpStep === "setup" ? (
              <>
                {/* QR Code placeholder */}
                <div className="flex items-center justify-center p-6 rounded-lg bg-black/30 border border-border/40">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-36 w-36 rounded-lg border-2 border-dashed border-gold/30 flex items-center justify-center bg-gold/5">
                      <div className="text-center">
                        <Lock className="h-8 w-8 text-gold/40 mx-auto mb-1" />
                        <div className="text-[10px] text-muted-foreground">QR Code</div>
                        <div className="text-[9px] text-muted-foreground">Scan with authenticator app</div>
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground text-center max-w-[200px]">
                      Scan this QR code with Google Authenticator, Authy, or similar app
                    </div>
                  </div>
                </div>
                <Button
                  className="w-full bg-gold-gradient text-black h-12 tap-target"
                  onClick={() => setTotpStep("verify")}
                >
                  I&apos;ve Scanned the Code
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Verification Code</Label>
                  <Input
                    value={security.verifyCode}
                    onChange={(e) => setSecurity({ ...security, verifyCode: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                    placeholder="000000"
                    className="border-border/60 bg-black/30 text-center text-lg tracking-[0.5em] font-mono focus-visible:ring-gold/50"
                    maxLength={6}
                  />
                  <div className="text-[10px] text-muted-foreground">Enter the 6-digit code from your authenticator app</div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 border-border/60 h-12 tap-target"
                    onClick={() => setTotpStep("setup")}
                  >
                    Back
                  </Button>
                  <Button
                    className="flex-1 bg-gold-gradient text-black h-12 tap-target"
                    onClick={() => {
                      if (security.verifyCode.length === 6) {
                        setSecurity({ ...security, totpEnabled: true });
                        toast.success("2FA enabled successfully!");
                      }
                    }}
                    disabled={security.verifyCode.length !== 6}
                  >
                    Verify & Enable
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-profit/30 bg-profit/5 p-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-profit" />
            <span className="text-xs text-profit">Two-factor authentication is enabled on your account</span>
          </div>
        )}
      </GlassCard>

      {/* Recovery Email */}
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Mail className="h-3.5 w-3.5" /> Recovery Email
        </Label>
        <Input
          value={security.recoveryEmail}
          onChange={(e) => setSecurity({ ...security, recoveryEmail: e.target.value })}
          placeholder="backup@example.com"
          type="email"
          className="border-border/60 bg-black/30 focus-visible:ring-gold/50 h-12"
        />
        <div className="text-[10px] text-muted-foreground">Used for account recovery if you lose access to 2FA</div>
      </div>

      {!security.totpEnabled && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
          <div className="text-[11px] text-muted-foreground">
            You can skip 2FA setup, but it is highly recommended for account security. You can enable it later in Settings.
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
   STEP 3: FIRST DEPOSIT  (renumbered after KYC removal)
   ────────────────────────────────────────────────────────────────────────────── */

function Step3Deposit({
  amount,
  setAmount,
}: {
  amount: string;
  setAmount: (a: string) => void;
}) {
  const presets = [
    { label: "$50K", value: "50000" },
    { label: "$100K", value: "100000" },
    { label: "$250K", value: "250000" },
    { label: "$500K", value: "500000" },
  ];

  const numericAmount = parseFloat(amount.replace(/[^0-9.]/g, "")) || 0;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-foreground">Fund Your Account</h3>
        <p className="text-xs text-muted-foreground mt-1">Make your first deposit to start investing</p>
      </div>

      <div className="space-y-4">
        {/* Preset amounts */}
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Quick Select</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {presets.map((p) => (
              <button
                key={p.value}
                onClick={() => setAmount(p.value)}
                className={`rounded-lg border p-2.5 text-center transition-all h-12 ${
                  amount === p.value
                    ? "border-gold/50 bg-gold/10 text-gold shadow-[0_0_12px_rgba(212,175,55,0.15)]"
                    : "border-border/40 bg-black/20 text-foreground hover:border-gold/30 hover:bg-gold/[0.03]"
                }`}
              >
                <div className="text-sm font-semibold">{p.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Custom amount */}
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5" /> Custom Amount
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted-foreground">$</span>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="0.00"
              inputMode="decimal"
              className="border-border/60 bg-black/30 pl-8 text-xl sm:text-2xl font-metric font-semibold h-14 focus-visible:ring-gold/50"
            />
          </div>
          <div className="text-[10px] text-muted-foreground">Minimum deposit: $1,000</div>
        </div>

        {/* Summary card */}
        {numericAmount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <GlassCard gold className="p-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Deposit Summary</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Deposit Amount</span>
                  <span className="font-metric text-lg font-bold text-gold">
                    ${numericAmount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Management Fee (2%)</span>
                  <span className="font-metric text-sm text-foreground">
                    ${((numericAmount * 0.02) / 4).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/qtr
                  </span>
                </div>
                <div className="border-t border-border/40 pt-2 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Net Investment</span>
                  <span className="font-metric text-sm font-semibold text-profit">
                    ${numericAmount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
              <div className="mt-3 rounded-lg border border-gold/20 bg-gold/5 p-2 text-[10px] text-muted-foreground">
                Deposit request will be reviewed by the fund administrator. Wire transfer instructions will be provided upon approval.
              </div>
            </GlassCard>
          </motion.div>
        )}
      </div>
    </div>
  );
}
