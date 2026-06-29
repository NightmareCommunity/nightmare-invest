"use client";
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { GlassCard, SectionTitle } from "@/components/brand/primitives";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FileText, Upload, Loader2, Trash2, CheckCircle2, XCircle, Clock,
  FileCheck, AlertCircle, ShieldCheck, IdCard, MapPin, User, Banknote,
} from "lucide-react";
import { toast } from "sonner";
import { fmtDate } from "@/lib/format";

interface KycDocument {
  id: string;
  type: string;
  fileName: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  notes: string | null;
  createdAt: string;
  reviewedAt: string | null;
  sizeBytes: number;
  mimeType: string;
}

interface KycResponse {
  status: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
  tier: "STANDARD" | "ACCREDITED";
  notes: string | null;
  reviewedAt: string | null;
  documents: KycDocument[];
}

const DOC_TYPES = [
  { value: "GOVT_ID", label: "Government ID", icon: IdCard, hint: "Passport, driver license, or national ID" },
  { value: "PROOF_OF_ADDRESS", label: "Proof of Address", icon: MapPin, hint: "Utility bill or bank statement (≤ 3 months)" },
  { value: "ACCREDITATION", label: "Accreditation Proof", icon: ShieldCheck, hint: "CPA letter, tax returns, or investment statement" },
  { value: "SOURCE_OF_FUNDS", label: "Source of Funds", icon: Banknote, hint: "Bank statement or sale-of-asset proof" },
  { value: "SELFIE", label: "Identity Selfie", icon: User, hint: "Selfie holding your government ID" },
];

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export function KycSection() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedType, setSelectedType] = useState<string>("GOVT_ID");
  const [dragOver, setDragOver] = useState(false);

  const { data, isLoading, refetch } = useQuery<KycResponse>({
    queryKey: ["kyc"],
    queryFn: () => api.get<KycResponse>("/api/kyc"),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      form.append("type", selectedType);
      return api.upload<{ document: KycDocument }>("/api/kyc/upload", form);
    },
    onSuccess: () => {
      toast.success("Document uploaded — pending review");
      qc.invalidateQueries({ queryKey: ["kyc"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Upload failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/api/kyc?docId=${id}`),
    onSuccess: () => {
      toast.success("Document removed");
      qc.invalidateQueries({ queryKey: ["kyc"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Max file size 8MB");
      return;
    }
    uploadMutation.mutate(file);
  };

  const status = data?.status ?? "NONE";

  const statusBadge = () => {
    if (status === "APPROVED")
      return <Badge className="border-profit/30 bg-profit/10 text-profit"><CheckCircle2 className="mr-1 h-3 w-3" /> Verified</Badge>;
    if (status === "PENDING")
      return <Badge className="border-gold/30 bg-gold/10 text-gold"><Clock className="mr-1 h-3 w-3" /> Pending Review</Badge>;
    if (status === "REJECTED")
      return <Badge className="border-loss/30 bg-loss/10 text-loss"><XCircle className="mr-1 h-3 w-3" /> Action Needed</Badge>;
    return <Badge className="border-muted-foreground/30 bg-muted/10 text-muted-foreground">Not Started</Badge>;
  };

  return (
    <GlassCard className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <SectionTitle
            title="Identity Verification (KYC)"
            subtitle="Required for accredited investor onboarding"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {statusBadge()}
            {data?.tier && (
              <Badge variant="outline" className="border-gold/30 text-gold">
                Tier: {data.tier}
              </Badge>
            )}
          </div>
        </div>
        <div className="hidden sm:flex h-12 w-12 items-center justify-center rounded-full border border-gold/30 bg-gold/5">
          <ShieldCheck className="h-6 w-6 text-gold" />
        </div>
      </div>

      {status === "REJECTED" && data?.notes && (
        <div className="mt-4 rounded-lg border border-loss/30 bg-loss/5 p-3 text-sm text-loss">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-semibold">Action required</div>
              <div className="text-loss/80">{data.notes}</div>
            </div>
          </div>
        </div>
      )}

      {status === "APPROVED" && (
        <div className="mt-4 rounded-lg border border-profit/30 bg-profit/5 p-3 text-sm text-profit">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-semibold">Your account is verified</div>
              <div className="text-profit/80">
                Reviewed {data?.reviewedAt ? fmtDate(data.reviewedAt, true) : "—"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload area */}
      <div className="mt-5 space-y-3">
        <div>
          <div className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">Document Type</div>
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="border-border/60 bg-black/30">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-border/60 bg-popover">
              {DOC_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  <div className="flex items-center gap-2">
                    <t.icon className="h-4 w-4 text-gold" />
                    <span>{t.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {DOC_TYPES.find((t) => t.value === selectedType)?.hint}
          </p>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFile(e.dataTransfer.files[0]);
          }}
          className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 transition-colors ${
            dragOver ? "border-gold bg-gold/5" : "border-border/60 bg-black/20 hover:border-gold/40"
          }`}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-gold/30 bg-gold/5">
            {uploadMutation.isPending ? (
              <Loader2 className="h-6 w-6 animate-spin text-gold" />
            ) : (
              <Upload className="h-6 w-6 text-gold" />
            )}
          </div>
          <div className="text-center">
            <div className="text-sm font-medium text-foreground">
              Drop file or <button onClick={() => fileRef.current?.click()} className="text-gold underline-offset-2 hover:underline">browse</button>
            </div>
            <div className="text-[11px] text-muted-foreground">PNG, JPEG, WebP, PDF · max 8MB</div>
          </div>
        </div>
      </div>

      {/* Documents list */}
      <div className="mt-5">
        <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
          Uploaded Documents {data?.documents?.length ? `(${data.documents.length})` : ""}
        </div>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : data?.documents?.length ? (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
            {data.documents.map((d) => {
              const icon = d.mimeType.includes("pdf") ? FileText : FileCheck;
              const DocIcon = icon;
              return (
                <div
                  key={d.id}
                  className="flex items-center gap-3 rounded-lg border border-border/40 bg-black/20 p-3 hover:bg-gold/5 transition-colors"
                >
                  <div className={`flex h-9 w-9 items-center justify-center rounded-md ${
                    d.status === "APPROVED" ? "bg-profit/10 text-profit"
                    : d.status === "REJECTED" ? "bg-loss/10 text-loss"
                    : "bg-gold/10 text-gold"
                  }`}>
                    <DocIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">{d.fileName}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {DOC_TYPES.find((t) => t.value === d.type)?.label ?? d.type} · {formatBytes(d.sizeBytes)} · {fmtDate(d.createdAt)}
                    </div>
                    {d.notes && d.status === "REJECTED" && (
                      <div className="mt-0.5 text-[11px] text-loss">{d.notes}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {d.status === "APPROVED" && <Badge className="border-profit/30 bg-profit/10 text-profit text-[10px]">Approved</Badge>}
                    {d.status === "PENDING" && <Badge className="border-gold/30 bg-gold/10 text-gold text-[10px]">Pending</Badge>}
                    {d.status === "REJECTED" && <Badge className="border-loss/30 bg-loss/10 text-loss text-[10px]">Rejected</Badge>}
                    {d.status === "PENDING" && (
                      <button
                        onClick={() => deleteMutation.mutate(d.id)}
                        disabled={deleteMutation.isPending}
                        className="text-muted-foreground hover:text-loss transition-colors"
                        title="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border/40 bg-black/20 p-4 text-center text-xs text-muted-foreground">
            No documents uploaded yet
          </div>
        )}
      </div>
    </GlassCard>
  );
}
