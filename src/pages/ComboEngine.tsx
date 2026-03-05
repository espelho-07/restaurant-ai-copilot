import { DashboardNav } from "@/components/DashboardNav";
import { motion } from "framer-motion";
import { Sparkles, TrendingUp, Plus, ArrowUpRight } from "lucide-react";

const combos = [
  {
    title: "Paneer Tikka Combo",
    items: ["Paneer Tikka", "Butter Naan", "Lassi"],
    reason: "Paneer Tikka has 52% margin but low orders. Bundling increases visibility and AOV.",
    aovIncrease: "+₹45",
    aovPercent: "+12%",
    confidence: 92,
  },
  {
    title: "Burger Meal Deal",
    items: ["Veg Burger", "French Fries", "Coke"],
    reason: "78% of burger customers also order fries. Bundling captures this demand at higher margins.",
    aovIncrease: "+₹68",
    aovPercent: "+18%",
    confidence: 88,
  },
  {
    title: "South Indian Breakfast",
    items: ["Masala Dosa", "Filter Coffee", "Vada"],
    reason: "Morning orders spike 40% on weekends. A breakfast combo can capture this underserved segment.",
    aovIncrease: "+₹35",
    aovPercent: "+15%",
    confidence: 85,
  },
  {
    title: "Dal Makhani Thali",
    items: ["Dal Makhani", "Jeera Rice", "Roti", "Raita"],
    reason: "Thali combos have 23% higher order rate than individual items in the same price range.",
    aovIncrease: "+₹55",
    aovPercent: "+14%",
    confidence: 90,
  },
];

const ComboEngine = () => {
  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <div className="mx-auto max-w-7xl px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-2xl font-bold">Combo Recommendation Engine</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI-generated combo suggestions based on ordering patterns and margin analysis.
          </p>
        </motion.div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {combos.map((combo, i) => (
            <motion.div
              key={combo.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass-card-hover overflow-hidden"
            >
              <div className="border-b border-border/30 bg-primary/[0.03] px-5 py-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-accent" />
                  <span className="text-xs font-semibold text-accent">Suggested Combo</span>
                  <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                    {combo.confidence}% match
                  </span>
                </div>
              </div>

              <div className="p-5">
                <h3 className="font-display text-lg font-bold">{combo.title}</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {combo.items.map((item) => (
                    <span
                      key={item}
                      className="rounded-lg border border-border bg-secondary/50 px-3 py-1 text-xs font-medium"
                    >
                      {item}
                    </span>
                  ))}
                </div>

                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{combo.reason}</p>

                <div className="mt-4 flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-3.5 w-3.5 text-success" />
                    <span className="text-sm font-bold text-success">{combo.aovIncrease}</span>
                    <span className="text-xs text-muted-foreground">AOV increase</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ArrowUpRight className="h-3.5 w-3.5 text-primary" />
                    <span className="text-sm font-bold text-primary">{combo.aovPercent}</span>
                  </div>
                </div>

                <div className="mt-5 flex gap-2">
                  <button className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110">
                    <Plus className="h-3 w-3" />
                    Create Combo
                  </button>
                  <button className="rounded-xl border border-border px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary">
                    View Details
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
