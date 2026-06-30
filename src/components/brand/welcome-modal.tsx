"use client";

import { useSyncExternalStore, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Shield, TrendingUp, ArrowDownToLine, ArrowUpFromLine, FileText } from "lucide-react";

const STORAGE_KEY = "ni-welcome-dismissed";

// Custom store for welcome modal dismissed state with change notifications
const listeners = new Set<() => void>();
let cachedDismissed: boolean | null = null;

function notifyAll() {
  listeners.forEach((l) => l());
}

function getDismissed(): boolean {
  if (cachedDismissed === null) {
    try {
      cachedDismissed = localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      cachedDismissed = false;
    }
  }
  return cachedDismissed;
}

function setDismissed(value: boolean) {
  cachedDismissed = value;
  try {
    localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    /* ignore */
  }
  notifyAll();
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot() {
  return getDismissed();
}

function getServerSnapshot() {
  return true; // dismissed on server — don't show modal during SSR
}

const features = [
  {
    icon: TrendingUp,
    title: "Monitor Portfolio",
    description: "Track your holdings, NAV, and P&L in real-time",
  },
  {
    icon: ArrowDownToLine,
    title: "Request Deposits",
    description: "Allocate additional capital with a single request",
  },
  {
    icon: ArrowUpFromLine,
    title: "Request Withdrawals",
    description: "Access liquidity during scheduled windows",
  },
  {
    icon: FileText,
    title: "Download Reports",
    description: "Export statements and performance data",
  },
];

export function WelcomeModal() {
  const dismissed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const open = !dismissed;

  const handleDismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss(); }}>
      <DialogContent
        showCloseButton={false}
        className="border-gold/20 bg-card/95 backdrop-blur-xl max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto overscroll-contain p-5 sm:p-6 safe-area-bottom"
      >
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <DialogHeader className="items-center text-center sm:items-center">
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15, duration: 0.4 }}
                  className="mx-auto mb-2 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full border border-gold/30 bg-gold/10"
                >
                  <Shield className="h-6 w-6 sm:h-7 sm:w-7 text-gold" />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25, duration: 0.4 }}
                >
                  <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight">
                    Welcome to{" "}
                    <span className="bg-gradient-to-r from-gold via-yellow-400 to-gold bg-clip-text text-transparent">
                      Nightmare Invest
                    </span>
                  </DialogTitle>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.35, duration: 0.4 }}
                >
                  <DialogDescription className="mt-2 text-sm text-muted-foreground px-2">
                    Your private portal to the Nightmare Alpha Crypto Fund is ready. Here&apos;s what you can do:
                  </DialogDescription>
                </motion.div>
              </DialogHeader>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45, duration: 0.5 }}
                className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3"
              >
                {features.map((f, i) => (
                  <motion.div
                    key={f.title}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 + i * 0.08, duration: 0.35 }}
                    className="flex items-start gap-3 rounded-xl border border-border/60 bg-white/[0.02] p-3 sm:p-4 transition-colors hover:border-gold/20 hover:bg-gold/[0.03] min-w-0"
                  >
                    <f.icon className="h-5 w-5 shrink-0 text-gold/80" />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground">{f.title}</div>
                      <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground break-words-mobile">{f.description}</div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.85, duration: 0.4 }}
                className="mt-6 flex justify-center"
              >
                <Button
                  onClick={handleDismiss}
                  className="w-full sm:w-auto bg-gold-gradient px-8 h-12 text-sm font-semibold text-black hover:opacity-90 tap-target btn-full-mobile"
                >
                  Enter Portal
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
