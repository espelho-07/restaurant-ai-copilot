import { DashboardNav } from "@/components/DashboardNav";
import { motion } from "framer-motion";
import { Sparkles, ArrowLeft, LayoutDashboard, Rocket } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

const ComingSoon = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const feature = searchParams.get("feature") || "This Feature";

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <div className="flex min-h-[80vh] flex-col items-center justify-center px-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/3 left-1/3 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/3 right-1/3 w-72 h-72 bg-accent/5 rounded-full blur-3xl" />
        </div>
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="relative w-full max-w-lg text-center">
          <div className="glass-card p-10 space-y-6">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-primary/10 border border-primary/20"
            >
              <Rocket className="h-12 w-12 text-primary" />
            </motion.div>

            <div>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent">
                  <Sparkles className="h-3 w-3" /> Under Development
                </span>
              </motion.div>
              <h1 className="mt-4 font-display text-2xl font-bold">{feature}</h1>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                We're building something amazing! This feature will be available soon. 
                Our AI team is working hard to bring you the best experience.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
              {["AI-Powered", "Smart Analytics", "Real-time Data"].map((tag) => (
                <span key={tag} className="rounded-full bg-secondary px-2.5 py-1 font-medium">{tag}</span>
              ))}
            </div>

            <div className="flex gap-3">
              <button onClick={() => navigate(-1)} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition-all hover:bg-secondary">
                <ArrowLeft className="h-4 w-4" /> Go Back
              </button>
              <button onClick={() => navigate("/dashboard")} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110">
                <LayoutDashboard className="h-4 w-4" /> Dashboard
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ComingSoon;
