import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import heroVisual from "@/assets/hero-visual.png";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 gradient-hero-bg opacity-[0.03]" />
      <div className="absolute top-20 right-0 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-accent/5 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-6 pb-20 pt-24 lg:pt-32">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              AI-Powered Restaurant Intelligence
            </div>

            <h1 className="font-display text-5xl font-bold leading-[1.1] tracking-tight lg:text-6xl xl:text-7xl">
              AI Copilot for{" "}
              <span className="gradient-text">Restaurant Revenue</span>
            </h1>

            <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">
              Transform restaurant PoS data into intelligent insights, automated
              combos, and AI-assisted voice ordering. Make every menu decision
              data-driven.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 rounded-2xl bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg transition-all hover:shadow-xl hover:brightness-110"
              >
                Open Command Center
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/voice"
                className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-7 py-3.5 text-sm font-semibold transition-all hover:border-primary/30 hover:bg-primary/5"
              >
                Try Voice Ordering
              </Link>
            </div>

            <div className="mt-10 flex items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-success" />
                Real-time analytics
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-accent" />
                AI recommendations
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary" />
                Voice ordering
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="relative"
          >
            <div className="relative overflow-hidden rounded-3xl border border-border/50 shadow-2xl">
              <img
                src={heroVisual}
                alt="AI Restaurant Revenue Dashboard"
                className="w-full"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent" />
            </div>
            {/* Floating card */}
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -bottom-6 -left-6 glass-card p-4 shadow-lg"
            >
              <div className="text-xs font-medium text-muted-foreground">AOV Increase</div>
              <div className="font-display text-2xl font-bold text-success">+18%</div>
            </motion.div>
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
              className="absolute -right-4 top-8 glass-card p-4 shadow-lg"
            >
              <div className="text-xs font-medium text-muted-foreground">AI Insights</div>
              <div className="font-display text-2xl font-bold text-primary">24</div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
