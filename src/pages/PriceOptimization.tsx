import { DashboardNav } from "@/components/DashboardNav";
import { motion } from "framer-motion";
import { Tag, ArrowLeft, Check, ArrowUpRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRestaurantData } from "@/lib/restaurantData";
import { generatePriceRecommendations, calculateMargin } from "@/lib/aiEngine";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const PriceOptimization = () => {
  const navigate = useNavigate();
  const { menuItems, orders, commissions, updateMenuItem } = useRestaurantData();
  const [appliedIds, setAppliedIds] = useState<Set<number>>(new Set());

  const priceRecs = useMemo(() => {
    try { return generatePriceRecommendations(menuItems, orders, commissions); } catch { return []; }
  }, [menuItems, orders, commissions]);

  const handleApply = async (rec: typeof priceRecs[0]) => {
    const updates: Partial<{ name: string; price: number; cost: number; category: string; onlinePrice: number }> = {
      price: rec.suggestedPrice,
    };
    if (rec.suggestedOnlinePrice) {
      updates.onlinePrice = rec.suggestedOnlinePrice;
    }
    await updateMenuItem(rec.menuItem.id, updates);
    setAppliedIds(prev => new Set([...prev, rec.menuItem.id]));
    toast.success(`Price updated: ${rec.menuItem.name}`, {
      description: `₹${rec.currentPrice} → ₹${rec.suggestedPrice}${rec.suggestedOnlinePrice ? ` (Online: ₹${rec.suggestedOnlinePrice})` : ""}`,
    });
  };

  const totalImpact = priceRecs.reduce((s, r) => s + (r.estimatedMonthlyImpact || 0), 0);

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <div className="mx-auto max-w-6xl px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <button onClick={() => navigate("/dashboard")} className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10"><Tag className="h-5 w-5 text-amber-500" /></div>
            <div>
              <h1 className="font-display text-xl font-bold">Price Optimization</h1>
              <p className="text-xs text-muted-foreground">AI ne analysis karke best prices suggest kiye hain — Apply karo aur revenue badhao!</p>
            </div>
          </div>
        </motion.div>

        {/* Summary */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Recommendations</p>
            <p className="font-display text-2xl font-bold mt-1">{priceRecs.length}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="glass-card p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Price Changes Suggested</p>
            <p className="font-display text-2xl font-bold mt-1">{priceRecs.filter(r => r.suggestedPrice !== r.currentPrice).length}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="glass-card p-5 border-success/30">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Est. Monthly Impact</p>
            <p className="font-display text-2xl font-bold text-success mt-1">+₹{totalImpact}</p>
          </motion.div>
        </div>

        {/* Recommendations */}
        <div className="mt-6 space-y-3">
          {priceRecs.map((rec, i) => {
            const isApplied = appliedIds.has(rec.menuItem.id);
            const hasChange = rec.suggestedPrice !== rec.currentPrice;
            const hasOnlineChange = rec.suggestedOnlinePrice && rec.suggestedOnlinePrice !== rec.currentPrice;
            if (!hasChange && !hasOnlineChange) return null;
            return (
              <motion.div key={rec.menuItem.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className={`glass-card p-5 transition-all ${isApplied ? "border-success/30 bg-success/[0.02]" : "hover:border-primary/30"}`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1">
                    <p className="text-sm font-bold">{rec.menuItem.name}</p>
                    <p className="text-[10px] text-muted-foreground">{rec.menuItem.category} · {calculateMargin(rec.menuItem).toFixed(0)}% margin</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {rec.impactLevel && (
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${rec.impactLevel === "HIGH" ? "bg-destructive/10 text-destructive" : rec.impactLevel === "MEDIUM" ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground"}`}>{rec.impactLevel}</span>
                    )}
                    <span className="text-[10px] font-semibold text-muted-foreground">{rec.confidence}% confidence</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-3">
                  <div><p className="text-[10px] text-muted-foreground">Current Price</p><p className="text-sm font-bold">₹{rec.currentPrice}</p></div>
                  {hasChange && <div><p className="text-[10px] text-muted-foreground">Suggested Price</p><p className="text-sm font-bold text-primary">₹{rec.suggestedPrice}</p></div>}
                  {hasOnlineChange && <div><p className="text-[10px] text-muted-foreground">Online Price</p><p className="text-sm font-bold text-accent">₹{rec.suggestedOnlinePrice}</p></div>}
                  {rec.estimatedMonthlyImpact > 0 && <div><p className="text-[10px] text-muted-foreground">Monthly Impact</p><p className="text-sm font-bold text-success">+₹{rec.estimatedMonthlyImpact}</p></div>}
                </div>

                <p className="text-xs text-muted-foreground mb-3">{rec.reason}</p>

                {rec.reasoning && rec.reasoning.length > 0 && (
                  <div className="mb-3 space-y-1">
                    {rec.reasoning.map((r, ri) => (
                      <p key={ri} className="flex items-start gap-1.5 text-[10px] text-muted-foreground/80"><span className="mt-1 h-1 w-1 rounded-full bg-primary shrink-0" />{r}</p>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <button disabled={isApplied} onClick={() => handleApply(rec)}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-bold transition-all ${isApplied ? "bg-success/10 text-success cursor-default" : "bg-primary text-primary-foreground hover:brightness-110"}`}
                  >
                    {isApplied ? <><Check className="h-3 w-3" /> Applied</> : <><ArrowUpRight className="h-3 w-3" /> Apply Now</>}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>

        {priceRecs.length === 0 && (
          <div className="mt-16 text-center">
            <p className="text-3xl mb-3">💰</p>
            <h2 className="font-display text-lg font-bold">No Recommendations Yet</h2>
            <p className="text-sm text-muted-foreground mt-2">Add menu items and generate orders to get AI pricing suggestions.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PriceOptimization;
