"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import {
  GlassCard, SectionTitle, FadeIn, SkeletonCard, SkeletonTable, EmptyState,
} from "@/components/brand/primitives";
import { fmtDate, fmtDateTime, timeAgo } from "@/lib/format";
import {
  Mail, Megaphone, AlertTriangle, ChevronRight, Eye, Clock,
  CheckCircle2, Circle, Star, Inbox, ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/* ──────────────────────────────────────────────────────────────────────────────
   INVESTOR INBOX — Message inbox for investors
   ────────────────────────────────────────────────────────────────────────────── */

interface SenderInfo {
  id: string;
  name: string;
  email: string;
  role: string;
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
  sender: SenderInfo;
}

interface MessagesResponse {
  messages: Message[];
  unreadCount: number;
  pagination: { page: number; limit: number; total: number; pages: number };
}

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

export function InvestorInbox() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<MessagesResponse>({
    queryKey: ["investor-messages", page],
    queryFn: () => api.get(`/api/messages?page=${page}&limit=20`),
    retry: 1,
  });

  const messages = data?.messages ?? [];
  const selectedMessage = selectedId ? messages.find((m) => m.id === selectedId) : null;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SectionTitle title="Inbox" subtitle="Messages & announcements" />
        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <SkeletonTable rows={5} cols={3} />
          </div>
          <div className="lg:col-span-2">
            <SkeletonCard className="h-64" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn>
        <div className="flex items-center justify-between">
          <SectionTitle
            title="Inbox"
            subtitle="Messages & announcements from the fund"
          />
          {(data?.unreadCount ?? 0) > 0 && (
            <Badge className="border-gold/30 bg-gold/10 text-gold">
              {data!.unreadCount} unread
            </Badge>
          )}
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Message List */}
          <div className="lg:col-span-1">
            <GlassCard className="overflow-hidden">
              <div className="border-b border-border/40 px-4 py-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Inbox className="h-3.5 w-3.5" />
                  Messages ({data?.pagination.total ?? 0})
                </div>
              </div>
              <div className="max-h-[600px] overflow-y-auto scroll-luxury">
                {messages.length === 0 ? (
                  <div className="p-6">
                    <EmptyState
                      icon={<Mail />}
                      title="No messages"
                      description="Your inbox is empty. Messages from fund administrators will appear here."
                    />
                  </div>
                ) : (
                  messages.map((msg, idx) => (
                    <button
                      key={msg.id}
                      onClick={() => setSelectedId(msg.id)}
                      className={cn(
                        "group flex w-full items-start gap-3 border-b border-border/20 px-4 py-3 text-left transition-colors",
                        selectedId === msg.id ? "bg-gold/5" : "hover:bg-white/[0.02]",
                        !msg.isRead && "border-l-2 border-l-gold bg-gold/[0.03]"
                      )}
                      style={{ animationDelay: `${idx * 30}ms` }}
                    >
                      <div className="mt-1 shrink-0">
                        {msg.isRead ? (
                          <Circle className="h-2.5 w-2.5 text-muted-foreground/40" />
                        ) : (
                          <div className="h-2.5 w-2.5 rounded-full bg-gold shadow-[0_0_6px_rgba(212,175,55,0.5)]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {msg.isBroadcast && (
                            <Megaphone className="h-3 w-3 shrink-0 text-gold" />
                          )}
                          <span className={cn("truncate text-xs", !msg.isRead ? "font-semibold text-foreground" : "text-foreground/80")}>
                            {msg.subject}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">{msg.sender.name}</span>
                          <span className="text-muted-foreground/30">·</span>
                          <span className="text-[10px] text-muted-foreground">{timeAgo(msg.createdAt)}</span>
                        </div>
                        <div className="mt-1">
                          <PriorityBadge priority={msg.priority} />
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>

              {/* Pagination */}
              {data && data.pagination.pages > 1 && (
                <div className="flex items-center justify-center gap-2 border-t border-border/40 px-4 py-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="h-6 text-[10px] text-muted-foreground"
                  >
                    Previous
                  </Button>
                  <span className="text-[10px] text-muted-foreground">
                    {page}/{data.pagination.pages}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={page >= data.pagination.pages}
                    onClick={() => setPage((p) => p + 1)}
                    className="h-6 text-[10px] text-muted-foreground"
                  >
                    Next
                  </Button>
                </div>
              )}
            </GlassCard>
          </div>

          {/* Message Detail */}
          <div className="lg:col-span-2">
            {!selectedMessage ? (
              <GlassCard className="flex min-h-[400px] items-center justify-center p-8">
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border border-gold/20 bg-gold/5">
                    <Mail className="h-6 w-6 text-gold/60" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">Select a message</h3>
                  <p className="max-w-xs text-xs text-muted-foreground">
                    Choose a message from the list to read its contents
                  </p>
                </div>
              </GlassCard>
            ) : (
              <GlassCard className="overflow-hidden">
                {/* Message Header */}
                <div className="border-b border-border/40 px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {selectedMessage.isBroadcast && (
                          <Megaphone className="h-4 w-4 shrink-0 text-gold" />
                        )}
                        <h2 className="text-lg font-semibold text-foreground">{selectedMessage.subject}</h2>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gold-gradient text-[9px] font-bold text-black">
                            {selectedMessage.sender.name.charAt(0)}
                          </div>
                          <span className="font-medium text-foreground">{selectedMessage.sender.name}</span>
                          <span className="text-muted-foreground/60">({selectedMessage.sender.role})</span>
                        </div>
                        <span className="text-muted-foreground/30">·</span>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{fmtDateTime(selectedMessage.createdAt)}</span>
                        </div>
                        <PriorityBadge priority={selectedMessage.priority} />
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedId(null)}
                      className="shrink-0 text-muted-foreground lg:hidden"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Message Body */}
                <div className="px-6 py-5">
                  <div className="prose prose-sm prose-invert max-w-none">
                    {selectedMessage.body.split("\n").map((paragraph, i) => (
                      <p key={i} className="mb-3 text-sm leading-relaxed text-foreground/90 last:mb-0">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </div>

                {/* Message Footer */}
                <div className="border-t border-border/30 px-6 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      {selectedMessage.isBroadcast ? (
                        <span className="flex items-center gap-1 text-gold">
                          <Megaphone className="h-3 w-3" /> Broadcast message
                        </span>
                      ) : (
                        <span>Direct message</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Eye className="h-3 w-3" />
                      Read
                    </div>
                  </div>
                </div>
              </GlassCard>
            )}
          </div>
        </div>
      </FadeIn>
    </div>
  );
}
