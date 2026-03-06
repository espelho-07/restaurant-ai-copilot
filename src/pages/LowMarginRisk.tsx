import { DashboardNav } from "@/components/DashboardNav";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowLeft, TrendingUp, ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRestaurantData } from "@/lib/restaurantData";
import { calculateMargin, getOrderCountForItem, generatePriceRecommendations } from "@/lib/aiEngine";
import { useMemo } from "react";

const LowMarginRisk = () => {
  const navigate = useNavigate();
  const { menuItems, orders, commissions } = useRestaurantData();

  const { riskItems, avgOrders } = useMemo(() => {
    if (menuItems.length === 0) return { riskItems: [], avgOrders: 0 };
    const avgOrders = menuItems.reduce((s, m) => s + getOrderCountForItem(m.id, orders), 0) / menuItems.length;
    const riskItems = menuItems.filter(item => {
      const margin = calculateMargin(item);
      const count = getOrderCountForItem(item.id, orders);
      return margin < 40 && count >= avgOrders * 0.5;
    }).map(item => {
      const margin = calculateMargin(item);
      const count = getOrderCountForItem(item.id, orders);
      const severity = margin < 20 ? "Critical" : margin < 30 ? "High" : "Medium";
      const lostProfit = Math.round(count * (item.price * 0.5 - (item.price - item.cost)));
      return { ...item, margin, orderCount: count, severity, lostProfit, profit: item.price - item.cost };
    }).sort((a, b) => a.margin - b.margin);
    return { riskItems, avgOrders: Math.round(avgOrders) };
  }, [menuItems, orders]);

  const priceRecs = useMemo(() => {
    try { return generatePriceRecommendations(menuItems, orders, commissions); } catch { return []; }
  }, [menuItems, orders, commissions]);

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <div className="mx-auto max-w-6xl px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <button onClick={() => navigate("/dashboard")} className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10"><AlertTriangle className="h-5 w-5 text-red-500" /></div>
            <div>
              <h1 className="font-display text-xl font-bold">Low-Margin Risk Alerts</h1>
              <p className="text-xs text-muted-foreground">Ye items bahut bik rahe hain lekin profit kam hai. Dhyan do!</p>
            </div>
          </div>
        </motion.div>

        {riskItems.length > 0 ? (
          <div className="mt-6 space-y-3">
            {riskItems.map((item, i) => {
              const rec = priceRecs.find(r => r.menuItem.id === item.id);
              return (
                <motion.div key={item.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                  className={`glass-card p-5 border-l-4 ${item.severity === "Critical" ? "border-l-red-500" : item.severity === "High" ? "border-l-orange-500" : "border-l-amber-500"}`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <ShieldAlert className={`h-5 w-5 shrink-0 ${item.severity === "Critical" ? "text-red-500" : "text-orange-500"}`} />
                    <div className="flex-1">
                      <p className="text-sm font-bold">{item.name}</p>
                      <p className="text-[10px] text-muted-foreground">{item.orderCount} orders · Average: {avgOrders}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-[9px] font-bold ${item.severity === "Critical" ? "bg-red-500/10 text-red-500" : item.severity === "High" ? "bg-orange-500/10 text-orange-500" : "bg-amber-500/10 text-amber-500"}`}>
                      {item.severity} Risk
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div><p className="text-[10px] text-muted-foreground">Selling Price</p><p className="text-sm font-bold">₹{item.price}</p></div>
                    <div><p className="text-[10px] text-muted-foreground">Food Cost</p><p className="text-sm font-bold text-destructive">₹{item.cost}</p></div>
                    <div><p className="text-[10px] text-muted-foreground">Profit / Plate</p><p className="text-sm font-bold">₹{item.profit}</p></div>
                    <div><p className="text-[10px] text-muted-foreground">Margin</p><p className="text-sm font-bold text-destructive">{item.margin.toFixed(1)}%</p></div>
                  </div>
                  {rec && rec.suggestedPrice !== item.price && (
                    <div className="mt-3 rounded-lg bg-primary/5 border border-primary/20 p-3 flex items-center gap-3">
                      <TrendingUp className="h-4 w-4 text-primary shrink-0" />
                      <div>
                        <p className="text-[10px] font-semibold text-primary">AI Recommendation</p>
                        <p className="text-xs text-muted-foreground">Increase price to <b className="text-foreground">₹{rec.suggestedPrice}</b> — {rec.reason.split(".")[0]}.</p>
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="mt-16 text-center">
            <p className="text-3xl mb-3">✅</p>
            <h2 className="font-display text-lg font-bold">All Clear!</h2>
            <p className="text-sm text-muted-foreground mt-2">None of your popular items have dangerously low margins. Great pricing!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LowMarginRisk;
