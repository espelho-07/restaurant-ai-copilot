import { DashboardNav } from "@/components/DashboardNav";
import { motion } from "framer-motion";
import { DollarSign, ArrowLeft, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRestaurantData } from "@/lib/restaurantData";
import { calculateMargin, getOrderCountForItem } from "@/lib/aiEngine";
import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const ContributionMargin = () => {
  const navigate = useNavigate();
  const { menuItems, orders } = useRestaurantData();

  const data = useMemo(() => {
    return menuItems.map(item => {
      const margin = calculateMargin(item);
      const profit = item.price - item.cost;
      const orderCount = getOrderCountForItem(item.id, orders);
      return {
        name: item.name,
        price: item.price,
        cost: item.cost,
        profit,
        margin: Number(margin.toFixed(1)),
        orders: orderCount,
        totalProfit: profit * orderCount,
        color: margin >= 50 ? "#10B981" : margin >= 30 ? "#F59E0B" : "#EF4444",
        status: margin >= 50 ? "Great" : margin >= 30 ? "Average" : "Low",
      };
    }).sort((a, b) => b.margin - a.margin);
  }, [menuItems, orders]);

  const avgMargin = data.length > 0 ? (data.reduce((s, d) => s + d.margin, 0) / data.length).toFixed(1) : "0";

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <div className="mx-auto max-w-6xl px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <button onClick={() => navigate("/dashboard")} className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10"><DollarSign className="h-5 w-5 text-emerald-500" /></div>
            <div>
              <h1 className="font-display text-xl font-bold">Contribution Margin</h1>
              <p className="text-xs text-muted-foreground">Ek plate bikte hain toh kitna profit milta hai? — Per-plate profit analysis</p>
            </div>
          </div>
        </motion.div>

        {/* Summary Cards */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { label: "Average Margin", value: `${avgMargin}%`, icon: TrendingUp, desc: "Across all items" },
            { label: "High Profit Items", value: `${data.filter(d => d.margin >= 50).length}`, icon: CheckCircle2, desc: "Above 50% margin" },
            { label: "Low Profit Items", value: `${data.filter(d => d.margin < 30).length}`, icon: AlertTriangle, desc: "Below 30% margin — needs attention" },
          ].map((card, i) => (
            <motion.div key={card.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="glass-card p-5">
              <div className="flex items-center gap-2 mb-2"><card.icon className="h-4 w-4 text-primary" /><span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{card.label}</span></div>
              <p className="font-display text-2xl font-bold">{card.value}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{card.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Chart */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-6 glass-card p-6">
          <h3 className="font-display text-sm font-semibold mb-4">Margin by Item</h3>
          <p className="text-xs text-muted-foreground mb-4">🟢 Great (50%+) · 🟡 Average (30-50%) · 🔴 Low (&lt;30%)</p>
          <ResponsiveContainer width="100%" height={Math.max(data.length * 40, 200)}>
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" horizontal vertical={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} stroke="transparent" unit="%" />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: 'hsl(var(--foreground))', fontWeight: 500 }} stroke="transparent" width={120} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', color: 'hsl(var(--foreground))', fontSize: '12px' }} formatter={(value: number) => [`${value}%`, 'Margin']} />
              <Bar dataKey="margin" radius={[0, 6, 6, 0]} barSize={18}>
                {data.map((entry, index) => <Cell key={index} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Detailed Table */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-6 glass-card overflow-hidden">
          <div className="p-5 border-b border-border/30">
            <h3 className="font-display text-sm font-semibold">Detailed Breakdown</h3>
            <p className="text-xs text-muted-foreground mt-1">Every item's selling price, food cost, and profit per plate</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-secondary/50">
                <tr className="text-muted-foreground">
                  <th className="px-5 py-3 text-left font-semibold">Item Name</th>
                  <th className="px-4 py-3 text-right font-semibold">Selling Price</th>
                  <th className="px-4 py-3 text-right font-semibold">Food Cost</th>
                  <th className="px-4 py-3 text-right font-semibold">Profit / Plate</th>
                  <th className="px-4 py-3 text-right font-semibold">Margin %</th>
                  <th className="px-4 py-3 text-right font-semibold">Orders</th>
                  <th className="px-4 py-3 text-right font-semibold">Total Profit</th>
                  <th className="px-4 py-3 text-center font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {data.map((item) => (
                  <tr key={item.name} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-5 py-3 font-semibold">{item.name}</td>
                    <td className="px-4 py-3 text-right">₹{item.price}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">₹{item.cost}</td>
                    <td className="px-4 py-3 text-right font-semibold text-success">₹{item.profit}</td>
                    <td className="px-4 py-3 text-right font-bold" style={{ color: item.color }}>{item.margin}%</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{item.orders}</td>
                    <td className="px-4 py-3 text-right font-semibold">₹{item.totalProfit}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${item.status === "Great" ? "bg-success/10 text-success" : item.status === "Average" ? "bg-accent/10 text-accent" : "bg-destructive/10 text-destructive"}`}>{item.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ContributionMargin;
