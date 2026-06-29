"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import {
  GlassCard, SectionTitle, FadeIn, SkeletonCard, SkeletonTable, EmptyState,
} from "@/components/brand/primitives";
import { fmtDate, fmtDateTime, timeAgo } from "@/lib/format";
import {
  Mail, Megaphone, AlertTriangle, ChevronRight, Eye, Clock,
  CheckCircle2, Circle, Star, Inbox, ArrowLeft,
  Search, Filter, Reply, BookOpen, Keyboard, Hash, Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

/* ──────────────────────────────────────────────────────────────────────────────
   INVESTOR INBOX — Enhanced message inbox for investors
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

// ────────────────────────────────────────────────────────────
// Rich text renderer — converts plain text with markdown-like
// formatting into styled HTML
// ────────────────────────────────────────────────────────────
function RichMessageBody({ body }: { body: string }) {
  const lines = body.split("\n");
  const elements: React.ReactNode[] = [];
  let inList = false;
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="ml-4 mb-3 space-y-1">
          {listItems.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-foreground/90">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
              <span>{renderInlineFormatting(item)}</span>
            </li>
          ))}
        </ul>
      );
      listItems = [];
    }
    inList = false;
  };

  const renderInlineFormatting = (text: string): React.ReactNode => {
    // Bold: **text**
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
      }
      // Links: [text](url)
      const linkParts = part.split(/(\[[^\]]+\]\([^)]+\))/g);
      return linkParts.map((lp, j) => {
        const linkMatch = lp.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (linkMatch) {
          return (
            <a
              key={`${i}-${j}`}
              href={linkMatch[2]}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold underline decoration-gold/30 hover:decoration-gold transition-colors"
            >
              {linkMatch[1]}
            </a>
          );
        }
        return lp;
      });
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Bullet point
    if (line.match(/^[\s]*[-•]\s/)) {
      inList = true;
      listItems.push(line.replace(/^[\s]*[-•]\s/, ""));
      continue;
    }

    // Flush any pending list
    if (inList) {
      flushList();
    }

    // Empty line
    if (line.trim() === "") {
      elements.push(<div key={`empty-${i}`} className="h-2" />);
      continue;
    }

    // Heading-like lines (ALL CAPS or ending with colon)
    if (line.trim().endsWith(":") && line.trim().length < 60) {
      elements.push(
        <p key={i} className="mb-1 text-sm font-semibold text-foreground">
          {renderInlineFormatting(line)}
        </p>
      );
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={i} className="mb-3 text-sm leading-relaxed text-foreground/90 last:mb-0">
        {renderInlineFormatting(line)}
      </p>
    );
  }

  // Flush remaining list
  if (inList) {
    flushList();
  }

  return <div className="prose prose-sm prose-invert max-w-none">{elements}</div>;
}

// ════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════
export function InvestorInbox() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [showKeyboardHints, setShowKeyboardHints] = useState(false);

  const { data, isLoading } = useQuery<MessagesResponse>({
    queryKey: ["investor-messages", page],
    queryFn: () => api.get(`/api/messages?page=${page}&limit=20`),
    retry: 1,
  });

  const messages = data?.messages ?? [];
  const selectedMessage = selectedId ? messages.find((m) => m.id === selectedId) : null;

  // ── Filtered messages ────────────────────────────────
  const filteredMessages = messages.filter((msg) => {
    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        msg.subject.toLowerCase().includes(q) ||
        msg.body.toLowerCase().includes(q) ||
        msg.sender.name.toLowerCase().includes(q);
      if (!matchesSearch) return false;
    }
    // Category filter
    switch (activeFilter) {
      case "unread":
        return !msg.isRead;
      case "broadcast":
        return msg.isBroadcast;
      case "direct":
        return !msg.isBroadcast;
      case "urgent":
        return msg.priority === "URGENT" || msg.priority === "IMPORTANT";
      default:
        return true;
    }
  });

  // ── Message stats ────────────────────────────────────
  const totalCount = data?.pagination.total ?? 0;
  const unreadCount = data?.unreadCount ?? 0;
  const broadcastCount = messages.filter((m) => m.isBroadcast).length;

  // ── Keyboard navigation ──────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const currentIdx = filteredMessages.findIndex((m) => m.id === selectedId);
        let nextIdx: number;
        if (e.key === "ArrowDown") {
          nextIdx = currentIdx < filteredMessages.length - 1 ? currentIdx + 1 : 0;
        } else {
          nextIdx = currentIdx > 0 ? currentIdx - 1 : filteredMessages.length - 1;
        }
        if (filteredMessages[nextIdx]) {
          setSelectedId(filteredMessages[nextIdx].id);
        }
      } else if (e.key === "Enter" && !selectedId) {
        if (filteredMessages.length > 0) {
          setSelectedId(filteredMessages[0].id);
        }
      } else if (e.key === "Escape") {
        setSelectedId(null);
        setReplyOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredMessages, selectedId]);

  // ── Mark as unread mutation ──────────────────────────
  const markUnread = useMutation({
    mutationFn: async (msgId: string) => {
      // Using the messages API to mark as unread (best effort)
      return api.put(`/api/messages/${msgId}/unread`, {});
    },
    onSuccess: () => {
      toast.success("Marked as unread");
      queryClient.invalidateQueries({ queryKey: ["investor-messages"] });
    },
    onError: () => {
      toast.error("Failed to mark as unread");
    },
  });

  // ── Loading skeleton ────────────────────────────────
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
          {(unreadCount > 0) && (
            <Badge className="border-gold/30 bg-gold/10 text-gold">
              {unreadCount} unread
            </Badge>
          )}
        </div>
      </FadeIn>

      {/* ── Message Statistics Bar ─────────────────────── */}
      <FadeIn delay={0.03}>
        <div className="grid grid-cols-3 gap-3">
          <div className="flex items-center gap-3 rounded-lg border border-border/40 bg-black/20 px-4 py-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/10">
              <Inbox className="h-4 w-4 text-gold" />
            </div>
            <div>
              <div className="font-metric text-lg font-bold text-foreground">{totalCount}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-gold/20 bg-gold/5 px-4 py-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/10">
              <Mail className="h-4 w-4 text-gold" />
            </div>
            <div>
              <div className="font-metric text-lg font-bold text-gold">{unreadCount}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Unread</div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-border/40 bg-black/20 px-4 py-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/10">
              <Megaphone className="h-4 w-4 text-gold" />
            </div>
            <div>
              <div className="font-metric text-lg font-bold text-foreground">{broadcastCount}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Broadcasts</div>
            </div>
          </div>
        </div>
      </FadeIn>

      {/* ── Search & Filter Bar ────────────────────────── */}
      <FadeIn delay={0.05}>
        <GlassCard className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search messages..."
                className="pl-9 border-border/60 bg-black/30 h-8 text-xs"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-muted-foreground mr-1" />
              {[
                { key: "all", label: "All" },
                { key: "unread", label: "Unread" },
                { key: "broadcast", label: "Broadcasts" },
                { key: "direct", label: "Direct" },
                { key: "urgent", label: "Urgent" },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setActiveFilter(f.key)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors press-scale",
                    activeFilter === f.key
                      ? "border-gold/30 bg-gold/10 text-gold"
                      : "border-border/60 text-muted-foreground hover:border-gold/20 hover:text-foreground"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowKeyboardHints(!showKeyboardHints)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-medium transition-colors",
                showKeyboardHints
                  ? "border-gold/30 bg-gold/10 text-gold"
                  : "border-border/60 text-muted-foreground hover:text-foreground"
              )}
            >
              <Keyboard className="h-3 w-3" />
              Shortcuts
            </button>
          </div>
          {/* Keyboard shortcuts hint */}
          <AnimatePresence>
            {showKeyboardHints && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-3 flex flex-wrap items-center gap-4 border-t border-border/30 pt-3 text-[10px] text-muted-foreground"
              >
                <div className="flex items-center gap-1.5">
                  <kbd className="rounded border border-border/60 bg-black/40 px-1.5 py-0.5 font-mono text-[9px]">↑</kbd>
                  <kbd className="rounded border border-border/60 bg-black/40 px-1.5 py-0.5 font-mono text-[9px]">↓</kbd>
                  <span>Navigate</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <kbd className="rounded border border-border/60 bg-black/40 px-1.5 py-0.5 font-mono text-[9px]">Enter</kbd>
                  <span>Open message</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <kbd className="rounded border border-border/60 bg-black/40 px-1.5 py-0.5 font-mono text-[9px]">Esc</kbd>
                  <span>Close / Go back</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </GlassCard>
      </FadeIn>

      <FadeIn delay={0.07}>
        <div className="grid gap-4 lg:grid-cols-3">
          {/* ── Message List ──────────────────────────────── */}
          <div className="lg:col-span-1">
            <GlassCard className="overflow-hidden">
              <div className="border-b border-border/40 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <Inbox className="h-3.5 w-3.5" />
                    Messages ({filteredMessages.length})
                  </div>
                  {(searchQuery || activeFilter !== "all") && (
                    <button
                      onClick={() => { setSearchQuery(""); setActiveFilter("all"); }}
                      className="text-[10px] text-gold hover:text-gold/80 transition-colors"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              </div>
              <div className="max-h-[600px] overflow-y-auto scroll-luxury">
                {filteredMessages.length === 0 ? (
                  <div className="p-6">
                    <EmptyState
                      icon={<Mail />}
                      title={searchQuery || activeFilter !== "all" ? "No matching messages" : "No messages"}
                      description={
                        searchQuery || activeFilter !== "all"
                          ? "Try adjusting your search or filters"
                          : "Your inbox is empty. Messages from fund administrators will appear here."
                      }
                    />
                  </div>
                ) : (
                  filteredMessages.map((msg, idx) => (
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

          {/* ── Message Detail (Enhanced) ─────────────────── */}
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
                  <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground/60">
                    <kbd className="rounded border border-border/40 bg-black/30 px-1.5 py-0.5 font-mono text-[9px]">↑↓</kbd>
                    <span>Navigate</span>
                    <kbd className="rounded border border-border/40 bg-black/30 px-1.5 py-0.5 font-mono text-[9px]">Enter</kbd>
                    <span>Open</span>
                  </div>
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

                {/* Message Body (Rich) */}
                <div className="px-6 py-5">
                  <RichMessageBody body={selectedMessage.body} />
                </div>

                {/* Reply Section */}
                <AnimatePresence>
                  {replyOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-border/30 px-6 py-4"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Reply className="h-3.5 w-3.5" />
                          <span>Reply to <span className="text-foreground font-medium">{selectedMessage.sender.name}</span></span>
                        </div>
                        <textarea
                          value={replyBody}
                          onChange={(e) => setReplyBody(e.target.value)}
                          placeholder="Write your reply..."
                          className="w-full min-h-[100px] rounded-lg border border-border/60 bg-black/30 p-3 text-xs text-foreground placeholder:text-muted-foreground/50 resize-y focus:border-gold/30 focus:outline-none"
                          autoFocus
                        />
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setReplyOpen(false); setReplyBody(""); }}
                            className="text-xs text-muted-foreground"
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            disabled={!replyBody.trim()}
                            className="bg-gold-gradient text-black text-xs font-semibold hover:opacity-90 press-scale"
                          >
                            <Send className="mr-1.5 h-3 w-3" />
                            Send Reply
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Message Footer (Enhanced) */}
                <div className="border-t border-border/30 px-6 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
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
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          markUnread.mutate(selectedMessage.id);
                          setSelectedId(null);
                        }}
                        className="h-7 text-[10px] text-muted-foreground hover:text-gold"
                      >
                        <BookOpen className="mr-1 h-3 w-3" />
                        Mark Unread
                      </Button>
                      {!replyOpen && !selectedMessage.isBroadcast && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setReplyOpen(true)}
                          className="h-7 border-gold/30 text-gold text-[10px] hover:bg-gold/10"
                        >
                          <Reply className="mr-1 h-3 w-3" />
                          Reply
                        </Button>
                      )}
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
