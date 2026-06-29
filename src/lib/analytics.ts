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
    sharpe,
    maxDrawdown: maxDd * 100,
    volatility: vol * 100,
    inceptionNav: fund.inceptionNav,
    navHistory: points.map((p) => ({ date: p.date.toISOString(), nav: p.nav })),
  };
}

// ----------------------- Advanced Risk Analytics -----------------------
export interface AdvancedAnalytics {
  sharpe: number;
  sortino: number;
  calmar: number;
  volatility: number;
  maxDrawdown: number;
  var95: number;          // parametric 1-day Value at Risk (95%)
  cvar95: number;         // Conditional VaR (expected shortfall)
  bestDay: number;
  worstDay: number;
  positiveDaysPct: number;
  avgUpDay: number;
  avgDownDay: number;
  upDownRatio: number;     // |avg up / avg down|
  currentDrawdown: number;
  drawdownSeries: { date: string; dd: number }[];
  monthlyReturns: { month: string; ret: number }[];
  yearlyReturns: { year: number; ret: number }[];
  rollingSharpe30: number;
  longestWinStreak: number;
  longestLossStreak: number;
  navHistory: { date: string; nav: number; ret: number | null }[];
}

function downsideDev(returns: number[]): number {
  const downs = returns.filter((r) => r < 0);
  if (downs.length === 0) return 0;
  const meanSq = downs.reduce((acc, r) => acc + r * r, 0) / returns.length;
  return Math.sqrt(meanSq);
}

export async function getAdvancedAnalytics(fundId: string): Promise<AdvancedAnalytics | null> {
  const fund = await db.fund.findUnique({ where: { id: fundId } });
  if (!fund) return null;

  const points = await db.nAVPoint.findMany({
    where: { fundId },
    orderBy: { date: "asc" },
  });

  if (points.length < 2) {
    return null;
  }

  // Daily returns
  const rets: number[] = [];
  const navHistory: { date: string; nav: number; ret: number | null }[] = [];
  for (let i = 0; i < points.length; i++) {
    const ret = i === 0 ? null : (points[i].nav - points[i - 1].nav) / points[i - 1].nav;
    if (ret !== null) rets.push(ret);
    navHistory.push({
      date: points[i].date.toISOString(),
      nav: points[i].nav,
      ret,
    });
  }

  const dayMs = 86400000;
  const meanDaily = rets.reduce((a, b) => a + b, 0) / rets.length;
  const vol = stdev(rets) * Math.sqrt(365);
  const sharpe = vol > 0 ? (meanDaily * 365) / vol : 0;

  const dd = downsideDev(rets) * Math.sqrt(365);
  const sortino = dd > 0 ? (meanDaily * 365) / dd : 0;

  // Max drawdown + current drawdown + series
  let peak = points[0].nav;
  let maxDd = 0;
  const drawdownSeries: { date: string; dd: number }[] = [];
  for (const p of points) {
    if (p.nav > peak) peak = p.nav;
    const d = (p.nav - peak) / peak;
    if (d < maxDd) maxDd = d;
    drawdownSeries.push({ date: p.date.toISOString(), dd: d * 100 });
  }
  const currentDrawdown = drawdownSeries[drawdownSeries.length - 1].dd;

  // Years elapsed from inception to last point
  const yearsElapsed = Math.max(
    (points[points.length - 1].date.getTime() - points[0].date.getTime()) / (365 * dayMs),
    1 / 365
  );
  const cagr = (Math.pow(points[points.length - 1].nav / points[0].nav, 1 / yearsElapsed) - 1);
  const calmar = maxDd !== 0 ? cagr / Math.abs(maxDd) : 0;

  // VaR (95%) parametric: mean - 1.645 * stdev_daily
  const dailyVol = stdev(rets);
  const var95 = -(meanDaily - 1.645 * dailyVol); // positive number = loss
  const cvar95 = -(rets.filter((r) => r <= -var95).reduce((a, b) => a + b, 0) /
    Math.max(rets.filter((r) => r <= -var95).length, 1) || meanDaily - 1.645 * dailyVol);

  const bestDay = Math.max(...rets) * 100;
  const worstDay = Math.min(...rets) * 100;
  const positive = rets.filter((r) => r > 0);
  const negative = rets.filter((r) => r < 0);
  const avgUp = positive.length > 0 ? positive.reduce((a, b) => a + b, 0) / positive.length * 100 : 0;
  const avgDown = negative.length > 0 ? negative.reduce((a, b) => a + b, 0) / negative.length * 100 : 0;
  const upDownRatio = avgDown !== 0 ? Math.abs(avgUp / avgDown) : 0;

  // Monthly returns: group by YYYY-MM, take last NAV vs last NAV of prior month
  const monthlyMap = new Map<string, number>(); // YYYY-MM -> last NAV of month
  for (const p of points) {
    const key = `${p.date.getUTCFullYear()}-${String(p.date.getUTCMonth() + 1).padStart(2, "0")}`;
    monthlyMap.set(key, p.nav);
  }
  const monthKeys = Array.from(monthlyMap.keys()).sort();
  const monthlyReturns: { month: string; ret: number }[] = [];
  for (let i = 1; i < monthKeys.length; i++) {
    const prev = monthlyMap.get(monthKeys[i - 1])!;
    const curr = monthlyMap.get(monthKeys[i])!;
    monthlyReturns.push({ month: monthKeys[i], ret: ((curr - prev) / prev) * 100 });
  }

  // Yearly returns
  const yearlyMap = new Map<number, number>();
  for (const p of points) {
    const y = p.date.getUTCFullYear();
    yearlyMap.set(y, p.nav);
  }
  const yearKeys = Array.from(yearlyMap.keys()).sort();
  const yearlyReturns: { year: number; ret: number }[] = [];
  for (let i = 1; i < yearKeys.length; i++) {
    const prev = yearlyMap.get(yearKeys[i - 1])!;
    const curr = yearlyMap.get(yearKeys[i])!;
    yearlyReturns.push({ year: yearKeys[i], ret: ((curr - prev) / prev) * 100 });
  }

  // Rolling 30-day Sharpe
  const last30 = rets.slice(-30);
  const rollingSharpe30 = stdev(last30) > 0
    ? (last30.reduce((a, b) => a + b, 0) / last30.length * 365) / (stdev(last30) * Math.sqrt(365))
    : 0;

  // Win/loss streaks
  let longestWin = 0, longestLoss = 0, curWin = 0, curLoss = 0;
  for (const r of rets) {
    if (r > 0) { curWin++; curLoss = 0; longestWin = Math.max(longestWin, curWin); }
    else if (r < 0) { curLoss++; curWin = 0; longestLoss = Math.max(longestLoss, curLoss); }
    else { curWin = 0; curLoss = 0; }
  }

  return {
    sharpe,
    sortino,
    calmar,
    volatility: vol * 100,
    maxDrawdown: maxDd * 100,
    var95: var95 * 100,
    cvar95: cvar95 * 100,
    bestDay,
    worstDay,
    positiveDaysPct: (positive.length / rets.length) * 100,
    avgUpDay: avgUp,
    avgDownDay: avgDown,
    upDownRatio,
    currentDrawdown,
    drawdownSeries,
    monthlyReturns,
    yearlyReturns,
    rollingSharpe30,
    longestWinStreak: longestWin,
    longestLossStreak: longestLoss,
    navHistory,
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
