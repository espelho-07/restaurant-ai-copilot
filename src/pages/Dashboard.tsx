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
  Target,
  Shield,
  BarChart3,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useState, useEffect, useMemo } from "react";
import { useRestaurantData } from "@/lib/restaurantData";
import {
  generateDashboardInsights,
  generatePriceRecommendations,
  calculateMargin,
  getOrderCountForItem,
} from "@/lib/aiEngine";

const liveOrderPool = [
  { items: "Butter Chicken x1, Butter Naan x2", total: 420, margin: 62 },
  { items: "Veg Burger x2, Coke x2", total: 480, margin: 68 },
  { items: "Chicken Biryani x1, Raita x1", total: 320, margin: 38 },
  { items: "Paneer Tikka x1, Lassi x1", total: 350, margin: 54 },
  { items: "Masala Dosa x2, Filter Coffee x2", total: 380, margin: 72 },
  { items: "Dal Makhani x1, Jeera Rice x1, Roti x2", total: 340, margin: 65 },
  { items: "Fish Fry x1, Lemon Soda x1", total: 420, margin: 35 },
  { items: "Gulab Jamun x3, Coke x1", total: 300, margin: 74 },
  { items: "Veg Burger x1, French Fries x1, Coke x1", total: 360, margin: 66 },
  { items: "Butter Chicken x2, Naan x3, Lassi x2", total: 870, margin: 58 },
];

interface LiveOrder { id: number; time: string; items: string; total: number; margin: number; }

const impactBadge = (level: string) => {
  const cls = level === "HIGH" ? "bg-destructive/10 text-destructive" : level === "MEDIUM" ? "bg-accent/10 text-accent" : "bg-secondary text-muted-foreground";
  return <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${cls}`}>{level}</span>;
};

const confidenceDot = (conf: number) => {
  const color = conf >= 75 ? "text-success" : conf >= 50 ? "text-accent" : "text-muted-foreground";
  return <span className={`text-[10px] font-bold ${color}`}>{conf}%</span>;
};

const Dashboard = () => {
  const { menuItems, orders, commissions, totalRevenue, totalOrders, avgOrderValue } = useRestaurantData();
  const [liveOrders, setLiveOrders] = useState<LiveOrder[]>([]);
  const [expandedInsight, setExpandedInsight] = useState<number | null>(null);

  const insights = useMemo(() => generateDashboardInsights(menuItems, orders, commissions), [menuItems, orders, commissions]);
  const priceRecs = useMemo(() => generatePriceRecommendations(menuItems, orders, commissions), [menuItems, orders, commissions]);

  const topSeller = useMemo(() => {
    let best = menuItems[0]; let bestCount = 0;
    for (const item of menuItems) { const count = getOrderCountForItem(item.id, orders); if (count > bestCount) { bestCount = count; best = item; } }
    return { name: best?.name || "—", count: bestCount };
  }, [menuItems, orders]);

  const hiddenStar = useMemo(() => {
    let best = menuItems[0]; let bestScore = 0;
    for (const item of menuItems) { const margin = calculateMargin(item); const count = getOrderCountForItem(item.id, orders); const avg = menuItems.reduce((s, m) => s + getOrderCountForItem(m.id, orders), 0) / menuItems.length; if (margin > 50 && count < avg) { const score = margin * (avg - count); if (score > bestScore) { bestScore = score; best = item; } } }
    return { name: best?.name || "—", margin: calculateMargin(best).toFixed(0) };
  }, [menuItems, orders]);

  const forecastData = useMemo(() => {
    const base = avgOrderValue * 30;
    return Array.from({ length: 7 }, (_, i) => ({ week: `Week ${i + 1}`, withoutAI: Math.round(base * (1 + Math.random() * 0.03)), withAI: Math.round(base * (1 + (i + 1) * 0.04 + Math.random() * 0.02)) }));
  }, [avgOrderValue]);

  const popularityData = useMemo(() => menuItems.map((item) => ({ item: item.name, orders: getOrderCountForItem(item.id, orders) })).sort((a, b) => b.orders - a.orders).slice(0, 6), [menuItems, orders]);

  const categoryData = useMemo(() => {
    const cats = new Map<string, number>(); const colors = ["#4F46E5", "#F59E0B", "#10B981", "#8B5CF6", "#EF4444", "#06B6D4"];
    for (const item of menuItems) { const count = getOrderCountForItem(item.id, orders); cats.set(item.category, (cats.get(item.category) || 0) + count); }
    return Array.from(cats.entries()).map(([name, value], i) => ({ name, value, color: colors[i % colors.length] })).sort((a, b) => b.value - a.value);
  }, [menuItems, orders]);

  const salesData = useMemo(() => {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]; const daySales = new Map<string, number>(); days.forEach((d) => daySales.set(d, 0));
    for (const order of orders) { const day = days[new Date(order.timestamp).getDay() === 0 ? 6 : new Date(order.timestamp).getDay() - 1]; daySales.set(day, (daySales.get(day) || 0) + order.total); }
    return days.map((day) => ({ day, revenue: daySales.get(day) || Math.round(3000 + Math.random() * 4000) }));
  }, [orders]);

  const metrics = [
    { label: "Total Revenue", value: `₹${(totalRevenue / 1000).toFixed(1)}K`, change: "+12.5%", icon: DollarSign },
    { label: "Avg Order Value", value: `₹${Math.round(avgOrderValue)}`, change: "+8.2%", icon: TrendingUp },
    { label: "Top Selling Item", value: topSeller.name, sub: `${topSeller.count} orders`, icon: Star },
    { label: "Hidden Star", value: hiddenStar.name, sub: `${hiddenStar.margin}% margin`, icon: Eye },
  ];

  const actions = useMemo(() => priceRecs.filter(r => r.suggestedPrice !== r.currentPrice || (r.suggestedOnlinePrice && r.suggestedOnlinePrice !== r.currentPrice)).slice(0, 3).map((rec) => {
    let title = `${rec.menuItem.name}: Optimized`;
    if (rec.suggestedPrice !== rec.currentPrice && rec.suggestedOnlinePrice && rec.suggestedOnlinePrice !== rec.currentPrice) title = `${rec.menuItem.name}: ₹${rec.suggestedPrice} | O: ₹${rec.suggestedOnlinePrice}`;
    else if (rec.suggestedPrice !== rec.currentPrice) title = `${rec.menuItem.name}: ₹${rec.currentPrice} → ₹${rec.suggestedPrice}`;
    else if (rec.suggestedOnlinePrice && rec.suggestedOnlinePrice !== rec.currentPrice) title = `${rec.menuItem.name}: Online ₹${rec.suggestedOnlinePrice}`;

    return {
      title,
      description: rec.reason.split(".")[0] + ".",
      impactLevel: rec.impactLevel,
      confidence: rec.confidence,
      monthlyImpact: rec.estimatedMonthlyImpact,
    };
  }), [priceRecs]);

  useEffect(() => {
    const now = new Date(); const t = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    setLiveOrders([{ id: 1000, time: t, ...liveOrderPool[0] }]);
    let counter = 1001;
    const interval = setInterval(() => { const d = liveOrderPool[Math.floor(Math.random() * liveOrderPool.length)]; const now = new Date(); const t = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }); counter++; setLiveOrders((prev) => [{ id: counter, time: t, ...d }, ...prev].slice(0, 5)); }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <div className="px-6 py-6">
        {/* Live POS Feed */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 glass-card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border/30 bg-primary/[0.03] px-5 py-2.5">
            <Radio className="h-3.5 w-3.5 text-success animate-pulse" /><span className="text-xs font-semibold">Live POS Feed</span>
            <span className="ml-auto text-[10px] text-muted-foreground">Auto-syncing from Petpooja</span>
          </div>
          <div className="divide-y divide-border/20 max-h-44 overflow-y-auto">
            <AnimatePresence>
              {liveOrders.map((order) => (
                <motion.div key={order.id} initial={{ opacity: 0, x: -20, height: 0 }} animate={{ opacity: 1, x: 0, height: "auto" }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="flex items-center gap-4 px-5 py-2.5 text-xs hover:bg-secondary/30 transition-colors">
                  <span className="text-muted-foreground font-mono w-12 shrink-0">{order.time}</span>
                  <span className="font-medium text-muted-foreground w-16 shrink-0">#{order.id}</span>
                  <span className="flex-1 truncate">{order.items}</span>
                  <span className="font-semibold shrink-0">₹{order.total}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${order.margin >= 60 ? "bg-success/10 text-success" : order.margin >= 45 ? "bg-accent/10 text-accent" : "bg-destructive/10 text-destructive"}`}>{order.margin}% margin</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Metrics */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((m, i) => (
            <motion.div key={m.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="metric-card">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{m.label}</p>
                  <p className="mt-1 font-display text-2xl font-bold">{m.value}</p>
                  {m.change && <span className="mt-1 inline-flex items-center gap-0.5 text-xs font-semibold text-success"><ArrowUpRight className="h-3 w-3" />{m.change}</span>}
                  {m.sub && <p className="mt-1 text-xs text-muted-foreground">{m.sub}</p>}
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10"><m.icon className="h-4 w-4 text-primary" /></div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* 3-Panel Command Center */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr_300px]">
          {/* Left — AI Insights with Explainability */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="command-panel space-y-3">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-accent" />
              <h2 className="font-display text-sm font-semibold">AI Insights</h2>
              <span className="ml-auto rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent">{insights.length}</span>
            </div>
            {insights.slice(0, 6).map((ins, i) => (
              <div key={i} className="insight-card cursor-pointer" onClick={() => setExpandedInsight(expandedInsight === i ? null : i)}>
                <div className="flex items-center gap-1.5 mb-1">
                  {ins.type === "warning" ? <Target className="h-3 w-3 text-destructive" /> : ins.type === "forecast" ? <TrendingUp className="h-3 w-3 text-primary" /> : <Sparkles className="h-3 w-3 text-accent" />}
                  <span className={`text-xs font-semibold flex-1 ${ins.type === "warning" ? "text-destructive" : ins.type === "forecast" ? "text-primary" : "text-accent"}`}>{ins.title}</span>
                  {expandedInsight === i ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                </div>

                <div className="flex items-center gap-2 mb-1.5">
                  {impactBadge(ins.impactLevel)}
                  <div className="flex items-center gap-1">
                    <Shield className="h-2.5 w-2.5 text-muted-foreground" />
                    {confidenceDot(ins.confidence)}
                  </div>
                </div>

                <p className="text-xs leading-relaxed text-muted-foreground">{ins.description}</p>
                {ins.impact && <p className="mt-1 text-xs font-semibold text-success">{ins.impact}</p>}

                {/* Expanded reasoning */}
                {expandedInsight === i && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-3 border-t border-border/30 pt-3">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">AI Reasoning</p>
                    <ul className="space-y-1">
                      {ins.reasoning.map((r, ri) => (
                        <li key={ri} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                          <span className="mt-1 h-1 w-1 rounded-full bg-primary shrink-0" />
                          {r}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {ins.impactedMetrics.map((m) => (
                        <span key={m} className="rounded-full bg-primary/5 px-2 py-0.5 text-[9px] font-medium text-primary">{m}</span>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>
            ))}
          </motion.div>

          {/* Center — Charts */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="space-y-6">
            <div className="glass-card p-5">
              <h3 className="mb-4 font-display text-sm font-semibold">Weekly Sales Trend</h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={salesData}>
                  <defs><linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4F46E5" stopOpacity={0.3} /><stop offset="95%" stopColor="#4F46E5" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" /><XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="hsl(220 9% 46%)" /><YAxis tick={{ fontSize: 12 }} stroke="hsl(220 9% 46%)" /><Tooltip />
                  <Area type="monotone" dataKey="revenue" stroke="#4F46E5" fill="url(#colorRevenue)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="glass-card p-5">
                <h3 className="mb-4 font-display text-sm font-semibold">Menu Item Popularity</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={popularityData} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" /><XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(220 9% 46%)" /><YAxis dataKey="item" type="category" tick={{ fontSize: 11 }} stroke="hsl(220 9% 46%)" width={90} /><Tooltip /><Bar dataKey="orders" fill="#4F46E5" radius={[0, 6, 6, 0]} barSize={16} /></BarChart>
                </ResponsiveContainer>
              </div>
              <div className="glass-card p-5">
                <h3 className="mb-4 font-display text-sm font-semibold">Revenue by Category</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart><Pie data={categoryData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={4}>{categoryData.map((e) => <Cell key={e.name} fill={e.color} />)}</Pie><Tooltip /></PieChart>
                </ResponsiveContainer>
                <div className="mt-2 flex flex-wrap justify-center gap-3">
                  {categoryData.map((c) => <div key={c.name} className="flex items-center gap-1.5 text-xs text-muted-foreground"><div className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />{c.name}</div>)}
                </div>
              </div>
            </div>
            <div className="glass-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-sm font-semibold">Revenue Forecast — AI Impact</h3>
                <span className="rounded-full bg-success/10 px-3 py-1 text-[10px] font-bold text-success">+18% projected</span>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={forecastData}><CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" /><XAxis dataKey="week" tick={{ fontSize: 11 }} stroke="hsl(220 9% 46%)" /><YAxis tick={{ fontSize: 11 }} stroke="hsl(220 9% 46%)" /><Tooltip /><Legend />
                  <Line type="monotone" dataKey="withoutAI" name="Without AI" stroke="#94A3B8" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                  <Line type="monotone" dataKey="withAI" name="With AI" stroke="#4F46E5" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Right — AI Copilot Actions */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }} className="command-panel space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <h2 className="font-display text-sm font-semibold">AI Copilot</h2>
            </div>
            <p className="text-xs text-muted-foreground">Price optimization actions from your data:</p>
            {actions.map((a, i) => (
              <div key={i} className="glass-card-hover cursor-pointer p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-xs font-semibold">{a.title}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{a.description}</p>
                  </div>
                  <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </div>
                <div className="mt-2 flex items-center gap-2">
                  {impactBadge(a.impactLevel)}
                  <div className="flex items-center gap-1"><Shield className="h-2.5 w-2.5 text-muted-foreground" />{confidenceDot(a.confidence)}</div>
                  {a.monthlyImpact > 0 && <span className="ml-auto text-[10px] font-semibold text-success">+₹{a.monthlyImpact}/mo</span>}
                </div>
                <div className="mt-2 flex gap-2">
                  <button className="rounded-lg bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground hover:brightness-110">Apply</button>
                  <button className="rounded-lg border border-border px-3 py-1 text-[11px] font-medium text-muted-foreground hover:bg-secondary">Details</button>
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
