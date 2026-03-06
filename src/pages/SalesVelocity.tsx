import { DashboardNav } from "@/components/DashboardNav";
import { motion } from "framer-motion";
import { Flame, ArrowLeft, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRestaurantData } from "@/lib/restaurantData";
import { calculateSalesVelocity } from "@/lib/aiEngine";
import { useMemo } from "react";

const SalesVelocity = () => {
  const navigate = useNavigate();
  const { menuItems, orders } = useRestaurantData();

  const velocityData = useMemo(() => {
    try { return calculateSalesVelocity(menuItems, orders); } catch { return []; }
  }, [menuItems, orders]);

  const labelConfig: Record<string, { bg: string; text: string; icon: typeof Flame }> = {
    "🔥 Hot Seller": { bg: "bg-red-500/10", text: "text-red-500", icon: Flame },
    "📈 Trending Up": { bg: "bg-emerald-500/10", text: "text-emerald-500", icon: TrendingUp },
    "➡️ Steady": { bg: "bg-blue-500/10", text: "text-blue-500", icon: Minus },
    "📉 Slowing Down": { bg: "bg-amber-500/10", text: "text-amber-500", icon: TrendingDown },
    "❄️ Cold Item": { bg: "bg-gray-500/10", text: "text-gray-400", icon: TrendingDown },
    "No Data": { bg: "bg-gray-500/10", text: "text-gray-400", icon: Minus },
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <div className="mx-auto max-w-6xl px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <button onClick={() => navigate("/dashboard")} className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10"><Flame className="h-5 w-5 text-orange-500" /></div>
            <div>
              <h1 className="font-display text-xl font-bold">Sales Velocity</h1>
              <p className="text-xs text-muted-foreground">Kaunsa item dhoom macha raha hai? Kaunsa thanda ho raha? — Trend analysis</p>
            </div>
          </div>
        </motion.div>

        {/* Summary */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {["🔥 Hot Seller", "📈 Trending Up", "➡️ Steady", "📉 Slowing Down", "❄️ Cold Item"].map((label) => {
            const count = velocityData.filter(v => v.velocityLabel === label).length;
            const cfg = labelConfig[label] || labelConfig["No Data"];
            return (
              <motion.div key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`rounded-xl border border-border/30 p-4 text-center ${cfg.bg}`}>
                <p className="text-lg mb-1">{label.split(" ")[0]}</p>
                <p className="font-display text-2xl font-bold">{count}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{label.substring(label.indexOf(" ") + 1)}</p>
              </motion.div>
            );
          })}
        </div>

        {/* Item List */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-6 space-y-2">
          {velocityData.map((v, i) => {
            const cfg = labelConfig[v.velocityLabel] || labelConfig["No Data"];
            return (
              <motion.div key={v.item.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                className="glass-card p-4 flex items-center gap-4 group hover:border-primary/30 transition-all"
              >
                <div className="w-8 text-center font-display text-lg font-bold text-muted-foreground/30">#{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{v.item.name}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] text-muted-foreground">₹{v.item.price}</span>
                    <span className="text-[10px] text-muted-foreground">{v.totalOrders} orders</span>
                  </div>
                </div>
                {/* Velocity Score */}
                <div className="text-center shrink-0">
                  <div className="relative w-12 h-12">
                    <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48"><circle cx="24" cy="24" r="20" fill="none" stroke="hsl(var(--border) / 0.3)" strokeWidth="4" /><circle cx="24" cy="24" r="20" fill="none" stroke={v.velocityScore >= 60 ? '#10B981' : v.velocityScore >= 40 ? '#F59E0B' : '#EF4444'} strokeWidth="4" strokeDasharray={`${v.velocityScore * 1.256} 125.6`} strokeLinecap="round" /></svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">{v.velocityScore}</span>
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${cfg.bg} ${cfg.text}`}>{v.velocityLabel}</span>
              </motion.div>
            );
          })}
        </motion.div>

        {velocityData.length === 0 && (
          <div className="mt-10 text-center text-muted-foreground">
            <p className="text-sm">No data available yet. Generate some orders first!</p>
            <button onClick={() => navigate("/pos")} className="mt-3 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">Go to POS Simulator</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SalesVelocity;
