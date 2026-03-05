import { motion } from "framer-motion";
import { BarChart3, Brain, Mic, Layers, TrendingUp, Shield } from "lucide-react";

const features = [
  {
    icon: BarChart3,
    title: "Revenue Analytics",
    description: "Real-time revenue tracking with trend analysis and performance benchmarks across your menu.",
  },
  {
    icon: Brain,
    title: "AI Insights Engine",
    description: "Discover hidden stars, underperforming items, and profit opportunities your team might miss.",
  },
  {
    icon: Layers,
    title: "Smart Combo Builder",
    description: "AI-generated combo recommendations based on customer ordering patterns and profit margins.",
  },
  {
    icon: Mic,
    title: "Voice Ordering",
    description: "AI-powered voice assistant that takes orders, upsells intelligently, and reduces wait times.",
  },
  {
    icon: TrendingUp,
    title: "Profit Optimization",
    description: "Identify low-margin items and get actionable suggestions to improve your bottom line.",
  },
  {
    icon: Shield,
    title: "Menu Intelligence",
    description: "Comprehensive menu analysis with cost tracking, performance tags, and AI recommendations.",
  },
];

export function FeaturesSection() {
  return (
    <section className="relative py-24">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Everything you need to{" "}
            <span className="gradient-text">maximize revenue</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            A complete AI-powered suite built specifically for restaurant owners
            who want data-driven decisions.
          </p>
        </motion.div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass-card-hover p-6"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                <feature.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-display text-lg font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
