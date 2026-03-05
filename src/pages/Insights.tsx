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

const marginData = [
  { range: "0-30%", count: 2 },
  { range: "30-50%", count: 3 },
  { range: "50-70%", count: 8 },
  { range: "70%+", count: 4 },
];

const revenueContribution = [
  { name: "Butter Chicken", value: 22, color: "#4F46E5" },
  { name: "Biryani", value: 18, color: "#F59E0B" },
  { name: "Veg Burger", value: 15, color: "#10B981" },
  { name: "Paneer Tikka", value: 12, color: "#8B5CF6" },
  { name: "Others", value: 33, color: "#94A3B8" },
];

const lowPerformers = [
  { item: "Fish Fry", margin: 37, orders: 45 },
  { item: "Chicken Biryani", margin: 36, orders: 135 },
  { item: "Pasta Alfredo", margin: 32, orders: 28 },
];

const comboPerformance = [
  { metric: "AOV", A: 85, B: 70 },
  { metric: "Orders", A: 60, B: 90 },
  { metric: "Margin", A: 78, B: 55 },
  { metric: "Repeat", A: 70, B: 65 },
  { metric: "Rating", A: 90, B: 80 },
];

const aiSummary = [
  "Your top 3 items contribute 55% of revenue — diversify to reduce risk.",
  "Weekend combos perform 34% better than weekday. Launch weekend-exclusive bundles.",
  "Items with >60% margin are underrepresented in promotions. Increase visibility for Masala Dosa and Dal Makhani.",
  "Fish Fry should be replaced or repriced — lowest margin and declining orders.",
];

const Insights = () => {
  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <div className="mx-auto max-w-7xl px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-2xl font-bold">Insights & Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">Deep analytics and AI-powered business recommendations.</p>
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
              {lowPerformers.map((item) => (
                <div key={item.item} className="flex items-center justify-between rounded-xl bg-destructive/[0.04] px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{item.item}</p>
                    <p className="text-xs text-muted-foreground">{item.orders} orders/week</p>
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
