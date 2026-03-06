import { DashboardNav } from "@/components/DashboardNav";
import { motion } from "framer-motion";
import { BarChart3, ArrowLeft, Star, TrendingDown, HelpCircle, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRestaurantData } from "@/lib/restaurantData";
import { calculateMargin, getOrderCountForItem } from "@/lib/aiEngine";
import { useMemo } from "react";

const ItemProfitability = () => {
  const navigate = useNavigate();
  const { menuItems, orders } = useRestaurantData();

  const { stars, cashCows, questionMarks, dogs } = useMemo(() => {
    if (menuItems.length === 0) return { stars: [], cashCows: [], questionMarks: [], dogs: [] };
    const avgOrders = menuItems.reduce((s, m) => s + getOrderCountForItem(m.id, orders), 0) / menuItems.length;
    const avgMargin = menuItems.reduce((s, m) => s + calculateMargin(m), 0) / menuItems.length;

    const stars: typeof menuItems = [];
    const cashCows: typeof menuItems = [];
    const questionMarks: typeof menuItems = [];
    const dogs: typeof menuItems = [];

    for (const item of menuItems) {
      const margin = calculateMargin(item);
      const count = getOrderCountForItem(item.id, orders);
      const highMargin = margin >= avgMargin;
      const highSales = count >= avgOrders;
      if (highMargin && highSales) stars.push(item);
      else if (!highMargin && highSales) cashCows.push(item);
      else if (highMargin && !highSales) questionMarks.push(item);
      else dogs.push(item);
    }
    return { stars, cashCows, questionMarks, dogs };
  }, [menuItems, orders]);

  const renderCard = (item: typeof menuItems[0]) => {
    const margin = calculateMargin(item);
    const count = getOrderCountForItem(item.id, orders);
    return (
      <div key={item.id} className="rounded-lg border border-border/30 bg-card p-3 hover:border-primary/30 transition-all">
        <p className="text-xs font-bold truncate">{item.name}</p>
        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-[10px] text-muted-foreground">₹{item.price}</span>
          <span className="text-[10px] font-semibold" style={{ color: margin >= 50 ? '#10B981' : margin >= 30 ? '#F59E0B' : '#EF4444' }}>{margin.toFixed(0)}% margin</span>
          <span className="text-[10px] text-muted-foreground ml-auto">{count} orders</span>
        </div>
      </div>
    );
  };

  const quadrants = [
    { title: "⭐ Stars", subtitle: "High profit + High sales — Your best items!", items: stars, color: "border-success/30 bg-success/5", icon: Star, iconColor: "text-success" },
    { title: "🐄 Cash Cows", subtitle: "Low margin but selling a lot — Increase prices carefully", items: cashCows, color: "border-accent/30 bg-accent/5", icon: TrendingDown, iconColor: "text-accent" },
    { title: "❓ Question Marks", subtitle: "High profit but low sales — Promote more!", items: questionMarks, color: "border-primary/30 bg-primary/5", icon: HelpCircle, iconColor: "text-primary" },
    { title: "🐕 Dogs", subtitle: "Low profit and low sales — Consider removing or revamping", items: dogs, color: "border-destructive/30 bg-destructive/5", icon: Trash2, iconColor: "text-destructive" },
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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10"><BarChart3 className="h-5 w-5 text-blue-500" /></div>
            <div>
              <h1 className="font-display text-xl font-bold">Item Profitability Matrix</h1>
              <p className="text-xs text-muted-foreground">Kaunsa item hero hai? Kaunsa kam chal raha? — BCG matrix analysis</p>
            </div>
          </div>
        </motion.div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {quadrants.map((q, i) => (
            <motion.div key={q.title} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}
              className={`glass-card p-5 border ${q.color}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <q.icon className={`h-4 w-4 ${q.iconColor}`} />
                <h3 className="font-display text-sm font-bold">{q.title}</h3>
                <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{q.items.length}</span>
              </div>
              <p className="text-[10px] text-muted-foreground mb-3">{q.subtitle}</p>
              {q.items.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                  {q.items.map(renderCard)}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/50 italic py-4 text-center">No items in this category</p>
              )}
            </motion.div>
          ))}
        </div>

        {/* Legend */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mt-6 glass-card p-5">
          <h3 className="font-display text-sm font-semibold mb-3">📖 How to Read This</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs text-muted-foreground">
            <p>⭐ <b className="text-foreground">Stars</b> — Keep these items, they are your money-makers!</p>
            <p>🐄 <b className="text-foreground">Cash Cows</b> — Selling well but margin is low. Try small price increases.</p>
            <p>❓ <b className="text-foreground">Question Marks</b> — Great margins! Promote them more to boost sales.</p>
            <p>🐕 <b className="text-foreground">Dogs</b> — Not profitable, not popular. Consider removing or redesigning.</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ItemProfitability;
