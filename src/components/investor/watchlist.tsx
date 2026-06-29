"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api-client";
import { fmtUSD, fmtPct } from "@/lib/format";
import { GlassCard, FadeIn, SkeletonCard, SkeletonTable, EmptyState as EmptyStatePrimitive } from "@/components/brand/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  Bell,
  BellRing,
  Pencil,
  TrendingUp,
  TrendingDown,
  Search,
  ChevronUp,
  ChevronDown,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────
interface WatchlistItem {
  id: string;
  symbol: string;
  name: string;
  alertPrice: number | null;
  alertDirection: string | null;
  notes: string | null;
  createdAt: string;
  currentPrice: number | null;
  change24h: number | null;
  alertTriggered: boolean;
}

// ─── Available coins for adding to watchlist ─────────────────────
const AVAILABLE_COINS = [
  { symbol: "bitcoin", name: "Bitcoin", color: "#F7931A", icon: "₿" },
  { symbol: "ethereum", name: "Ethereum", color: "#627EEA", icon: "Ξ" },
  { symbol: "solana", name: "Solana", color: "#14F195", icon: "◎" },
];

// ─── Sort helpers ────────────────────────────────────────────────
type SortKey = "name" | "price" | "change";
type SortDir = "asc" | "desc";

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className="ml-1 inline-flex flex-col">
      <ChevronUp className={cn("h-3 w-3 -mb-1", active && dir === "asc" ? "text-gold" : "text-muted-foreground/40")} />
      <ChevronDown className={cn("h-3 w-3 -mt-1", active && dir === "desc" ? "text-gold" : "text-muted-foreground/40")} />
    </span>
  );
}

function sortItems(items: WatchlistItem[], key: SortKey, dir: SortDir): WatchlistItem[] {
  return [...items].sort((a, b) => {
    let va: number | string = 0;
    let vb: number | string = 0;
    switch (key) {
      case "name":
        va = a.name.toLowerCase();
        vb = b.name.toLowerCase();
        break;
      case "price":
        va = a.currentPrice ?? 0;
        vb = b.currentPrice ?? 0;
        break;
      case "change":
        va = a.change24h ?? 0;
        vb = b.change24h ?? 0;
        break;
    }
    if (va < vb) return dir === "asc" ? -1 : 1;
    if (va > vb) return dir === "asc" ? 1 : -1;
    return 0;
  });
}

// ─── Component ───────────────────────────────────────────────────
export function WatchlistPage() {
  const qc = useQueryClient();
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<WatchlistItem | null>(null);
  const [search, setSearch] = useState("");

  // Fetch watchlist
  const { data, isLoading } = useQuery({
    queryKey: ["watchlist"],
    queryFn: () => api.get<{ items: WatchlistItem[] }>("/api/watchlist"),
    refetchInterval: 30000,
  });

  const items = data?.items ?? [];
  const filtered = sortItems(
    items.filter((i) =>
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.symbol.toLowerCase().includes(search.toLowerCase())
    ),
    sortKey,
    sortDir
  );

  // Which coins are already on watchlist?
  const existingSymbols = new Set(items.map((i) => i.symbol));
  const availableToAdd = AVAILABLE_COINS.filter((c) => !existingSymbols.has(c.symbol));

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/api/watchlist?id=${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["watchlist"] });
      toast.success("Asset removed from watchlist");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const coinMeta = (symbol: string) => AVAILABLE_COINS.find((c) => c.symbol === symbol) ?? AVAILABLE_COINS[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              <span className="text-gold-gradient">Watchlist</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Track your favorite crypto assets and set price alerts</p>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gold-gradient text-black font-semibold hover:opacity-90">
                <Plus className="mr-2 h-4 w-4" />
                Add Asset
              </Button>
            </DialogTrigger>
            <AddAssetDialog
              available={availableToAdd}
              onSuccess={() => {
                setAddOpen(false);
                qc.invalidateQueries({ queryKey: ["watchlist"] });
              }}
            />
          </Dialog>
        </div>
      </FadeIn>

      {/* Search & Stats */}
      <FadeIn delay={0.1}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search assets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-black/30 border-border/60"
            />
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>
              <span className="text-gold font-semibold">{items.length}</span> asset{items.length !== 1 ? "s" : ""}
            </span>
            <span>
              <span className="text-profit font-semibold">
                {items.filter((i) => i.alertTriggered).length}
              </span>{" "}
              alert{items.filter((i) => i.alertTriggered).length !== 1 ? "s" : ""} triggered
            </span>
          </div>
        </div>
      </FadeIn>

      {/* Content */}
      {isLoading ? (
        <WatchlistSkeleton />
      ) : items.length === 0 ? (
        <EmptyState onAddClick={() => setAddOpen(true)} />
      ) : (
        <FadeIn delay={0.2}>
          {/* Desktop table */}
          <div className="hidden md:block">
            <GlassCard>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/40">
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Asset
                    </th>
                    <th
                      className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-gold transition-colors"
                      onClick={() => toggleSort("price")}
                    >
                      Price <SortIcon active={sortKey === "price"} dir={sortDir} />
                    </th>
                    <th
                      className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-gold transition-colors"
                      onClick={() => toggleSort("change")}
                    >
                      24h Change <SortIcon active={sortKey === "change"} dir={sortDir} />
                    </th>
                    <th
                      className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-gold transition-colors"
                      onClick={() => toggleSort("name")}
                    >
                      Alert <SortIcon active={sortKey === "name"} dir={sortDir} />
                    </th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {filtered.map((item, idx) => {
                      const meta = coinMeta(item.symbol);
                      const isUp = (item.change24h ?? 0) >= 0;
                      return (
                        <motion.tr
                          key={item.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ delay: idx * 0.05, duration: 0.3 }}
                          className={cn(
                            "border-b border-border/20 transition-colors hover:bg-gold/[0.03]",
                            item.alertTriggered && "border-l-2 border-l-gold bg-gold/[0.04]"
                          )}
                        >
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-3">
                              <div
                                className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold"
                                style={{ backgroundColor: `${meta.color}20`, color: meta.color }}
                              >
                                {meta.icon}
                              </div>
                              <div>
                                <div className="text-sm font-semibold text-foreground">{item.name}</div>
                                <div className="text-[11px] uppercase text-muted-foreground">{item.symbol}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="font-metric text-sm text-foreground">
                              {item.currentPrice ? fmtUSD(item.currentPrice, { decimals: 2 }) : "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            {item.change24h !== null ? (
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 text-sm font-medium",
                                  isUp ? "text-profit" : "text-loss"
                                )}
                              >
                                {isUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                                {fmtPct(item.change24h)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            <AlertStatus item={item} />
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-gold"
                                onClick={() => setEditItem(item)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-loss"
                                onClick={() => deleteMutation.mutate(item.id)}
                                disabled={deleteMutation.isPending}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </GlassCard>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            <AnimatePresence>
              {filtered.map((item, idx) => {
                const meta = coinMeta(item.symbol);
                const isUp = (item.change24h ?? 0) >= 0;
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: idx * 0.05, duration: 0.3 }}
                  >
                    <GlassCard
                      className={cn(
                        "p-4",
                        item.alertTriggered && "border-gold/40"
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-10 w-10 items-center justify-center rounded-full text-base font-bold"
                            style={{ backgroundColor: `${meta.color}20`, color: meta.color }}
                          >
                            {meta.icon}
                          </div>
                          <div>
                            <div className="font-semibold text-foreground">{item.name}</div>
                            <div className="text-[11px] uppercase text-muted-foreground">{item.symbol}</div>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-gold"
                            onClick={() => setEditItem(item)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-loss"
                            onClick={() => deleteMutation.mutate(item.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Price</div>
                          <div className="font-metric text-sm text-foreground">
                            {item.currentPrice ? fmtUSD(item.currentPrice, { decimals: 2 }) : "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">24h Change</div>
                          <div
                            className={cn(
                              "font-metric text-sm font-medium",
                              isUp ? "text-profit" : "text-loss"
                            )}
                          >
                            {item.change24h !== null ? fmtPct(item.change24h) : "—"}
                          </div>
                        </div>
                      </div>
                      {item.alertPrice !== null && (
                        <div className="mt-3 flex items-center justify-between rounded-lg border border-border/30 bg-black/20 px-3 py-2">
                          <AlertStatus item={item} />
                          <div className="text-xs text-muted-foreground">
                            {item.alertDirection === "ABOVE" ? "↑" : "↓"} {fmtUSD(item.alertPrice, { decimals: 2 })}
                          </div>
                        </div>
                      )}
                    </GlassCard>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </FadeIn>
      )}

      {/* Edit Alert Dialog */}
      <EditAlertDialog
        item={editItem}
        onClose={() => setEditItem(null)}
        onSuccess={() => {
          setEditItem(null);
          qc.invalidateQueries({ queryKey: ["watchlist"] });
        }}
      />
    </div>
  );
}

// ─── Alert Status Pill ───────────────────────────────────────────
function AlertStatus({ item }: { item: WatchlistItem }) {
  if (item.alertPrice === null) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border/30 bg-muted/10 px-2.5 py-0.5 text-[11px] text-muted-foreground">
        <Bell className="h-3 w-3" />
        No alert
      </span>
    );
  }

  if (item.alertTriggered) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-0.5 text-[11px] text-gold animate-pulse-gold">
        <BellRing className="h-3 w-3" />
        Triggered
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-profit/30 bg-profit/10 px-2.5 py-0.5 text-[11px] text-profit">
      <Bell className="h-3 w-3" />
      {item.alertDirection === "ABOVE" ? "Above" : "Below"} {fmtUSD(item.alertPrice, { decimals: 2 })}
    </span>
  );
}

// ─── Add Asset Dialog ────────────────────────────────────────────
function AddAssetDialog({
  available,
  onSuccess,
}: {
  available: typeof AVAILABLE_COINS;
  onSuccess: () => void;
}) {
  const [selected, setSelected] = useState<string>("");
  const [alertPrice, setAlertPrice] = useState<string>("");
  const [alertDirection, setAlertDirection] = useState<"ABOVE" | "BELOW">("ABOVE");
  const [notes, setNotes] = useState("");

  const addMutation = useMutation({
    mutationFn: () =>
      api.post("/api/watchlist", {
        symbol: selected,
        alertPrice: alertPrice ? parseFloat(alertPrice) : null,
        alertDirection,
        notes: notes || null,
      }),
    onSuccess: () => {
      toast.success(`${AVAILABLE_COINS.find((c) => c.symbol === selected)?.name ?? "Asset"} added to watchlist`);
      onSuccess();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const selectedCoin = AVAILABLE_COINS.find((c) => c.symbol === selected);

  return (
    <DialogContent className="glass-strong border-gold/20 sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="text-gold-gradient">Add Asset to Watchlist</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-2">
        {/* Coin selection */}
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Select Asset</Label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {available.map((coin) => (
              <button
                key={coin.symbol}
                onClick={() => setSelected(coin.symbol)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-all",
                  selected === coin.symbol
                    ? "border-gold/60 bg-gold/10 text-gold"
                    : "border-border/40 bg-black/20 text-muted-foreground hover:border-gold/30 hover:text-foreground"
                )}
              >
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold"
                  style={{ backgroundColor: `${coin.color}20`, color: coin.color }}
                >
                  {coin.icon}
                </div>
                <span className="text-[11px] font-medium">{coin.name}</span>
              </button>
            ))}
            {available.length === 0 && (
              <div className="col-span-3 py-4 text-center text-sm text-muted-foreground">
                All available assets are already in your watchlist
              </div>
            )}
          </div>
        </div>

        {/* Alert settings */}
        {selectedCoin && (
          <>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Price Alert <span className="text-muted-foreground/60">(optional)</span>
              </Label>
              <div className="mt-2 flex gap-2">
                <Select value={alertDirection} onValueChange={(v) => setAlertDirection(v as "ABOVE" | "BELOW")}>
                  <SelectTrigger className="w-28 bg-black/30 border-border/60 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="glass-strong border-gold/20">
                    <SelectItem value="ABOVE">Above ↑</SelectItem>
                    <SelectItem value="BELOW">Below ↓</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  placeholder="Alert price..."
                  value={alertPrice}
                  onChange={(e) => setAlertPrice(e.target.value)}
                  className="flex-1 bg-black/30 border-border/60"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Notes <span className="text-muted-foreground/60">(optional)</span>
              </Label>
              <Textarea
                placeholder="Any notes about this asset..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-2 bg-black/30 border-border/60 min-h-[60px]"
              />
            </div>
          </>
        )}
      </div>
      <DialogFooter>
        <Button
          onClick={() => addMutation.mutate()}
          disabled={!selected || addMutation.isPending}
          className="bg-gold-gradient text-black font-semibold hover:opacity-90"
        >
          {addMutation.isPending ? "Adding..." : "Add to Watchlist"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ─── Edit Alert Dialog ───────────────────────────────────────────
function EditAlertDialog({
  item,
  onClose,
  onSuccess,
}: {
  item: WatchlistItem | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  return (
    <Dialog open={!!item} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="glass-strong border-gold/20 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-gold-gradient">
            Edit Alert — {item?.name}
          </DialogTitle>
        </DialogHeader>
        {item && (
          <EditAlertForm key={item.id} item={item} onSuccess={onSuccess} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditAlertForm({
  item,
  onSuccess,
}: {
  item: WatchlistItem;
  onSuccess: () => void;
}) {
  const [alertPrice, setAlertPrice] = useState(item.alertPrice !== null ? String(item.alertPrice) : "");
  const [alertDirection, setAlertDirection] = useState<"ABOVE" | "BELOW">((item.alertDirection as "ABOVE" | "BELOW") ?? "ABOVE");
  const [notes, setNotes] = useState(item.notes ?? "");

  const updateMutation = useMutation({
    mutationFn: () =>
      api.put(`/api/watchlist/${item.id}`, {
        alertPrice: alertPrice ? parseFloat(alertPrice) : null,
        alertDirection,
        notes: notes || null,
      }),
    onSuccess: () => {
      toast.success("Alert updated");
      onSuccess();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeAlertMutation = useMutation({
    mutationFn: () =>
      api.put(`/api/watchlist/${item.id}`, {
        alertPrice: null,
        alertDirection: null,
        notes: null,
      }),
    onSuccess: () => {
      toast.success("Alert removed");
      onSuccess();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <div className="space-y-4 py-2">
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Price Alert</Label>
          <div className="mt-2 flex gap-2">
            <Select value={alertDirection} onValueChange={(v) => setAlertDirection(v as "ABOVE" | "BELOW")}>
              <SelectTrigger className="w-28 bg-black/30 border-border/60 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="glass-strong border-gold/20">
                <SelectItem value="ABOVE">Above ↑</SelectItem>
                <SelectItem value="BELOW">Below ↓</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder="Alert price..."
              value={alertPrice}
              onChange={(e) => setAlertPrice(e.target.value)}
              className="flex-1 bg-black/30 border-border/60"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Notes</Label>
          <Textarea
            placeholder="Notes about this asset..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-2 bg-black/30 border-border/60 min-h-[60px]"
          />
        </div>
        {item.alertPrice !== null && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => removeAlertMutation.mutate()}
            disabled={removeAlertMutation.isPending}
            className="w-full border-loss/30 text-loss hover:bg-loss/10"
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Remove Alert
          </Button>
        )}
      </div>
      <DialogFooter className="gap-2">
        <Button variant="ghost" onClick={onSuccess} className="text-muted-foreground">
          Cancel
        </Button>
        <Button
          onClick={() => updateMutation.mutate()}
          disabled={updateMutation.isPending}
          className="bg-gold-gradient text-black font-semibold hover:opacity-90"
        >
          {updateMutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </DialogFooter>
    </>
  );
}

// ─── Empty State ─────────────────────────────────────────────────
function EmptyState({ onAddClick }: { onAddClick: () => void }) {
  return (
    <EmptyStatePrimitive
      icon={<Eye className="h-10 w-10" />}
      title="Your watchlist is empty"
      description="Add your first crypto asset to start tracking prices and setting custom alerts."
      action={
        <Button onClick={onAddClick} className="bg-gold-gradient text-black font-semibold hover:opacity-90 press-scale">
          <Plus className="mr-2 h-4 w-4" />
          Add Your First Asset
        </Button>
      }
    />
  );
}

// ─── Skeleton Loader ─────────────────────────────────────────────
function WatchlistSkeleton() {
  return (
    <GlassCard className="p-4">
      <SkeletonTable rows={4} cols={5} />
    </GlassCard>
  );
}
