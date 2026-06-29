"use client";

import { useState, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCircle, XCircle, TrendingUp, Info } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api } from "@/lib/api-client";
import { timeAgo } from "@/lib/format";

interface NotificationItem {
  id: string;
  type: "TRANSACTION_APPROVED" | "TRANSACTION_REJECTED" | "NAV_UPDATED" | "SYSTEM";
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  referenceId: string;
}

interface NotificationsResponse {
  notifications: NotificationItem[];
  unreadCount: number;
}

const TYPE_CONFIG: Record<
  NotificationItem["type"],
  { icon: typeof CheckCircle; color: string; bg: string }
> = {
  TRANSACTION_APPROVED: {
    icon: CheckCircle,
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
  },
  TRANSACTION_REJECTED: {
    icon: XCircle,
    color: "text-red-400",
    bg: "bg-red-400/10",
  },
  NAV_UPDATED: {
    icon: TrendingUp,
    color: "text-gold",
    bg: "bg-gold/10",
  },
  SYSTEM: {
    icon: Info,
    color: "text-blue-400",
    bg: "bg-blue-400/10",
  },
};

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data, refetch } = useQuery<NotificationsResponse>({
    queryKey: ["notifications"],
    queryFn: () => api.get<NotificationsResponse>("/api/notifications"),
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  // Listen for real-time notifications from useRealtimeNotifications hook
  // and immediately refetch the list + invalidate badge count.
  useEffect(() => {
    const handler = () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    };
    window.addEventListener("notifications-updated", handler);
    return () => window.removeEventListener("notifications-updated", handler);
  }, [refetch, queryClient]);

  const markAllRead = useCallback(async () => {
    try {
      await api.put("/api/notifications");
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    } catch {
      // silent fail
    }
  }, [queryClient]);

  // When the popover opens, we could auto-mark as read, but let's keep
  // the explicit "Mark all as read" button for better UX.

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative rounded-md p-2 text-muted-foreground hover:bg-gold/10 hover:text-gold transition-colors"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[9px] font-bold text-black">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-80 border-border/60 bg-[#0d0d0e]/95 p-0 backdrop-blur-xl sm:w-96"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
            {unreadCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gold/15 px-1.5 text-[10px] font-bold text-gold">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-[11px] font-medium text-gold/70 transition-colors hover:text-gold"
            >
              Mark all as read
            </button>
          )}
        </div>

        {/* Notification list */}
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10">
            <Bell className="mb-2 h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No new notifications</p>
          </div>
        ) : (
          <ScrollArea className="max-h-96">
            <div className="divide-y divide-border/40">
              {notifications.map((notification) => {
                const config = TYPE_CONFIG[notification.type];
                const Icon = config.icon;
                return (
                  <div
                    key={notification.id}
                    className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-gold/5 ${
                      !notification.read ? "bg-gold/[0.03]" : ""
                    }`}
                  >
                    {/* Icon */}
                    <div
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${config.bg}`}
                    >
                      <Icon className={`h-4 w-4 ${config.color}`} />
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-foreground">
                          {notification.title}
                        </p>
                        {!notification.read && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-gold shadow-[0_0_6px_rgba(212,175,55,0.5)]" />
                        )}
                      </div>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        {notification.description}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground/60">
                        {timeAgo(notification.timestamp)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="border-t border-border/40 px-4 py-2">
            <p className="text-center text-[10px] text-muted-foreground/50">
              Auto-refreshes every 30s
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
