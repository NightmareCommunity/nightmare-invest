"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import {
  GlassCard, SectionTitle, FadeIn, SkeletonCard, SkeletonTable, EmptyState,
} from "@/components/brand/primitives";
import { fmtDate, timeAgo } from "@/lib/format";
import {
  Mail, Send, Megaphone, Users, AlertTriangle, ArrowRight, ChevronRight,
  Plus, Search, Filter, Star, Clock,
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

/* ──────────────────────────────────────────────────────────────────────────────
   ADMIN COMMUNICATIONS — Admin-to-investor messaging system
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

export function AdminCommunications() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("compose");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [isBroadcast, setIsBroadcast] = useState(false);
  const [recipientId, setRecipientId] = useState("");
  const [sentPage, setSentPage] = useState(1);
  const [sentFilter, setSentFilter] = useState<string>("all");

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

  const investors = (usersData?.users || []).filter((u: any) => u.role !== "ADMIN");

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

          {/* Compose Tab */}
          <TabsContent value="compose" className="mt-4">
            <GlassCard className="p-6">
              <div className="space-y-5">
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

                {/* Send Button */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => { setSubject(""); setBody(""); setPriority("NORMAL"); }}
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
            </GlassCard>
          </TabsContent>

          {/* Sent Messages Tab */}
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

              {/* Messages Table */}
              {sentLoading ? (
                <SkeletonTable rows={5} cols={5} />
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
                        <th className="pb-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sentData.messages.map((msg, idx) => (
                        <tr
                          key={msg.id}
                          className="border-b border-border/20 transition-colors hover:bg-gold/[0.03]"
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
                          <td className="py-3">
                            <span className="text-[11px] text-muted-foreground">{timeAgo(msg.createdAt)}</span>
                          </td>
                        </tr>
                      ))}
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
