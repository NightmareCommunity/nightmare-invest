# Task 5 — welcome-modal-and-txn-fixes

## Task: Add investor welcome modal and improve transactions page

### What was done:
1. **Created `/src/components/brand/welcome-modal.tsx`** — Premium welcome modal for first-time investor login
   - Uses `useSyncExternalStore` with custom localStorage-backed store (avoids setState-in-effect lint error)
   - Stores dismissed state in `ni-welcome-dismissed` localStorage key
   - Shield icon, gold gradient heading, 2x2 feature cards, "Enter Portal" button
   - Framer Motion staggered animations
   - Server snapshot returns dismissed=true to prevent SSR flash

2. **Integrated WelcomeModal into `/src/app/page.tsx`** — Added inside `<PortalShell>` for investor routes only (not admin)

3. **Improved `/src/components/investor/transactions.tsx`**:
   - Rich empty state with large deposit icon, "Begin Your Investment Journey" heading, and prominent "New Deposit" button
   - Pending Requests card with gold border, pulsing gold dot indicator, "Awaiting admin review" subtitle
   - Guidance hint below deposit/withdraw buttons with Info icon
   - Table alternating row backgrounds, font-metric on amount, hover:bg-gold/5

### Lint: Clean ✅
### Dev server: Compiles successfully ✅
