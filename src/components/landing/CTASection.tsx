import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export function CTASection() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-3xl gradient-hero-bg p-12 text-center text-primary-foreground md:p-20"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent)]" />
          <div className="relative">
            <h2 className="font-display text-3xl font-bold sm:text-4xl lg:text-5xl">
              Ready to unlock hidden revenue?
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-lg text-primary-foreground/80">
              See how AI can transform your restaurant's menu strategy and boost
              average order value.
            </p>
            <Link
              to="/dashboard"
              className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-card px-8 py-4 text-sm font-semibold text-foreground shadow-lg transition-all hover:shadow-xl hover:brightness-105"
            >
              Explore the Dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
