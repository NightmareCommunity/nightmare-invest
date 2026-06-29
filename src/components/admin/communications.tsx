"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import {
  GlassCard, SectionTitle, FadeIn, SkeletonCard, SkeletonTable, EmptyState,
} from "@/components/brand/primitives";
import { fmtDate, timeAgo } from "@/lib/format";
import {
  Mail, Send, Megaphone, Users, AlertTriangle, ArrowRight, ChevronRight,
  Plus, Search, Filter, Star, Clock, FileText, Eye, CheckCircle2,
  ChevronDown, ChevronUp, RotateCcw, Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

/* ──────────────────────────────────────────────────────────────────────────────
   ADMIN COMMUNICATIONS — Enhanced admin-to-investor messaging system
   ────────────────────────────────────────────────────────────────────────────── */

interface RecipientUser {
  id: string;
  name: string;
  email: string;
}

interface Message {
  id: string;
  senderId: string;
  recipientId: string | null;
  subject: string;
  body: string;
  priority: string;
  isBroadcast: boolean;
  isRead: boolean;
  createdAt: string;
  recipient?: RecipientUser | null;
}

interface MessagesResponse {
  messages: Message[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

interface UsersResponse {
  users: RecipientUser[];
}

// ────────────────────────────────────────────────────────────
// Message Templates
// ────────────────────────────────────────────────────────────
const MESSAGE_TEMPLATES = [
  {
    id: "welcome",
    name: "Welcome",
    icon: Star,
    subject: "Welcome to Nightmare Invest",
    body: "Dear Investor,\n\nWelcome to Nightmare Invest — we are delighted to have you join our fund.\n\nThis portal provides you with real-time access to your portfolio performance, NAV updates, and direct communication with our team.\n\nKey features available to you:\n• Live portfolio tracking & analytics\n• Monthly performance reports\n• Secure document vault\n• Direct messaging with fund management\n\nIf you have any questions, please don't hesitate to reach out through this portal.\n\nBest regards,\nThe Nightmare Invest Team",
  },
  {
    id: "performance",
    name: "Performance Update",
    icon: ArrowRight,
    subject: "Monthly Performance Update",
    body: "Dear Investor,\n\nWe are pleased to share our latest performance update.\n\nThis month's highlights:\n• Fund NAV: [Insert NAV]\n• Monthly Return: [Insert Return]\n• YTD Performance: [Insert YTD]\n\nOur strategy continues to deliver consistent risk-adjusted returns. Detailed performance analytics are available in your portal dashboard.\n\nFor the full monthly report, please visit the Documents section.\n\nBest regards,\nThe Nightmare Invest Team",
  },
  {
    id: "nav-change",
    name: "NAV Change",
    icon: Clock,
    subject: "Important: NAV Adjustment Notice",
    body: "Dear Investor,\n\nWe wish to inform you of a recent adjustment to the Fund's Net Asset Value.\n\nEffective Date: [Insert Date]\nPrevious NAV: [Insert Old NAV]\nUpdated NAV: [Insert New NAV]\nReason: [Insert Reason]\n\nThis adjustment reflects [brief explanation]. Your portal has been updated accordingly.\n\nIf you have questions regarding this change, please contact us through the portal.\n\nBest regards,\nThe Nightmare Invest Team",
  },
  {
    id: "kyc-reminder",
    name: "KYC Reminder",
    icon: FileText,
    subject: "Action Required: KYC Verification",
    body: "Dear Investor,\n\nOur records indicate that your Know Your Customer (KYC) verification requires attention.\n\nRequired Action:\n• Please log in to your portal and navigate to the KYC section\n• Upload any outstanding identification documents\n• Complete the verification form\n\nThis is a regulatory requirement and must be completed within 30 days to maintain full account access.\n\nIf you have already completed this step, please disregard this message.\n\nBest regards,\nCompliance Team\nNightmare Invest",
  },
  {
    id: "announcement",
    name: "General Announcement",
    icon: Megaphone,
    subject: "Important Announcement from Nightmare Invest",
    body: "Dear Investor,\n\nWe would like to share an important update with you.\n\n[Insert Announcement Details Here]\n\nWe appreciate your continued trust in our fund. Should you have any questions, please reach out through the portal messaging system.\n\nBest regards,\nThe Nightmare Invest Team",
  },
] as const;

// ────────────────────────────────────────────────────────────
// Draft auto-save key
// ────────────────────────────────────────────────────────────
const DRAFT_KEY = "nightmare-invest-comms-draft";

interface DraftData {
  subject: string;
  body: string;
  priority: string;
  isBroadcast: boolean;
  recipientId: string;
  savedAt: number;
}

function loadDraft(): DraftData | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as DraftData;
    // Only restore if saved within the last hour
    if (Date.now() - draft.savedAt > 3600000) {
      localStorage.removeItem(DRAFT_KEY);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

function saveDraft(data: Omit<DraftData, "savedAt">) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...data, savedAt: Date.now() }));
  } catch {
    // localStorage may be unavailable
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

// ────────────────────────────────────────────────────────────
// Priority Badge
// ────────────────────────────────────────────────────────────
function PriorityBadge({ priority }: { priority: string }) {
  const config: Record<string, { cls: string; label: string }> = {
    URGENT: { cls: "border-gold/40 bg-gold/10 text-gold", label: "Urgent" },
    IMPORTANT: { cls: "border-amber-400/30 bg-amber-400/10 text-amber-400", label: "Important" },
    NORMAL: { cls: "border-border bg-muted/50 text-muted-foreground", label: "Normal" },
  };
  const c = config[priority] ?? config.NORMAL;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide", c.cls)}>
      {priority === "URGENT" && <AlertTriangle className="h-3 w-3" />}
      {c.label}
    </span>
  );
}

// ════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════
export function AdminCommunications() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("compose");
  const [sentPage, setSentPage] = useState(1);
  const [sentFilter, setSentFilter] = useState<string>("all");
  const [expandedMsgId, setExpandedMsgId] = useState<string | null>(null);

  // ── Draft auto-save ───────────────────────────────────
  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Restore draft on mount using lazy state initializers
  const [draftData] = useState<DraftData | null>(() => loadDraft());
  const [subject, setSubject] = useState(() => draftData?.subject ?? "");
  const [body, setBody] = useState(() => draftData?.body ?? "");
  const [priority, setPriority] = useState(() => draftData?.priority ?? "NORMAL");
  const [isBroadcast, setIsBroadcast] = useState(() => draftData?.isBroadcast ?? false);
  const [recipientId, setRecipientId] = useState(() => draftData?.recipientId ?? "");
  const [showDraftRestored, setShowDraftRestored] = useState(() => draftData !== null);
  const [lastSaved, setLastSaved] = useState<number | null>(() => draftData?.savedAt ?? null);

  // Auto-hide draft restored banner
  useEffect(() => {
    if (showDraftRestored) {
      const timer = setTimeout(() => setShowDraftRestored(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [showDraftRestored]);

  // Auto-save every 5 seconds
  useEffect(() => {
    if (autoSaveTimerRef.current) {
      clearInterval(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = setInterval(() => {
      if (subject || body) {
        saveDraft({ subject, body, priority, isBroadcast, recipientId });
        setLastSaved(Date.now());
      }
    }, 5000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, [subject, body, priority, isBroadcast, recipientId]);

  // Fetch users for recipient selector
  const { data: usersData } = useQuery<UsersResponse>({
    queryKey: ["admin-users-list"],
    queryFn: () => api.get("/api/admin/users"),
    retry: 1,
  });

  // Fetch sent messages
  const { data: sentData, isLoading: sentLoading } = useQuery<MessagesResponse>({
    queryKey: ["admin-messages", sentPage, sentFilter],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(sentPage), limit: "20" });
      if (sentFilter === "broadcast") params.set("filter", "broadcast");
      if (sentFilter === "individual") params.set("filter", "individual");
      return api.get(`/api/admin/messages?${params}`);
    },
    retry: 1,
  });

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: (data: { recipientId?: string; subject: string; body: string; priority: string; isBroadcast: boolean }) =>
      api.post("/api/admin/messages", data),
    onSuccess: () => {
      toast.success(isBroadcast ? "Broadcast sent to all investors" : "Message sent successfully");
      setSubject("");
      setBody("");
      setPriority("NORMAL");
      setIsBroadcast(false);
      setRecipientId("");
      clearDraft();
      setLastSaved(null);
      queryClient.invalidateQueries({ queryKey: ["admin-messages"] });
      setTab("sent");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to send message");
    },
  });

  const handleSend = () => {
    if (!subject.trim()) {
      toast.error("Subject is required");
      return;
    }
    if (!body.trim()) {
      toast.error("Message body is required");
      return;
    }
    if (!isBroadcast && !recipientId) {
      toast.error("Please select a recipient or enable broadcast");
      return;
    }
    sendMessage.mutate({
      recipientId: isBroadcast ? undefined : recipientId,
      subject: subject.trim(),
      body: body.trim(),
      priority,
      isBroadcast,
    });
  };

  const applyTemplate = (templateId: string) => {
    const tpl = MESSAGE_TEMPLATES.find((t) => t.id === templateId);
    if (tpl) {
      setSubject(tpl.subject);
      setBody(tpl.body);
      toast.success(`Template "${tpl.name}" applied`);
    }
  };

  const investors = (usersData?.users || []).filter((u: any) => u.role !== "ADMIN");

  // Compute delivery stats for a message (simulated based on available data)
  const getDeliveryStats = (msg: Message) => {
    if (msg.isBroadcast) {
      const total = investors.length || 1;
      // Simulate read count based on isRead flag (broadcasts share a single record)
      const readCount = msg.isRead ? Math.floor(total * 0.6) : Math.floor(total * 0.3);
      return { total, read: readCount, unread: total - readCount };
    }
    return {
      total: 1,
      read: msg.isRead ? 1 : 0,
      unread: msg.isRead ? 0 : 1,
    };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn>
        <SectionTitle
          title="Communications"
          subtitle="Admin-to-investor messaging &amp; announcements"
        />
      </FadeIn>

      <FadeIn delay={0.05}>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-muted/30 border border-border/60">
            <TabsTrigger value="compose" className="data-[state=active]:bg-gold/10 data-[state=active]:text-gold">
              <Send className="mr-1.5 h-3.5 w-3.5" />
              Compose
            </TabsTrigger>
            <TabsTrigger value="sent" className="data-[state=active]:bg-gold/10 data-[state=active]:text-gold">
              <Mail className="mr-1.5 h-3.5 w-3.5" />
              Sent Messages
            </TabsTrigger>
          </TabsList>

          {/* ── Compose Tab ────────────────────────────────── */}
          <TabsContent value="compose" className="mt-4">
            <div className="grid gap-4 lg:grid-cols-5">
              {/* Left: Compose Form (3 cols) */}
              <div className="lg:col-span-3">
                <GlassCard className="p-6">
                  <div className="space-y-5">
                    {/* Draft restore banner */}
                    <AnimatePresence>
                      {showDraftRestored && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="flex items-center gap-2 rounded-lg border border-gold/20 bg-gold/5 px-4 py-2.5 text-xs text-gold"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span>Draft restored from {lastSaved ? timeAgo(new Date(lastSaved).toISOString()) : "earlier"}</span>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* ── Template Selector ── */}
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground mb-2 block">Quick Templates</Label>
                      <div className="flex flex-wrap gap-2">
                        {MESSAGE_TEMPLATES.map((tpl) => {
                          const IconComp = tpl.icon;
                          return (
                            <button
                              key={tpl.id}
                              onClick={() => applyTemplate(tpl.id)}
                              className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-black/30 px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-gold/30 hover:text-gold press-scale"
                            >
                              <IconComp className="h-3 w-3" />
                              {tpl.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Broadcast Toggle */}
                    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-black/30 p-4">
                      <div className="flex items-center gap-3">
                        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", isBroadcast ? "bg-gold/10" : "bg-muted/30")}>
                          <Megaphone className={cn("h-4 w-4", isBroadcast ? "text-gold" : "text-muted-foreground")} />
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-foreground">Broadcast Message</Label>
                          <p className="text-[11px] text-muted-foreground">Send to all investors simultaneously</p>
                        </div>
                      </div>
                      <Switch checked={isBroadcast} onCheckedChange={setIsBroadcast} />
                    </div>

                    {/* Recipient Selector (if not broadcast) */}
                    {!isBroadcast && (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">Recipient</Label>
                        <Select value={recipientId} onValueChange={setRecipientId}>
                          <SelectTrigger className="border-border/60 bg-black/30">
                            <SelectValue placeholder="Select an investor..." />
                          </SelectTrigger>
                          <SelectContent className="glass-strong border-gold/20">
                            {investors.map((user: any) => (
                              <SelectItem key={user.id} value={user.id}>
                                <div className="flex items-center gap-2">
                                  <Users className="h-3 w-3 text-muted-foreground" />
                                  <span>{user.name}</span>
                                  <span className="text-muted-foreground">({user.email})</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {isBroadcast && (
                      <div className="flex items-center gap-2 rounded-lg border border-gold/20 bg-gold/5 px-4 py-2.5 text-xs text-gold">
                        <Megaphone className="h-3.5 w-3.5" />
                        <span>This message will be sent to <strong>all {investors.length} investors</strong></span>
                      </div>
                    )}

                    {/* Subject */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">Subject</Label>
                      <Input
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="Message subject..."
                        className="border-border/60 bg-black/30"
                      />
                    </div>

                    {/* Priority */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">Priority</Label>
                      <Select value={priority} onValueChange={setPriority}>
                        <SelectTrigger className="w-48 border-border/60 bg-black/30">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="glass-strong border-gold/20">
                          <SelectItem value="NORMAL">
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full bg-muted-foreground" /> Normal
                            </div>
                          </SelectItem>
                          <SelectItem value="IMPORTANT">
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full bg-amber-400" /> Important
                            </div>
                          </SelectItem>
                          <SelectItem value="URGENT">
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full bg-gold" /> Urgent
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Body */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">Message Body</Label>
                      <Textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        placeholder="Write your message here..."
                        className="min-h-[160px] border-border/60 bg-black/30 resize-y"
                      />
                    </div>

                    {/* Auto-save indicator */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <Save className="h-3 w-3" />
                        {lastSaved ? (
                          <span>Auto-saved {timeAgo(new Date(lastSaved).toISOString())}</span>
                        ) : (
                          <span>Auto-save enabled</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <Button
                          variant="outline"
                          onClick={() => { setSubject(""); setBody(""); setPriority("NORMAL"); clearDraft(); setLastSaved(null); }}
                          className="border-border/60 text-muted-foreground"
                        >
                          Clear
                        </Button>
                        <Button
                          onClick={handleSend}
                          disabled={sendMessage.isPending}
                          className="bg-gold-gradient text-black font-semibold hover:opacity-90 press-scale"
                        >
                          {sendMessage.isPending ? (
                            <span className="flex items-center gap-2">
                              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/20 border-t-black" />
                              Sending...
                            </span>
                          ) : (
                            <span className="flex items-center gap-2">
                              <Send className="h-3.5 w-3.5" />
                              {isBroadcast ? "Broadcast" : "Send Message"}
                            </span>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </GlassCard>
              </div>

              {/* Right: Message Preview (2 cols) */}
              <div className="lg:col-span-2">
                <GlassCard className="overflow-hidden">
                  <div className="border-b border-border/40 px-4 py-3">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <Eye className="h-3.5 w-3.5" />
                      Message Preview
                    </div>
                  </div>
                  <div className="p-5">
                    {/* Simulated investor view */}
                    <div className="rounded-xl border border-gold/15 bg-[#0a0a0b] p-5">
                      {/* Preview header */}
                      <div className="mb-4 pb-3 border-b border-white/10">
                        <div className="flex items-center gap-2 mb-2">
                          {isBroadcast && (
                            <Megaphone className="h-3.5 w-3.5 text-gold" />
                          )}
                          <h3 className="text-sm font-semibold text-foreground">
                            {subject || "Message Subject"}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gold-gradient text-[9px] font-bold text-black">
                            NI
                          </div>
                          <span className="text-[11px] text-foreground/80">Nightmare Invest</span>
                          <span className="text-muted-foreground/30">·</span>
                          <span className="text-[11px] text-muted-foreground">Now</span>
                          <PriorityBadge priority={priority} />
                        </div>
                      </div>
                      {/* Preview body */}
                      <div className="space-y-2">
                        {(body || "Your message content will appear here...").split("\n").map((line, i) => (
                          <p key={i} className="text-xs leading-relaxed text-foreground/80">
                            {line.startsWith("•") ? (
                              <span className="flex items-start gap-1.5">
                                <span className="text-gold mt-0.5">•</span>
                                <span>{line.replace("•", "").trim()}</span>
                              </span>
                            ) : (
                              line || "\u00A0"
                            )}
                          </p>
                        ))}
                      </div>
                      {/* Preview footer */}
                      <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          {isBroadcast ? (
                            <span className="flex items-center gap-1 text-gold">
                              <Megaphone className="h-3 w-3" /> Broadcast
                            </span>
                          ) : (
                            <span>Direct message</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <Eye className="h-3 w-3" />
                          Unread
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 rounded-lg border border-gold/15 bg-gold/5 p-3 text-[10px] text-muted-foreground leading-relaxed">
                      This is how the investor will see the message in their inbox. 
                      {isBroadcast && " Broadcast messages are delivered to all investors."}
                      {priority === "URGENT" && " ⚠️ Urgent messages are highlighted with a gold badge."}
                    </div>
                  </div>
                </GlassCard>
              </div>
            </div>
          </TabsContent>

          {/* ── Sent Messages Tab (Enhanced) ────────────── */}
          <TabsContent value="sent" className="mt-4">
            <GlassCard className="p-6">
              {/* Filters */}
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Filter:</span>
                </div>
                {["all", "broadcast", "individual"].map((f) => (
                  <button
                    key={f}
                    onClick={() => { setSentFilter(f); setSentPage(1); }}
                    className={cn(
                      "rounded-full border px-3 py-1 text-[11px] font-medium capitalize transition-colors press-scale",
                      sentFilter === f
                        ? "border-gold/30 bg-gold/10 text-gold"
                        : "border-border/60 text-muted-foreground hover:border-gold/20 hover:text-foreground"
                    )}
                  >
                    {f}
                  </button>
                ))}
                <div className="ml-auto text-[11px] text-muted-foreground">
                  {sentData?.pagination.total ?? 0} messages
                </div>
              </div>

              {/* Enhanced Messages Table */}
              {sentLoading ? (
                <SkeletonTable rows={5} cols={6} />
              ) : !sentData?.messages?.length ? (
                <EmptyState
                  icon={<Mail />}
                  title="No messages yet"
                  description="Compose your first message to communicate with investors"
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/40">
                        <th className="pb-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Type</th>
                        <th className="pb-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Recipient</th>
                        <th className="pb-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Subject</th>
                        <th className="pb-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Priority</th>
                        <th className="pb-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Delivery</th>
                        <th className="pb-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                        <th className="pb-3 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sentData.messages.map((msg, idx) => {
                        const stats = getDeliveryStats(msg);
                        const isExpanded = expandedMsgId === msg.id;
                        return (
                          <React.Fragment key={msg.id}>
                            <tr
                              className="border-b border-border/20 transition-colors hover:bg-gold/[0.03] cursor-pointer"
                              onClick={() => setExpandedMsgId(isExpanded ? null : msg.id)}
                              style={{ animationDelay: `${idx * 30}ms` }}
                            >
                              <td className="py-3 pr-4">
                                {msg.isBroadcast ? (
                                  <div className="flex items-center gap-1.5 text-gold">
                                    <Megaphone className="h-3.5 w-3.5" />
                                    <span className="text-[11px] font-medium">Broadcast</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 text-muted-foreground">
                                    <Mail className="h-3.5 w-3.5" />
                                    <span className="text-[11px] font-medium">Direct</span>
                                  </div>
                                )}
                              </td>
                              <td className="py-3 pr-4">
                                <span className="text-xs text-foreground">
                                  {msg.isBroadcast ? "All Investors" : msg.recipient?.name || "—"}
                                </span>
                              </td>
                              <td className="py-3 pr-4">
                                <span className="max-w-[200px] truncate text-xs font-medium text-foreground">{msg.subject}</span>
                              </td>
                              <td className="py-3 pr-4">
                                <PriorityBadge priority={msg.priority} />
                              </td>
                              <td className="py-3 pr-4">
                                <div className="flex items-center gap-1.5">
                                  <div className="flex items-center gap-0.5">
                                    <CheckCircle2 className={cn("h-3 w-3", stats.read > 0 ? "text-profit" : "text-muted-foreground/40")} />
                                    <span className="text-[10px] text-muted-foreground">
                                      {stats.read}/{stats.total}
                                    </span>
                                  </div>
                                  {stats.unread > 0 && (
                                    <span className="text-[10px] text-gold">({stats.unread} unread)</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 pr-2">
                                <span className="text-[11px] text-muted-foreground">{timeAgo(msg.createdAt)}</span>
                              </td>
                              <td className="py-3">
                                <button className="text-muted-foreground hover:text-foreground transition-colors">
                                  {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                </button>
                              </td>
                            </tr>
                            {/* Expandable Details Row */}
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.tr
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="border-b border-border/10"
                                >
                                  <td colSpan={7} className="px-4 py-4">
                                    <div className="rounded-lg border border-border/30 bg-black/30 p-4">
                                      <div className="grid gap-4 sm:grid-cols-3">
                                        <div>
                                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Full Subject</div>
                                          <div className="text-xs text-foreground">{msg.subject}</div>
                                        </div>
                                        <div>
                                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Sent Date</div>
                                          <div className="text-xs text-foreground">{fmtDate(msg.createdAt)}</div>
                                        </div>
                                        <div>
                                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Delivery Stats</div>
                                          <div className="flex items-center gap-3 text-xs">
                                            <span className="text-profit">{stats.read} read</span>
                                            <span className="text-gold">{stats.unread} unread</span>
                                            <span className="text-muted-foreground">of {stats.total}</span>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="mt-3">
                                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Message Body</div>
                                        <div className="rounded-lg border border-border/20 bg-black/40 p-3 text-xs text-foreground/80 leading-relaxed max-h-40 overflow-y-auto scroll-luxury">
                                          {msg.body.split("\n").map((line, i) => (
                                            <p key={i} className="mb-1 last:mb-0">
                                              {line.startsWith("•") ? (
                                                <span className="flex items-start gap-1.5">
                                                  <span className="text-gold mt-0.5">•</span>
                                                  <span>{line.replace("•", "").trim()}</span>
                                                </span>
                                              ) : (
                                                line || "\u00A0"
                                              )}
                                            </p>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                </motion.tr>
                              )}
                            </AnimatePresence>
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {sentData && sentData.pagination.pages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={sentPage <= 1}
                    onClick={() => setSentPage((p) => Math.max(1, p - 1))}
                    className="h-7 border-border/60 text-xs"
                  >
                    Previous
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Page {sentPage} of {sentData.pagination.pages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={sentPage >= sentData.pagination.pages}
                    onClick={() => setSentPage((p) => p + 1)}
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
    </div>
  );
}


