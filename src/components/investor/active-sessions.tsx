"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { GlassCard } from "@/components/brand/primitives";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Monitor, Smartphone, Laptop, Tablet, MapPin, Activity, Trash2,
  LogOut, AlertTriangle, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { fmtDate } from "@/lib/format";

interface Session {
  id: string;
  deviceLabel: string;
  ip: string | null;
  lastSeenAt: string;
  createdAt: string;
  expiresAt: string;
  current: boolean;
}

function deviceIcon(label: string) {
  const l = label.toLowerCase();
  if (l.includes("android") || l.includes("ios") || l.includes("iphone") || l.includes("ipad")) {
    return <Smartphone className="h-4 w-4 text-gold" />;
  }
  if (l.includes("ipad") || l.includes("tablet")) {
    return <Tablet className="h-4 w-4 text-gold" />;
  }
  if (l.includes("macos") || l.includes("windows") || l.includes("linux")) {
    return <Laptop className="h-4 w-4 text-gold" />;
  }
  return <Monitor className="h-4 w-4 text-gold" />;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return fmtDate(iso);
}

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "expired";
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hrs = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (days > 0) return `${days}d ${hrs}h left`;
  const mins = Math.floor((diff % (60 * 60 * 1000)) / 60_000);
  return `${hrs}h ${mins}m left`;
}

export function ActiveSessionsSection() {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [revokingAll, setRevokingAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ sessions: Session[] }>("/api/auth/sessions");
      setSessions(res.sessions);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load sessions");
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const revoke = async (id: string) => {
    try {
      await api.del(`/api/auth/sessions?id=${encodeURIComponent(id)}`);
      toast.success("Session revoked");
      setSessions((prev) => prev?.filter((s) => s.id !== id) ?? null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to revoke session");
    }
  };

  const revokeAll = async () => {
    setRevokingAll(true);
    try {
      const res = await api.del<{ revoked: number }>(`/api/auth/sessions?all=true`);
      toast.success(`${res.revoked} session${res.revoked === 1 ? "" : "s"} revoked. Please log in again.`);
      // The current session is also revoked — reload to landing
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to revoke sessions");
      setRevokingAll(false);
    }
  };

  return (
    <GlassCard className="glass-card-hover p-4 sm:p-6 border-gold/10">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gold/20 bg-gold/5">
            <Activity className="h-5 w-5 text-gold" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground">Active Sessions</h3>
            <p className="text-xs text-muted-foreground">
              Devices currently signed into your account. Refresh tokens persist for 30 days.
            </p>
          </div>
        </div>
        {sessions && sessions.length > 1 && (
          <Button
            variant="outline"
            size="sm"
            className="border-loss/30 text-loss hover:bg-loss/10 gap-1.5 text-xs"
            onClick={revokeAll}
            disabled={revokingAll}
          >
            <LogOut className="h-3 w-3" />
            {revokingAll ? "Revoking..." : "Log out everywhere"}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-gold/5">
              <Skeleton className="h-9 w-9 rounded-md" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-7 w-20" />
            </div>
          ))}
        </div>
      ) : !sessions || sessions.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          <AlertTriangle className="h-5 w-5 mx-auto mb-2 text-gold/60" />
          No active sessions found.
        </div>
      ) : (
        <motion.div layout className="space-y-2">
          <AnimatePresence initial={false}>
            {sessions.map((s) => (
              <motion.div
                key={s.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className={`flex flex-wrap items-center gap-3 p-3 rounded-lg border transition-colors ${
                  s.current
                    ? "border-gold/30 bg-gold/5"
                    : "border-gold/10 hover:border-gold/20 hover:bg-gold/[0.03]"
                }`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-gold/15 bg-background/60">
                  {deviceIcon(s.deviceLabel)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground truncate">{s.deviceLabel}</span>
                    {s.current && (
                      <Badge className="border-gold/30 bg-gold/15 text-gold text-[10px] px-1.5 py-0">
                        THIS DEVICE
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground flex-wrap">
                    {s.ip && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {s.ip}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Active {relativeTime(s.lastSeenAt)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-gold/70">
                      <Activity className="h-3 w-3" /> {timeUntil(s.expiresAt)}
                    </span>
                  </div>
                </div>
                {!s.current && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-loss hover:bg-loss/10 gap-1.5 text-xs h-7 px-2"
                    onClick={() => revoke(s.id)}
                  >
                    <Trash2 className="h-3 w-3" /> Revoke
                  </Button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <div className="mt-4 pt-3 border-t border-gold/5 text-[11px] text-muted-foreground leading-relaxed">
        <p className="flex items-start gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-gold/60 mt-0.5 shrink-0" />
          <span>
            If you see a session you don&apos;t recognize, revoke it immediately and change your password.
            Refresh tokens are stored hashed in the database — a database leak alone cannot forge sessions.
          </span>
        </p>
      </div>
    </GlassCard>
  );
}
