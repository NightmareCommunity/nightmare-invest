"use client";
import { useState, useEffect, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useApp, type Route } from "@/lib/store";
import { Logo } from "@/components/brand/logo";
import { NotificationCenter } from "@/components/brand/notification-center";
import { useRealtimeNotifications } from "@/hooks/use-realtime-notifications";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/brand/error-boundary";
import { OnboardingWizard } from "@/components/brand/onboarding-wizard";
import {
  LayoutDashboard, Wallet, ArrowLeftRight, FileText, Settings,
  Users, TrendingUp, Database, ScrollText, History, Menu, X, LogOut,
  ChevronDown, ShieldCheck, BarChart3, FileCheck2, Megaphone,
  Star, Calculator, Activity, Mail, FolderArchive, PiggyBank,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format";

interface NavItem {
  label: string;
  route: Route;
  icon: typeof LayoutDashboard;
  description: string;
  badge?: "pendingTx" | "pendingAdmin";
}

const INVESTOR_NAV: NavItem[] = [
  { label: "Dashboard", route: { name: "dashboard" }, icon: LayoutDashboard, description: "Portfolio overview & metrics" },
  { label: "Portfolio", route: { name: "portfolio" }, icon: Wallet, description: "Holdings, exposures & allocations" },
  { label: "Analytics", route: { name: "analytics" }, icon: BarChart3, description: "Advanced risk & performance analytics" },
  { label: "My Investments", route: { name: "investments" }, icon: PiggyBank, description: "Your active investment positions & performance" },
  { label: "Watchlist", route: { name: "watchlist" }, icon: Star, description: "Track favorite crypto assets & price alerts" },
  { label: "Calculator", route: { name: "calculator" }, icon: Calculator, description: "Profit/loss projection calculator" },
  { label: "Inbox", route: { name: "inbox" }, icon: Mail, description: "Messages & announcements from the fund" },
  { label: "Transactions", route: { name: "transactions" }, icon: ArrowLeftRight, description: "Deposits, withdrawals & history" },
  { label: "Reports", route: { name: "reports" }, icon: FileText, description: "Download statements & ledger exports" },
  { label: "Documents", route: { name: "documents" }, icon: FolderArchive, description: "Statement vault & official correspondence" },
  { label: "Settings", route: { name: "settings" }, icon: Settings, description: "Profile, security & preferences" },
];

const ADMIN_NAV: NavItem[] = [
  { label: "Dashboard", route: { name: "admin-dashboard" }, icon: LayoutDashboard, description: "AUM, NAV trend & capital flows" },
  { label: "Users", route: { name: "admin-investors" }, icon: Users, description: "Directory & user management" },
  { label: "Deposits", route: { name: "admin-transactions" }, icon: ArrowLeftRight, description: "Review pending deposits & withdrawals", badge: "pendingAdmin" },
  { label: "Investments", route: { name: "admin-investments" }, icon: PiggyBank, description: "Create & manage investor investment positions" },
  { label: "Fund", route: { name: "admin-fund" }, icon: TrendingUp, description: "Fund metadata & allocation editor" },
  { label: "NAV Management", route: { name: "admin-nav" }, icon: Database, description: "Publish NAV & history" },
  // KYC Review removed — module temporarily disabled. Route retained in store
  // for clean future reintroduction.
  { label: "Fund Updates", route: { name: "admin-fund-updates" }, icon: Megaphone, description: "Publish news & updates for investors" },
  { label: "Documents", route: { name: "admin-documents" }, icon: FolderArchive, description: "Generate statements & manage investor documents" },
  { label: "Communications", route: { name: "admin-communications" }, icon: Mail, description: "Message investors & broadcast announcements" },
  { label: "System Health", route: { name: "admin-system-health" }, icon: Activity, description: "Infrastructure monitoring & diagnostics" },
  { label: "Ledger", route: { name: "admin-ledger" }, icon: ScrollText, description: "Fund ledger entries & CSV export" },
  { label: "Audit Logs", route: { name: "admin-audit" }, icon: History, description: "System action history & metadata" },
  { label: "Settings", route: { name: "admin-settings" }, icon: Settings, description: "Platform configuration & security policy" },
];

export function PortalShell({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const user = useApp((s) => s.user)!;
  const route = useApp((s) => s.route);
  const setRoute = useApp((s) => s.setRoute);
  const logout = useApp((s) => s.logout);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Real-time WebSocket notifications (toasts + badge refresh). Active
  // whenever the shell is mounted (i.e. user is logged in).
  useRealtimeNotifications();

  // Show onboarding wizard for new investors.
  // KYC module temporarily disabled — onboarding no longer gated on kycStatus.
  // Instead, we prompt onboarding for users who haven't dismissed it this session.
  useEffect(() => {
    if (
      !admin &&
      user &&
      user.role === "USER" &&
      !sessionStorage.getItem("onboarding_dismissed")
    ) {
      const timer = setTimeout(() => setShowOnboarding(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [admin, user]);

  const nav = admin ? ADMIN_NAV : INVESTOR_NAV;
  const current = route.name;

  const go = (r: Route) => {
    setRoute(r);
    setMobileOpen(false);
  };

  // Expose onboarding trigger to child components via a global function
  useEffect(() => {
    (window as Record<string, unknown>).__showOnboarding = () => setShowOnboarding(true);
    return () => { delete (window as Record<string, unknown>).__showOnboarding; };
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Onboarding wizard overlay */}
      <AnimatePresence>
        {showOnboarding && !admin && (
          <OnboardingWizard
            onComplete={() => {
              setShowOnboarding(false);
              sessionStorage.setItem("onboarding_dismissed", "1");
            }}
            onClose={() => {
              setShowOnboarding(false);
              sessionStorage.setItem("onboarding_dismissed", "1");
            }}
          />
        )}
      </AnimatePresence>
      {/* Top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border/60 glass-strong topbar-glow-line px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-gold/10 hover:text-gold lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <button onClick={() => go(admin ? { name: "admin-dashboard" } : { name: "dashboard" })}>
            <Logo />
          </button>
          {admin && (
            <span className="hidden items-center gap-1.5 rounded-full border border-gold/20 bg-gold/5 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gold sm:inline-flex">
              <ShieldCheck className="h-3 w-3" /> Admin
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <NotificationCenter />
          <div className="hidden items-center gap-2 rounded-lg border border-border/60 bg-black/30 px-3 py-1.5 sm:flex">
            <div className="relative">
              <div className={cn("flex h-7 w-7 items-center justify-center rounded-full bg-gold-gradient text-xs font-bold text-black transition-transform duration-200 hover:scale-110", user.role === "ADMIN" && "ring-2 ring-gold/50 ring-offset-1 ring-offset-background")}>
                {user.name.charAt(0).toUpperCase()}
              </div>
              {/* Online indicator dot */}
              <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full rounded-full bg-profit opacity-50 online-dot-pulse" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-profit border-2 border-background" />
              </span>
            </div>
            <div className="leading-none">
              <div className="text-xs font-semibold text-foreground">{user.name}</div>
              <div className="text-[10px] text-muted-foreground">{user.role}</div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground hover:text-loss">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="sidebar-gold-accent sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 border-r border-border/60 bg-sidebar/40 lg:block">
          <SidebarContent nav={nav} current={current} go={go} admin={admin} setRoute={setRoute} />
        </aside>

        {/* Mobile drawer */}
        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setMobileOpen(false)}
                className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md lg:hidden"
              />
              <motion.aside
                initial={{ x: -300 }}
                animate={{ x: 0 }}
                exit={{ x: -300 }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="fixed inset-y-0 left-0 z-50 w-72 border-r border-gold/20 bg-sidebar glass-strong lg:hidden"
              >
                <div className="flex h-14 items-center justify-between border-b border-border/60 px-4">
                  <Logo />
                  <button onClick={() => setMobileOpen(false)} className="rounded-md p-1.5 text-muted-foreground hover:text-foreground">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <SidebarContent nav={nav} current={current} go={go} admin={admin} setRoute={setRoute} mobile />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main */}
        <main className="relative flex flex-1 flex-col overflow-x-hidden bg-gradient-animated">
          {/* NIGHTMARE INVEST watermark */}
          <div className="pointer-events-none absolute bottom-4 right-6 z-0 select-none text-[11px] font-semibold uppercase tracking-[0.3em] text-foreground/[0.02]">
            NIGHTMARE INVEST
          </div>
          <div className="relative z-10 flex-1 mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 w-full">
            <ErrorBoundary>
              <AnimatePresence mode="wait">
                <motion.div
                  key={current}
                  initial={{ opacity: 0, y: 8, scale: 0.998 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.998 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                >
                  {children}
                </motion.div>
              </AnimatePresence>
            </ErrorBoundary>
          </div>
          <footer className="mt-auto border-t border-border/60 bg-black/30 px-4 py-4 sm:px-6">
            <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 text-[11px] text-muted-foreground sm:flex-row">
              <span>© {new Date().getFullYear()} Nightmare Invest · Confidential</span>
              <span>NAV as of {fmtDate(new Date())} · For accredited investors only</span>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}

function SidebarContent({
  nav, current, go, admin, setRoute, mobile,
}: {
  nav: NavItem[];
  current: string;
  go: (r: Route) => void;
  admin: boolean;
  setRoute: (r: Route) => void;
  mobile?: boolean;
}) {
  const user = useApp((s) => s.user);
  const canSwitchToAdmin = user?.role === "ADMIN";
  return (
    <div className="flex h-full flex-col">
      <nav className="flex-1 space-y-1 overflow-y-auto scroll-luxury p-3">
        <div className="px-3 pb-2 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {admin ? "Administration" : "Investor"}
        </div>
        {nav.map((item, idx) => {
          const active = current === item.route.name;
          const isFirstGroup = admin ? idx < 2 : idx < 3;
          const showSeparator = !isFirstGroup && (admin ? idx === 2 : idx === 3);
          return (
            <div key={item.label}>
              {showSeparator && <div className="my-2 border-t border-border/40" />}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => go(item.route)}
                    className={cn(
                      "nav-item-hover group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                      active
                        ? "nav-active-indicator-gold bg-gold/10 text-gold"
                        : "text-muted-foreground hover:bg-gold/10 hover:text-foreground"
                    )}
                  >
                    <item.icon className={cn("h-4 w-4", active ? "text-gold" : "text-muted-foreground group-hover:text-gold")} />
                    <span className="flex-1 text-left">{item.label}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  align="center"
                  sideOffset={8}
                  className="glass-strong border border-gold/25 px-3 py-2 text-foreground shadow-[0_0_24px_rgba(212,175,55,0.15)]"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-semibold text-gold">{item.label}</span>
                    <span className="max-w-[200px] text-[11px] leading-snug text-muted-foreground">{item.description}</span>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-border/60 p-3">
        {!admin && (
          <div className="mb-2 rounded-lg border border-gold/15 bg-gold/5 p-3 help-card-glow">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-gold">Need Help?</div>
            <div className="mt-1 text-xs text-muted-foreground">Contact investor relations at ir@nightmare.invest</div>
          </div>
        )}
        {(admin ? true : canSwitchToAdmin) && (
          <button
            onClick={() => setRoute(admin ? { name: "dashboard" } : { name: "admin-dashboard" })}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-gold/10 hover:text-gold"
          >
            <ChevronDown className="h-3.5 w-3.5 rotate-90" />
            {admin ? "Exit to Investor Portal" : "Admin Console"}
          </button>
        )}
      </div>
    </div>
  );
}
