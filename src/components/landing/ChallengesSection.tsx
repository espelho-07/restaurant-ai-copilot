import { motion } from "framer-motion";
import { AlertTriangle, TrendingDown, HelpCircle } from "lucide-react";

const challenges = [
  {
    icon: TrendingDown,
    title: "Revenue Leaks",
    description: "Low-margin items silently eating into profits while high-margin items stay hidden.",
  },
  {
    icon: HelpCircle,
    title: "Guesswork Menus",
    description: "Menu decisions based on gut feeling instead of data-driven performance analysis.",
  },
  {
    icon: AlertTriangle,
    title: "Missed Upsells",
    description: "Every uncaptured combo or upsell opportunity is revenue left on the table.",
  },
];

export function ChallengesSection() {
  return (
    <section className="py-24 bg-secondary/30">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            The restaurant revenue problem
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Most restaurants lose 15-25% of potential revenue due to uninformed menu decisions.
          </p>
        </motion.div>

        <div className="grid gap-8 md:grid-cols-3">
          {challenges.map((c, i) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="glass-card p-6 text-center"
            >
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10">
                <c.icon className="h-6 w-6 text-destructive" />
              </div>
              <h3 className="font-display text-lg font-semibold">{c.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{c.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
