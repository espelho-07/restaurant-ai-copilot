import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DashboardNav } from '@/components/DashboardNav';
import { useRestaurantData } from '@/lib/restaurantData';
import { PackageOpen, Clock, Tag, ExternalLink, CalendarDays, Filter } from 'lucide-react';
import type { SalesChannel } from '@/lib/types';
import { format } from 'date-fns';

const channelColors: Record<SalesChannel, string> = {
    ZOMATO: 'bg-red-500/10 text-red-600',
    SWIGGY: 'bg-orange-500/10 text-orange-600',
    OTHER: 'bg-blue-500/10 text-blue-600',
    OFFLINE: 'bg-primary/10 text-primary',
};

export default function Orders() {
    const { orders } = useRestaurantData();
    const [filter, setFilter] = useState<SalesChannel | 'ALL'>('ALL');

    const filteredOrders = orders.filter(o => filter === 'ALL' || o.channel === filter);

    return (
        <div className="min-h-screen bg-background">
            <DashboardNav />
            <div className="px-6 py-8 pb-32">
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                    <h1 className="font-display text-4xl font-bold tracking-tight">Order Logs</h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Complete history of your AI-optimized transactions. Data is stored safely on your machine.
                    </p>
                </motion.div>

                {/* Filters */}
                <div className="flex gap-2 mb-6">
                    {(['ALL', 'OFFLINE', 'ZOMATO', 'SWIGGY', 'OTHER'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f as any)}
                            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${filter === f ? 'bg-primary text-primary-foreground shadow-md' : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'}`}
                        >
                            {f}
                        </button>
                    ))}
                </div>

                {/* Table */}
                <div className="glass-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-secondary/30 text-xs text-muted-foreground border-b border-border/50">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">Order ID</th>
                                    <th className="px-6 py-4 font-semibold">Date & Time</th>
                                    <th className="px-6 py-4 font-semibold">Channel</th>
                                    <th className="px-6 py-4 font-semibold">Items</th>
                                    <th className="px-6 py-4 font-semibold text-right">Revenue</th>
                                    <th className="px-6 py-4 font-semibold text-right">Margin</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/20">
                                <AnimatePresence>
                                    {filteredOrders.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                                                <PackageOpen className="h-8 w-8 mx-auto mb-3 opacity-20" />
                                                No orders found for this channel.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredOrders.map((order) => (
                                            <motion.tr
                                                key={order.id}
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                className="hover:bg-primary/[0.02] transition-colors"
                                            >
                                                <td className="px-6 py-4 font-mono text-xs">{order.id}</td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="font-medium">{format(new Date(order.timestamp), "MMM dd, yyyy")}</span>
                                                        <span className="text-xs flex items-center gap-1 text-muted-foreground"><Clock className="h-3 w-3" /> {format(new Date(order.timestamp), "hh:mm a")}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${channelColors[order.channel]}`}>
                                                        {order.channel}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                                                        {order.items.map((i, idx) => (
                                                            <span key={idx} className="bg-secondary/50 px-2 py-0.5 rounded text-[10px] font-medium border border-border/30">
                                                                {i.qty}x {i.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right font-semibold">₹{order.total}</td>
                                                <td className="px-6 py-4 text-right font-medium">
                                                    <span className={`${order.margin >= 60 ? 'text-success' : order.margin >= 45 ? 'text-accent' : 'text-destructive'}`}>
                                                        {order.margin.toFixed(1)}%
                                                    </span>
                                                </td>
                                            </motion.tr>
                                        ))
                                    )}
                                </AnimatePresence>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
