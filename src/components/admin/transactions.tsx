"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { GlassCard, SectionTitle, StatusPill, TypePill, FadeIn, EmptyState } from "@/components/brand/primitives";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmtUSD, fmtDate } from "@/lib/format";
import { Check, X, ArrowDownToLine, ArrowUpFromLine, Clock, Inbox } from "lucide-react";
import { toast } from "sonner";

export function AdminTransactions() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("PENDING");
  const [reviewing, setReviewing] = useState<any | null>(null);
  const [notes, setNotes] = useState("");
  const [acting, setActing] = useState(false);

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

  const counts = {
    PENDING: useCount("PENDING"),
    APPROVED: useCount("APPROVED"),
    REJECTED: useCount("REJECTED"),
  };

  return (
    <div className="space-y-6">
      <FadeIn>
        <div>
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Admin Console</span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Transaction Review</h1>
          <p className="text-sm text-muted-foreground">Approve or reject deposit and withdrawal requests</p>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-black/30 border border-border/60">
            <TabsTrigger value="PENDING" className="data-[state=active]:bg-gold-gradient data-[state=active]:text-black">
              <Clock className="mr-1.5 h-3.5 w-3.5" /> Pending {counts.PENDING > 0 && <span className="ml-1.5 rounded-full bg-loss px-1.5 text-[10px] text-white">{counts.PENDING}</span>}
            </TabsTrigger>
            <TabsTrigger value="APPROVED" className="data-[state=active]:bg-gold-gradient data-[state=active]:text-black">Approved</TabsTrigger>
            <TabsTrigger value="REJECTED" className="data-[state=active]:bg-gold-gradient data-[state=active]:text-black">Rejected</TabsTrigger>
          </TabsList>
        </Tabs>
      </FadeIn>

      <FadeIn delay={0.1}>
        <GlassCard className="p-5">
          {txns.length === 0 ? (
            <EmptyState
              icon={<Inbox className="h-10 w-10" />}
              title={`No ${tab.toLowerCase()} transactions`}
              description={tab === "PENDING" ? "All caught up. New requests will appear here." : `No ${tab.toLowerCase()} transactions to display.`}
            />
          ) : (
            <div className="space-y-3">
              {txns.map((t: any) => (
                <div key={t.id} className="flex flex-wrap items-center gap-4 rounded-lg border border-border/60 bg-black/20 p-4 hover:border-gold/30">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${t.type === "DEPOSIT" ? "bg-profit/10 text-profit" : "bg-info/10 text-info"}`}>
                    {t.type === "DEPOSIT" ? <ArrowDownToLine className="h-5 w-5" /> : <ArrowUpFromLine className="h-5 w-5" />}
                  </div>
                  <div className="min-w-[160px] flex-1">
                    <div className="flex items-center gap-2">
                      <TypePill type={t.type} />
                      <StatusPill status={t.status} />
                    </div>
                    <div className="mt-1 font-metric text-lg font-bold text-foreground">{fmtUSD(t.amount)}</div>
                  </div>
                  <div className="min-w-[180px]">
                    <div className="text-xs text-muted-foreground">Investor</div>
                    <div className="text-sm font-medium text-foreground">{t.user?.name}</div>
                    <div className="text-xs text-muted-foreground">{t.user?.email}</div>
                  </div>
                  <div className="min-w-[120px]">
                    <div className="text-xs text-muted-foreground">Requested</div>
                    <div className="text-sm text-foreground">{fmtDate(t.createdAt, true)}</div>
                  </div>
                  {t.notes && (
                    <div className="min-w-[140px] max-w-xs">
                      <div className="text-xs text-muted-foreground">Notes</div>
                      <div className="truncate text-sm text-foreground" title={t.notes}>{t.notes}</div>
                    </div>
                  )}
                  {t.status === "PENDING" && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => { setReviewing(t); setNotes(t.notes ?? ""); }} className="bg-gold-gradient text-black hover:opacity-90">
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

      {/* Review modal */}
      <Dialog open={reviewing !== null} onOpenChange={(o) => !o && setReviewing(null)}>
        <DialogContent className="border-gold/20 bg-card/95 backdrop-blur-xl sm:max-w-lg">
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
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-border/60 bg-black/20 p-4">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Amount</div>
                  <div className="font-metric text-xl font-bold text-gold">{fmtUSD(reviewing.amount)}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Type</div>
                  <div className="mt-1"><TypePill type={reviewing.type} /></div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Investor</div>
                  <div className="text-sm font-medium text-foreground">{reviewing.user?.name}</div>
                  <div className="text-xs text-muted-foreground">{reviewing.user?.email}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Requested</div>
                  <div className="text-sm text-foreground">{fmtDate(reviewing.createdAt, true)}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Fund</div>
                  <div className="text-sm text-foreground">{reviewing.fund?.name}</div>
                </div>
              </div>
              {reviewing.type === "DEPOSIT" && (
                <div className="rounded-lg border border-profit/20 bg-profit/5 p-3 text-xs text-foreground/90">
                  <strong className="text-profit">Approving</strong> will mint {fmtNum(reviewing.amount, 2)} units at current NAV and post a ledger entry.
                </div>
              )}
              {reviewing.type === "WITHDRAWAL" && (
                <div className="rounded-lg border border-info/20 bg-info/5 p-3 text-xs text-foreground/90">
                  <strong className="text-info">Approving</strong> will redeem units and deduct {fmtUSD(reviewing.amount)} from the investor's balance.
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Admin Notes (optional)</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add review notes…" className="border-border/60 bg-black/30 text-sm" rows={2} />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setReviewing(null)}>Cancel</Button>
            <Button variant="outline" onClick={() => act("reject")} disabled={acting} className="border-loss/40 text-loss hover:bg-loss/10">
              <X className="mr-1 h-4 w-4" /> Reject
            </Button>
            <Button onClick={() => act("approve")} disabled={acting} className="bg-gold-gradient text-black hover:opacity-90">
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
