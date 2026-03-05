import { DashboardNav } from "@/components/DashboardNav";
import { motion } from "framer-motion";
import { ShoppingCart, Plus, Minus, Trash2, Sparkles, CheckCircle2, Zap } from "lucide-react";
import { useState, useMemo } from "react";
import { useRestaurantData } from "@/lib/restaurantData";
import { calculateMargin, calculateOnlineMargin, getOrderCountForItem } from "@/lib/aiEngine";
import type { OrderItem, SalesChannel } from "@/lib/types";
import { toast } from "sonner";

const OrdersSimulation = () => {
    const { menuItems, orders, commissions, addOrder, totalOrders } = useRestaurantData();
    const [cart, setCart] = useState<OrderItem[]>([]);
    const [orderCount, setOrderCount] = useState(0);
    const [activeCategory, setActiveCategory] = useState("All");
    const [channel, setChannel] = useState<SalesChannel>("OFFLINE");

    const channelCommission = useMemo(() => {
        const c = commissions.find(x => x.channel === channel);
        return c?.enabled ? c.commissionPct : 0;
    }, [commissions, channel]);

    const categories = useMemo(() => {
        const cats = Array.from(new Set(menuItems.map((i) => i.category)));
        return ["All", ...cats];
    }, [menuItems]);

    const filteredItems = useMemo(() => {
        if (activeCategory === "All") return menuItems;
        return menuItems.filter((i) => i.category === activeCategory);
    }, [menuItems, activeCategory]);

    const addToCart = (itemId: number) => {
        const item = menuItems.find((i) => i.id === itemId);
        if (!item) return;

        setCart((prev) => {
            const existing = prev.find((i) => i.menuItemId === itemId);
            if (existing) {
                return prev.map((i) =>
                    i.menuItemId === itemId ? { ...i, qty: i.qty + 1 } : i
                );
            }
            return [
                ...prev,
                { menuItemId: item.id, name: item.name, qty: 1, price: item.price, cost: item.cost },
            ];
        });
    };

    const updateQty = (itemId: number, delta: number) => {
        setCart((prev) =>
            prev
                .map((i) =>
                    i.menuItemId === itemId ? { ...i, qty: Math.max(0, i.qty + delta) } : i
                )
                .filter((i) => i.qty > 0)
        );
    };

    const removeItem = (itemId: number) => {
        setCart((prev) => prev.filter((i) => i.menuItemId !== itemId));
    };

    const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const commissionVal = subtotal * (channelCommission / 100);
    const totalCost = cart.reduce((s, i) => s + i.cost * i.qty, 0);
    const marginPct = subtotal > 0 ? ((subtotal - commissionVal - totalCost) / subtotal) * 100 : 0;

    // Smart upsell based on co-occurrence
    const upsellSuggestion = useMemo(() => {
        if (cart.length === 0) return null;
        const cartIds = new Set(cart.map((i) => i.menuItemId));
        // Build co-occurrence from orders
        const coOccurrence = new Map<number, number>();
        for (const order of orders) {
            const orderItemIds = order.items.map((oi) => oi.menuItemId);
            const hasCartItem = orderItemIds.some((id) => cartIds.has(id));
            if (!hasCartItem) continue;
            for (const oi of order.items) {
                if (!cartIds.has(oi.menuItemId)) {
                    coOccurrence.set(oi.menuItemId, (coOccurrence.get(oi.menuItemId) || 0) + 1);
                }
            }
        }
        let bestId = -1;
        let bestCount = 0;
        for (const [id, count] of coOccurrence) {
            if (count > bestCount) { bestCount = count; bestId = id; }
        }
        if (bestId < 0 || bestCount < 1) return null;
        const item = menuItems.find((m) => m.id === bestId);
        if (!item) return null;
        const pct = Math.round((bestCount / orders.length) * 100);
        return { item, count: bestCount, pct };
    }, [cart, orders, menuItems]);

    const handleGenerateOrder = () => {
        if (cart.length === 0) return;

        const order = addOrder(cart, channel);
        setOrderCount((c) => c + 1);
        setCart([]);
        toast.success(`Order ${order.id} generated!`, {
            description: `₹${order.total} via ${channel} · ${order.margin.toFixed(0)}% margin`,
        });
    };

    return (
        <div className="min-h-screen bg-background">
            <DashboardNav />
            <div className="mx-auto max-w-7xl px-6 py-8">
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="font-display text-2xl font-bold">
                                POS Simulation
                            </h1>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Simulate restaurant orders to generate AI training data.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                                {totalOrders} total orders
                            </span>
                            {orderCount > 0 && (
                                <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                                    +{orderCount} this session
                                </span>
                            )}
                        </div>
                    </div>
                </motion.div>

                <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
                    {/* Menu Grid */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        {/* Category filters */}
                        <div className="mb-4 flex flex-wrap gap-2">
                            {categories.map((cat) => (
                                <button
                                    key={cat}
                                    onClick={() => setActiveCategory(cat)}
                                    className={
                                        activeCategory === cat
                                            ? "nav-pill-active"
                                            : "nav-pill-inactive"
                                    }
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {filteredItems.map((item) => {
                                const margin = calculateMargin(item);
                                return (
                                    <div
                                        key={item.id}
                                        className="glass-card-hover p-4 flex flex-col justify-between"
                                    >
                                        <div>
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <p className="text-sm font-semibold">{item.name}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {item.category}
                                                    </p>
                                                </div>
                                                <span
                                                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${margin > 60
                                                        ? "bg-success/10 text-success"
                                                        : margin > 40
                                                            ? "bg-accent/10 text-accent"
                                                            : "bg-destructive/10 text-destructive"
                                                        }`}
                                                >
                                                    {margin.toFixed(0)}%
                                                </span>
                                            </div>
                                        </div>
                                        <div className="mt-3 flex items-center justify-between">
                                            <span className="font-display text-lg font-bold">
                                                ₹{item.price}
                                            </span>
                                            <button
                                                onClick={() => addToCart(item.id)}
                                                className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-all hover:brightness-110"
                                            >
                                                <Plus className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>

                    {/* Cart Panel */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                        className="command-panel flex flex-col"
                    >
                        <div className="flex items-center gap-2">
                            <ShoppingCart className="h-4 w-4 text-primary" />
                            <h2 className="font-display text-sm font-semibold">
                                Order Cart
                            </h2>
                            {cart.length > 0 && (
                                <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                                    {cart.reduce((s, i) => s + i.qty, 0)} items
                                </span>
                            )}
                        </div>

                        {cart.length === 0 ? (
                            <div className="flex flex-1 items-center justify-center py-12">
                                <div className="text-center">
                                    <ShoppingCart className="mx-auto h-10 w-10 text-muted-foreground/30" />
                                    <p className="mt-3 text-sm text-muted-foreground">
                                        Cart is empty
                                    </p>
                                    <p className="text-xs text-muted-foreground/60">
                                        Add items from the menu
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="mt-4 flex-1 space-y-2 max-h-[300px] overflow-y-auto">
                                    {cart.map((item) => (
                                        <div
                                            key={item.menuItemId}
                                            className="flex items-center gap-3 rounded-xl bg-secondary/50 px-4 py-3"
                                        >
                                            <div className="flex-1">
                                                <p className="text-sm font-medium">{item.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    ₹{item.price} × {item.qty}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    onClick={() => updateQty(item.menuItemId, -1)}
                                                    className="flex h-6 w-6 items-center justify-center rounded-md bg-card border border-border"
                                                >
                                                    <Minus className="h-3 w-3" />
                                                </button>
                                                <span className="w-6 text-center text-sm font-semibold">
                                                    {item.qty}
                                                </span>
                                                <button
                                                    onClick={() => updateQty(item.menuItemId, 1)}
                                                    className="flex h-6 w-6 items-center justify-center rounded-md bg-card border border-border"
                                                >
                                                    <Plus className="h-3 w-3" />
                                                </button>
                                                <button
                                                    onClick={() => removeItem(item.menuItemId)}
                                                    className="ml-1 flex h-6 w-6 items-center justify-center rounded-md text-destructive hover:bg-destructive/10"
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </button>
                                            </div>
                                            <span className="shrink-0 text-sm font-semibold">
                                                ₹{item.price * item.qty}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                {/* Smart Upsell Suggestion */}
                                {upsellSuggestion && (
                                    <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-xl border border-accent/20 bg-accent/5 px-4 py-3">
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <Zap className="h-3 w-3 text-accent" />
                                            <span className="text-[11px] font-semibold text-accent">Smart Upsell</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Customers who order these items also add{" "}
                                            <span className="font-semibold text-foreground">{upsellSuggestion.item.name}</span>{" "}
                                            <span className="font-semibold text-accent">{upsellSuggestion.pct}%</span> of the time.
                                        </p>
                                        <div className="mt-2 flex items-center justify-between">
                                            <span className="text-xs font-semibold">₹{upsellSuggestion.item.price}</span>
                                            <button
                                                onClick={() => addToCart(upsellSuggestion.item.id)}
                                                className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-1 text-[11px] font-semibold text-accent-foreground hover:brightness-110"
                                            >
                                                <Plus className="h-3 w-3" /> Add
                                            </button>
                                        </div>
                                    </motion.div>
                                )}

                                {/* AI Insight */}
                                {cart.length >= 2 && (
                                    <div className="mt-4 insight-card">
                                        <div className="flex items-center gap-1.5">
                                            <Sparkles className="h-3 w-3 text-accent" />
                                            <span className="text-[11px] font-semibold text-accent">
                                                AI Margin Insight
                                            </span>
                                        </div>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            This order has a{" "}
                                            <span
                                                className={`font-bold ${marginPct > 50
                                                    ? "text-success"
                                                    : "text-destructive"
                                                    }`}
                                            >
                                                {marginPct.toFixed(0)}% margin
                                            </span>
                                            . Profit: ₹{(subtotal - totalCost).toFixed(0)} on ₹
                                            {subtotal} revenue.
                                            {marginPct < 45 &&
                                                " Consider suggesting a high-margin add-on like Gulab Jamun to improve profitability."}
                                        </p>
                                    </div>
                                )}

                                {/* Totals */}
                                <div className="mt-4 space-y-2 border-t border-border/50 pt-4">
                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <span>Subtotal</span>
                                        <span>₹{subtotal}</span>
                                    </div>
                                    {channelCommission > 0 && (
                                        <div className="flex items-center justify-between text-xs text-destructive">
                                            <span>Commission ({channelCommission}%)</span>
                                            <span>-₹{commissionVal.toFixed(0)}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <span>Net Margin</span>
                                        <span
                                            className={
                                                marginPct > 50 ? "text-success" : marginPct > 0 ? "text-accent" : "text-destructive"
                                            }
                                        >
                                            {marginPct.toFixed(1)}%
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium">Total</span>
                                        <span className="font-display text-xl font-bold">
                                            ₹{subtotal}
                                        </span>
                                    </div>
                                </div>

                                <div className="mt-4">
                                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Sales Channel</label>
                                    <div className="flex gap-2">
                                        {commissions.filter(c => c.enabled).map(c => (
                                            <button
                                                key={c.channel}
                                                onClick={() => setChannel(c.channel)}
                                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${channel === c.channel ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:bg-secondary"}`}
                                            >
                                                {c.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    onClick={handleGenerateOrder}
                                    className="mt-4 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 glow-ring"
                                >
                                    <CheckCircle2 className="mr-1.5 inline h-4 w-4" />
                                    Generate Order
                                </button>
                            </>
                        )}
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default OrdersSimulation;
