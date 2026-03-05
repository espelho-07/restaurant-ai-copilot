import { DashboardNav } from "@/components/DashboardNav";
import { motion } from "framer-motion";
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
} from "lucide-react";
import {
  AreaChart,
  Area,
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
} from "recharts";

const salesData = [
  { day: "Mon", revenue: 4200 },
  { day: "Tue", revenue: 3800 },
  { day: "Wed", revenue: 5100 },
  { day: "Thu", revenue: 4600 },
  { day: "Fri", revenue: 6200 },
  { day: "Sat", revenue: 7400 },
  { day: "Sun", revenue: 6800 },
];

const popularityData = [
  { item: "Butter Chicken", orders: 142 },
  { item: "Paneer Tikka", orders: 98 },
  { item: "Veg Burger", orders: 120 },
  { item: "Biryani", orders: 135 },
  { item: "Masala Dosa", orders: 87 },
  { item: "Dal Makhani", orders: 76 },
];

const categoryData = [
  { name: "Main Course", value: 42, color: "#4F46E5" },
  { name: "Starters", value: 25, color: "#F59E0B" },
  { name: "Beverages", value: 18, color: "#10B981" },
  { name: "Desserts", value: 15, color: "#8B5CF6" },
];

const metrics = [
  { label: "Total Revenue", value: "₹4,82,000", change: "+12.5%", icon: DollarSign, positive: true },
  { label: "Avg Order Value", value: "₹385", change: "+8.2%", icon: TrendingUp, positive: true },
  { label: "Top Selling Item", value: "Butter Chicken", sub: "142 orders", icon: Star, positive: true },
  { label: "Hidden Star", value: "Paneer Tikka", sub: "52% margin", icon: Eye, positive: true },
];

const insights = [
  {
    type: "opportunity",
    title: "High Margin Opportunity",
    description: "Paneer Tikka has a 52% profit margin but low visibility. Promoting it as a combo with Butter Naan could increase AOV by ₹45.",
  },
  {
    type: "warning",
    title: "Low Margin Alert",
    description: "Chicken Biryani margins dropped 8% this month. Consider renegotiating ingredient costs or adjusting portion size.",
  },
  {
    type: "insight",
    title: "Weekend Pattern",
    description: "Saturday revenue is 74% higher than weekday average. Consider a premium weekend menu to maximize this trend.",
  },
];

const actions = [
  { title: "Create Paneer Tikka Combo", description: "Bundle with Butter Naan + Lassi for ₹299", priority: "high" },
  { title: "Promote Hidden Stars", description: "3 items with >45% margin need visibility", priority: "medium" },
  { title: "Optimize Weekend Menu", description: "Add premium items for Saturday rush", priority: "medium" },
];

const Dashboard = () => {
  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <div className="px-6 py-6">
        {/* Top Metrics */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="metric-card"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{m.label}</p>
                  <p className="mt-1 font-display text-2xl font-bold">{m.value}</p>
                  {m.change && (
                    <span className="mt-1 inline-flex items-center gap-0.5 text-xs font-semibold text-success">
                      <ArrowUpRight className="h-3 w-3" />
                      {m.change}
                    </span>
                  )}
                  {m.sub && (
                    <p className="mt-1 text-xs text-muted-foreground">{m.sub}</p>
                  )}
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                  <m.icon className="h-4 w-4 text-primary" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* 3-Panel Command Center */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr_300px]">
          {/* Left Panel - AI Insights */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="command-panel space-y-4"
          >
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-accent" />
              <h2 className="font-display text-sm font-semibold">AI Insights</h2>
            </div>
            {insights.map((ins, i) => (
              <div key={i} className="insight-card">
                <div className="mb-1 flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-accent" />
                  <span className="text-xs font-semibold text-accent">{ins.title}</span>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">{ins.description}</p>
              </div>
            ))}
          </motion.div>

          {/* Center - Charts */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-6"
          >
            {/* Sales Trend */}
            <div className="glass-card p-5">
              <h3 className="mb-4 font-display text-sm font-semibold">Weekly Sales Trend</h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={salesData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="hsl(220 9% 46%)" />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(220 9% 46%)" />
                  <Tooltip />
                  <Area type="monotone" dataKey="revenue" stroke="#4F46E5" fill="url(#colorRevenue)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Two charts side by side */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="glass-card p-5">
                <h3 className="mb-4 font-display text-sm font-semibold">Menu Item Popularity</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={popularityData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
                    <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(220 9% 46%)" />
                    <YAxis dataKey="item" type="category" tick={{ fontSize: 11 }} stroke="hsl(220 9% 46%)" width={90} />
                    <Tooltip />
                    <Bar dataKey="orders" fill="#4F46E5" radius={[0, 6, 6, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="glass-card p-5">
                <h3 className="mb-4 font-display text-sm font-semibold">Revenue by Category</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={4}>
                      {categoryData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-2 flex flex-wrap justify-center gap-3">
                  {categoryData.map((c) => (
                    <div key={c.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                      {c.name}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right Panel - AI Copilot */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="command-panel space-y-4"
          >
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <h2 className="font-display text-sm font-semibold">AI Copilot</h2>
            </div>
            <p className="text-xs text-muted-foreground">Suggested actions based on your data:</p>
            {actions.map((a, i) => (
              <div key={i} className="glass-card-hover cursor-pointer p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold">{a.title}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{a.description}</p>
                  </div>
                  <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </div>
                <div className="mt-2 flex gap-2">
                  <button className="rounded-lg bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground transition-colors hover:brightness-110">
                    Create Combo
                  </button>
                  <button className="rounded-lg border border-border px-3 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary">
                    Promote
                  </button>
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
