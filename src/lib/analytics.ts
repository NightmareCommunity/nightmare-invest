import { db } from "./db";
import type { NAVPoint, Holding } from "@prisma/client";

export interface FundMetrics {
  nav: number;
  aum: number;
  dailyReturn: number;
  weeklyReturn: number;
  monthlyReturn: number;
  annualReturn: number;
  cagr: number;
  sharpe: number;
  maxDrawdown: number;
  volatility: number;
  inceptionNav: number;
  navHistory: { date: string; nav: number }[];
}

function pct(curr: number, prev: number | null): number {
  if (prev == null || prev === 0) return 0;
  return ((curr - prev) / prev) * 100;
}

function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export async function getFundMetrics(fundId: string): Promise<FundMetrics> {
  const fund = await db.fund.findUnique({ where: { id: fundId } });
  if (!fund) throw new Error("Fund not found");

  const points = await db.nAVPoint.findMany({
    where: { fundId },
    orderBy: { date: "asc" },
  });

  if (points.length === 0) {
    return {
      nav: fund.inceptionNav,
      aum: 0,
      dailyReturn: 0,
      weeklyReturn: 0,
      monthlyReturn: 0,
      annualReturn: 0,
      cagr: 0,
      sharpe: 0,
      maxDrawdown: 0,
      volatility: 0,
      inceptionNav: fund.inceptionNav,
      navHistory: [],
    };
  }

  const last = points[points.length - 1];
  const nav = last.nav;
  const aum = last.aum ?? 0;

  const daily = points.length >= 2 ? pct(nav, points[points.length - 2].nav) : 0;

  const dayMs = 24 * 60 * 60 * 1000;
  const now = last.date.getTime();
  const weeklyIdx = points.findIndex((p) => p.date.getTime() >= now - 7 * dayMs);
  const weekly = weeklyIdx > 0 ? pct(nav, points[weeklyIdx - 1].nav) : pct(nav, points[0].nav);

  const monthlyIdx = points.findIndex((p) => p.date.getTime() >= now - 30 * dayMs);
  const monthly = monthlyIdx > 0 ? pct(nav, points[monthlyIdx - 1].nav) : pct(nav, points[0].nav);

  const yearlyIdx = points.findIndex((p) => p.date.getTime() >= now - 365 * dayMs);
  const annual = yearlyIdx > 0 ? pct(nav, points[yearlyIdx - 1].nav) : pct(nav, points[0].nav);

  // CAGR from inception
  const yearsElapsed = Math.max(
    (last.date.getTime() - points[0].date.getTime()) / (365 * dayMs),
    1 / 365
  );
  const cagr = (Math.pow(nav / points[0].nav, 1 / yearsElapsed) - 1) * 100;

  // Daily returns series for sharpe/vol/dd
  const rets: number[] = [];
  for (let i = 1; i < points.length; i++) {
    rets.push((points[i].nav - points[i - 1].nav) / points[i - 1].nav);
  }
  const vol = stdev(rets) * Math.sqrt(365); // annualised
  const meanDaily = rets.reduce((a, b) => a + b, 0) / Math.max(rets.length, 1);
  const sharpe = vol > 0 ? (meanDaily * 365) / vol : 0;

  // Max drawdown
  let peak = points[0].nav;
  let maxDd = 0;
  for (const p of points) {
    if (p.nav > peak) peak = p.nav;
    const dd = (p.nav - peak) / peak;
    if (dd < maxDd) maxDd = dd;
  }

  return {
    nav,
    aum,
    dailyReturn: daily,
    weeklyReturn: weekly,
    monthlyReturn: monthly,
    annualReturn: annual,
    cagr,
    sharpe: sharpe * 100,
    maxDrawdown: maxDd * 100,
    volatility: vol * 100,
    inceptionNav: fund.inceptionNav,
    navHistory: points.map((p) => ({ date: p.date.toISOString(), nav: p.nav })),
  };
}

export interface PortfolioSummary {
  investedCapital: number;
  currentValue: number;
  unrealizedPnl: number;
  roi: number;
  units: number;
  avgPrice: number;
  currentNav: number;
}

export async function getPortfolioSummary(userId: string, fundId: string): Promise<PortfolioSummary> {
  const holding = await db.holding.findUnique({ where: { userId_fundId: { userId, fundId } } });
  const lastNav = await db.nAVPoint.findFirst({
    where: { fundId },
    orderBy: { date: "desc" },
  });
  const currentNav = lastNav?.nav ?? 100;

  if (!holding) {
    return {
      investedCapital: 0,
      currentValue: 0,
      unrealizedPnl: 0,
      roi: 0,
      units: 0,
      avgPrice: 0,
      currentNav,
    };
  }

  const investedCapital = holding.units * holding.avgPrice;
  const currentValue = holding.units * currentNav;
  const unrealizedPnl = currentValue - investedCapital;
  const roi = investedCapital > 0 ? (unrealizedPnl / investedCapital) * 100 : 0;

  return {
    investedCapital,
    currentValue,
    unrealizedPnl,
    roi,
    units: holding.units,
    avgPrice: holding.avgPrice,
    currentNav,
  };
}

export async function getUserLedgerBalance(userId: string, fundId: string): Promise<number> {
  const accountId = `${userId}-${fundId}`;
  const last = await db.ledgerEntry.findFirst({
    where: { accountId },
    orderBy: { createdAt: "desc" },
  });
  return last?.balanceAfter ?? 0;
}

export function accountKey(userId: string, fundId: string): string {
  return `${userId}-${fundId}`;
}
