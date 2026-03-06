import { motion } from "framer-motion";
import { AlertTriangle, Home, LayoutDashboard } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-destructive/5 rounded-full blur-3xl" />
      </div>
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="relative w-full max-w-md text-center">
        <div className="glass-card p-10 space-y-6">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-destructive/10 border border-destructive/20"
          >
            <AlertTriangle className="h-12 w-12 text-destructive" />
          </motion.div>

          <div>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="font-display text-7xl font-black text-foreground/10">404</motion.p>
            <h1 className="font-display text-xl font-bold -mt-2">Page Not Found</h1>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              The page <span className="font-mono text-xs bg-secondary px-1.5 py-0.5 rounded">{location.pathname}</span> doesn't exist. 
              It might have been moved or you may have typed the wrong address.
            </p>
          </div>

          <div className="flex gap-3">
            <button onClick={() => navigate("/")} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition-all hover:bg-secondary">
              <Home className="h-4 w-4" /> Home
            </button>
            <button onClick={() => navigate("/dashboard")} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110">
              <LayoutDashboard className="h-4 w-4" /> Dashboard
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default NotFound;
