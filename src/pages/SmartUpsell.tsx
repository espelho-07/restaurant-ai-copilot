import { DashboardNav } from "@/components/DashboardNav";
import { motion } from "framer-motion";
import { ArrowRightLeft, ArrowLeft, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRestaurantData } from "@/lib/restaurantData";
import { generateUpsellSuggestions, calculateMargin } from "@/lib/aiEngine";
import { useMemo } from "react";

const SmartUpsell = () => {
  const navigate = useNavigate();
  const { menuItems, orders } = useRestaurantData();

  const upsellData = useMemo(() => {
    try { return generateUpsellSuggestions(menuItems, orders); } catch { return []; }
  }, [menuItems, orders]);

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <div className="mx-auto max-w-6xl px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <button onClick={() => navigate("/dashboard")} className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-500/10"><ArrowRightLeft className="h-5 w-5 text-pink-500" /></div>
            <div>
              <h1 className="font-display text-xl font-bold">Smart Upsell Recommendations</h1>
              <p className="text-xs text-muted-foreground">Jab customer X order kare, toh Y bhi suggest karo — Cross-sell prioritization</p>
            </div>
          </div>
        </motion.div>

        {upsellData.length > 0 ? (
          <>
            {/* Staff Cheat Sheet */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="mt-6 glass-card p-5 border border-pink-500/20 bg-pink-500/[0.02]"
            >
              <h3 className="font-display text-sm font-semibold mb-3">📋 Staff Cheat Sheet — Top Upsell Pairs</h3>
              <p className="text-[10px] text-muted-foreground mb-3">Print this and give to your waiters. When a customer orders the first item, suggest the second one!</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {upsellData.slice(0, 6).flatMap(u =>
                  u.upsells.slice(0, 1).map(s => ({
                    from: u.forItem.name,
                    to: s.item.name,
                    confidence: s.confidence,
                    margin: s.marginPct,
                  }))
                ).map((pair, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg border border-border/30 bg-card p-3">
                    <span className="text-xs font-bold truncate flex-1">{pair.from}</span>
                    <ArrowRight className="h-3 w-3 text-pink-500 shrink-0" />
                    <span className="text-xs font-bold text-pink-500 truncate flex-1">{pair.to}</span>
                    <span className="text-[9px] text-muted-foreground shrink-0">{pair.confidence}%</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Detailed Upsells */}
            <div className="mt-6 space-y-4">
              {upsellData.map((u, i) => (
                <motion.div key={u.forItem.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.05 }}
                  className="glass-card overflow-hidden"
                >
                  <div className="p-4 bg-secondary/30 border-b border-border/30 flex items-center gap-3">
                    <p className="text-sm font-bold flex-1">When customer orders: <span className="text-primary">{u.forItem.name}</span></p>
                    <span className="text-xs text-muted-foreground">₹{u.forItem.price} · {calculateMargin(u.forItem).toFixed(0)}% margin</span>
                  </div>
                  <div className="p-4 space-y-2">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Suggest these items:</p>
                    {u.upsells.map((s, si) => (
                      <div key={si} className="flex items-center gap-3 rounded-lg border border-border/20 p-3 hover:border-pink-500/30 transition-all">
                        <span className="text-xs font-bold text-muted-foreground/40 w-5">#{si + 1}</span>
                        <div className="flex-1">
                          <p className="text-xs font-bold">{s.item.name} — ₹{s.item.price}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{s.reasoning}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[10px] font-bold text-pink-500">Score: {(s.score * 100).toFixed(0)}</p>
                          <p className="text-[9px] text-muted-foreground">{s.confidence}% confidence · {s.marginPct.toFixed(0)}% margin</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        ) : (
          <div className="mt-16 text-center">
            <p className="text-3xl mb-3">📊</p>
            <h2 className="font-display text-lg font-bold">Need More Data</h2>
            <p className="text-sm text-muted-foreground mt-2">Generate at least 3 orders with different items to see upsell recommendations.</p>
            <button onClick={() => navigate("/pos")} className="mt-4 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">Go to POS Simulator</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SmartUpsell;
