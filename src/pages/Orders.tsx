import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardNav } from "@/components/DashboardNav";
import { useRestaurantData } from "@/lib/restaurantData";
import { ShoppingBag, Clock, MapPin, Hash } from "lucide-react";
import type { SalesChannel } from "@/lib/types";
import { format } from "date-fns";

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

export default function Orders() {
  const { orders } = useRestaurantData();
  const [filter, setFilter] = useState<SalesChannel | "ALL">("ALL");

  const filteredOrders = useMemo(() =>
    orders.filter((o) => filter === "ALL" || o.channel === filter),
  [orders, filter]);

  const channelCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: orders.length };
    for (const o of orders) {
      counts[o.channel] = (counts[o.channel] || 0) + 1;
    }
    return counts;
  }, [orders]);

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <div className="px-4 sm:px-6 py-8 pb-32 max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-tight">Order Logs</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Complete history of your transactions · {orders.length} total orders
          </p>
        </motion.div>

        <div className="flex flex-wrap gap-2 mb-6">
          {(["ALL", "OFFLINE", "CALL", "ZOMATO", "SWIGGY", "OTHER"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${filter === f ? "bg-primary text-primary-foreground shadow-md" : "bg-secondary/50 text-muted-foreground hover:bg-secondary"}`}
            >
              {channelLabels[f]} {(channelCounts[f] || 0) > 0 && <span className="ml-1 opacity-70">({channelCounts[f] || 0})</span>}
            </button>
          ))}
        </div>

        {filteredOrders.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
              <ShoppingBag className="h-8 w-8 text-muted-foreground/30" />
            </div>
            <h2 className="font-display text-lg font-bold text-muted-foreground">
              {filter === "ALL" ? "No orders yet" : `No ${channelLabels[filter]} orders found`}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground/60 max-w-md mx-auto">
              {filter === "ALL"
                ? "Orders will appear here once you import order data or generate orders."
                : `No orders from ${channelLabels[filter]} platform yet.`}
            </p>
          </motion.div>
        ) : (
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-secondary/30 text-xs text-muted-foreground border-b border-border/50">
                  <tr>
                    <th className="px-4 sm:px-6 py-4 font-semibold">Order</th>
                    <th className="px-4 sm:px-6 py-4 font-semibold hidden sm:table-cell">Date & Time</th>
                    <th className="px-4 sm:px-6 py-4 font-semibold">Channel</th>
                    <th className="px-4 sm:px-6 py-4 font-semibold hidden md:table-cell">Items</th>
                    <th className="px-4 sm:px-6 py-4 font-semibold hidden lg:table-cell">Delivery</th>
                    <th className="px-4 sm:px-6 py-4 font-semibold text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  <AnimatePresence mode="popLayout">
                    {filteredOrders.map((order) => {
                      const foodTotal = order.foodTotal ?? order.total;
                      const charge = order.deliveryCharge ?? 0;

                      return (
                        <motion.tr
                          key={order.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          layout
                          className="hover:bg-primary/[0.02] transition-colors align-top"
                        >
                          <td className="px-4 sm:px-6 py-4 font-mono text-xs">
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
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-medium">{format(new Date(order.timestamp), "MMM dd, yyyy")}</span>
                              <span className="text-xs flex items-center gap-1 text-muted-foreground"><Clock className="h-3 w-3" /> {format(new Date(order.timestamp), "hh:mm a")}</span>
                            </div>
                          </td>
                          <td className="px-4 sm:px-6 py-4">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${channelColors[order.channel] || "bg-secondary text-muted-foreground"}`}>
                              {order.channel}
                            </span>
                          </td>
                          <td className="px-4 sm:px-6 py-4 hidden md:table-cell">
                            <div className="flex flex-wrap gap-1 max-w-[260px]">
                              {order.items.map((i, idx) => (
                                <span key={idx} className="bg-secondary/50 px-2 py-0.5 rounded text-[10px] font-medium border border-border/30">
                                  {i.qty}x {i.name}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 sm:px-6 py-4 hidden lg:table-cell text-xs">
                            {order.deliveryAddress ? (
                              <div className="space-y-1 max-w-[220px]">
                                <div className="flex items-start gap-1 text-muted-foreground">
                                  <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
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
                          <td className="px-4 sm:px-6 py-4 text-right font-semibold">Rs.{order.total.toFixed(0)}</td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

