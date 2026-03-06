import { DashboardNav } from "@/components/DashboardNav";
import { motion } from "framer-motion";
import { Sparkles, TrendingDown, TrendingUp, BarChart3 } from "lucide-react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import { useMemo } from "react";
import { useRestaurantData } from "@/lib/restaurantData";
import { calculateMargin, generateComboRecommendations, getOrderCountForItem } from "@/lib/aiEngine";

const colors = ["#4F46E5", "#F59E0B", "#10B981", "#8B5CF6", "#EF4444", "#06B6D4", "#94A3B8"];

const Insights = () => {
  const { menuItems, orders, totalRevenue } = useRestaurantData();

  // Dynamic margin distribution
  const marginData = useMemo(() => {
    const buckets = [
      { range: "0-30%", count: 0 },
      { range: "30-50%", count: 0 },
      { range: "50-70%", count: 0 },
      { range: "70%+", count: 0 },
    ];
    for (const item of menuItems) {
      const m = calculateMargin(item);
      if (m < 30) buckets[0].count++;
      else if (m < 50) buckets[1].count++;
      else if (m < 70) buckets[2].count++;
      else buckets[3].count++;
    }
    return buckets;
  }, [menuItems]);

  // Dynamic revenue contribution
  const revenueContribution = useMemo(() => {
    const itemRevMap = new Map<string, number>();
    for (const item of menuItems) {
      const count = getOrderCountForItem(item.id, orders);
      itemRevMap.set(item.name, item.price * count);
    }
    const sorted = Array.from(itemRevMap.entries()).sort((a, b) => b[1] - a[1]);
    const top4 = sorted.slice(0, 4);
    const othersRev = sorted.slice(4).reduce((s, [, v]) => s + v, 0);
    const total = sorted.reduce((s, [, v]) => s + v, 0) || 1;
    const result = top4.map(([name, val], i) => ({
      name,
      value: Math.round((val / total) * 100),
      color: colors[i],
    }));
    if (othersRev > 0) result.push({ name: "Others", value: Math.round((othersRev / total) * 100), color: "#94A3B8" });
    return result;
  }, [menuItems, orders]);

  // Dynamic low performers
  const lowPerformers = useMemo(() => {
    return menuItems
      .map((item) => ({
        item: item.name,
        margin: Math.round(calculateMargin(item)),
        orders: getOrderCountForItem(item.id, orders),
      }))
      .filter((i) => i.margin < 45)
      .sort((a, b) => a.margin - b.margin)
      .slice(0, 4);
  }, [menuItems, orders]);

  // Dynamic AI summary
  const aiSummary = useMemo(() => {
    const summaries: string[] = [];
    if (menuItems.length === 0) return ["Upload menu and order data to generate AI insights."];

    // Revenue concentration
    const itemRevs = menuItems.map((item) => ({
      name: item.name,
      rev: item.price * getOrderCountForItem(item.id, orders),
    })).sort((a, b) => b.rev - a.rev);
    const totalRev = itemRevs.reduce((s, i) => s + i.rev, 0) || 1;
    const top3Pct = Math.round((itemRevs.slice(0, 3).reduce((s, i) => s + i.rev, 0) / totalRev) * 100);
    if (top3Pct > 40) summaries.push(`Your top 3 items contribute ${top3Pct}% of revenue — diversify to reduce risk.`);

    // High margin underpromotion
    const highMarginLowOrder = menuItems.filter((i) => {
      const m = calculateMargin(i);
      const c = getOrderCountForItem(i.id, orders);
      const avg = orders.length / (menuItems.length || 1);
      return m > 60 && c < avg;
    });
    if (highMarginLowOrder.length > 0) {
      summaries.push(`Items with >60% margin are underrepresented in orders. Increase visibility for ${highMarginLowOrder.slice(0, 2).map((i) => i.name).join(" and ")}.`);
    }

    // Low margin warnings
    if (lowPerformers.length > 0) {
      summaries.push(`${lowPerformers[0].item} should be repriced — lowest margin at ${lowPerformers[0].margin}%.`);
    }

    // AOV insight
    const aov = orders.length > 0 ? totalRevenue / orders.length : 0;
    if (aov > 0) summaries.push(`Current AOV is ₹${Math.round(aov)}. Combos could boost this by 15-20%.`);

    return summaries.length > 0 ? summaries : ["Upload more order data to generate deeper insights."];
  }, [menuItems, orders, totalRevenue, lowPerformers]);

  const comboPerformance = useMemo(() => {
    const combos = generateComboRecommendations(menuItems, orders).slice(0, 2);
    const first = combos[0];
    const second = combos[1] || combos[0];

    const toRadar = (combo: typeof first | undefined) => {
      if (!combo) {
        return { AOV: 0, Orders: 0, Margin: 0, Repeat: 0, Confidence: 0 };
      }

      const comboCost = combo.items.reduce((sum, item) => sum + item.cost, 0);
      const comboMargin = combo.suggestedPrice > 0
        ? ((combo.suggestedPrice - comboCost) / combo.suggestedPrice) * 100
        : 0;

      return {
        AOV: Math.max(0, Math.min(100, combo.aovIncrease + 40)),
        Orders: Math.max(0, Math.min(100, (combo.coOccurrenceCount / Math.max(combo.totalOrders, 1)) * 100)),
        Margin: Math.max(0, Math.min(100, comboMargin)),
        Repeat: Math.max(0, Math.min(100, combo.confidence)),
        Confidence: Math.max(0, Math.min(100, combo.confidence)),
      };
    };

    const firstRadar = toRadar(first);
    const secondRadar = toRadar(second);

    return [
      { metric: "AOV", A: Math.round(firstRadar.AOV), B: Math.round(secondRadar.AOV) },
      { metric: "Orders", A: Math.round(firstRadar.Orders), B: Math.round(secondRadar.Orders) },
      { metric: "Margin", A: Math.round(firstRadar.Margin), B: Math.round(secondRadar.Margin) },
      { metric: "Repeat", A: Math.round(firstRadar.Repeat), B: Math.round(secondRadar.Repeat) },
      { metric: "Confidence", A: Math.round(firstRadar.Confidence), B: Math.round(secondRadar.Confidence) },
    ];
  }, [menuItems, orders]);

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <div className="mx-auto max-w-7xl px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-2xl font-bold">Insights & Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">Deep analytics and AI-powered business recommendations based on {orders.length} orders.</p>
        </motion.div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {/* Margin Distribution */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-5">
            <h3 className="mb-4 font-display text-sm font-semibold">Profit Margin Distribution</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={marginData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
                <XAxis dataKey="range" tick={{ fontSize: 11 }} stroke="hsl(220 9% 46%)" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(220 9% 46%)" />
                <Tooltip />
                <Bar dataKey="count" fill="#4F46E5" radius={[6, 6, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Revenue Contribution */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card p-5">
            <h3 className="mb-4 font-display text-sm font-semibold">Revenue Contribution</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={revenueContribution} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={3}>
                  {revenueContribution.map((e) => (
                    <Cell key={e.name} fill={e.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {revenueContribution.map((c) => (
                <div key={c.name} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c.color }} />
                  {c.name}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Combo Performance */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-5">
            <h3 className="mb-4 font-display text-sm font-semibold">Combo Performance</h3>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={comboPerformance}>
                <PolarGrid stroke="hsl(220 13% 91%)" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10 }} />
                <PolarRadiusAxis tick={false} axisLine={false} />
                <Radar name="Paneer Combo" dataKey="A" stroke="#4F46E5" fill="#4F46E5" fillOpacity={0.2} />
                <Radar name="Burger Meal" dataKey="B" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.15} />
              </RadarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
          {/* Low Performers */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown className="h-4 w-4 text-destructive" />
              <h3 className="font-display text-sm font-semibold">Low Performing Items</h3>
            </div>
            <div className="space-y-3">
              {lowPerformers.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">No low-margin items detected. All items above 45% margin.</p>
              ) : lowPerformers.map((item) => (
                <div key={item.item} className="flex items-center justify-between rounded-xl bg-destructive/[0.04] px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{item.item}</p>
                    <p className="text-xs text-muted-foreground">{item.orders} orders</p>
                  </div>
                  <span className="tag-low-margin">{item.margin}% margin</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* AI Summary */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="command-panel space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" />
              <h3 className="font-display text-sm font-semibold">AI Recommendations</h3>
            </div>
            {aiSummary.map((s, i) => (
              <div key={i} className="insight-card">
                <p className="text-xs leading-relaxed text-muted-foreground">{s}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Insights;

