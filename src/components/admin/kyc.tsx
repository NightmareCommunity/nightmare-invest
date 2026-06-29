"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { GlassCard, MetricTile, SectionTitle, FadeIn, SkeletonCard, SkeletonMetric, EmptyState } from "@/components/brand/primitives";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { fmtDate, fmtNum } from "@/lib/format";
import {
  FileCheck2, Clock, CheckCircle2, XCircle, Loader2, FileText, Image as ImageIcon,
  IdCard, MapPin, User, Banknote, ShieldCheck, AlertCircle, Filter,
} from "lucide-react";
import { toast } from "sonner";

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

export function AdminKyc() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [reviewDoc, setReviewDoc] = useState<AdminKycDocument | null>(null);
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const [notes, setNotes] = useState("");
  const [tier, setTier] = useState<"STANDARD" | "ACCREDITED">("STANDARD");

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

  const docs = (data?.documents ?? []).filter((d) => d.status === tab);

  const kycBreakdown = dashData?.kycBreakdown ?? {};

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

          <div className="mt-4 max-h-[640px] overflow-y-auto pr-1 custom-scrollbar">
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
              <div className="space-y-2">
                {docs.map((d) => {
                  const meta = DOC_TYPE_LABELS[d.type] ?? { label: d.type, icon: FileText };
                  const Icon = d.mimeType.includes("pdf") ? FileText : ImageIcon;
                  return (
                    <div
                      key={d.id}
                      className="flex flex-col gap-3 rounded-lg border border-border/40 bg-black/20 p-3 transition-colors hover:bg-gold/5 sm:flex-row sm:items-center"
                    >
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${
                        d.status === "APPROVED" ? "bg-profit/10 text-profit"
                        : d.status === "REJECTED" ? "bg-loss/10 text-loss"
                        : "bg-gold/10 text-gold"
                      }`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{d.fileName}</span>
                          <Badge variant="outline" className="border-gold/30 text-gold text-[10px]">
                            <meta.icon className="mr-1 h-2.5 w-2.5" />
                            {meta.label}
                          </Badge>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          <span>{d.user.name} · {d.user.email}</span>
                          <span>·</span>
                          <span>{formatBytes(d.sizeBytes)}</span>
                          <span>·</span>
                          <span>Uploaded {fmtDate(d.createdAt, true)}</span>
                          {d.reviewedAt && (
                            <>
                              <span>·</span>
                              <span>Reviewed {fmtDate(d.reviewedAt, true)}</span>
                            </>
                          )}
                        </div>
                        {d.notes && d.status === "REJECTED" && (
                          <div className="mt-1 text-[11px] text-loss">Reason: {d.notes}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {d.status === "PENDING" && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => { setReviewDoc(d); setDecision("approve"); setNotes(""); setTier(d.user.kycTier === "ACCREDITED" ? "ACCREDITED" : "STANDARD"); }}
                              className="bg-profit/90 text-white hover:bg-profit"
                            >
                              <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { setReviewDoc(d); setDecision("reject"); setNotes(""); }}
                              className="border-loss/30 text-loss hover:bg-loss/10"
                            >
                              <XCircle className="mr-1 h-3.5 w-3.5" /> Reject
                            </Button>
                          </>
                        )}
                        {d.status === "APPROVED" && (
                          <Badge className="border-profit/30 bg-profit/10 text-profit">Approved</Badge>
                        )}
                        {d.status === "REJECTED" && (
                          <Badge className="border-loss/30 bg-loss/10 text-loss">Rejected</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </GlassCard>
      </FadeIn>

      {/* Review dialog */}
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
                {/* File preview (image only) */}
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
    </div>
  );
}
