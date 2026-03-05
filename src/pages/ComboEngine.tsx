import { DashboardNav } from "@/components/DashboardNav";
import { motion } from "framer-motion";
import { Sparkles, TrendingUp, Plus, ArrowUpRight, Database } from "lucide-react";
import { useMemo } from "react";
import { useRestaurantData } from "@/lib/restaurantData";
import { generateComboRecommendations } from "@/lib/aiEngine";

const ComboEngine = () => {
  const { menuItems, orders } = useRestaurantData();

  const combos = useMemo(
    () => generateComboRecommendations(menuItems, orders),
    [menuItems, orders]
  );

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <div className="mx-auto max-w-7xl px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-2xl font-bold">Combo Recommendation Engine</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI-generated combo suggestions based on co-occurrence analysis of {orders.length} orders.
          </p>
        </motion.div>

        {/* Data source badge */}
        <div className="mt-4 flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1">
            <Database className="h-3 w-3 text-primary" />
            <span className="text-[11px] font-semibold text-primary">
              Analyzed {orders.length} orders · {menuItems.length} menu items
            </span>
          </div>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {combos.map((combo, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass-card-hover overflow-hidden"
            >
              <div className="border-b border-border/30 bg-primary/[0.03] px-5 py-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-accent" />
                  <span className="text-xs font-semibold text-accent">AI Suggested Combo</span>
                  <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                    {combo.confidence}% confidence
                  </span>
                </div>
              </div>

              <div className="p-5">
                <h3 className="font-display text-lg font-bold">
                  {combo.items.map((item) => item.name).join(" + ")}
                </h3>

                <div className="mt-3 flex flex-wrap gap-2">
                  {combo.items.map((item) => (
                    <span
                      key={item.id}
                      className="rounded-lg border border-border bg-secondary/50 px-3 py-1 text-xs font-medium"
                    >
                      {item.name} · ₹{item.price}
                    </span>
                  ))}
                </div>

                {/* Association data */}
                {combo.coOccurrenceCount > 0 && (
                  <div className="mt-3 rounded-lg bg-primary/[0.03] px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">
                      <span className="font-semibold text-primary">Co-occurrence data:</span> Ordered together in{" "}
                      <span className="font-bold text-foreground">{combo.coOccurrenceCount}</span> out of{" "}
                      <span className="font-bold text-foreground">{combo.totalOrders}</span> orders
                    </p>
                  </div>
                )}

                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{combo.reason}</p>

                {/* Pricing */}
                <div className="mt-4 flex items-center gap-6">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Individual Total</p>
                    <p className="text-sm text-muted-foreground line-through">₹{combo.individualTotal}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Combo Price</p>
                    <p className="font-display text-lg font-bold text-primary">₹{combo.suggestedPrice}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-3.5 w-3.5 text-success" />
                    <span className="text-sm font-bold text-success">+{combo.aovIncrease}%</span>
                    <span className="text-xs text-muted-foreground">AOV</span>
                  </div>
                </div>

                <div className="mt-5 flex gap-2">
                  <button className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110">
                    <Plus className="h-3 w-3" />
                    Create Combo
                  </button>
                  <button className="rounded-xl border border-border px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary">
                    View Analysis
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ComboEngine;
