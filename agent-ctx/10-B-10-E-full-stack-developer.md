# Task 10-B + 10-E: Portfolio Benchmarking & Tax Reporting

## Summary
Implemented two new features for the Nightmare Invest portal:

### Feature 1: Portfolio Benchmarking (10-B)
- Added benchmark comparison section to `src/components/investor/portfolio.tsx`
- 4 benchmark options: S&P 500, Bitcoin, Ethereum, Nasdaq 100 with simulated annual returns
- ComposedChart with fund NAV (gold solid 3px) + benchmark lines (dashed, colored)
- Performance comparison table as GlassCards
- Alpha vs Benchmark metric tile

### Feature 2: Investor Tax Reporting (10-E)
- Added tax reporting section to `src/components/investor/reports.tsx`
- Tax summary cards (net gains, short/long-term breakdown, estimated tax liability)
- FIFO/LIFO cost basis method selector
- Stacked bar chart for monthly realized gains/losses
- Sortable tax lots table with holding period indicators
- CSV export functionality

### Files Modified
- `src/components/investor/portfolio.tsx` — Benchmarking section
- `src/components/investor/reports.tsx` — Tax reporting section

### Quality
- Lint passes with zero errors
- All hooks properly ordered before early returns
- Uses existing brand primitives, no new CSS needed
- No backend changes
