import { DashboardNav } from "@/components/DashboardNav";
import { motion, AnimatePresence } from "framer-motion";
import {
  DollarSign,
  TrendingUp,
  Star,
  Eye,
  Sparkles,
  ArrowUpRight,
  Lightbulb,
  Zap,
  ChevronRight,
  ChevronDown,
  Radio,
  BarChart3,
  Target,
  Shield,
  Activity,
  Package,
  Flame,
  AlertTriangle,
  Layers,
  ArrowRightLeft,
  Tag,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, Legend,
} from "recharts";
import { useState, useEffect, useMemo } from "react";
import { useRestaurantData } from "@/lib/restaurantData";
import { useNavigate } from "react-router-dom";
import {
  generateDashboardInsights,
  generatePriceRecommendations,
  calculateMargin,
  getOrderCountForItem,
  calculateSalesVelocity,
  generateUpsellSuggestions,
} from "@/lib/aiEngine";
import { toast } from "sonner";

interface LiveOrder {
  id: number;
  time: string;
  items: string;
  total: number;
  margin: number;
}

const impactBadge = (level?: string) => {
  if (level === "HIGH") return <span className="rounded-md bg-destructive/10 px-2 py-0.5 text-[9px] font-extrabold text-destructive">HIGH</span>;
  if (level === "MEDIUM") return <span className="rounded-md bg-accent/10 px-2 py-0.5 text-[9px] font-extrabold text-accent">MEDIUM</span>;
  return <span className="rounded-md bg-muted px-2 py-0.5 text-[9px] font-extrabold text-muted-foreground">LOW</span>;
};

const confidenceDot = (conf: number) => {
  const color = conf >= 70 ? "text-success" : conf >= 40 ? "text-accent" : "text-muted-foreground";
  return <span className={`text-[9px] font-bold ${color}`}>{conf}%</span>;
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { menuItems, orders, commissions, totalRevenue, totalOrders, avgOrderValue, updateMenuItem } = useRestaurantData();
  const [liveOrders, setLiveOrders] = useState<LiveOrder[]>([]);
  const [expandedInsight, setExpandedInsight] = useState<number | null>(null);

  const insights = useMemo(() => generateDashboardInsights(menuItems, orders), [menuItems, orders]);
  const priceRecs = useMemo(() => {
    try { return generatePriceRecommendations(menuItems, orders, commissions); } catch { return []; }
  }, [menuItems, orders, commissions]);

  const topSeller = useMemo(() => {
    if (menuItems.length === 0) return { name: "\u2014", count: 0 };
    let best = menuItems[0], bestCount = 0;
    for (const item of menuItems) { const c = getOrderCountForItem(item.id, orders); if (c > bestCount) { bestCount = c; best = item; } }
    return { name: best.name, count: bestCount };
  }, [menuItems, orders]);

  const hiddenStar = useMemo(() => {
    if (menuItems.length === 0) return { name: "\u2014", margin: "0" };
    const avg = menuItems.reduce((s, m) => s + getOrderCountForItem(m.id, orders), 0) / menuItems.length;
    const best = menuItems.filter(item => { const m = calculateMargin(item); const c = getOrderCountForItem(item.id, orders); return m > 50 && c < avg; }).sort((a, b) => calculateMargin(b) - calculateMargin(a))[0];
    return { name: best?.name || "\u2014", margin: best ? calculateMargin(best).toFixed(0) : "0" };
  }, [menuItems, orders]);

  const velocityData = useMemo(() => {
    try { return calculateSalesVelocity(menuItems, orders); } catch { return []; }
  }, [menuItems, orders]);
  const hotItems = velocityData.filter(v => v.velocityLabel === "\uD83D\uDD25 Hot Seller" || v.velocityLabel === "\uD83D\uDCC8 Trending Up").length;
  const coldItems = velocityData.filter(v => v.velocityLabel === "\u2744\uFE0F Cold Item" || v.velocityLabel === "\uD83D\uDCC9 Slowing Down").length;

  const upsellData = useMemo(() => {
    try { return generateUpsellSuggestions(menuItems, orders); } catch { return []; }
  }, [menuItems, orders]);
  const totalUpsells = upsellData.reduce((s, u) => s + (u.upsells?.length || 0), 0);

  const lowMarginRiskItems = useMemo(() => {
    try {
      const avg = menuItems.reduce((s, m) => s + getOrderCountForItem(m.id, orders), 0) / (menuItems.length || 1);
      return menuItems.filter(item => { const margin = calculateMargin(item); const count = getOrderCountForItem(item.id, orders); return margin < 40 && count > avg; }).length;
    } catch { return 0; }
  }, [menuItems, orders]);

  const hiddenStarsCount = useMemo(() => {
    try {
      const avg = menuItems.reduce((s, m) => s + getOrderCountForItem(m.id, orders), 0) / (menuItems.length || 1);
      return menuItems.filter(item => { const margin = calculateMargin(item); const count = getOrderCountForItem(item.id, orders); return margin > 55 && count < avg * 0.6; }).length;
    } catch { return 0; }
  }, [menuItems, orders]);

  const trendSummary = useMemo(() => {
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;

    let currentRevenue = 0;
    let currentOrders = 0;
    let previousRevenue = 0;
    let previousOrders = 0;

    for (const order of orders) {
      const ts = new Date(order.timestamp).getTime();
      const age = now - ts;
      if (age < 0) continue;

      if (age < weekMs) {
        currentRevenue += order.total;
        currentOrders += 1;
      } else if (age < weekMs * 2) {
        previousRevenue += order.total;
        previousOrders += 1;
      }
    }

    const revenueChangePct = previousRevenue > 0
      ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
      : (currentRevenue > 0 ? 100 : 0);

    const currentAov = currentOrders > 0 ? currentRevenue / currentOrders : 0;
    const previousAov = previousOrders > 0 ? previousRevenue / previousOrders : 0;
    const aovChangePct = previousAov > 0
      ? ((currentAov - previousAov) / previousAov) * 100
      : (currentAov > 0 ? 100 : 0);

    return { revenueChangePct, aovChangePct };
  }, [orders]);

  const forecastData = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const buckets = Array.from({ length: 14 }, () => 0);

    for (const order of orders) {
      const ts = new Date(order.timestamp).getTime();
      const ageDays = Math.floor((now - ts) / dayMs);
      if (ageDays >= 0 && ageDays < buckets.length) {
        buckets[ageDays] += order.total;
      }
    }

    const last7 = buckets.slice(0, 7);
    const previous7 = buckets.slice(7, 14);
    const lastAvg = last7.reduce((s, v) => s + v, 0) / 7;
    const previousAvg = previous7.reduce((s, v) => s + v, 0) / 7;
    const growth = previousAvg > 0 ? (lastAvg - previousAvg) / previousAvg : 0;

    return Array.from({ length: 7 }, (_, i) => {
      const baseline = Math.max(0, Math.round(lastAvg * (1 + growth * i)));
      return {
        week: `Week ${i + 1}`,
        withoutAI: baseline,
        withAI: Math.round(baseline * 1.08),
      };
    });
  }, [orders]);

  const popularityData = useMemo(() => menuItems.map((item) => ({ item: item.name, orders: getOrderCountForItem(item.id, orders) })).sort((a, b) => b.orders - a.orders).slice(0, 6), [menuItems, orders]);

  const categoryData = useMemo(() => {
    const cats = new Map<string, number>(); const colors = ["#4F46E5", "#F59E0B", "#10B981", "#8B5CF6", "#EF4444", "#06B6D4"];
    for (const item of menuItems) { const count = getOrderCountForItem(item.id, orders); cats.set(item.category, (cats.get(item.category) || 0) + count); }
    return Array.from(cats.entries()).map(([name, value], i) => ({ name, value, color: colors[i % colors.length] })).sort((a, b) => b.value - a.value);
  }, [menuItems, orders]);

  const salesData = useMemo(() => {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]; const daySales = new Map<string, number>(); days.forEach((d) => daySales.set(d, 0));
    for (const order of orders) { const day = days[new Date(order.timestamp).getDay() === 0 ? 6 : new Date(order.timestamp).getDay() - 1]; daySales.set(day, (daySales.get(day) || 0) + order.total); }
    return days.map((day) => ({ day, revenue: daySales.get(day) || 0 }));
  }, [orders]);

  const formatChange = (value: number): string => {
    if (!Number.isFinite(value)) return "0%";
    const rounded = Math.round(value * 10) / 10;
    const sign = rounded > 0 ? "+" : "";
    return `${sign}${rounded}%`;
  };

  const metrics = useMemo(() => [
    {
      label: "Total Revenue",
      value: `\u20B9${totalRevenue >= 1000 ? (totalRevenue / 1000).toFixed(1) + "K" : totalRevenue.toFixed(0)}`,
      change: formatChange(trendSummary.revenueChangePct),
      icon: DollarSign,
    },
    {
      label: "Avg Order Value",
      value: `\u20B9${Math.round(avgOrderValue)}`,
      change: formatChange(trendSummary.aovChangePct),
      icon: TrendingUp,
    },
    { label: "Top Selling Item", value: topSeller.name, sub: `${topSeller.count} orders`, icon: Star },
    { label: "Hidden Star", value: hiddenStar.name, sub: `${hiddenStar.margin}% margin`, icon: Eye },
  ], [
    avgOrderValue,
    hiddenStar.margin,
    hiddenStar.name,
    topSeller.count,
    topSeller.name,
    totalRevenue,
    trendSummary.aovChangePct,
    trendSummary.revenueChangePct,
  ]);

  const actions = useMemo(() => priceRecs.filter(r => r.suggestedPrice !== r.currentPrice || (r.suggestedOnlinePrice && r.suggestedOnlinePrice !== r.currentPrice)).slice(0, 3).map((rec) => {
    let title = `${rec.menuItem.name}: Optimized`;
    if (rec.suggestedPrice !== rec.currentPrice && rec.suggestedOnlinePrice && rec.suggestedOnlinePrice !== rec.currentPrice) title = `${rec.menuItem.name}: \u20B9${rec.suggestedPrice} | O: \u20B9${rec.suggestedOnlinePrice}`;
    else if (rec.suggestedPrice !== rec.currentPrice) title = `${rec.menuItem.name}: \u20B9${rec.currentPrice} \u2192 \u20B9${rec.suggestedPrice}`;
    else if (rec.suggestedOnlinePrice && rec.suggestedOnlinePrice !== rec.currentPrice) title = `${rec.menuItem.name}: Online \u20B9${rec.suggestedOnlinePrice}`;
    return { title, description: rec.reason.split(".")[0] + ".", impactLevel: rec.impactLevel, confidence: rec.confidence, monthlyImpact: rec.estimatedMonthlyImpact, rec };
  }), [priceRecs]);

  const aiModules = [
    { icon: DollarSign, name: "Contribution Margin", desc: "Per-plate profit analysis", status: menuItems.length > 0 ? "Active" : "Waiting", stat: menuItems.length > 0 ? `${menuItems.length} items` : "\u2014", color: "text-emerald-500", bgColor: "bg-emerald-500/10", link: "/contribution-margin" },
    { icon: BarChart3, name: "Item Profitability", desc: "Star/Dog classification", status: menuItems.length > 0 ? "Active" : "Waiting", stat: menuItems.length > 0 ? `${menuItems.filter(m => calculateMargin(m) > 50).length} profitable` : "\u2014", color: "text-blue-500", bgColor: "bg-blue-500/10", link: "/item-profitability" },
    { icon: Flame, name: "Sales Velocity", desc: "Hot & cold item trends", status: orders.length > 0 ? "Active" : "Waiting", stat: hotItems > 0 ? `${hotItems} hot, ${coldItems} cold` : "Need orders", color: "text-orange-500", bgColor: "bg-orange-500/10", link: "/sales-velocity" },
    { icon: Eye, name: "Hidden Stars", desc: "High margin, promote more!", status: hiddenStarsCount > 0 ? "Found" : "Scanning", stat: hiddenStarsCount > 0 ? `${hiddenStarsCount} found` : "0 detected", color: "text-violet-500", bgColor: "bg-violet-500/10", link: "/hidden-stars" },
    { icon: AlertTriangle, name: "Low-Margin Risk", desc: "Selling a lot but low profit", status: lowMarginRiskItems > 0 ? "Alert" : "Clear", stat: lowMarginRiskItems > 0 ? `${lowMarginRiskItems} at risk` : "All safe", color: lowMarginRiskItems > 0 ? "text-red-500" : "text-emerald-500", bgColor: lowMarginRiskItems > 0 ? "bg-red-500/10" : "bg-emerald-500/10", link: "/low-margin-risk" },
    { icon: Layers, name: "Combo Engine", desc: "Smart combo suggestions", status: orders.length >= 2 ? "Active" : "Waiting", stat: orders.length >= 2 ? "AI combos ready" : "Need 2+ orders", color: "text-cyan-500", bgColor: "bg-cyan-500/10", link: "/combos" },
    { icon: ArrowRightLeft, name: "Smart Upsell", desc: "What to suggest next", status: totalUpsells > 0 ? "Active" : "Waiting", stat: totalUpsells > 0 ? `${totalUpsells} suggestions` : "Need data", color: "text-pink-500", bgColor: "bg-pink-500/10", link: "/smart-upsell" },
    { icon: Tag, name: "Price Optimization", desc: "AI-suggested best prices", status: priceRecs.length > 0 ? "Active" : "Waiting", stat: priceRecs.length > 0 ? `${priceRecs.filter(r => r.suggestedPrice !== r.currentPrice).length} recs` : "\u2014", color: "text-amber-500", bgColor: "bg-amber-500/10", link: "/price-optimization" },
    { icon: Package, name: "Inventory Signals", desc: "Performance-linked alerts", status: "Beta", stat: "Coming soon", color: "text-gray-400", bgColor: "bg-gray-500/10", link: "/coming-soon?feature=Inventory%20Signals" },
  ];

  useEffect(() => {
    if (orders.length > 0) {
      const recent = [...orders].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 5);
      const mapped = recent.map((o, i) => ({
        id: i,
        time: new Date(o.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
        items: o.items.map(it => `${it.name} x${it.qty}`).join(", "),
        total: o.total,
        margin: o.margin,
      }));
      setLiveOrders(mapped);
    }
  }, [orders]);

  const activeModules = aiModules.filter(m => m.status === "Active" || m.status === "Found" || m.status === "Alert").length;

  const tooltipStyle = {
    borderRadius: '12px',
    border: '1px solid hsl(var(--border))',
    background: 'hsl(var(--card))',
    color: 'hsl(var(--foreground))',
    fontSize: '12px',
    fontWeight: 600,
  };

  const tooltipStyleSmall = {
    borderRadius: '8px',
    border: '1px solid hsl(var(--border))',
    background: 'hsl(var(--card))',
    color: 'hsl(var(--foreground))',
    fontSize: '11px',
  };

  if (menuItems.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardNav />
        <div className="flex min-h-[80vh] flex-col items-center justify-center px-6">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-md">
            <Sparkles className="h-12 w-12 text-primary/30 mx-auto mb-4" />
            <h2 className="font-display text-xl font-bold">Welcome to Command Center</h2>
            <p className="mt-2 text-sm text-muted-foreground">Set up your restaurant to unlock AI-powered insights.</p>
            <button onClick={() => navigate("/setup")} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:brightness-110 transition-all">
              <Sparkles className="h-4 w-4" /> Setup My Restaurant
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <div className="px-6 py-6">
        {/* Live POS Feed  at Top */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 glass-card overflow-hidden shadow-sm border border-border/40">
          <div className="flex items-center gap-2 border-b border-border/30 bg-gradient-to-r from-primary/5 via-transparent to-transparent px-5 py-3">
            <Radio className="h-4 w-4 text-primary animate-pulse" />
            <span className="text-sm font-bold tracking-tight text-foreground">Live POS Data Stream</span>
            <div className="ml-auto flex items-center gap-2">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span></span>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Syncing</span>
            </div>
          </div>
          <div className="divide-y divide-border/10 max-h-[160px] overflow-y-auto custom-scrollbar bg-background/30 backdrop-blur-md">
            <AnimatePresence>
              {liveOrders.map((order) => (
                <motion.div key={order.id} initial={{ opacity: 0, x: -20, height: 0 }} animate={{ opacity: 1, x: 0, height: "auto" }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.3 }} className="flex items-center gap-5 px-6 py-3 text-xs hover:bg-primary/[0.02] transition-colors group cursor-pointer" onClick={() => navigate('/orders')}>
                  <span className="text-muted-foreground/70 font-mono w-14 shrink-0 font-medium group-hover:text-primary transition-colors">{order.time}</span>
                  <span className="font-bold text-foreground/70 w-20 shrink-0">#{order.id}</span>
                  <span className="flex-1 truncate font-medium text-muted-foreground">{order.items}</span>
                  <span className="font-bold text-sm shrink-0">{"\u20B9"}{order.total}</span>
                  <span className={`shrink-0 rounded-md px-2.5 py-1 text-[10px] font-extrabold tracking-wide uppercase ${order.margin >= 60 ? "bg-success/10 text-success" : order.margin >= 45 ? "bg-accent/10 text-accent" : "bg-destructive/10 text-destructive"}`}>{Number(order.margin).toFixed(1)}% margin</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Metrics */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((m, i) => (
            <motion.div key={m.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="glass-card p-5 relative overflow-hidden group hover:border-primary/30 transition-all duration-300">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500"><m.icon className="h-20 w-20" /></div>
              <div className="relative flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">{m.label}</p>
                  <p className="font-display text-2xl font-extrabold tracking-tight text-foreground">{m.value}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {m.change && <span className="inline-flex items-center gap-0.5 rounded border border-success/20 bg-success/10 px-1.5 py-0.5 text-[9px] font-bold text-success"><ArrowUpRight className="h-2.5 w-2.5" />{m.change}</span>}
                    {m.sub && <p className="text-[10px] font-medium text-muted-foreground truncate max-w-[120px]">{m.sub}</p>}
                  </div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 shadow-sm"><m.icon className="h-4 w-4 text-primary" /></div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* AI Intelligence Modules Grid */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary animate-pulse" />
              <h2 className="font-display text-sm font-bold">AI Intelligence Modules</h2>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary">{activeModules}/9 Active</span>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {aiModules.map((mod, i) => (
              <motion.div key={mod.name} onClick={() => { if (mod.link !== '#') navigate(mod.link); }} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 * i }}
                className="group relative flex items-center gap-3.5 rounded-xl border border-border/40 bg-card p-4 shadow-sm transition-all hover:border-primary/30 hover:shadow-md cursor-pointer overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-20 h-20 bg-primary/3 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none group-hover:bg-primary/8 transition-colors" />
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${mod.bgColor} transition-transform group-hover:scale-105`}>
                  <mod.icon className={`h-5 w-5 ${mod.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-foreground truncate">{mod.name}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-wider ${mod.status === "Active" || mod.status === "Found" ? "bg-success/10 text-success" : mod.status === "Alert" ? "bg-destructive/10 text-destructive" : mod.status === "Beta" ? "bg-muted text-muted-foreground" : "bg-accent/10 text-accent"}`}>
                      {mod.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{mod.desc}</p>
                  <p className={`text-[10px] font-semibold mt-1 ${mod.status === "Alert" ? "text-destructive" : mod.color}`}>{mod.stat}</p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0" />
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Charts + Insights + Actions */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr_280px]">
          {/* Left  AI Insights */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="command-panel space-y-4">
            <div className="flex items-center gap-2 border-b border-border/40 pb-3">
              <Lightbulb className="h-5 w-5 text-accent" />
              <h2 className="font-display text-base font-bold">AI Insights</h2>
              <span className="ml-auto rounded-full bg-accent/10 px-2.5 py-0.5 text-[10px] font-bold text-accent">{insights.length}</span>
            </div>
            {insights.slice(0, 4).map((ins, i) => (
              <div key={i} className="group rounded-2xl border border-border/40 bg-card p-4 shadow-sm transition-all hover:border-primary/30 hover:shadow-md cursor-pointer" onClick={() => setExpandedInsight(expandedInsight === i ? null : i)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      {impactBadge(ins.impactLevel)}
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">{ins.type}</span>
                    </div>
                    <p className="text-xs font-bold text-foreground">{ins.title}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground line-clamp-2">{ins.description}</p>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground/30 transition-transform ${expandedInsight === i ? "rotate-180" : ""}`} />
                </div>
                <AnimatePresence>
                  {expandedInsight === i && ins.reasoning && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="mt-3 pt-3 border-t border-border/20 space-y-1.5">
                        {ins.reasoning.map((r, ri) => (
                          <p key={ri} className="flex items-start gap-1.5 text-[10px] text-muted-foreground"><span className="mt-1 h-1 w-1 rounded-full bg-primary shrink-0" />{r}</p>
                        ))}
                        {ins.impact && <p className="text-[10px] font-bold text-success mt-2">Potential Impact: {ins.impact}</p>}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </motion.div>

          {/* Center  Charts */}
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="space-y-6">
            <div className="glass-card p-6 border border-border/40 shadow-sm">
              <h3 className="mb-6 font-display text-sm font-semibold tracking-wide flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Revenue Trajectory</h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={salesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs><linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4F46E5" stopOpacity={0.4} /><stop offset="95%" stopColor="#4F46E5" stopOpacity={0.01} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="hsl(var(--muted-foreground) / 0.15)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} stroke="transparent" dy={10} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} stroke="transparent" dx={-10} tickFormatter={(val) => `\u20B9${val}`} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="revenue" stroke="#4F46E5" fill="url(#colorRevenue)" strokeWidth={3} activeDot={{ r: 6, strokeWidth: 0, fill: '#4F46E5' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="glass-card p-6 border border-border/40 shadow-sm">
                <h3 className="mb-6 font-display text-sm font-semibold tracking-wide flex items-center gap-2"><Star className="h-4 w-4 text-accent" /> Menu Item Popularity</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={popularityData} layout="vertical" margin={{ top: 0, right: 0, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" horizontal={true} vertical={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} stroke="transparent" />
                    <YAxis dataKey="item" type="category" tick={{ fontSize: 10, fill: 'hsl(var(--foreground))', fontWeight: 500 }} stroke="transparent" width={100} />
                    <Tooltip cursor={{ fill: 'hsl(var(--primary) / 0.05)' }} contentStyle={tooltipStyleSmall} />
                    <Bar dataKey="orders" fill="url(#colorRevenue)" radius={[0, 4, 4, 0]} barSize={12} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="glass-card p-6 border border-border/40 shadow-sm flex flex-col items-center justify-center">
                <h3 className="mb-4 font-display text-sm font-semibold tracking-wide flex items-center gap-2 self-start"><Target className="h-4 w-4 text-primary" /> Category Revenue</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" innerRadius={55} outerRadius={75} dataKey="value" paddingAngle={4} cornerRadius={4} stroke="none">{categoryData.map((e) => <Cell key={e.name} fill={e.color} />)}</Pie>
                    <Tooltip contentStyle={tooltipStyleSmall} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2 max-w-[200px]">
                  {categoryData.slice(0, 4).map((c) => <div key={c.name} className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground"><div className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />{c.name}</div>)}
                </div>
              </div>
            </div>
            <div className="glass-card p-6 border border-border/40 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-sm font-semibold tracking-wide flex items-center gap-2"><TrendingUp className="h-4 w-4 text-success" /> AI Revenue Forecast</h3>
                <span className="rounded-md bg-success border border-success/20 px-3 py-1 text-[10px] font-bold text-success-foreground shadow-sm">+18% projected</span>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={forecastData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.1)" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} stroke="transparent" dy={10} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} stroke="transparent" dx={-10} tickFormatter={(val) => `\u20B9${val}`} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Line type="monotone" dataKey="withoutAI" name="Without AI" stroke="hsl(var(--muted-foreground) / 0.5)" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                  <Line type="monotone" dataKey="withAI" name="With AI Engine" stroke="#4F46E5" strokeWidth={3} dot={{ r: 4, strokeWidth: 0, fill: '#4F46E5' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Right  Copilot Actions */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }} className="command-panel space-y-4">
            <div className="flex items-center gap-2 border-b border-border/40 pb-3">
              <Zap className="h-5 w-5 text-primary" />
              <h2 className="font-display text-base font-bold">Copilot Actions</h2>
            </div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground pb-2">High Impact Optimizations</p>
            {actions.map((a, i) => (
              <div key={i} className="group relative overflow-hidden rounded-2xl border border-border/40 bg-card p-4 shadow-sm transition-all hover:border-primary/40 hover:shadow-md">
                <div className="absolute top-0 right-0 h-32 w-32 bg-primary/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none group-hover:bg-primary/10 transition-colors"></div>
                <div className="relative flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">{a.title}</p>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground line-clamp-2">{a.description}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  {impactBadge(a.impactLevel)}
                  <div className="flex items-center gap-1"><Shield className="h-2.5 w-2.5 text-muted-foreground" />{confidenceDot(a.confidence)}</div>
                  {a.monthlyImpact > 0 && <span className="ml-auto text-[10px] font-extrabold text-success tracking-wide">+{"\u20B9"}{a.monthlyImpact}/mo</span>}
                </div>
                <div className="mt-4 flex gap-2">
                  <button onClick={async () => {
                    if (a.rec) {
                      const updates: any = { price: a.rec.suggestedPrice };
                      if (a.rec.suggestedOnlinePrice) updates.onlinePrice = a.rec.suggestedOnlinePrice;
                      await updateMenuItem(a.rec.menuItem.id, updates);
                    }
                    toast.success(`Applied: ${a.title}`, { description: 'Price updated in menu!' });
                  }} className="flex-1 rounded-xl bg-primary px-3 py-2 text-[11px] font-bold text-primary-foreground shadow-sm transition-all hover:brightness-110 hover:shadow">Apply Now</button>
                  <button onClick={() => navigate('/price-optimization')} className="flex-1 rounded-xl border border-border/60 bg-secondary/50 px-3 py-2 text-[11px] font-semibold text-foreground shadow-sm transition-colors hover:bg-secondary">Details</button>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;



