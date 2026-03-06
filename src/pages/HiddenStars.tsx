import { DashboardNav } from "@/components/DashboardNav";
import { motion } from "framer-motion";
import { Eye, ArrowLeft, Megaphone, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRestaurantData } from "@/lib/restaurantData";
import { calculateMargin, getOrderCountForItem } from "@/lib/aiEngine";
import { useMemo } from "react";

const HiddenStars = () => {
  const navigate = useNavigate();
  const { menuItems, orders } = useRestaurantData();

  const { hiddenStars, avgOrders } = useMemo(() => {
    if (menuItems.length === 0) return { hiddenStars: [], avgOrders: 0 };
    const avgOrders = menuItems.reduce((s, m) => s + getOrderCountForItem(m.id, orders), 0) / menuItems.length;
    const hiddenStars = menuItems.filter(item => {
      const margin = calculateMargin(item);
      const count = getOrderCountForItem(item.id, orders);
      return margin > 50 && count < avgOrders * 0.8;
    }).map(item => ({
      ...item,
      margin: calculateMargin(item),
      orderCount: getOrderCountForItem(item.id, orders),
      profit: item.price - item.cost,
      potentialRevenue: Math.round((avgOrders - getOrderCountForItem(item.id, orders)) * (item.price - item.cost)),
    })).sort((a, b) => b.margin - a.margin);
    return { hiddenStars, avgOrders: Math.round(avgOrders) };
  }, [menuItems, orders]);

  const suggestions = [
    "📋 Feature prominently on menu boards and table tents",
    "🤝 Pair in combo deals with popular items",
    "📢 Train staff to recommend these items",
    "📱 Highlight in online menu with 'Chef's Special' tag",
    "🎯 Create limited-time offers to boost trial",
  ];

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <div className="mx-auto max-w-6xl px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <button onClick={() => navigate("/dashboard")} className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10"><Eye className="h-5 w-5 text-violet-500" /></div>
            <div>
              <h1 className="font-display text-xl font-bold">Hidden Stars ⭐</h1>
              <p className="text-xs text-muted-foreground">Ye items pe bahut profit hai lekin log order nahi kar rahe. Inhe promote karo!</p>
            </div>
          </div>
        </motion.div>

        {hiddenStars.length > 0 ? (
          <>
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {hiddenStars.map((item, i) => (
                <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                  className="glass-card p-5 border-l-4 border-l-violet-500 hover:border-primary/30 transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-bold">{item.name}</p>
                    <span className="rounded-full bg-violet-500/10 text-violet-500 px-2 py-0.5 text-[9px] font-bold">HIDDEN STAR</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div><p className="text-[10px] text-muted-foreground">Selling Price</p><p className="text-sm font-bold">₹{item.price}</p></div>
                    <div><p className="text-[10px] text-muted-foreground">Profit / Plate</p><p className="text-sm font-bold text-success">₹{item.profit}</p></div>
                    <div><p className="text-[10px] text-muted-foreground">Margin</p><p className="text-sm font-bold text-violet-500">{item.margin.toFixed(0)}%</p></div>
                    <div><p className="text-[10px] text-muted-foreground">Current Orders</p><p className="text-sm font-bold">{item.orderCount} <span className="text-[9px] text-muted-foreground">(avg: {avgOrders})</span></p></div>
                  </div>
                  {item.potentialRevenue > 0 && (
                    <div className="mt-3 rounded-lg bg-success/5 border border-success/20 p-2.5">
                      <p className="text-[10px] font-semibold text-success flex items-center gap-1"><Target className="h-3 w-3" /> Potential extra profit: ₹{item.potentialRevenue}/month if promoted to average sales</p>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mt-6 glass-card p-5">
              <div className="flex items-center gap-2 mb-3"><Megaphone className="h-4 w-4 text-accent" /><h3 className="font-display text-sm font-semibold">How to Promote These Items</h3></div>
              <div className="space-y-2">
                {suggestions.map((s, i) => (<p key={i} className="text-xs text-muted-foreground">{s}</p>))}
              </div>
            </motion.div>
          </>
        ) : (
          <div className="mt-16 text-center">
            <p className="text-3xl mb-3">🎉</p>
            <h2 className="font-display text-lg font-bold">No Hidden Stars Right Now!</h2>
            <p className="text-sm text-muted-foreground mt-2">All your high-margin items are selling well. Keep it up!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default HiddenStars;
