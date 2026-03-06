import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardNav } from "@/components/DashboardNav";
import { useRestaurantData } from "@/lib/restaurantData";
import { ShoppingBag, Clock, MapPin, Hash, RefreshCw } from "lucide-react";
import type { SalesChannel } from "@/lib/types";
import { format } from "date-fns";

const PAGE_SIZE = 12;

const channelColors: Record<SalesChannel, string> = {
  ZOMATO: "bg-red-500/10 text-red-600",
  SWIGGY: "bg-orange-500/10 text-orange-600",
  OTHER: "bg-blue-500/10 text-blue-600",
  OFFLINE: "bg-primary/10 text-primary",
  CALL: "bg-emerald-500/10 text-emerald-600",
};

const channelLabels: Record<string, string> = {
  ALL: "All Orders",
  OFFLINE: "Dine-in",
  ZOMATO: "Zomato",
  SWIGGY: "Swiggy",
  OTHER: "Other",
  CALL: "Phone Call",
};

function buildPageList(current: number, total: number): number[] {
  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  return Array.from(pages).filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
}

export default function Orders() {
  const { orders, isLoading, reloadOrders } = useRestaurantData();
  const [filter, setFilter] = useState<SalesChannel | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const filteredOrders = useMemo(() =>
    orders.filter((o) => filter === "ALL" || o.channel === filter),
  [orders, filter]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [filter]);

  useEffect(() => {
    let mounted = true;
    setRefreshing(true);
    reloadOrders()
      .then(() => {
        if (!mounted) return;
        setLoadError(null);
      })
      .catch((error) => {
        if (!mounted) return;
        setLoadError(error instanceof Error ? error.message : "Failed to load orders");
      })
      .finally(() => {
        if (mounted) setRefreshing(false);
      });

    return () => {
      mounted = false;
    };
  }, [reloadOrders]);

  const paginatedOrders = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredOrders.slice(start, start + PAGE_SIZE);
  }, [filteredOrders, page]);

  const channelCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: orders.length };
    for (const o of orders) {
      counts[o.channel] = (counts[o.channel] || 0) + 1;
    }
    return counts;
  }, [orders]);

  const pageList = useMemo(() => buildPageList(page, totalPages), [page, totalPages]);

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <div className="mx-auto max-w-7xl px-4 py-8 pb-24 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-4xl">Order Logs</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Database-backed transaction history · {orders.length} total orders
            </p>
          </div>

          <button
            onClick={async () => {
              setRefreshing(true);
              try {
                await reloadOrders();
                setLoadError(null);
              } catch (error) {
                setLoadError(error instanceof Error ? error.message : "Failed to refresh orders");
              } finally {
                setRefreshing(false);
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </motion.div>

        <div className="mb-6 flex flex-wrap gap-2">
          {(["ALL", "OFFLINE", "CALL", "ZOMATO", "SWIGGY", "OTHER"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${filter === f ? "bg-primary text-primary-foreground shadow-md" : "bg-secondary/50 text-muted-foreground hover:bg-secondary"}`}
            >
              {channelLabels[f]} {(channelCounts[f] || 0) > 0 && <span className="ml-1 opacity-70">({channelCounts[f] || 0})</span>}
            </button>
          ))}
        </div>

        {loadError ? (
          <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            Failed to load fresh orders: {loadError}
          </div>
        ) : null}

        {isLoading && orders.length === 0 ? (
          <div className="glass-card p-10 text-center text-sm text-muted-foreground">Loading orders...</div>
        ) : filteredOrders.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
              <ShoppingBag className="h-8 w-8 text-muted-foreground/30" />
            </div>
            <h2 className="font-display text-lg font-bold text-muted-foreground">
              {filter === "ALL" ? "No orders yet" : `No ${channelLabels[filter]} orders found`}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground/60">
              {filter === "ALL"
                ? "Orders will appear here once imports or call orders are stored in database."
                : `No orders from ${channelLabels[filter]} channel yet.`}
            </p>
          </motion.div>
        ) : (
          <>
            <div className="glass-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b border-border/50 bg-secondary/30 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-4 font-semibold sm:px-6">Order</th>
                      <th className="hidden px-4 py-4 font-semibold sm:table-cell sm:px-6">Date & Time</th>
                      <th className="px-4 py-4 font-semibold sm:px-6">Channel</th>
                      <th className="hidden px-4 py-4 font-semibold md:table-cell sm:px-6">Items</th>
                      <th className="hidden px-4 py-4 font-semibold lg:table-cell sm:px-6">Delivery</th>
                      <th className="px-4 py-4 text-right font-semibold sm:px-6">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    <AnimatePresence mode="popLayout">
                      {paginatedOrders.map((order) => {
                        const foodTotal = order.foodTotal ?? order.total;
                        const charge = order.deliveryCharge ?? 0;

                        return (
                          <motion.tr
                            key={`${order.id}-${order.timestamp}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            layout
                            className="align-top transition-colors hover:bg-primary/[0.02]"
                          >
                            <td className="px-4 py-4 font-mono text-xs sm:px-6">
                              <div className="flex flex-col gap-1">
                                <span>{order.id}</span>
                                {order.orderNumber && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary">
                                    <Hash className="h-3 w-3" />#{order.orderNumber}
                                  </span>
                                )}
                                {order.posOrderRef && (
                                  <span className="text-[10px] text-muted-foreground">{order.posOrderRef}</span>
                                )}
                              </div>
                            </td>
                            <td className="hidden whitespace-nowrap px-4 py-4 sm:table-cell sm:px-6">
                              <div className="flex flex-col gap-0.5">
                                <span className="font-medium">{format(new Date(order.timestamp), "MMM dd, yyyy")}</span>
                                <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" /> {format(new Date(order.timestamp), "hh:mm a")}</span>
                              </div>
                            </td>
                            <td className="px-4 py-4 sm:px-6">
                              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${channelColors[order.channel] || "bg-secondary text-muted-foreground"}`}>
                                {order.channel}
                              </span>
                            </td>
                            <td className="hidden px-4 py-4 md:table-cell sm:px-6">
                              <div className="flex max-w-[260px] flex-wrap gap-1">
                                {order.items.map((i, idx) => (
                                  <span key={idx} className="rounded border border-border/30 bg-secondary/50 px-2 py-0.5 text-[10px] font-medium">
                                    {i.qty}x {i.name}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="hidden px-4 py-4 text-xs lg:table-cell sm:px-6">
                              {order.deliveryAddress ? (
                                <div className="max-w-[220px] space-y-1">
                                  <div className="flex items-start gap-1 text-muted-foreground">
                                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                    <span className="line-clamp-2">{order.deliveryAddress}</span>
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">
                                    {order.city || ""} {order.pincode ? `- ${order.pincode}` : ""}
                                  </div>
                                  {charge > 0 && (
                                    <div className="text-[10px] text-muted-foreground">
                                      Food Rs.{foodTotal.toFixed(0)} + Delivery Rs.{charge.toFixed(0)}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="px-4 py-4 text-right font-semibold sm:px-6">Rs.{order.total.toFixed(0)}</td>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Page {page} of {totalPages} · Showing {paginatedOrders.length} of {filteredOrders.length}
              </p>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page <= 1}
                  className="rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>

                {pageList.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${p === page ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}
                  >
                    {p}
                  </button>
                ))}

                <button
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={page >= totalPages}
                  className="rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
