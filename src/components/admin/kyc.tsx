"use client";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { GlassCard, MetricTile, SectionTitle, FadeIn, EmptyState } from "@/components/brand/primitives";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { fmtDate, fmtNum } from "@/lib/format";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileCheck2, Clock, CheckCircle2, XCircle, Loader2, FileText, Image as ImageIcon,
  IdCard, MapPin, User, Banknote, ShieldCheck, AlertCircle, Filter,
  Download, Eye, ZoomIn, FilePlus2, ChevronLeft, ChevronRight,
  GripVertical, ThumbsUp, ThumbsDown, Search,
} from "lucide-react";
import { toast } from "sonner";

/* ──────────────────────────────────────────────────────────────────────────────
   TYPES
   ────────────────────────────────────────────────────────────────────────────── */

interface AdminKycDocument {
  id: string;
  type: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  sizeBytes: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  notes: string | null;
  createdAt: string;
  reviewedAt: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    kycStatus: string;
    kycTier: string;
  };
}

interface AdminKycResponse {
  documents: AdminKycDocument[];
  pendingCount: number;
}

const DOC_TYPE_LABELS: Record<string, { label: string; icon: typeof IdCard }> = {
  GOVT_ID: { label: "Government ID", icon: IdCard },
  PROOF_OF_ADDRESS: { label: "Proof of Address", icon: MapPin },
  ACCREDITATION: { label: "Accreditation Proof", icon: ShieldCheck },
  SOURCE_OF_FUNDS: { label: "Source of Funds", icon: Banknote },
  SELFIE: { label: "Identity Selfie", icon: User },
};

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

/* ──────────────────────────────────────────────────────────────────────────────
   MAIN COMPONENT
   ────────────────────────────────────────────────────────────────────────────── */

export function AdminKyc() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [reviewDoc, setReviewDoc] = useState<AdminKycDocument | null>(null);
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const [notes, setNotes] = useState("");
  const [tier, setTier] = useState<"STANDARD" | "ACCREDITED">("STANDARD");

  // Preview modal state
  const [previewDoc, setPreviewDoc] = useState<AdminKycDocument | null>(null);

  // Side-by-side review mode state
  const [reviewModeDoc, setReviewModeDoc] = useState<AdminKycDocument | null>(null);
  const [checklist, setChecklist] = useState({
    idVerified: false,
    addressVerified: false,
    accreditationVerified: false,
    selfieMatch: false,
  });
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewTier, setReviewTier] = useState<"STANDARD" | "ACCREDITED">("STANDARD");

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading } = useQuery<AdminKycResponse>({
    queryKey: ["admin-kyc"],
    queryFn: () => api.get("/api/admin/kyc"),
    refetchInterval: 30000,
  });

  const { data: dashData } = useQuery<any>({
    queryKey: ["admin-dashboard"],
    queryFn: () => api.get("/api/admin/dashboard"),
    refetchInterval: 30000,
  });

  const reviewMutation = useMutation({
    mutationFn: async () => {
      if (!reviewDoc || !decision) return;
      if (decision === "approve") {
        return api.post(`/api/admin/kyc/${reviewDoc.id}/approve`, { tier, notes: notes || undefined });
      } else {
        return api.post(`/api/admin/kyc/${reviewDoc.id}/reject`, { notes });
      }
    },
    onSuccess: () => {
      toast.success(decision === "approve" ? "Document approved" : "Document rejected");
      setReviewDoc(null);
      setDecision(null);
      setNotes("");
      setTier("STANDARD");
      qc.invalidateQueries({ queryKey: ["admin-kyc"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Action failed"),
  });

  const sideBySideMutation = useMutation({
    mutationFn: async (action: "approve" | "reject") => {
      if (!reviewModeDoc) return;
      if (action === "approve") {
        return api.post(`/api/admin/kyc/${reviewModeDoc.id}/approve`, { tier: reviewTier, notes: reviewNotes || undefined });
      } else {
        return api.post(`/api/admin/kyc/${reviewModeDoc.id}/reject`, { notes: reviewNotes });
      }
    },
    onSuccess: (_, action) => {
      toast.success(action === "approve" ? "Document approved" : "Document rejected");
      setReviewModeDoc(null);
      setReviewNotes("");
      setReviewTier("STANDARD");
      setChecklist({ idVerified: false, addressVerified: false, accreditationVerified: false, selfieMatch: false });
      qc.invalidateQueries({ queryKey: ["admin-kyc"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Action failed"),
  });

  const docs = useMemo(() => {
    const filtered = (data?.documents ?? []).filter((d) => d.status === tab);
    if (!searchQuery.trim()) return filtered;
    const q = searchQuery.toLowerCase();
    return filtered.filter(
      (d) =>
        d.fileName.toLowerCase().includes(q) ||
        d.user.name.toLowerCase().includes(q) ||
        d.user.email.toLowerCase().includes(q) ||
        (DOC_TYPE_LABELS[d.type]?.label ?? "").toLowerCase().includes(q)
    );
  }, [data, tab, searchQuery]);

  const kycBreakdown = dashData?.kycBreakdown ?? {};

  // Group documents by user for review mode
  const docsByUser = useMemo(() => {
    const map = new Map<string, AdminKycDocument[]>();
    for (const d of docs) {
      const key = d.user.id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    return map;
  }, [docs]);

  const allChecklistChecked = Object.values(checklist).every(Boolean);

  return (
    <div className="space-y-6">
      <FadeIn>
        <div>
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Admin Console</span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">KYC Review</h1>
          <p className="text-sm text-muted-foreground">Verify investor identity & accreditation documents</p>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricTile
            label="Pending Review"
            value={fmtNum(data?.pendingCount ?? 0, 0)}
            accent="gold"
            icon={<Clock className="h-4 w-4" />}
            sub="Awaiting decision"
          />
          <MetricTile
            label="Verified Investors"
            value={fmtNum(kycBreakdown.APPROVED ?? 0, 0)}
            accent="profit"
            icon={<CheckCircle2 className="h-4 w-4" />}
            sub="KYC complete"
          />
          <MetricTile
            label="In Progress"
            value={fmtNum(kycBreakdown.PENDING ?? 0, 0)}
            icon={<FileCheck2 className="h-4 w-4" />}
            sub="Awaiting full submission"
          />
          <MetricTile
            label="Action Required"
            value={fmtNum(kycBreakdown.REJECTED ?? 0, 0)}
            accent="loss"
            icon={<AlertCircle className="h-4 w-4" />}
            sub="Rejected / resubmit"
          />
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <GlassCard className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionTitle
              title="Document Queue"
              subtitle={`${docs.length} ${tab.toLowerCase()} document${docs.length === 1 ? "" : "s"}`}
            />
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search docs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 w-48 border-border/40 bg-black/30 pl-8 text-xs"
                />
              </div>
              <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
                <TabsList className="bg-black/40">
                  <TabsTrigger value="PENDING" className="data-[state=active]:bg-gold data-[state=active]:text-black">
                    Pending {data?.pendingCount ? `(${data.pendingCount})` : ""}
                  </TabsTrigger>
                  <TabsTrigger value="APPROVED">Approved</TabsTrigger>
                  <TabsTrigger value="REJECTED">Rejected</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          <div className="mt-4 max-h-[720px] overflow-y-auto pr-1 custom-scrollbar">
            {isLoading ? (
              <div className="flex items-center gap-2 py-12 justify-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading documents…
              </div>
            ) : docs.length === 0 ? (
              <EmptyState
                icon={<Filter className="h-8 w-8" />}
                title={`No ${tab.toLowerCase()} documents`}
                description={`There are no ${tab.toLowerCase()} KYC documents to review.`}
              />
            ) : (
              /* ═══════════════════ THUMBNAIL GRID ═══════════════════ */
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {docs.map((d) => {
                  const meta = DOC_TYPE_LABELS[d.type] ?? { label: d.type, icon: FileText };
                  const isImage = d.mimeType.startsWith("image/");
                  const isPdf = d.mimeType.includes("pdf");
                  const DocIcon = isPdf ? FileText : isImage ? ImageIcon : FilePlus2;

                  return (
                    <motion.div
                      key={d.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="group relative"
                    >
                      <div className={`relative overflow-hidden rounded-xl border transition-all duration-300 hover:border-gold/50 hover:shadow-[0_0_20px_rgba(212,175,55,0.15)] ${
                        d.status === "APPROVED" ? "border-profit/30 bg-profit/[0.03]"
                        : d.status === "REJECTED" ? "border-loss/30 bg-loss/[0.03]"
                        : "border-border/40 bg-black/20"
                      }`}>
                        {/* Thumbnail area */}
                        <div
                          className="relative flex h-40 items-center justify-center bg-black/30 cursor-pointer overflow-hidden"
                          onClick={() => setPreviewDoc(d)}
                        >
                          {isImage ? (
                            <img
                              src={`/api/kyc/file/${d.id}`}
                              alt={d.fileName}
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                          ) : isPdf ? (
                            <div className="flex flex-col items-center gap-2">
                              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-loss/10">
                                <FileText className="h-8 w-8 text-loss/70" />
                              </div>
                              <span className="text-[10px] text-muted-foreground">PDF Document</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-2">
                              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gold/10">
                                <DocIcon className="h-8 w-8 text-gold/70" />
                              </div>
                              <span className="text-[10px] text-muted-foreground">{d.mimeType.split("/").pop()?.toUpperCase()}</span>
                            </div>
                          )}
                          {/* Hover overlay */}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); setPreviewDoc(d); }}
                                className="bg-gold/90 text-black hover:bg-gold"
                              >
                                <Eye className="mr-1 h-3.5 w-3.5" /> View
                              </Button>
                              {d.status === "PENDING" && (
                                <Button
                                  size="sm"
                                  onClick={(e) => { e.stopPropagation(); openSideBySideReview(d); }}
                                  className="bg-profit/90 text-white hover:bg-profit"
                                >
                                  <ZoomIn className="mr-1 h-3.5 w-3.5" /> Review
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Card info */}
                        <div className="p-3 space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <span className="truncate text-sm font-medium text-foreground">{d.fileName}</span>
                            {d.status === "PENDING" && (
                              <span className="shrink-0 h-2 w-2 rounded-full bg-gold animate-pulse" />
                            )}
                          </div>
                          <Badge variant="outline" className="border-gold/30 text-gold text-[10px]">
                            <meta.icon className="mr-1 h-2.5 w-2.5" />
                            {meta.label}
                          </Badge>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                            <span>{d.user.name}</span>
                            <span>·</span>
                            <span>{formatBytes(d.sizeBytes)}</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {fmtDate(d.createdAt, true)}
                          </div>
                          {d.notes && d.status === "REJECTED" && (
                            <div className="text-[10px] text-loss truncate">Reason: {d.notes}</div>
                          )}
                          {/* Action buttons */}
                          <div className="flex items-center gap-1.5 pt-1">
                            {d.status === "PENDING" && (
                              <>
                                <Button
                                  size="sm"
                                  className="h-7 flex-1 bg-profit/90 text-white hover:bg-profit text-[11px]"
                                  onClick={() => { setReviewDoc(d); setDecision("approve"); setNotes(""); setTier(d.user.kycTier === "ACCREDITED" ? "ACCREDITED" : "STANDARD"); }}
                                >
                                  <CheckCircle2 className="mr-1 h-3 w-3" /> Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 flex-1 border-loss/30 text-loss hover:bg-loss/10 text-[11px]"
                                  onClick={() => { setReviewDoc(d); setDecision("reject"); setNotes(""); }}
                                >
                                  <XCircle className="mr-1 h-3 w-3" /> Reject
                                </Button>
                              </>
                            )}
                            {d.status === "APPROVED" && (
                              <Badge className="border-profit/30 bg-profit/10 text-profit text-[10px]">Approved</Badge>
                            )}
                            {d.status === "REJECTED" && (
                              <Badge className="border-loss/30 bg-loss/10 text-loss text-[10px]">Rejected</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </GlassCard>
      </FadeIn>

      {/* ═══════════════════ DOCUMENT PREVIEW MODAL ═══════════════════ */}
      <Dialog open={!!previewDoc} onOpenChange={(o) => { if (!o) setPreviewDoc(null); }}>
        <DialogContent className="border-gold/30 bg-card glass-strong max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          {previewDoc && (
            <>
              <DialogHeader className="shrink-0 border-b border-gold/20 pb-4">
                <DialogTitle className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15">
                    <Eye className="h-5 w-5 text-gold" />
                  </div>
                  <div>
                    <div className="text-base font-bold text-foreground">{previewDoc.fileName}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="border-gold/30 text-gold text-[10px]">
                        {DOC_TYPE_LABELS[previewDoc.type]?.label ?? previewDoc.type}
                      </Badge>
                      <span>{previewDoc.mimeType}</span>
                      <span>·</span>
                      <span>{formatBytes(previewDoc.sizeBytes)}</span>
                      <span>·</span>
                      <span>Uploaded {fmtDate(previewDoc.createdAt, true)}</span>
                    </div>
                  </div>
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Document preview for {previewDoc.fileName}
                </DialogDescription>
              </DialogHeader>

              {/* Document viewer area */}
              <div className="flex-1 min-h-0 overflow-auto bg-black/30 rounded-lg m-1">
                {previewDoc.mimeType.startsWith("image/") ? (
                  <div className="flex items-center justify-center p-4 min-h-[400px]">
                    <img
                      src={`/api/kyc/file/${previewDoc.id}`}
                      alt={previewDoc.fileName}
                      className="max-h-[60vh] max-w-full object-contain rounded-lg"
                    />
                  </div>
                ) : previewDoc.mimeType.includes("pdf") ? (
                  <iframe
                    src={`/api/kyc/file/${previewDoc.id}`}
                    className="w-full h-[60vh] border-0 rounded-lg"
                    title={previewDoc.fileName}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-4 py-20">
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gold/10">
                      <FileText className="h-10 w-10 text-gold/60" />
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-medium text-foreground">{previewDoc.fileName}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {previewDoc.mimeType} · {formatBytes(previewDoc.sizeBytes)}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">This file type cannot be previewed in the browser.</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action bar */}
              <div className="shrink-0 flex items-center justify-between gap-3 border-t border-border/40 pt-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-gradient text-xs font-bold text-black">
                    {previewDoc.user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-xs font-medium text-foreground">{previewDoc.user.name}</div>
                    <div className="text-[10px] text-muted-foreground">{previewDoc.user.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="border-gold/30 text-gold hover:bg-gold/10"
                  >
                    <a href={`/api/kyc/file/${previewDoc.id}`} target="_blank" rel="noreferrer">
                      <Download className="mr-1 h-3.5 w-3.5" /> Download
                    </a>
                  </Button>
                  {previewDoc.status === "PENDING" && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => {
                          setPreviewDoc(null);
                          setReviewDoc(previewDoc);
                          setDecision("approve");
                          setNotes("");
                          setTier(previewDoc.user.kycTier === "ACCREDITED" ? "ACCREDITED" : "STANDARD");
                        }}
                        className="bg-profit/90 text-white hover:bg-profit"
                      >
                        <ThumbsUp className="mr-1 h-3.5 w-3.5" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setPreviewDoc(null);
                          setReviewDoc(previewDoc);
                          setDecision("reject");
                          setNotes("");
                        }}
                        className="border-loss/30 text-loss hover:bg-loss/10"
                      >
                        <ThumbsDown className="mr-1 h-3.5 w-3.5" /> Reject
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══════════════════ QUICK REVIEW DIALOG ═══════════════════ */}
      <Dialog open={!!reviewDoc} onOpenChange={(o) => { if (!o) { setReviewDoc(null); setDecision(null); setNotes(""); } }}>
        <DialogContent className="border-gold/30 bg-card glass-strong sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {decision === "approve" ? (
                <CheckCircle2 className="h-5 w-5 text-profit" />
              ) : (
                <XCircle className="h-5 w-5 text-loss" />
              )}
              {decision === "approve" ? "Approve Document" : "Reject Document"}
            </DialogTitle>
            <DialogDescription>
              {reviewDoc?.user.name} · {reviewDoc?.user.email}
            </DialogDescription>
          </DialogHeader>

          {reviewDoc && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border/40 bg-black/30 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Document</div>
                <div className="mt-1 text-sm font-medium text-foreground">{reviewDoc.fileName}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {DOC_TYPE_LABELS[reviewDoc.type]?.label} · {formatBytes(reviewDoc.sizeBytes)}
                </div>
                {reviewDoc.mimeType.startsWith("image/") && (
                  <div className="mt-3 overflow-hidden rounded-lg border border-border/40 bg-black/40">
                    <img
                      src={`/api/kyc/file/${reviewDoc.id}`}
                      alt={reviewDoc.fileName}
                      className="max-h-72 w-full object-contain"
                    />
                  </div>
                )}
                {reviewDoc.mimeType.includes("pdf") && (
                  <a
                    href={`/api/kyc/file/${reviewDoc.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 text-xs text-gold hover:underline"
                  >
                    <FileText className="h-3.5 w-3.5" /> Open PDF in new tab
                  </a>
                )}
              </div>

              {decision === "approve" && (
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">KYC Tier</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={tier === "STANDARD" ? "default" : "outline"}
                      onClick={() => setTier("STANDARD")}
                      className={tier === "STANDARD" ? "bg-gold-gradient text-black" : "border-border/60"}
                    >
                      Standard
                    </Button>
                    <Button
                      type="button"
                      variant={tier === "ACCREDITED" ? "default" : "outline"}
                      onClick={() => setTier("ACCREDITED")}
                      className={tier === "ACCREDITED" ? "bg-gold-gradient text-black" : "border-border/60"}
                    >
                      Accredited
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="notes" className="text-xs uppercase tracking-wider text-muted-foreground">
                  {decision === "approve" ? "Notes (optional)" : "Rejection reason"}
                </Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={decision === "approve" ? "Internal note for the investor's file" : "Explain why this document is being rejected"}
                  className="border-border/60 bg-black/30 min-h-[80px]"
                  required={decision === "reject"}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => { setReviewDoc(null); setDecision(null); setNotes(""); }}
                  className="border-border/60"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => reviewMutation.mutate()}
                  disabled={reviewMutation.isPending || (decision === "reject" && !notes.trim())}
                  className={decision === "approve" ? "bg-profit/90 text-white hover:bg-profit" : "bg-loss/90 text-white hover:bg-loss"}
                >
                  {reviewMutation.isPending ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : decision === "approve" ? (
                    <CheckCircle2 className="mr-1.5 h-4 w-4" />
                  ) : (
                    <XCircle className="mr-1.5 h-4 w-4" />
                  )}
                  Confirm {decision === "approve" ? "Approval" : "Rejection"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══════════════════ SIDE-BY-SIDE REVIEW MODAL ═══════════════════ */}
      <Dialog open={!!reviewModeDoc} onOpenChange={(o) => {
        if (!o) {
          setReviewModeDoc(null);
          setReviewNotes("");
          setReviewTier("STANDARD");
          setChecklist({ idVerified: false, addressVerified: false, accreditationVerified: false, selfieMatch: false });
        }
      }}>
        <DialogContent className="border-gold/30 bg-card glass-strong max-w-6xl max-h-[90vh] overflow-hidden p-0">
          {reviewModeDoc && (
            <div className="flex flex-col h-full">
              {/* Gold header */}
              <div className="shrink-0 border-b border-gold/20 bg-gradient-to-r from-gold/10 via-transparent to-gold/10 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/20">
                      <ShieldCheck className="h-5 w-5 text-gold" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">KYC Document Review</h3>
                      <p className="text-xs text-muted-foreground">{reviewModeDoc.user.name} · {reviewModeDoc.user.email}</p>
                    </div>
                  </div>
                  <Badge className="border-gold/30 bg-gold/10 text-gold">
                    {DOC_TYPE_LABELS[reviewModeDoc.type]?.label ?? reviewModeDoc.type}
                  </Badge>
                </div>
              </div>

              {/* Side-by-side content */}
              <div className="flex-1 min-h-0 flex overflow-hidden">
                {/* Left: Document Preview */}
                <div className="flex-1 min-w-0 border-r border-border/40 overflow-auto bg-black/20 p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Document Preview</div>
                  {reviewModeDoc.mimeType.startsWith("image/") ? (
                    <div className="flex items-center justify-center">
                      <img
                        src={`/api/kyc/file/${reviewModeDoc.id}`}
                        alt={reviewModeDoc.fileName}
                        className="max-h-[55vh] max-w-full object-contain rounded-lg"
                      />
                    </div>
                  ) : reviewModeDoc.mimeType.includes("pdf") ? (
                    <iframe
                      src={`/api/kyc/file/${reviewModeDoc.id}`}
                      className="w-full h-[55vh] border-0 rounded-lg"
                      title={reviewModeDoc.fileName}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-3 py-16">
                      <FileText className="h-12 w-12 text-gold/40" />
                      <div className="text-xs text-muted-foreground">
                        Preview not available —{" "}
                        <a href={`/api/kyc/file/${reviewModeDoc.id}`} target="_blank" rel="noreferrer" className="text-gold hover:underline">
                          Download file
                        </a>
                      </div>
                    </div>
                  )}
                  <div className="mt-3 text-xs text-muted-foreground">
                    {reviewModeDoc.fileName} · {formatBytes(reviewModeDoc.sizeBytes)} · {reviewModeDoc.mimeType}
                  </div>
                </div>

                {/* Right: Verification Checklist */}
                <div className="w-80 shrink-0 overflow-auto bg-black/10 p-4 space-y-4">
                  {/* User info */}
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Investor Info</div>
                    <div className="rounded-lg border border-border/40 bg-black/30 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-gradient text-xs font-bold text-black">
                          {reviewModeDoc.user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-foreground">{reviewModeDoc.user.name}</div>
                          <div className="text-[11px] text-muted-foreground">{reviewModeDoc.user.email}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="text-muted-foreground">KYC Status:</span>
                        <Badge variant="outline" className="text-[10px] border-gold/30 text-gold">
                          {reviewModeDoc.user.kycStatus}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="text-muted-foreground">Current Tier:</span>
                        <Badge variant="outline" className="text-[10px] border-border/40">
                          {reviewModeDoc.user.kycTier}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Verification checklist */}
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Verification Checklist</div>
                    <div className="space-y-2">
                      {[
                        { key: "idVerified" as const, label: "ID Verified", icon: IdCard },
                        { key: "addressVerified" as const, label: "Address Verified", icon: MapPin },
                        { key: "accreditationVerified" as const, label: "Accreditation Verified", icon: ShieldCheck },
                        { key: "selfieMatch" as const, label: "Selfie Match", icon: User },
                      ].map((item) => (
                        <label
                          key={item.key}
                          className={`flex items-center gap-3 rounded-lg border p-3 transition-all cursor-pointer ${
                            checklist[item.key]
                              ? "border-profit/40 bg-profit/[0.06]"
                              : "border-border/40 bg-black/20 hover:border-gold/30 hover:bg-gold/[0.03]"
                          }`}
                        >
                          <Checkbox
                            checked={checklist[item.key]}
                            onCheckedChange={(checked) =>
                              setChecklist((prev) => ({ ...prev, [item.key]: !!checked }))
                            }
                            className={`${checklist[item.key] ? "border-profit bg-profit text-white" : ""}`}
                          />
                          <item.icon className={`h-4 w-4 ${checklist[item.key] ? "text-profit" : "text-muted-foreground"}`} />
                          <span className={`text-xs font-medium ${checklist[item.key] ? "text-profit" : "text-foreground"}`}>
                            {item.label}
                          </span>
                        </label>
                      ))}
                    </div>
                    {/* Progress indicator */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                        <span>Verification progress</span>
                        <span>{Object.values(checklist).filter(Boolean).length}/4</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-black/40 overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-gold to-profit"
                          initial={{ width: 0 }}
                          animate={{ width: `${(Object.values(checklist).filter(Boolean).length / 4) * 100}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Tier selection */}
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Assign Tier</div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={reviewTier === "STANDARD" ? "default" : "outline"}
                        onClick={() => setReviewTier("STANDARD")}
                        className={reviewTier === "STANDARD" ? "bg-gold-gradient text-black flex-1" : "border-border/60 flex-1"}
                      >
                        Standard
                      </Button>
                      <Button
                        size="sm"
                        variant={reviewTier === "ACCREDITED" ? "default" : "outline"}
                        onClick={() => setReviewTier("ACCREDITED")}
                        className={reviewTier === "ACCREDITED" ? "bg-gold-gradient text-black flex-1" : "border-border/60 flex-1"}
                      >
                        Accredited
                      </Button>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Notes</div>
                    <Textarea
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="Add review notes..."
                      className="border-border/40 bg-black/30 min-h-[60px] text-xs"
                    />
                  </div>

                  {/* Action buttons */}
                  <div className="space-y-2 pt-2">
                    <Button
                      className="w-full bg-profit/90 text-white hover:bg-profit"
                      disabled={sideBySideMutation.isPending}
                      onClick={() => sideBySideMutation.mutate("approve")}
                    >
                      {sideBySideMutation.isPending ? (
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-1.5 h-4 w-4" />
                      )}
                      Approve All
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full border-loss/30 text-loss hover:bg-loss/10"
                      disabled={sideBySideMutation.isPending || !reviewNotes.trim()}
                      onClick={() => sideBySideMutation.mutate("reject")}
                    >
                      {sideBySideMutation.isPending ? (
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      ) : (
                        <XCircle className="mr-1.5 h-4 w-4" />
                      )}
                      Reject with Reason
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );

  function openSideBySideReview(d: AdminKycDocument) {
    setReviewModeDoc(d);
    setChecklist({ idVerified: false, addressVerified: false, accreditationVerified: false, selfieMatch: false });
    setReviewNotes("");
    setReviewTier(d.user.kycTier === "ACCREDITED" ? "ACCREDITED" : "STANDARD");
  }
}
