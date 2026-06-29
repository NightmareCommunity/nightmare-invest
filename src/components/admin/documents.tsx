"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import {
  GlassCard, SectionTitle, FadeIn, SkeletonCard, SkeletonTable, EmptyState,
} from "@/components/brand/primitives";
import { fmtDate, timeAgo } from "@/lib/format";
import {
  FileText, Download, Receipt, FileSpreadsheet, ScrollText, FileCheck2,
  Trash2, Upload, Plus, Search, Filter, FilePlus2, Loader2, ShieldAlert, Users,
  Clock, CheckCircle2, XCircle, ChevronRight, Inbox, Calendar, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/* ──────────────────────────────────────────────────────────────────────────────
   ADMIN DOCUMENTS — Generate statements & manage investor documents
   ────────────────────────────────────────────────────────────────────────────── */

interface UserBrief { id: string; name: string; email: string; role: string; }
interface UsersResponse { users: UserBrief[]; }

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
  user: { id: string; name: string; email: string };
}

interface DocumentsResponse {
  documents: DocumentItem[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

interface StatementRequestItem {
  id: string;
  periodStart: string;
  periodEnd: string;
  type: string;
  notes: string | null;
  status: string;
  documentId: string | null;
  processedBy: string | null;
  createdAt: string;
  completedAt: string | null;
  user: { id: string; name: string; email: string };
  document?: { id: string; title: string; type: string; period: string | null; fileName: string } | null;
  processor?: { id: string; name: string; email: string } | null;
}

interface StatementRequestsResponse {
  requests: StatementRequestItem[];
  pendingCount: number;
  pagination: { page: number; limit: number; total: number; pages: number };
}

const TYPE_META: Record<string, { label: string; icon: typeof FileText; cls: string }> = {
  MONTHLY_STATEMENT: { label: "Statement", icon: FileText, cls: "border-gold/30 bg-gold/10 text-gold" },
  QUARTERLY_REPORT: { label: "Quarterly", icon: ScrollText, cls: "border-info/30 bg-info/10 text-info" },
  TAX_STATEMENT: { label: "Tax", icon: FileSpreadsheet, cls: "border-amber-400/30 bg-amber-400/10 text-amber-400" },
  TRADE_CONFIRMATION: { label: "Trade", icon: Receipt, cls: "border-profit/30 bg-profit/10 text-profit" },
  ACCOUNT_STATEMENT: { label: "Account", icon: FileCheck2, cls: "border-info/30 bg-info/10 text-info" },
  CUSTOM: { label: "Other", icon: FileText, cls: "border-border bg-muted/40 text-muted-foreground" },
};

const REQUEST_TYPE_LABELS: Record<string, string> = {
  MONTHLY_STATEMENT: "Monthly Statement",
  QUARTERLY_REPORT: "Quarterly Report",
  TAX_STATEMENT: "Tax Statement",
  CUSTOM: "Custom",
};

const UPLOAD_TYPES = [
  "MONTHLY_STATEMENT", "QUARTERLY_REPORT", "TAX_STATEMENT",
  "TRADE_CONFIRMATION", "ACCOUNT_STATEMENT", "CUSTOM",
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Shared label class — consistent institutional styling across all form fields
const LABEL_CLS = "text-xs font-medium uppercase tracking-wider text-muted-foreground";
const INPUT_CLS = "border-border/60 bg-black/30 focus:ring-2 focus:ring-gold/30";
const SELECT_TRIGGER_CLS = "border-border/60 bg-black/30 focus:ring-2 focus:ring-gold/30";

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

export function AdminDocuments() {
  const queryClient = useQueryClient();

  // Tab state
  const [tab, setTab] = useState<string>("documents");

  // Generate statement form state
  const [genInvestorId, setGenInvestorId] = useState("");
  const [genMonth, setGenMonth] = useState(new Date().getMonth());
  const [genYear, setGenYear] = useState(new Date().getFullYear());

  // Upload form state
  const [upInvestorId, setUpInvestorId] = useState("");
  const [upTitle, setUpTitle] = useState("");
  const [upType, setUpType] = useState("CUSTOM");
  const [upDescription, setUpDescription] = useState("");
  const [upFile, setUpFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Table state
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<DocumentItem | null>(null);

  // Reject statement-request state
  const [rejectTarget, setRejectTarget] = useState<StatementRequestItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Statement requests pagination
  const [reqPage, setReqPage] = useState(1);
  const [reqStatusFilter, setReqStatusFilter] = useState<string>("all");

  // ─── Fetch users (investors only) ───
  const { data: usersData } = useQuery<UsersResponse>({
    queryKey: ["admin-users-list"],
    queryFn: () => api.get("/api/admin/users"),
    retry: 1,
  });
  const investors = (usersData?.users || []).filter((u) => u.role !== "ADMIN");

  // ─── Fetch all documents ───
  const { data: docsData, isLoading: docsLoading } = useQuery<DocumentsResponse>({
    queryKey: ["admin-documents", page, typeFilter],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (typeFilter !== "all") params.set("type", typeFilter);
      return api.get(`/api/admin/documents?${params}`);
    },
    retry: 1,
  });

  // ─── Fetch statement requests (always fetched so the tab badge can show) ───
  const { data: reqData, isLoading: reqLoading } = useQuery<StatementRequestsResponse>({
    queryKey: ["admin-statement-requests", reqPage, reqStatusFilter],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(reqPage), limit: "20" });
      if (reqStatusFilter !== "all") params.set("status", reqStatusFilter);
      return api.get(`/api/admin/statement-requests?${params}`);
    },
    retry: 1,
  });

  const allDocs = docsData?.documents ?? [];
  const allRequests = reqData?.requests ?? [];
  const pendingCount = reqData?.pendingCount ?? 0;

  // Apply client-side search filter
  const filteredDocs = search
    ? allDocs.filter(
        (d) =>
          d.title.toLowerCase().includes(search.toLowerCase()) ||
          d.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
          d.user?.email?.toLowerCase().includes(search.toLowerCase())
      )
    : allDocs;

  // ─── Generate statement mutation ───
  const generateStatement = useMutation({
    mutationFn: (data: { userId: string; periodStart: string; periodEnd: string }) =>
      api.post<{ documentId: string; fileName: string }>("/api/admin/statements/generate", data),
    onSuccess: (resp) => {
      toast.success(`Statement generated: ${resp.fileName}`);
      queryClient.invalidateQueries({ queryKey: ["admin-documents"] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to generate statement"),
  });

  const handleGenerate = () => {
    if (!genInvestorId) {
      toast.error("Please select an investor");
      return;
    }
    const periodStart = new Date(genYear, genMonth, 1);
    const periodEnd = new Date(genYear, genMonth + 1, 0, 23, 59, 59);
    generateStatement.mutate({
      userId: genInvestorId,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    });
  };

  // ─── Upload document mutation ───
  const uploadDocument = useMutation({
    mutationFn: async () => {
      if (!upInvestorId) throw new Error("Please select an investor");
      if (!upTitle.trim()) throw new Error("Title is required");
      if (!upFile) throw new Error("Please select a file");
      const form = new FormData();
      form.append("file", upFile);
      form.append("userId", upInvestorId);
      form.append("title", upTitle.trim());
      form.append("type", upType);
      if (upDescription.trim()) form.append("description", upDescription.trim());
      return api.upload<{ document: DocumentItem }>("/api/admin/documents/upload", form);
    },
    onSuccess: () => {
      toast.success("Document uploaded successfully");
      setUpTitle("");
      setUpDescription("");
      setUpFile(null);
      setUpType("CUSTOM");
      if (fileInputRef.current) fileInputRef.current.value = "";
      queryClient.invalidateQueries({ queryKey: ["admin-documents"] });
    },
    onError: (err: Error) => toast.error(err.message || "Upload failed"),
  });

  // ─── Delete document mutation ───
  const deleteDocument = useMutation({
    mutationFn: (id: string) => api.del(`/api/admin/documents/${id}`),
    onSuccess: () => {
      toast.success("Document deleted");
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["admin-documents"] });
    },
    onError: (err: Error) => toast.error(err.message || "Delete failed"),
  });

  // ─── Fulfill statement request mutation ───
  const fulfillRequest = useMutation({
    mutationFn: (id: string) =>
      api.post<{ ok: boolean; status: string; documentId: string; fileName: string; title: string; period: string }>(
        `/api/admin/statement-requests/${id}/fulfill`
      ),
    onSuccess: (resp) => {
      toast.success("Statement request fulfilled", {
        description: `Generated: ${resp.title} (${resp.period})`,
      });
      queryClient.invalidateQueries({ queryKey: ["admin-statement-requests"] });
      queryClient.invalidateQueries({ queryKey: ["admin-documents"] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to fulfill request"),
  });

  // ─── Reject statement request mutation ───
  const rejectRequest = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.post<{ ok: boolean; status: string }>(`/api/admin/statement-requests/${id}/reject`, { reason }),
    onSuccess: () => {
      toast.success("Statement request rejected");
      setRejectTarget(null);
      setRejectReason("");
      queryClient.invalidateQueries({ queryKey: ["admin-statement-requests"] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to reject request"),
  });

  const handleFileChange = (file: File | null) => {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error("File too large. Max 25MB.");
      return;
    }
    setUpFile(file);
    if (!upTitle.trim()) {
      const name = file.name.replace(/\.[^/.]+$/, "");
      setUpTitle(name);
    }
  };

  const handleDownload = (doc: DocumentItem) => {
    window.open(`/api/documents/${doc.id}/download`, "_blank");
  };

  const totalDocuments = docsData?.pagination.total ?? 0;
  const currentYear = new Date().getFullYear();

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn>
        <div>
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Admin Console</span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Document Management</h1>
          <p className="text-sm text-muted-foreground">Generate statements &amp; manage investor documents</p>
        </div>
      </FadeIn>

      {/* Top-level Tabs: All Documents | Statement Requests */}
      <FadeIn delay={0.05}>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="glass border border-gold/15 p-1">
            <TabsTrigger
              value="documents"
              className="data-[state=active]:bg-gold/15 data-[state=active]:text-gold rounded-md px-4 py-2 text-xs font-medium"
            >
              <FileText className="h-3.5 w-3.5" />
              All Documents
            </TabsTrigger>
            <TabsTrigger
              value="requests"
              className="data-[state=active]:bg-gold/15 data-[state=active]:text-gold rounded-md px-4 py-2 text-xs font-medium"
            >
              <Inbox className="h-3.5 w-3.5" />
              Statement Requests
              {pendingCount > 0 && (
                <span className="status-pill-pulse ml-1 inline-flex h-5 items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/15 px-1.5 text-[10px] font-bold text-amber-400">
                  <span className="h-1 w-1 animate-pulse rounded-full bg-amber-400" />
                  {pendingCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ─── ALL DOCUMENTS TAB ─── */}
          <TabsContent value="documents" className="space-y-6">
            {/* Action Cards */}
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Generate Statement Card */}
              <GlassCard gold className="p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10">
                    <FilePlus2 className="h-5 w-5 text-gold" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Generate Monthly Statement</h2>
                    <p className="text-[11px] text-muted-foreground">Create an official PDF statement for an investor</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Investor selector */}
                  <div className="space-y-1.5">
                    <Label className={LABEL_CLS}>Investor</Label>
                    <Select value={genInvestorId} onValueChange={setGenInvestorId}>
                      <SelectTrigger className={SELECT_TRIGGER_CLS}>
                        <SelectValue placeholder="Select investor..." />
                      </SelectTrigger>
                      <SelectContent className="glass-strong border-gold/20 max-h-72">
                        {investors.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            <div className="flex items-center gap-2">
                              <Users className="h-3 w-3 text-muted-foreground" />
                              <span>{u.name}</span>
                              <span className="text-muted-foreground text-[11px]">({u.email})</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Period selector */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className={LABEL_CLS}>Month</Label>
                      <Select value={String(genMonth)} onValueChange={(v) => setGenMonth(Number(v))}>
                        <SelectTrigger className={SELECT_TRIGGER_CLS}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="glass-strong border-gold/20 max-h-72">
                          {MONTHS.map((m, i) => (
                            <SelectItem key={m} value={String(i)}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className={LABEL_CLS}>Year</Label>
                      <Select value={String(genYear)} onValueChange={(v) => setGenYear(Number(v))}>
                        <SelectTrigger className={SELECT_TRIGGER_CLS}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="glass-strong border-gold/20">
                          {Array.from({ length: 6 }, (_, i) => currentYear - i).map((y) => (
                            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button
                    onClick={handleGenerate}
                    disabled={generateStatement.isPending}
                    className="w-full bg-gold-gradient text-black font-semibold hover:opacity-90 press-scale"
                  >
                    {generateStatement.isPending ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Generating PDF...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <FilePlus2 className="h-3.5 w-3.5" />
                        Generate Statement
                      </span>
                    )}
                  </Button>
                </div>
              </GlassCard>

              {/* Upload Document Card */}
              <GlassCard className="p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/30">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Upload Custom Document</h2>
                    <p className="text-[11px] text-muted-foreground">Attach a file to an investor&apos;s vault</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Investor */}
                  <div className="space-y-1.5">
                    <Label className={LABEL_CLS}>Investor</Label>
                    <Select value={upInvestorId} onValueChange={setUpInvestorId}>
                      <SelectTrigger className={SELECT_TRIGGER_CLS}>
                        <SelectValue placeholder="Select investor..." />
                      </SelectTrigger>
                      <SelectContent className="glass-strong border-gold/20 max-h-72">
                        {investors.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            <div className="flex items-center gap-2">
                              <Users className="h-3 w-3 text-muted-foreground" />
                              <span>{u.name}</span>
                              <span className="text-muted-foreground text-[11px]">({u.email})</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Title + Type */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className={LABEL_CLS}>Title</Label>
                      <Input
                        value={upTitle}
                        onChange={(e) => setUpTitle(e.target.value)}
                        placeholder="Document title..."
                        className={INPUT_CLS}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className={LABEL_CLS}>Type</Label>
                      <Select value={upType} onValueChange={setUpType}>
                        <SelectTrigger className={SELECT_TRIGGER_CLS}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="glass-strong border-gold/20">
                          {UPLOAD_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>{TYPE_META[t]?.label ?? t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <Label className={LABEL_CLS}>
                      Description <span className="text-muted-foreground/60">(optional)</span>
                    </Label>
                    <Textarea
                      value={upDescription}
                      onChange={(e) => setUpDescription(e.target.value)}
                      placeholder="Brief description of this document..."
                      className={cn("min-h-[60px] resize-y text-xs", INPUT_CLS)}
                    />
                  </div>

                  {/* File drop zone — explicit 200px height, dashed gold border, accept all required types */}
                  <div
                    onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
                    onDragOver={(e) => { e.preventDefault(); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragActive(false);
                      const f = e.dataTransfer.files?.[0];
                      if (f) handleFileChange(f);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "upload-dropzone flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-all",
                      dragActive
                        ? "border-gold/60 bg-gold/[0.06] shadow-[0_0_18px_rgba(212,175,55,0.18)]"
                        : "border-gold/30 bg-black/20 hover:border-gold/50 hover:bg-gold/[0.03]"
                    )}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.txt,.xlsx"
                      onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                    />
                    {upFile ? (
                      <>
                        <FileCheck2 className="h-7 w-7 text-gold" />
                        <div className="text-xs font-medium text-foreground">{upFile.name}</div>
                        <div className="text-[10px] text-muted-foreground">{formatSize(upFile.size)}</div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setUpFile(null);
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                          className="mt-1 h-6 text-[10px] text-muted-foreground hover:text-loss"
                        >
                          <X className="h-3 w-3" /> Remove
                        </Button>
                      </>
                    ) : (
                      <>
                        <Upload className="h-7 w-7 text-gold/70" />
                        <div className="text-sm font-medium text-foreground">Click or drag files here</div>
                        <div className="text-[10px] text-muted-foreground">PDF, DOC, DOCX, PNG, JPG — max 25MB</div>
                      </>
                    )}
                  </div>

                  <Button
                    onClick={() => uploadDocument.mutate()}
                    disabled={uploadDocument.isPending}
                    className="w-full bg-gold-gradient text-black font-semibold hover:opacity-90 press-scale"
                  >
                    {uploadDocument.isPending ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Uploading...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Plus className="h-3.5 w-3.5" />
                        Upload Document
                      </span>
                    )}
                  </Button>
                </div>
              </GlassCard>
            </div>

            {/* Documents Table */}
            <GlassCard className="p-5">
              {/* Filters row */}
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by investor or title..."
                    className={cn("pl-9 h-8 text-xs", INPUT_CLS)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                  <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
                    <SelectTrigger className={cn("w-40 h-8 text-xs", SELECT_TRIGGER_CLS)}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="glass-strong border-gold/20">
                      <SelectItem value="all">All Types</SelectItem>
                      {UPLOAD_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{TYPE_META[t]?.label ?? t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="ml-auto text-[11px] text-muted-foreground">
                  {totalDocuments} documents
                </div>
              </div>

              {/* Table content */}
              {docsLoading ? (
                <SkeletonTable rows={6} cols={7} />
              ) : filteredDocs.length === 0 ? (
                <EmptyState
                  icon={<FileText className="h-6 w-6" />}
                  title="No documents found"
                  description="Generate a statement or upload a custom document to get started."
                />
              ) : (
                <div className="overflow-x-auto scroll-luxury">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/40 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        <th className="pb-3 pr-4">Date</th>
                        <th className="pb-3 pr-4">Investor</th>
                        <th className="pb-3 pr-4">Type</th>
                        <th className="pb-3 pr-4">Title</th>
                        <th className="pb-3 pr-4">Period</th>
                        <th className="pb-3 pr-4">Size</th>
                        <th className="pb-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDocs.map((doc, idx) => {
                        const meta = TYPE_META[doc.type] ?? TYPE_META.CUSTOM;
                        const Icon = meta.icon;
                        return (
                          <tr
                            key={doc.id}
                            className="group border-b border-border/20 transition-colors hover:bg-gold/[0.03]"
                            style={{ animationDelay: `${idx * 25}ms` }}
                          >
                            <td className="py-3 pr-4 align-top">
                              <div className="text-xs text-foreground">{fmtDate(doc.createdAt)}</div>
                              <div className="text-[10px] text-muted-foreground">{timeAgo(doc.createdAt)}</div>
                            </td>
                            <td className="py-3 pr-4 align-top">
                              <div className="text-xs font-medium text-foreground">{doc.user?.name ?? "—"}</div>
                              <div className="text-[10px] text-muted-foreground">{doc.user?.email}</div>
                            </td>
                            <td className="py-3 pr-4 align-top">
                              <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium", meta.cls)}>
                                <Icon className="h-3 w-3" />
                                {meta.label}
                              </span>
                            </td>
                            <td className="py-3 pr-4 align-top">
                              <div className="max-w-[200px] truncate text-xs font-medium text-foreground">{doc.title}</div>
                              {doc.description && (
                                <div className="mt-0.5 max-w-[200px] truncate text-[10px] text-muted-foreground">{doc.description}</div>
                              )}
                            </td>
                            <td className="py-3 pr-4 align-top">
                              <span className="text-[11px] text-muted-foreground">{doc.period ?? "—"}</span>
                            </td>
                            <td className="py-3 pr-4 align-top">
                              <span className="text-[11px] text-muted-foreground">{formatSize(doc.sizeBytes)}</span>
                            </td>
                            <td className="py-3 align-top">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDownload(doc)}
                                  className="h-7 px-2 text-muted-foreground hover:bg-gold/10 hover:text-gold"
                                  title="Download"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setDeleteTarget(doc)}
                                  className="h-7 px-2 text-muted-foreground hover:bg-loss/10 hover:text-loss"
                                  title="Delete"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {docsData && docsData.pagination.pages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="h-7 border-border/60 text-xs"
                  >
                    Previous
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Page {page} of {docsData.pagination.pages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= docsData.pagination.pages}
                    onClick={() => setPage((p) => p + 1)}
                    className="h-7 border-border/60 text-xs"
                  >
                    Next
                  </Button>
                </div>
              )}
            </GlassCard>
          </TabsContent>

          {/* ─── STATEMENT REQUESTS TAB ─── */}
          <TabsContent value="requests" className="space-y-4">
            <GlassCard className="p-5">
              {/* Filters row */}
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                  <Select value={reqStatusFilter} onValueChange={(v) => { setReqStatusFilter(v); setReqPage(1); }}>
                    <SelectTrigger className={cn("w-40 h-8 text-xs", SELECT_TRIGGER_CLS)}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="glass-strong border-gold/20">
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                      <SelectItem value="REJECTED">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="ml-auto text-[11px] text-muted-foreground">
                  {pendingCount} pending · {reqData?.pagination.total ?? 0} total
                </div>
              </div>

              {/* Requests list */}
              {reqLoading ? (
                <SkeletonTable rows={4} cols={6} />
              ) : allRequests.length === 0 ? (
                <EmptyState
                  icon={<Inbox className="h-6 w-6" />}
                  title="No statement requests"
                  description="When investors submit statement requests from their Document Vault, they will appear here for you to review, generate, or reject."
                />
              ) : (
                <div className="overflow-x-auto scroll-luxury">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/40 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        <th className="pb-3 pr-4">Requested</th>
                        <th className="pb-3 pr-4">Investor</th>
                        <th className="pb-3 pr-4">Type</th>
                        <th className="pb-3 pr-4">Period</th>
                        <th className="pb-3 pr-4">Status</th>
                        <th className="pb-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allRequests.map((r, idx) => (
                        <tr
                          key={r.id}
                          className="group border-b border-border/20 transition-colors hover:bg-gold/[0.03]"
                          style={{ animationDelay: `${idx * 25}ms` }}
                        >
                          <td className="py-3 pr-4 align-top">
                            <div className="text-xs text-foreground">{fmtDate(r.createdAt)}</div>
                            <div className="text-[10px] text-muted-foreground">{timeAgo(r.createdAt)}</div>
                          </td>
                          <td className="py-3 pr-4 align-top">
                            <div className="text-xs font-medium text-foreground">{r.user?.name ?? "—"}</div>
                            <div className="text-[10px] text-muted-foreground">{r.user?.email}</div>
                          </td>
                          <td className="py-3 pr-4 align-top">
                            <span className="inline-flex items-center gap-1 rounded-md border border-gold/30 bg-gold/10 px-2 py-0.5 text-[10px] font-medium text-gold">
                              <FileText className="h-3 w-3" />
                              {REQUEST_TYPE_LABELS[r.type] ?? r.type}
                            </span>
                          </td>
                          <td className="py-3 pr-4 align-top">
                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {fmtDate(r.periodStart)} → {fmtDate(r.periodEnd)}
                            </div>
                            {r.notes && (
                              <div className="mt-0.5 max-w-[220px] truncate text-[10px] italic text-muted-foreground/70">
                                "{r.notes}"
                              </div>
                            )}
                            {r.status === "REJECTED" && r.notes?.includes("[REJECTION REASON]") && (
                              <div className="mt-1 max-w-[220px] truncate text-[10px] text-loss/80">
                                Rejected: {r.notes.split("[REJECTION REASON]:")[1]?.trim()}
                              </div>
                            )}
                          </td>
                          <td className="py-3 pr-4 align-top">
                            {getRequestStatusBadge(r.status)}
                            {r.status === "COMPLETED" && r.processor && (
                              <div className="mt-1 text-[10px] text-muted-foreground">
                                by {r.processor.name}
                              </div>
                            )}
                          </td>
                          <td className="py-3 align-top">
                            <div className="flex items-center justify-end gap-1.5">
                              {r.status === "PENDING" && (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => fulfillRequest.mutate(r.id)}
                                    disabled={fulfillRequest.isPending && fulfillRequest.variables === r.id}
                                    className="h-7 bg-gold-gradient text-black font-semibold text-[11px] hover:opacity-90 press-scale"
                                  >
                                    {fulfillRequest.isPending && fulfillRequest.variables === r.id ? (
                                      <span className="flex items-center gap-1">
                                        <Loader2 className="h-3 w-3 animate-spin" /> Gen...
                                      </span>
                                    ) : (
                                      <span className="flex items-center gap-1">
                                        <FilePlus2 className="h-3 w-3" /> Generate Now
                                      </span>
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => { setRejectTarget(r); setRejectReason(""); }}
                                    className="h-7 border-loss/30 text-loss hover:bg-loss/10 hover:text-loss text-[11px] press-scale"
                                  >
                                    <XCircle className="h-3 w-3" /> Reject
                                  </Button>
                                </>
                              )}
                              {r.status === "COMPLETED" && r.document && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => window.open(`/api/documents/${r.document!.id}/download`, "_blank")}
                                  className="h-7 border-gold/30 text-gold hover:bg-gold/10 text-[11px] press-scale"
                                >
                                  <Download className="h-3 w-3" /> View
                                  <ChevronRight className="ml-0.5 h-3 w-3" />
                                </Button>
                              )}
                              {r.status === "REJECTED" && (
                                <span className="text-[10px] italic text-muted-foreground/60">No action</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {reqData && reqData.pagination.pages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={reqPage <= 1}
                    onClick={() => setReqPage((p) => Math.max(1, p - 1))}
                    className="h-7 border-border/60 text-xs"
                  >
                    Previous
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Page {reqPage} of {reqData.pagination.pages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={reqPage >= reqData.pagination.pages}
                    onClick={() => setReqPage((p) => p + 1)}
                    className="h-7 border-border/60 text-xs"
                  >
                    Next
                  </Button>
                </div>
              )}
            </GlassCard>
          </TabsContent>
        </Tabs>
      </FadeIn>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="glass-strong border-gold/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <ShieldAlert className="h-5 w-5 text-loss" />
              Delete Document
            </AlertDialogTitle>
            <AlertDialogDescription>
              You are about to permanently delete <strong className="text-foreground">{deleteTarget?.title}</strong> for{" "}
              <strong className="text-foreground">{deleteTarget?.user?.name}</strong>. This will remove the file from disk
              and the database record. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border/60 text-muted-foreground">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteDocument.mutate(deleteTarget.id)}
              disabled={deleteDocument.isPending}
              className="bg-loss text-white hover:bg-loss/90"
            >
              {deleteDocument.isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Deleting...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </span>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject statement request dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => { if (!open) { setRejectTarget(null); setRejectReason(""); } }}>
        <DialogContent className="glass-strong border-loss/30 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <XCircle className="h-5 w-5 text-loss" />
              Reject Statement Request
            </DialogTitle>
            <DialogDescription>
              Reject the {REQUEST_TYPE_LABELS[rejectTarget?.type ?? ""] ?? "statement"} request from{" "}
              <strong className="text-foreground">{rejectTarget?.user?.name}</strong> for the period{" "}
              {rejectTarget && `${fmtDate(rejectTarget.periodStart)} → ${fmtDate(rejectTarget.periodEnd)}`}.
              The investor will be notified in real-time.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label className={LABEL_CLS}>
              Reason <span className="text-muted-foreground/60">(optional)</span>
            </Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Period outside retention window, please contact investor relations..."
              className={cn("min-h-[80px] resize-y text-xs", "border-loss/30 bg-black/30 focus:ring-2 focus:ring-loss/30")}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setRejectTarget(null); setRejectReason(""); }}
              className="border-border/60 text-muted-foreground hover:bg-muted/30"
            >
              Cancel
            </Button>
            <Button
              onClick={() => rejectTarget && rejectRequest.mutate({ id: rejectTarget.id, reason: rejectReason.trim() || undefined })}
              disabled={rejectRequest.isPending}
              className="bg-loss text-white hover:bg-loss/90 press-scale"
            >
              {rejectRequest.isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Rejecting...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <XCircle className="h-3.5 w-3.5" /> Reject Request
                </span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
