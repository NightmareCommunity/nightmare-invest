"use client";
import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { GlassCard, SectionTitle, StatusPill, TypePill, FadeIn, EmptyState } from "@/components/brand/primitives";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmtUSD, fmtDate } from "@/lib/format";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, ArrowDownToLine, ArrowUpFromLine, Clock, Inbox, ShieldAlert, Loader2, Hash, Copy } from "lucide-react";
import { toast } from "sonner";

/* ──────────────────────────────────────────────────────────────────────────────
   Method badge — UPI / BTC / LTC / USDT
   ────────────────────────────────────────────────────────────────────────────── */
function MethodBadge({ method, cryptoAmount }: { method?: string | null; cryptoAmount?: number | null }) {
  const m = (method ?? "UPI").toUpperCase();
  const map: Record<string, { label: string; symbol?: string; cls: string }> = {
    UPI:  { label: "UPI",  cls: "border-gold/30 bg-gold/10 text-gold" },
    BTC:  { label: "BTC",  symbol: "₿", cls: "border-warning/30 bg-warning/10 text-warning" },
    LTC:  { label: "LTC",  symbol: "Ł", cls: "border-info/30 bg-info/10 text-info" },
    USDT: { label: "USDT", symbol: "₮", cls: "border-profit/30 bg-profit/10 text-profit" },
  };
  const cfg = map[m] ?? map.UPI;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${cfg.cls}`}>
      {cfg.symbol && <span className="font-semibold">{cfg.symbol}</span>}
      {cfg.label}
    </span>
  );
}

function formatCryptoAmount(method: string | null | undefined, amount: number | null | undefined): string | null {
  if (!amount || !method) return null;
  const m = method.toUpperCase();
  const decimals = m === "BTC" ? 8 : m === "LTC" ? 6 : 2;
  return `${amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: decimals })} ${m}`;
}

export function AdminTransactions() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("PENDING");
  const [reviewing, setReviewing] = useState<any | null>(null);
  const [notes, setNotes] = useState("");
  const [acting, setActing] = useState(false);

  // Bulk action state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<"approve" | "reject" | null>(null);
  const [bulkNotes, setBulkNotes] = useState("");
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const [bulkActing, setBulkActing] = useState(false);

  const { data } = useQuery<any>({
    queryKey: ["admin-transactions", tab],
    queryFn: () => api.get(`/api/admin/transactions?status=${tab}`),
    refetchInterval: tab === "PENDING" ? 10000 : 30000,
  });

  const txns = data?.transactions ?? [];

  const act = async (action: "approve" | "reject") => {
    if (!reviewing) return;
    setActing(true);
    try {
      await api.post(`/api/admin/transactions/${reviewing.id}/${action}`, { notes: notes || undefined });
      toast.success(`Transaction ${action === "approve" ? "approved" : "rejected"}`);
      setReviewing(null);
      setNotes("");
      qc.invalidateQueries({ queryKey: ["admin-transactions"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
      qc.invalidateQueries({ queryKey: ["admin-ledger"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setActing(false);
    }
  };

  // Bulk selection handlers
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === txns.length && txns.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(txns.map((t: any) => t.id)));
    }
  }, [selectedIds.size, txns]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Only allow selecting PENDING transactions
  const selectableTxns = tab === "PENDING" ? txns : [];
  const allSelected = selectableTxns.length > 0 && selectedIds.size === selectableTxns.length;

  // Bulk action execution
  const executeBulkAction = async () => {
    if (!bulkAction || selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    setBulkActing(true);
    setBulkProgress({ current: 0, total: ids.length });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < ids.length; i++) {
      setBulkProgress({ current: i + 1, total: ids.length });
      try {
        await api.post(`/api/admin/transactions/${ids[i]}/${bulkAction}`, {
          notes: bulkNotes || undefined,
        });
        successCount++;
      } catch {
        failCount++;
      }
    }

    setBulkActing(false);
    setBulkAction(null);
    setBulkNotes("");
    setSelectedIds(new Set());

    if (failCount === 0) {
      toast.success(`Successfully ${bulkAction === "approve" ? "approved" : "rejected"} ${successCount} transaction${successCount !== 1 ? "s" : ""}`);
    } else if (successCount === 0) {
      toast.error(`Failed to ${bulkAction} all ${failCount} transactions`);
    } else {
      toast.warning(`${successCount} succeeded, ${failCount} failed`);
    }

    qc.invalidateQueries({ queryKey: ["admin-transactions"] });
    qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
    qc.invalidateQueries({ queryKey: ["admin-ledger"] });
  };

  const counts = {
    PENDING: useCount("PENDING"),
    APPROVED: useCount("APPROVED"),
    REJECTED: useCount("REJECTED"),
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <FadeIn>
        <div className="min-w-0">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Admin Console</span>
          <h1 className="h2-responsive mt-1 font-bold tracking-tight">Transaction Review</h1>
          <p className="body-responsive text-muted-foreground">Approve or reject deposit and withdrawal requests</p>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <Tabs value={tab} onValueChange={(v) => { setTab(v); setSelectedIds(new Set()); }}>
          <TabsList className="bg-black/30 border border-border/60 w-full sm:w-auto justify-start overflow-x-auto scroll-x-allowed">
            <TabsTrigger value="PENDING" className="data-[state=active]:bg-gold-gradient data-[state=active]:text-black tap-target-sm">
              <Clock className="mr-1.5 h-3.5 w-3.5" /> Pending {counts.PENDING > 0 && <span className="ml-1.5 rounded-full bg-loss px-1.5 text-[10px] text-white">{counts.PENDING}</span>}
            </TabsTrigger>
            <TabsTrigger value="APPROVED" className="data-[state=active]:bg-gold-gradient data-[state=active]:text-black tap-target-sm">Approved</TabsTrigger>
            <TabsTrigger value="REJECTED" className="data-[state=active]:bg-gold-gradient data-[state=active]:text-black tap-target-sm">Rejected</TabsTrigger>
          </TabsList>
        </Tabs>
      </FadeIn>

      <FadeIn delay={0.1}>
        <GlassCard className="p-3 sm:p-4 lg:p-5">
          {txns.length === 0 ? (
            <EmptyState
              icon={<Inbox className="h-10 w-10" />}
              title={`No ${tab.toLowerCase()} transactions`}
              description={tab === "PENDING" ? "All caught up. New requests will appear here." : `No ${tab.toLowerCase()} transactions to display.`}
            />
          ) : (
            <div className="space-y-3">
              {/* Select All Header */}
              {tab === "PENDING" && txns.length > 0 && (
                <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-black/30 px-4 py-2.5">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleSelectAll}
                    className="border-gold/40 data-[state=checked]:bg-gold data-[state=checked]:border-gold data-[state=checked]:text-black"
                  />
                  <span className="text-xs text-muted-foreground">
                    {allSelected ? "Deselect all" : "Select all"} ({txns.length} transaction{txns.length !== 1 ? "s" : ""})
                  </span>
                </div>
              )}

              {txns.map((t: any) => (
                <div
                  key={t.id}
                  className={`flex flex-col gap-3 rounded-lg border p-3 sm:p-4 transition-all duration-200 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4 ${
                    selectedIds.has(t.id)
                      ? "border-gold/50 bg-gold/[0.06]"
                      : "border-border/60 bg-black/20 hover:border-gold/30"
                  }`}
                >
                  <div className="flex items-start gap-3 sm:items-center sm:gap-4">
                    {tab === "PENDING" && (
                      <Checkbox
                        checked={selectedIds.has(t.id)}
                        onCheckedChange={() => toggleSelect(t.id)}
                        className="border-gold/40 data-[state=checked]:bg-gold data-[state=checked]:border-gold data-[state=checked]:text-black mt-1 sm:mt-0"
                      />
                    )}
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${t.type === "DEPOSIT" ? "bg-profit/10 text-profit" : "bg-info/10 text-info"}`}>
                      {t.type === "DEPOSIT" ? <ArrowDownToLine className="h-5 w-5" /> : <ArrowUpFromLine className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <TypePill type={t.type} />
                        <StatusPill status={t.status} />
                        <MethodBadge method={t.method} cryptoAmount={t.cryptoAmount} />
                      </div>
                      <div className="mt-1 font-metric text-lg font-bold text-foreground">{fmtUSD(t.amount)}</div>
                      {(t.method ?? "UPI").toUpperCase() === "UPI" ? (
                        <span className="mt-0.5 inline-block rounded-sm bg-gold/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gold/80">INR</span>
                      ) : (
                        t.cryptoAmount && (
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            {formatCryptoAmount(t.method, t.cryptoAmount)}
                          </div>
                        )
                      )}
                      {t.proofRef && (
                        <div className="mt-1 inline-flex items-center gap-1 rounded-md border border-gold/20 bg-gold/5 px-1.5 py-0.5 text-[10px] font-medium text-gold/90 max-w-full">
                          <Hash className="h-2.5 w-2.5 shrink-0" />
                          <span className="font-mono truncate max-w-[140px]">{t.proofRef}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4 sm:ml-auto">
                    <div className="min-w-0 sm:min-w-[180px]">
                      <div className="text-xs text-muted-foreground">Investor</div>
                      <div className="text-sm font-medium text-foreground truncate">{t.user?.name}</div>
                      <div className="text-xs text-muted-foreground break-words-mobile">{t.user?.email}</div>
                    </div>
                    <div className="min-w-[100px] sm:min-w-[120px]">
                      <div className="text-xs text-muted-foreground">Requested</div>
                      <div className="text-sm text-foreground">{fmtDate(t.createdAt, true)}</div>
                    </div>
                    {t.notes && (
                      <div className="min-w-0 max-w-xs hide-mobile">
                        <div className="text-xs text-muted-foreground">Notes</div>
                        <div className="truncate text-sm text-foreground" title={t.notes}>{t.notes}</div>
                      </div>
                    )}
                  </div>
                  {t.status === "PENDING" && (
                    <div className="flex gap-2 sm:items-center">
                      <Button size="sm" onClick={() => { setReviewing(t); setNotes(t.notes ?? ""); }} className="tap-target-sm bg-gold-gradient text-black hover:opacity-90 btn-full-mobile">
                        Review
                      </Button>
                    </div>
                  )}
                  {t.processor && (
                    <div className="text-xs text-muted-foreground">by {t.processor.name}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </FadeIn>

      {/* Bulk Action Floating Bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-3 left-3 right-3 sm:bottom-6 sm:left-1/2 sm:right-auto z-50 sm:-translate-x-1/2 safe-area-bottom"
          >
            <div className="flex flex-col gap-3 rounded-2xl border border-gold/30 bg-card/95 px-4 py-3 shadow-[0_0_40px_rgba(212,175,55,0.15)] backdrop-blur-xl sm:flex-row sm:items-center sm:gap-3 sm:px-5">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-gold shrink-0" />
                <span className="text-sm font-medium text-foreground">
                  {selectedIds.size} transaction{selectedIds.size !== 1 ? "s" : ""} selected
                </span>
              </div>
              <div className="hidden h-6 w-px bg-border/60 sm:block" />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => setBulkAction("approve")}
                  disabled={bulkActing}
                  className="bg-gold-gradient text-black hover:opacity-90 press-scale tap-target-sm flex-1 sm:flex-none"
                >
                  <Check className="mr-1.5 h-3.5 w-3.5" /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setBulkAction("reject")}
                  disabled={bulkActing}
                  className="border-loss/40 text-loss hover:bg-loss/10 press-scale tap-target-sm flex-1 sm:flex-none"
                >
                  <X className="mr-1.5 h-3.5 w-3.5" /> Reject
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={clearSelection}
                  className="text-muted-foreground hover:text-foreground tap-target-sm"
                >
                  Clear
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Action Confirmation Dialog */}
      <Dialog open={bulkAction !== null} onOpenChange={(o) => { if (!o && !bulkActing) { setBulkAction(null); setBulkNotes(""); } }}>
        <DialogContent className="border-gold/20 bg-card/95 backdrop-blur-xl max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto scroll-luxury">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {bulkAction === "approve" ? (
                <Check className="h-5 w-5 text-profit" />
              ) : (
                <X className="h-5 w-5 text-loss" />
              )}
              Bulk {bulkAction === "approve" ? "Approve" : "Reject"} Transactions
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to {bulkAction} {selectedIds.size} transaction{selectedIds.size !== 1 ? "s" : ""}?
              {bulkAction === "reject" && " Please provide a reason for rejection."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {bulkActing ? (
              <div className="flex flex-col items-center gap-4 py-6">
                <Loader2 className="h-8 w-8 animate-spin text-gold" />
                <div className="text-center">
                  <div className="text-sm font-medium text-foreground">
                    {bulkAction === "approve" ? "Approving" : "Rejecting"} {bulkProgress.current}/{bulkProgress.total}...
                  </div>
                  <div className="mt-2 h-2 w-48 max-w-full overflow-hidden rounded-full bg-muted/30">
                    <motion.div
                      className="h-full rounded-full bg-gold-gradient"
                      initial={{ width: 0 }}
                      animate={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Selected transactions summary */}
                <div className="max-h-40 space-y-2 overflow-y-auto scroll-luxury rounded-lg border border-border/60 bg-black/20 p-3">
                  {Array.from(selectedIds).map((id) => {
                    const t = txns.find((tx: any) => tx.id === id);
                    if (!t) return null;
                    return (
                      <div key={id} className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <TypePill type={t.type} />
                          <span className="text-muted-foreground truncate">{t.user?.name}</span>
                        </div>
                        <span className="font-metric font-semibold shrink-0">{fmtUSD(t.amount)}</span>
                      </div>
                    );
                  })}
                </div>
                {bulkAction === "reject" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Rejection Reason (optional)</Label>
                    <Textarea
                      value={bulkNotes}
                      onChange={(e) => setBulkNotes(e.target.value)}
                      placeholder="Reason for rejecting these transactions…"
                      className="border-border/60 bg-black/30 text-sm"
                      rows={2}
                    />
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
            {!bulkActing && (
              <>
                <Button variant="ghost" onClick={() => { setBulkAction(null); setBulkNotes(""); }} className="btn-full-mobile">Cancel</Button>
                <Button
                  onClick={executeBulkAction}
                  className={bulkAction === "approve" ? "bg-gold-gradient text-black hover:opacity-90 btn-full-mobile" : "border-loss/40 text-loss hover:bg-loss/10 btn-full-mobile"}
                  variant={bulkAction === "reject" ? "outline" : "default"}
                >
                  {bulkAction === "approve" ? (
                    <><Check className="mr-1.5 h-4 w-4" /> Confirm Approval</>
                  ) : (
                    <><X className="mr-1.5 h-4 w-4" /> Confirm Rejection</>
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review modal */}
      <Dialog open={reviewing !== null} onOpenChange={(o) => !o && setReviewing(null)}>
        <DialogContent className="border-gold/20 bg-card/95 backdrop-blur-xl max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto scroll-luxury">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {reviewing?.type === "DEPOSIT" ? <ArrowDownToLine className="h-5 w-5 text-profit" /> : <ArrowUpFromLine className="h-5 w-5 text-info" />}
              Review Transaction
            </DialogTitle>
            <DialogDescription>
              {reviewing?.type === "DEPOSIT" ? "Capital deposit request" : "Capital withdrawal request"} from {reviewing?.user?.name}
            </DialogDescription>
          </DialogHeader>
          {reviewing && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-border/60 bg-black/20 p-3 sm:p-4">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Amount</div>
                  <div className="font-metric text-lg sm:text-xl font-bold text-gold break-words-mobile">{fmtUSD(reviewing.amount)}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Type</div>
                  <div className="mt-1"><TypePill type={reviewing.type} /></div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Method</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <MethodBadge method={reviewing.method} cryptoAmount={reviewing.cryptoAmount} />
                    {reviewing.cryptoAmount && (
                      <span className="text-[11px] text-muted-foreground break-words-mobile">
                        {formatCryptoAmount(reviewing.method, reviewing.cryptoAmount)}
                      </span>
                    )}
                    {(reviewing.method ?? "UPI").toUpperCase() === "UPI" && (
                      <span className="text-[11px] text-muted-foreground">INR via UPI</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Investor</div>
                  <div className="text-sm font-medium text-foreground truncate">{reviewing.user?.name}</div>
                  <div className="text-xs text-muted-foreground break-words-mobile">{reviewing.user?.email}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Requested</div>
                  <div className="text-sm text-foreground">{fmtDate(reviewing.createdAt, true)}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Fund</div>
                  <div className="text-sm text-foreground truncate">{reviewing.fund?.name}</div>
                </div>
              </div>
              {reviewing.type === "DEPOSIT" && reviewing.proofRef && (
                <div className="rounded-lg border border-gold/30 bg-gold/[0.06] p-3">
                  <div className="flex items-center gap-2">
                    <Hash className="h-3.5 w-3.5 shrink-0 text-gold" />
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-gold">
                      {(reviewing.method ?? "UPI").toUpperCase() === "UPI" ? "UPI Reference (UTR)" : `${(reviewing.method ?? "Crypto").toUpperCase()} Transaction Hash`}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <code className="block flex-1 min-w-0 overflow-x-auto scroll-row rounded-md border border-border/60 bg-black/40 px-2.5 py-1.5 font-mono text-[11px] text-foreground break-all">
                      {reviewing.proofRef}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 border-gold/30 hover:bg-gold/10 btn-full-mobile"
                      onClick={() => {
                        navigator.clipboard?.writeText(reviewing.proofRef);
                        toast.success("Proof reference copied");
                      }}
                    >
                      <Copy className="mr-1 h-3.5 w-3.5" /> Copy
                    </Button>
                  </div>
                  <div className="mt-2 text-[11px] text-muted-foreground break-words-mobile">
                    Verify this reference on the payment app / blockchain explorer before approving.
                  </div>
                </div>
              )}
              {reviewing.type === "DEPOSIT" && (
                <div className="rounded-lg border border-profit/20 bg-profit/5 p-3 text-xs text-foreground/90">
                  <strong className="text-profit">Approving</strong> will mint {fmtNum(reviewing.amount, 2)} units at current NAV and post a ledger entry.
                </div>
              )}
              {reviewing.type === "WITHDRAWAL" && (
                <div className="rounded-lg border border-info/20 bg-info/5 p-3 text-xs text-foreground/90">
                  <strong className="text-info">Approving</strong> will redeem units and deduct {fmtUSD(reviewing.amount)} from the investor&apos;s balance.
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Admin Notes (optional)</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add review notes…" className="border-border/60 bg-black/30 text-sm" rows={2} />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
            <Button variant="outline" onClick={() => setReviewing(null)} className="btn-full-mobile">Cancel</Button>
            <Button variant="outline" onClick={() => act("reject")} disabled={acting} className="border-loss/40 text-loss hover:bg-loss/10 btn-full-mobile">
              <X className="mr-1 h-4 w-4" /> Reject
            </Button>
            <Button onClick={() => act("approve")} disabled={acting} className="bg-gold-gradient text-black hover:opacity-90 btn-full-mobile">
              <Check className="mr-1 h-4 w-4" /> {acting ? "Processing…" : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function fmtNum(v: number, d: number) { return v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }); }

function useCount(status: string) {
  const { data } = useQuery<any>({
    queryKey: ["admin-transactions-count", status],
    queryFn: () => api.get(`/api/admin/transactions?status=${status}`),
    refetchInterval: 15000,
  });
  return data?.transactions?.length ?? 0;
}
