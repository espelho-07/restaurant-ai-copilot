import { DashboardNav } from "@/components/DashboardNav";
import { motion } from "framer-motion";
import {
  Store,
  MapPin,
  UtensilsCrossed,
  Plug,
  CheckCircle2,
  Terminal,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";

const cuisineTypes = [
  "North Indian",
  "South Indian",
  "Chinese",
  "Italian",
  "Multi-Cuisine",
  "Fast Food",
  "Cafe & Bakery",
  "Street Food",
];

const syncLogs = [
  "Connecting to Petpooja POS API...",
  "Authentication successful ✓",
  "Fetching restaurant profile...",
  "Syncing menu categories (4 found)...",
  "Importing menu items — Main Course (6 items)...",
  "Importing menu items — Starters (4 items)...",
  "Importing menu items — Beverages (5 items)...",
  "Importing menu items — Desserts (3 items)...",
  "Calculating profit margins for 18 items...",
  "Building AI recommendation model...",
  "Generating initial insights...",
  "✅ Sync complete — Restaurant ready!",
];

const RestaurantSetup = () => {
  const [step, setStep] = useState(1);
  const [syncing, setSyncing] = useState(false);
  const [syncDone, setSyncDone] = useState(false);
  const [visibleLogs, setVisibleLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const terminalRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    name: "",
    location: "",
    cuisine: "",
    apiKey: "",
  });

  const startSync = () => {
    setSyncing(true);
    setVisibleLogs([]);
    setProgress(0);

    syncLogs.forEach((log, i) => {
      setTimeout(() => {
        setVisibleLogs((prev) => [...prev, log]);
        setProgress(((i + 1) / syncLogs.length) * 100);
        if (i === syncLogs.length - 1) {
          setSyncDone(true);
        }
      }, (i + 1) * 800);
    });
  };

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [visibleLogs]);

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <div className="mx-auto max-w-3xl px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-2xl font-bold">Restaurant Setup</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure your restaurant profile and connect your POS system.
          </p>
        </motion.div>

        {/* Step Indicator */}
        <div className="mt-8 flex items-center gap-3">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                  step >= s
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {step > s ? <CheckCircle2 className="h-4 w-4" /> : s}
              </div>
              <span className="hidden text-xs font-medium text-muted-foreground sm:block">
                {s === 1 ? "Profile" : s === 2 ? "Connect POS" : "Sync Data"}
              </span>
              {s < 3 && <div className="h-px w-8 bg-border sm:w-16" />}
            </div>
          ))}
        </div>

        {/* Step 1 – Profile */}
        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-8 glass-card p-6 space-y-5"
          >
            <div className="flex items-center gap-2 mb-2">
              <Store className="h-4 w-4 text-primary" />
              <h2 className="font-display text-sm font-semibold">Restaurant Profile</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Restaurant Name</label>
                <div className="relative mt-1.5">
                  <Store className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Spice Garden"
                    className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Location</label>
                <div className="relative mt-1.5">
                  <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    placeholder="e.g. Koramangala, Bangalore"
                    className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Cuisine Type</label>
                <div className="relative mt-1.5">
                  <UtensilsCrossed className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <select
                    value={form.cuisine}
                    onChange={(e) => setForm({ ...form, cuisine: e.target.value })}
                    className="w-full appearance-none rounded-xl border border-border bg-card py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Select cuisine type</option>
                    {cuisineTypes.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              className="mt-2 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110"
            >
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          </motion.div>
        )}

        {/* Step 2 – Connect POS */}
        {step === 2 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-8 glass-card p-6 space-y-5"
          >
            <div className="flex items-center gap-2 mb-2">
              <Plug className="h-4 w-4 text-accent" />
              <h2 className="font-display text-sm font-semibold">Connect Your POS</h2>
            </div>

            <div className="insight-card">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-accent" />
                <span className="text-xs font-semibold text-accent">Why connect?</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                RevenueCopilot acts as an AI intelligence layer on top of your existing POS. 
                We analyze your sales data to find hidden revenue opportunities — no POS replacement needed.
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Petpooja API Key</label>
              <div className="relative mt-1.5">
                <Terminal className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={form.apiKey}
                  onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                  placeholder="pp_live_xxxxxxxxxxxxxxxxxx"
                  className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-4 font-mono text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110"
              >
                Connect & Sync <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 3 – Sync */}
        {step === 3 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-8 space-y-6"
          >
            {!syncing && !syncDone && (
              <div className="glass-card p-6 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <Plug className="h-8 w-8 text-primary" />
                </div>
                <h2 className="font-display text-lg font-bold">Ready to Sync</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  We'll import your menu, orders and build your AI model.
                </p>
                <button
                  onClick={startSync}
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 glow-ring"
                >
                  <Terminal className="h-4 w-4" /> Start Sync
                </button>
              </div>
            )}

            {(syncing || syncDone) && (
              <div className="glass-card overflow-hidden">
                {/* Progress bar */}
                <div className="relative h-1.5 w-full bg-secondary overflow-hidden">
                  <motion.div
                    className="absolute left-0 top-0 h-full rounded-r-full"
                    style={{ background: "var(--gradient-primary)" }}
                    initial={{ width: "0%" }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>

                {/* Terminal */}
                <div
                  ref={terminalRef}
                  className="h-72 overflow-y-auto bg-[#0d1117] p-5 font-mono text-xs leading-relaxed"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                    <div className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                    <div className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                    <span className="ml-2 text-[10px] text-gray-500">revenucopilot — sync</span>
                  </div>
                  {visibleLogs.map((log, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`py-0.5 ${
                        log.includes("✅") || log.includes("✓")
                          ? "text-emerald-400"
                          : log.includes("...")
                          ? "text-blue-400"
                          : "text-gray-400"
                      }`}
                    >
                      <span className="text-gray-600 mr-2">$</span>
                      {log}
                    </motion.div>
                  ))}
                  {syncing && !syncDone && (
                    <span className="inline-block h-3.5 w-1.5 animate-pulse bg-emerald-400" />
                  )}
                </div>
              </div>
            )}

            {syncDone && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-6 text-center"
              >
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-success/10">
                  <CheckCircle2 className="h-7 w-7 text-success" />
                </div>
                <h2 className="font-display text-lg font-bold">You're All Set!</h2>
                <p className="mt-1 text-sm text-muted-foreground">18 menu items synced. AI model is ready.</p>
                <a
                  href="/dashboard"
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 glow-ring"
                >
                  Go to Command Center <ArrowRight className="h-4 w-4" />
                </a>
              </motion.div>
            )}

            {(syncing || syncDone) && (
              <button
                onClick={() => setStep(2)}
                className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary"
              >
                Back
              </button>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default RestaurantSetup;
