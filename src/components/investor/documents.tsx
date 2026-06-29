"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import {
  GlassCard, SectionTitle, FadeIn, SkeletonCard, SkeletonTable, EmptyState,
} from "@/components/brand/primitives";
import { fmtDate, timeAgo } from "@/lib/format";
import {
  FileText, Download, Receipt, FileSpreadsheet, ScrollText, FileCheck2,
  Eye, Mailbox, Inbox, ShieldCheck, Loader2, Plus, Clock, CheckCircle2,
  XCircle, FilePlus2, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/* ──────────────────────────────────────────────────────────────────────────────
   INVESTOR DOCUMENTS — Document Vault
   ────────────────────────────────────────────────────────────────────────────── */

interface DocumentItem {
  id: string;
  userId: string;
  title: string;
  type: string;
  period: string | null;
  description: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  isRead: boolean;
  createdAt: string;
}

interface DocumentsResponse {
  documents: DocumentItem[];
}

interface StatementRequestItem {
  id: string;
  periodStart: string;
  periodEnd: string;
  type: string;
  notes: string | null;
  status: string; // PENDING | COMPLETED | REJECTED
  documentId: string | null;
  createdAt: string;
  completedAt: string | null;
  document?: { id: string; title: string; type: string; period: string | null; fileName: string } | null;
}

interface StatementRequestsResponse {
  requests: StatementRequestItem[];
}

const TYPE_META: Record<string, { label: string; icon: typeof FileText; cls: string }> = {
  MONTHLY_STATEMENT: { label: "Statement", icon: FileText, cls: "border-gold/30 bg-gold/10 text-gold" },
  QUARTERLY_REPORT: { label: "Quarterly", icon: ScrollText, cls: "border-info/30 bg-info/10 text-info" },
  TAX_STATEMENT: { label: "Tax", icon: FileSpreadsheet, cls: "border-amber-400/30 bg-amber-400/10 text-amber-400" },
  TRADE_CONFIRMATION: { label: "Trade", icon: Receipt, cls: "border-profit/30 bg-profit/10 text-profit" },
  ACCOUNT_STATEMENT: { label: "Account", icon: FileCheck2, cls: "border-info/30 bg-info/10 text-info" },
  CUSTOM: { label: "Other", icon: FileText, cls: "border-border bg-muted/40 text-muted-foreground" },
};

const REQUEST_TYPE_OPTIONS: { value: string; label: string; description: string }[] = [
  { value: "MONTHLY_STATEMENT", label: "Monthly Statement", description: "Standard monthly account statement" },
  { value: "QUARTERLY_REPORT", label: "Quarterly Report", description: "Comprehensive quarterly performance review" },
  { value: "TAX_STATEMENT", label: "Tax Statement", description: "Tax-reporting document for the period" },
  { value: "CUSTOM", label: "Custom", description: "Bespoke statement for a custom date range" },
];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getRequestStatusBadge(status: string) {
  switch (status) {
    case "PENDING":
      return (
        <span className="status-pill-pulse inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,166,35,0.7)]" />
          Pending
        </span>
      );
    case "COMPLETED":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-profit/40 bg-profit/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-profit">
          <CheckCircle2 className="h-3 w-3" />
          Completed
        </span>
      );
    case "REJECTED":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-loss/40 bg-loss/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-loss">
          <XCircle className="h-3 w-3" />
          Rejected
        </span>
      );
    default:
      return null;
  }
}

const FILTER_TABS = [
  { id: "all", label: "All", types: null },
  { id: "statements", label: "Statements", types: ["MONTHLY_STATEMENT", "ACCOUNT_STATEMENT"] },
  { id: "tax", label: "Tax", types: ["TAX_STATEMENT"] },
  { id: "trade", label: "Trade Confirms", types: ["TRADE_CONFIRMATION"] },
  { id: "other", label: "Other", types: ["QUARTERLY_REPORT", "CUSTOM"] },
] as const;

function fmtDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function InvestorDocuments() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>("all");

  // Request Statement dialog state
  const [requestOpen, setRequestOpen] = useState(false);
  const [reqType, setReqType] = useState("MONTHLY_STATEMENT");
  const [reqStart, setReqStart] = useState("");
  const [reqEnd, setReqEnd] = useState("");
  const [reqNotes, setReqNotes] = useState("");

  const { data, isLoading } = useQuery<DocumentsResponse>({
    queryKey: ["investor-documents"],
    queryFn: () => api.get("/api/documents"),
    retry: 1,
  });

  const { data: reqData, isLoading: reqLoading } = useQuery<StatementRequestsResponse>({
    queryKey: ["investor-statement-requests"],
    queryFn: () => api.get("/api/statement-requests"),
    retry: 1,
  });

  const documents = data?.documents ?? [];
  const requests = reqData?.requests ?? [];

  // Apply client-side filter tabs (multi-type per tab)
  const activeTab = FILTER_TABS.find((t) => t.id === filter);
  const filtered = activeTab?.types
    ? documents.filter((d) => activeTab.types!.includes(d.type))
    : documents;

  const unreadCount = documents.filter((d) => !d.isRead).length;
  const latestStatement = documents.find((d) => d.type === "MONTHLY_STATEMENT");

  const handleDownload = async (doc: DocumentItem) => {
    try {
      // Open the download URL in a new tab — browser streams the file
      window.open(`/api/documents/${doc.id}/download`, "_blank");
      // Optimistically invalidate to refresh read status
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["investor-documents"] });
      }, 1500);
      toast.success(`Downloading: ${doc.title}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    }
  };

  const createRequest = useMutation({
    mutationFn: (payload: { periodStart: string; periodEnd: string; type: string; notes?: string }) =>
      api.post<{ request: StatementRequestItem }>("/api/statement-requests", payload),
    onSuccess: () => {
      toast.success("Statement request submitted", {
        description: "The fund administrator will review your request shortly.",
      });
      setRequestOpen(false);
      setReqType("MONTHLY_STATEMENT");
      setReqStart("");
      setReqEnd("");
      setReqNotes("");
      queryClient.invalidateQueries({ queryKey: ["investor-statement-requests"] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to submit request"),
  });

  const handleSubmitRequest = () => {
    if (!reqStart || !reqEnd) {
      toast.error("Please select a period start and end date");
      return;
    }
    const start = new Date(reqStart);
    const end = new Date(reqEnd);
    end.setHours(23, 59, 59, 999);
    if (start >= end) {
      toast.error("Period end must be after period start");
      return;
    }
    if (start.getTime() > Date.now() + 60_000) {
      toast.error("Period start cannot be in the future");
      return;
    }
    createRequest.mutate({
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      type: reqType,
      notes: reqNotes.trim() || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <FadeIn>
          <div>
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Investor Portal</span>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Document Vault</h1>
            <p className="text-sm text-muted-foreground">Statements, tax forms &amp; official correspondence</p>
          </div>
        </FadeIn>
        <FadeIn delay={0.05}>
          <div className="grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => <SkeletonCard key={i} className="h-24" />)}
          </div>
        </FadeIn>
        <FadeIn delay={0.1}>
          <GlassCard className="p-5">
            <SkeletonTable rows={5} cols={6} />
          </GlassCard>
        </FadeIn>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Investor Portal</span>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Document Vault</h1>
            <p className="text-sm text-muted-foreground">Statements, tax forms &amp; official correspondence</p>
          </div>
          <Button
            onClick={() => setRequestOpen(true)}
            variant="outline"
            className="self-start border-gold/40 text-gold hover:bg-gold/10 hover:text-gold press-scale sm:self-auto"
          >
            <FilePlus2 className="h-4 w-4" />
            <span className="ml-1.5">Request Statement</span>
          </Button>
        </div>
      </FadeIn>

      {/* Stats Bar */}
      <FadeIn delay={0.05}>
        <div className="grid gap-4 sm:grid-cols-3">
          <GlassCard className="p-4 hover-lift">
            <div className="flex items-center gap-2 text-muted-foreground">
              <FileText className="h-4 w-4 text-gold" />
              <span className="text-[11px] uppercase tracking-wider">Total Documents</span>
            </div>
            <div className="mt-1 font-metric text-2xl font-bold text-foreground">{documents.length}</div>
          </GlassCard>
          <GlassCard className="p-4 hover-lift">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mailbox className="h-4 w-4 text-gold" />
              <span className="text-[11px] uppercase tracking-wider">Unread</span>
            </div>
            <div className="mt-1 font-metric text-2xl font-bold text-gold">{unreadCount}</div>
          </GlassCard>
          <GlassCard className="p-4 hover-lift">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4 text-gold" />
              <span className="text-[11px] uppercase tracking-wider">Pending Requests</span>
            </div>
            <div className="mt-1 font-metric text-2xl font-bold text-amber-400">
              {requests.filter((r) => r.status === "PENDING").length}
            </div>
          </GlassCard>
        </div>
      </FadeIn>

      {/* Filter Tabs — padded for breathing room, subtle hover lift */}
      <FadeIn delay={0.1}>
        <div className="flex flex-wrap items-center gap-2">
          {FILTER_TABS.map((t) => {
            const count = t.types
              ? documents.filter((d) => t.types!.includes(d.type)).length
              : documents.length;
            return (
              <button
                key={t.id}
                onClick={() => setFilter(t.id)}
                className={cn(
                  "rounded-full border px-4 py-2 text-xs font-medium transition-all press-scale hover:-translate-y-0.5",
                  filter === t.id
                    ? "border-gold/40 bg-gold/10 text-gold shadow-[0_0_12px_rgba(212,175,55,0.15)]"
                    : "border-border/60 text-muted-foreground hover:border-gold/25 hover:bg-gold/[0.04] hover:text-foreground"
                )}
              >
                {t.label} <span className="ml-1 opacity-60">{count}</span>
              </button>
            );
          })}
        </div>
      </FadeIn>

      {/* Documents Table */}
      <FadeIn delay={0.15}>
        <GlassCard className="p-5">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Inbox className="h-6 w-6" />}
              title="No documents yet"
              description="Your statements, tax forms and trade confirmations will appear here once they are issued by the fund administrator."
            />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden overflow-x-auto scroll-luxury md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <th className="pb-3 pr-4">Date</th>
                      <th className="pb-3 pr-4">Type</th>
                      <th className="pb-3 pr-4">Title</th>
                      <th className="pb-3 pr-4">Period</th>
                      <th className="pb-3 pr-4">Size</th>
                      <th className="pb-3 pr-4">Status</th>
                      <th className="pb-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((doc, idx) => {
                      const meta = TYPE_META[doc.type] ?? TYPE_META.CUSTOM;
                      const Icon = meta.icon;
                      return (
                        <tr
                          key={doc.id}
                          className="group border-b border-border/20 transition-colors hover:bg-gold/[0.03]"
                          style={{ animationDelay: `${idx * 30}ms` }}
                        >
                          <td className="py-3 pr-4 align-middle">
                            <div className="text-xs text-foreground">{fmtDate(doc.createdAt)}</div>
                            <div className="text-[10px] text-muted-foreground">{timeAgo(doc.createdAt)}</div>
                          </td>
                          <td className="py-3 pr-4 align-middle">
                            <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-medium", meta.cls)}>
                              <Icon className="h-3 w-3" />
                              {meta.label}
                            </span>
                          </td>
                          <td className="py-3 pr-4 align-middle">
                            <div className={cn("text-xs", doc.isRead ? "text-foreground/80" : "font-semibold text-foreground")}>
                              {doc.title}
                            </div>
                            {doc.description && (
                              <div className="mt-0.5 max-w-[220px] truncate text-[10px] text-muted-foreground">
                                {doc.description}
                              </div>
                            )}
                          </td>
                          <td className="py-3 pr-4 align-middle">
                            <span className="text-[11px] text-muted-foreground">{doc.period ?? "—"}</span>
                          </td>
                          <td className="py-3 pr-4 align-middle">
                            <span className="text-[11px] text-muted-foreground">{formatSize(doc.sizeBytes)}</span>
                          </td>
                          <td className="py-3 pr-4 align-middle">
                            {doc.isRead ? (
                              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Eye className="h-3 w-3" /> Read
                              </span>
                            ) : (
                              <span className="status-pill-pulse inline-flex animate-pulse items-center gap-1 rounded-full border border-gold/40 bg-gold/15 px-2 py-0.5 text-[9px] font-bold tracking-wider text-gold shadow-[0_0_10px_rgba(212,175,55,0.35)]">
                                <span className="h-1 w-1 rounded-full bg-gold-bright" />
                                NEW
                              </span>
                            )}
                          </td>
                          <td className="py-3 align-middle">
                            <div className="flex justify-center">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDownload(doc)}
                                className="border-gold/20 text-gold hover:bg-gold/10 hover:text-gold press-scale"
                              >
                                <Download className="h-3.5 w-3.5" />
                                <span className="ml-1 hidden lg:inline">Download</span>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="space-y-3 md:hidden">
                {filtered.map((doc, idx) => {
                  const meta = TYPE_META[doc.type] ?? TYPE_META.CUSTOM;
                  const Icon = meta.icon;
                  return (
                    <div
                      key={doc.id}
                      className={cn(
                        "rounded-lg border border-border/40 bg-black/30 p-3 transition-colors hover-lift",
                        !doc.isRead && "border-l-2 border-l-gold"
                      )}
                      style={{ animationDelay: `${idx * 30}ms` }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-medium", meta.cls)}>
                              <Icon className="h-2.5 w-2.5" />
                              {meta.label}
                            </span>
                            {!doc.isRead && (
                              <span className="status-pill-pulse inline-flex animate-pulse items-center gap-1 rounded-full border border-gold/40 bg-gold/15 px-1.5 py-0.5 text-[8px] font-bold tracking-wider text-gold">
                                NEW
                              </span>
                            )}
                          </div>
                          <div className="mt-1.5 text-sm font-medium text-foreground">{doc.title}</div>
                          {doc.description && (
                            <div className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">{doc.description}</div>
                          )}
                          <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span>{fmtDate(doc.createdAt)}</span>
                            <span>·</span>
                            <span>{doc.period ?? "—"}</span>
                            <span>·</span>
                            <span>{formatSize(doc.sizeBytes)}</span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownload(doc)}
                          className="shrink-0 border-gold/20 text-gold hover:bg-gold/10 press-scale"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </GlassCard>
      </FadeIn>

      {/* Pending Statement Requests Section */}
      <FadeIn delay={0.2}>
        <div>
          <SectionTitle
            title="Statement Requests"
            subtitle="Track your submitted statement requests"
            action={
              <span className="text-[11px] text-muted-foreground">
                {requests.length} {requests.length === 1 ? "request" : "requests"} total
              </span>
            }
          />
          <div className="mt-3">
            {reqLoading ? (
              <GlassCard className="p-5">
                <SkeletonTable rows={2} cols={5} />
              </GlassCard>
            ) : requests.length === 0 ? (
              <GlassCard className="p-5">
                <EmptyState
                  icon={<FilePlus2 className="h-6 w-6" />}
                  title="No statement requests"
                  description="Click 'Request Statement' above to ask the fund administrator for a custom-period statement, quarterly report, or tax document."
                />
              </GlassCard>
            ) : (
              <div className="space-y-2">
                {requests.map((r, idx) => (
                  <GlassCard key={r.id} className="p-4 hover-lift" >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
                          r.status === "PENDING" && "border-amber-400/30 bg-amber-400/10",
                          r.status === "COMPLETED" && "border-profit/30 bg-profit/10",
                          r.status === "REJECTED" && "border-loss/30 bg-loss/10",
                        )}>
                          {r.status === "PENDING" && <Clock className="h-4 w-4 text-amber-400" />}
                          {r.status === "COMPLETED" && <CheckCircle2 className="h-4 w-4 text-profit" />}
                          {r.status === "REJECTED" && <XCircle className="h-4 w-4 text-loss" />}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-foreground">
                              {REQUEST_TYPE_OPTIONS.find((o) => o.value === r.type)?.label ?? r.type}
                            </span>
                            {getRequestStatusBadge(r.status)}
                          </div>
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            Period: {fmtDate(r.periodStart)} → {fmtDate(r.periodEnd)}
                          </div>
                          <div className="mt-0.5 text-[10px] text-muted-foreground/70">
                            Requested {timeAgo(r.createdAt)}{r.completedAt && ` · ${r.status.toLowerCase()} ${timeAgo(r.completedAt)}`}
                          </div>
                          {r.notes && (
                            <div className="mt-1 max-w-md truncate text-[10px] italic text-muted-foreground/60">
                              "{r.notes}"
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {r.status === "COMPLETED" && r.document && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(`/api/documents/${r.document!.id}/download`, "_blank")}
                            className="border-gold/30 text-gold hover:bg-gold/10 press-scale"
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span className="ml-1">View Document</span>
                            <ChevronRight className="ml-1 h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </GlassCard>
                ))}
              </div>
            )}
          </div>
        </div>
      </FadeIn>

      {/* Generate Note (only admins can generate) */}
      <FadeIn delay={0.25}>
        <GlassCard gold className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/10">
              <ShieldCheck className="h-4 w-4 text-gold" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-foreground">Need a custom statement?</div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Use the <span className="font-medium text-gold">Request Statement</span> button above to ask the fund administrator
                for any official document — monthly statements, quarterly reports, tax forms, or custom-period statements.
                You'll receive a real-time notification when your request is fulfilled.
              </p>
            </div>
          </div>
        </GlassCard>
      </FadeIn>

      {/* Request Statement Dialog */}
      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="glass-strong border-gold/30 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <FilePlus2 className="h-4 w-4 text-gold" />
              Request a Statement
            </DialogTitle>
            <DialogDescription>
              Submit a request to the fund administrator. They'll generate your official statement and notify you when it's ready.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Statement Type */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Statement Type</Label>
              <Select value={reqType} onValueChange={setReqType}>
                <SelectTrigger className="border-border/60 bg-black/30 focus:ring-2 focus:ring-gold/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-strong border-gold/20 max-h-72">
                  {REQUEST_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      <div className="flex flex-col">
                        <span>{o.label}</span>
                        <span className="text-[10px] text-muted-foreground">{o.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Period Start */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Period Start</Label>
                <Input
                  type="date"
                  value={reqStart}
                  onChange={(e) => setReqStart(e.target.value)}
                  max={fmtDateInput(new Date())}
                  className="border-border/60 bg-black/30 focus:ring-2 focus:ring-gold/30"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Period End</Label>
                <Input
                  type="date"
                  value={reqEnd}
                  onChange={(e) => setReqEnd(e.target.value)}
                  max={fmtDateInput(new Date())}
                  className="border-border/60 bg-black/30 focus:ring-2 focus:ring-gold/30"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Notes <span className="text-muted-foreground/60">(optional)</span>
              </Label>
              <Textarea
                value={reqNotes}
                onChange={(e) => setReqNotes(e.target.value)}
                placeholder="e.g. Need for tax filing, auditor request, additional context..."
                className="min-h-[70px] resize-y border-border/60 bg-black/30 text-xs focus:ring-2 focus:ring-gold/30"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setRequestOpen(false)}
              className="border-border/60 text-muted-foreground hover:bg-muted/30"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitRequest}
              disabled={createRequest.isPending}
              className="bg-gold-gradient text-black font-semibold hover:opacity-90 press-scale"
            >
              {createRequest.isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Submitting...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Plus className="h-3.5 w-3.5" />
                  Submit Request
                </span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
