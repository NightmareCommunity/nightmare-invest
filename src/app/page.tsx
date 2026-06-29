"use client";
import { useEffect } from "react";
import { useApp, isPublicRoute } from "@/lib/store";
import { Landing } from "@/components/public/landing";
import { AuthScreen } from "@/components/public/auth-screen";
import { LegalPage } from "@/components/public/legal-page";
import { PortalShell } from "@/components/brand/portal-shell";
import { InvestorDashboard } from "@/components/investor/dashboard";
import { PortfolioPage } from "@/components/investor/portfolio";
import { TransactionsPage } from "@/components/investor/transactions";
import { ReportsPage } from "@/components/investor/reports";
import { SettingsPage } from "@/components/investor/settings";
import { AdminDashboard } from "@/components/admin/dashboard";
import { AdminInvestors } from "@/components/admin/investors";
import { AdminFund } from "@/components/admin/fund";
import { AdminNav } from "@/components/admin/nav";
import { AdminTransactions } from "@/components/admin/transactions";
import { AdminLedger } from "@/components/admin/ledger";
import { AdminAudit } from "@/components/admin/audit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15000 },
  },
});

export default function Home() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppRouter />
    </QueryClientProvider>
  );
}

function AppRouter() {
  const user = useApp((s) => s.user);
  const loading = useApp((s) => s.loading);
  const route = useApp((s) => s.route);
  const refresh = useApp((s) => s.refresh);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // After auth loads, redirect authenticated users from the default landing route to their portal
  useEffect(() => {
    if (!loading && user && route.name === "landing") {
      useApp.setState({ route: user.role === "ADMIN" ? { name: "admin-dashboard" } : { name: "dashboard" } });
    }
  }, [loading, user, route.name]);

  // Boot loading splash
  if (loading && !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <div className="relative h-12 w-12">
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-gold/20 border-t-gold" />
          <div className="absolute inset-2 rounded-full bg-gold-gradient opacity-20" />
        </div>
        <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Nightmare Invest</div>
      </div>
    );
  }

  // Public routes
  if (isPublicRoute(route)) {
    if (route.name === "legal") return <LegalPage route={route} />;
    if (route.name === "login") return <AuthScreen mode="login" />;
    if (route.name === "signup") return <AuthScreen mode="signup" />;
    if (route.name === "forgot") return <AuthScreen mode="forgot" />;
    return <Landing />;
  }

  // Authenticated routes — require user
  if (!user) {
    return <AuthScreen mode="login" />;
  }

  const isAdminRoute = route.name.startsWith("admin-");
  const isAdmin = user.role === "ADMIN";

  // Block non-admins from admin routes
  if (isAdminRoute && !isAdmin) {
    return (
      <PortalShell>
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <div className="text-4xl">⛔</div>
          <h2 className="text-xl font-semibold">Access Restricted</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            This area is reserved for fund administrators. Contact your relationship manager if you believe this is an error.
          </p>
        </div>
      </PortalShell>
    );
  }

  // Admin routes
  if (isAdminRoute && isAdmin) {
    return (
      <PortalShell admin>
        {renderAdmin(route.name)}
      </PortalShell>
    );
  }

  // Investor routes
  return (
    <PortalShell>
      {renderInvestor(route.name)}
    </PortalShell>
  );
}

function renderInvestor(name: string) {
  switch (name) {
    case "dashboard": return <InvestorDashboard />;
    case "portfolio": return <PortfolioPage />;
    case "transactions": return <TransactionsPage />;
    case "reports": return <ReportsPage />;
    case "settings": return <SettingsPage />;
    default: return <InvestorDashboard />;
  }
}

function renderAdmin(name: string) {
  switch (name) {
    case "admin-dashboard": return <AdminDashboard />;
    case "admin-investors": return <AdminInvestors />;
    case "admin-fund": return <AdminFund />;
    case "admin-nav": return <AdminNav />;
    case "admin-transactions": return <AdminTransactions />;
    case "admin-ledger": return <AdminLedger />;
    case "admin-audit": return <AdminAudit />;
    default: return <AdminDashboard />;
  }
}
