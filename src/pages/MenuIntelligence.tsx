import { DashboardNav } from "@/components/DashboardNav";
import { motion } from "framer-motion";
import { Search, ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import { useState } from "react";

const menuItems = [
  { name: "Butter Chicken", price: 320, cost: 110, margin: 65.6, orders: 142, tag: "top-seller", recommendation: "Best performer. Consider a premium variant at ₹399 with extra toppings." },
  { name: "Paneer Tikka", price: 260, cost: 125, margin: 51.9, orders: 98, tag: "hidden-star", recommendation: "High margin but low visibility. Promote as a combo with Butter Naan for +₹45 AOV." },
  { name: "Chicken Biryani", price: 280, cost: 180, margin: 35.7, orders: 135, tag: "low-margin", recommendation: "High volume but low margin. Renegotiate rice supplier or increase price by ₹20." },
  { name: "Veg Burger", price: 180, cost: 60, margin: 66.7, orders: 120, tag: "top-seller", recommendation: "Strong margins. Bundle with Fries + Coke for a ₹249 combo." },
  { name: "Masala Dosa", price: 150, cost: 45, margin: 70.0, orders: 87, tag: "hidden-star", recommendation: "Highest margin item. Increase promotions during breakfast hours." },
  { name: "Dal Makhani", price: 200, cost: 65, margin: 67.5, orders: 76, tag: "top-seller", recommendation: "Consistent performer. Pair with Jeera Rice as an affordable meal deal." },
  { name: "Fish Fry", price: 350, cost: 220, margin: 37.1, orders: 45, tag: "low-margin", recommendation: "Low orders and margin. Consider seasonal pricing or replacing with a higher-margin fish dish." },
  { name: "Gulab Jamun", price: 80, cost: 20, margin: 75.0, orders: 110, tag: "top-seller", recommendation: "Add as a discounted dessert upsell at checkout for ₹49 when ordered with mains." },
];

const tagLabel: Record<string, string> = {
  "top-seller": "Top Seller",
  "hidden-star": "Hidden Star",
  "low-margin": "Low Margin Risk",
};

const tagClass: Record<string, string> = {
  "top-seller": "tag-top-seller",
  "hidden-star": "tag-hidden-star",
  "low-margin": "tag-low-margin",
};

const MenuIntelligence = () => {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <div className="mx-auto max-w-7xl px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-2xl font-bold">Menu Intelligence</h1>
          <p className="mt-1 text-sm text-muted-foreground">AI-powered analysis of every menu item's performance.</p>
        </motion.div>

        <div className="mt-6 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search items..."
              className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex gap-2">
            {["All", "Top Seller", "Hidden Star", "Low Margin"].map((f) => (
              <button key={f} className={f === "All" ? "nav-pill-active" : "nav-pill-inactive"}>
                {f}
              </button>
            ))}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-6 glass-card overflow-hidden"
        >
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 text-left text-xs font-medium text-muted-foreground">
                <th className="px-5 py-3">Item Name</th>
                <th className="px-5 py-3">Selling Price</th>
                <th className="px-5 py-3">Food Cost</th>
                <th className="px-5 py-3">Profit Margin</th>
                <th className="px-5 py-3">Orders</th>
                <th className="px-5 py-3">Performance</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {menuItems.map((item, i) => (
                <>
                  <tr
                    key={item.name}
                    onClick={() => setExpanded(expanded === i ? null : i)}
                    className="cursor-pointer border-b border-border/30 transition-colors hover:bg-secondary/30"
                  >
                    <td className="px-5 py-3.5 text-sm font-medium">{item.name}</td>
                    <td className="px-5 py-3.5 text-sm">₹{item.price}</td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground">₹{item.cost}</td>
                    <td className="px-5 py-3.5 text-sm font-semibold">
                      <span className={item.margin > 50 ? "text-success" : "text-destructive"}>
                        {item.margin}%
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm">{item.orders}</td>
                    <td className="px-5 py-3.5">
                      <span className={tagClass[item.tag]}>{tagLabel[item.tag]}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      {expanded === i ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </td>
                  </tr>
                  {expanded === i && (
                    <tr key={`${item.name}-rec`}>
                      <td colSpan={7} className="bg-primary/[0.03] px-5 py-4">
                        <div className="flex items-start gap-2">
                          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                          <div>
                            <p className="text-xs font-semibold text-accent">AI Recommendation</p>
                            <p className="mt-1 text-sm text-muted-foreground">{item.recommendation}</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </motion.div>
      </div>
    </div>
  );
};

export default MenuIntelligence;
