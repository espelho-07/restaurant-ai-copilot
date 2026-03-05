import { DashboardNav } from "@/components/DashboardNav";
import { motion } from "framer-motion";
import { Mic, MicOff, Sparkles, ShoppingCart, Plus } from "lucide-react";
import { useState } from "react";

const WaveBar = ({ delay }: { delay: number }) => (
  <div
    className="w-1 rounded-full bg-primary"
    style={{
      animation: `wave 1.2s ease-in-out ${delay}s infinite`,
      height: "24px",
    }}
  />
);

const VoiceCopilot = () => {
  const [isListening, setIsListening] = useState(false);

  const detectedItems = [
    { name: "Veg Burger", qty: 2, price: 180 },
    { name: "Coke", qty: 1, price: 60 },
  ];

  const total = detectedItems.reduce((s, i) => s + i.price * i.qty, 0);

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <div className="mx-auto max-w-5xl px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <h1 className="font-display text-2xl font-bold">Voice Ordering Copilot</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI-powered voice assistant for faster, smarter ordering.
          </p>
        </motion.div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_340px]">
          {/* Voice interaction */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="glass-card flex flex-col items-center px-8 py-12"
          >
            {/* Mic button */}
            <div className="relative">
              {isListening && (
                <>
                  <div className="absolute inset-0 rounded-full bg-primary/20 animate-pulse-ring" />
                  <div className="absolute -inset-4 rounded-full bg-primary/10 animate-pulse-ring" style={{ animationDelay: "0.5s" }} />
                </>
              )}
              <button
                onClick={() => setIsListening(!isListening)}
                className={`relative z-10 flex h-24 w-24 items-center justify-center rounded-full transition-all duration-300 ${
                  isListening
                    ? "bg-primary text-primary-foreground shadow-lg glow-ring"
                    : "bg-secondary text-muted-foreground hover:bg-primary/10 hover:text-primary"
                }`}
              >
                {isListening ? <Mic className="h-10 w-10" /> : <MicOff className="h-10 w-10" />}
              </button>
            </div>

            <p className="mt-6 font-display text-sm font-semibold">
              {isListening ? "Listening..." : "Tap to start"}
            </p>

            {/* Waveform */}
            {isListening && (
              <div className="mt-6 flex items-center gap-1">
                {Array.from({ length: 20 }).map((_, i) => (
                  <WaveBar key={i} delay={i * 0.08} />
                ))}
              </div>
            )}

            {/* Transcription */}
            <div className="mt-8 w-full max-w-md rounded-2xl border border-border bg-secondary/30 p-5">
              <p className="text-xs font-medium text-muted-foreground">Live Transcription</p>
              <p className="mt-2 text-sm leading-relaxed">
                {isListening ? (
                  <span>
                    "I'd like to order <span className="font-semibold text-foreground">two veg burgers</span> and{" "}
                    <span className="font-semibold text-foreground">one coke</span> please."
                  </span>
                ) : (
                  <span className="text-muted-foreground italic">Tap the microphone to begin...</span>
                )}
              </p>
            </div>

            {/* Upsell */}
            {isListening && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 w-full max-w-md insight-card"
              >
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-accent" />
                  <span className="text-xs font-semibold text-accent">AI Upsell Suggestion</span>
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Customers who order burgers often add fries. Would you like to add <span className="font-semibold text-foreground">French Fries (₹99)</span>?
                </p>
                <div className="mt-3 flex gap-2">
                  <button className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground">
                    <Plus className="h-3 w-3" /> Add Fries
                  </button>
                  <button className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground">
                    No thanks
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* Order preview */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="command-panel"
          >
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
              <h2 className="font-display text-sm font-semibold">Order Preview</h2>
            </div>

            <div className="mt-4 space-y-3">
              {detectedItems.map((item) => (
                <div key={item.name} className="flex items-center justify-between rounded-xl bg-secondary/50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">×{item.qty}</p>
                  </div>
                  <p className="text-sm font-semibold">₹{item.price * item.qty}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-border/50 pt-4">
              <span className="text-sm font-medium text-muted-foreground">Total</span>
              <span className="font-display text-xl font-bold">₹{total}</span>
            </div>

            <button className="mt-4 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110">
              Confirm Order
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default VoiceCopilot;
