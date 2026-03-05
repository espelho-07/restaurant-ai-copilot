import { DashboardNav } from "@/components/DashboardNav";
import { motion } from "framer-motion";
import { Mic, MicOff, Sparkles, ShoppingCart, Plus, Code2, Globe, AlertCircle } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRestaurantData } from "@/lib/restaurantData";
import { parseVoiceOrder } from "@/lib/aiEngine";
import type { OrderItem } from "@/lib/types";
import { toast } from "sonner";

// Web Speech API types
interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message: string;
}

const WaveBar = ({ isListening }: { isListening: boolean }) => {
  const [height, setHeight] = useState(12);
  useEffect(() => {
    if (!isListening) { setHeight(12); return; }
    const interval = setInterval(() => setHeight(Math.random() * 36 + 6), 120);
    return () => clearInterval(interval);
  }, [isListening]);
  return (
    <div
      className="w-1 rounded-full bg-primary transition-all duration-100"
      style={{ height: `${isListening ? height : 12}px`, opacity: isListening ? 1 : 0.3 }}
    />
  );
};

const VoiceCopilot = () => {
  const { menuItems, addOrder } = useRestaurantData();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [language, setLanguage] = useState<"en-IN" | "hi-IN">("en-IN");
  const [detectedItems, setDetectedItems] = useState<OrderItem[]>([]);
  const [unmatchedPhrases, setUnmatchedPhrases] = useState<string[]>([]);
  const [showJson, setShowJson] = useState(false);
  const [orderConfirmed, setOrderConfirmed] = useState(false);
  const recognitionRef = useRef<any>(null);

  const total = detectedItems.reduce((s, i) => s + i.price * i.qty, 0);

  // Check browser support
  const SpeechRecognition =
    typeof window !== "undefined"
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null;

  const startListening = useCallback(() => {
    if (!SpeechRecognition) {
      toast.error("Speech recognition not supported. Please use Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = language;
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setTranscript("");
      setInterimTranscript("");
      setDetectedItems([]);
      setUnmatchedPhrases([]);
      setShowJson(false);
      setOrderConfirmed(false);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let final = "";
      let interim = "";

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript + " ";
        } else {
          interim += result[0].transcript;
        }
      }

      if (final) {
        setTranscript((prev) => prev + final);
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error:", event.error);
      if (event.error !== "no-speech") {
        toast.error(`Voice error: ${event.error}`);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [SpeechRecognition, language]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  }, []);

  // Parse transcript whenever it changes
  useEffect(() => {
    const fullText = (transcript + " " + interimTranscript).trim();
    if (!fullText) return;

    const result = parseVoiceOrder(fullText, menuItems);
    setDetectedItems(
      result.items.map((r) => ({
        menuItemId: r.menuItem.id,
        name: r.menuItem.name,
        qty: r.qty,
        price: r.menuItem.price,
        cost: r.menuItem.cost,
      }))
    );
    setUnmatchedPhrases(result.unmatched);
  }, [transcript, interimTranscript, menuItems]);

  const confirmOrder = () => {
    if (detectedItems.length === 0) return;
    const order = addOrder(detectedItems);
    setOrderConfirmed(true);
    toast.success(`Order ${order.id} created!`, {
      description: `${detectedItems.length} items · ₹${total}`,
    });
  };

  const jsonOutput = {
    order_id: orderConfirmed ? `ORD-${1000 + Math.floor(Math.random() * 100)}` : "pending",
    source: "voice_copilot",
    language: language === "hi-IN" ? "Hindi" : "English",
    transcript: (transcript + " " + interimTranscript).trim(),
    items: detectedItems.map((i) => ({
      name: i.name,
      qty: i.qty,
      unit_price: i.price,
      subtotal: i.price * i.qty,
    })),
    total,
    upsell_suggested: detectedItems.some((i) => i.name.includes("Burger")) ? "French Fries (₹120)" : null,
    status: orderConfirmed ? "confirmed_pos_push" : "awaiting_confirmation",
  };

  // Render transcript with keyword highlighting
  const renderTranscript = () => {
    const fullText = (transcript + " " + interimTranscript).trim();
    if (!fullText) return <span className="text-muted-foreground italic">Tap the microphone and speak your order...</span>;

    // Highlight detected item names
    let result = fullText;
    const highlighted: JSX.Element[] = [];
    let lastIdx = 0;

    const itemNames = detectedItems.map((i) => i.name.toLowerCase());

    // Simple highlight — bold matched portions
    const words = fullText.split(" ");
    return (
      <span>
        {words.map((word, i) => {
          const isMenuItem = itemNames.some(
            (name) => name.includes(word.toLowerCase()) || word.toLowerCase().includes(name.split(" ")[0])
          );
          return (
            <span key={i}>
              {isMenuItem ? (
                <span className="font-semibold text-primary">{word}</span>
              ) : (
                word
              )}{" "}
            </span>
          );
        })}
        {isListening && <span className="inline-block h-4 w-0.5 ml-0.5 bg-primary animate-pulse" />}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <div className="mx-auto max-w-6xl px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <h1 className="font-display text-2xl font-bold">Voice Ordering Copilot</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI-powered voice assistant — speak your order in English or Hindi.
          </p>
        </motion.div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* Left — Voice Interaction */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-6"
          >
            {/* Language selector + Mic */}
            <div className="glass-card flex flex-col items-center px-8 py-10">
              {/* Language toggle */}
              <div className="mb-6 flex items-center gap-2 rounded-xl bg-secondary p-1">
                <button
                  onClick={() => setLanguage("en-IN")}
                  className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-all ${language === "en-IN"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  <Globe className="h-3.5 w-3.5" /> English
                </button>
                <button
                  onClick={() => setLanguage("hi-IN")}
                  className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-all ${language === "hi-IN"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  <Globe className="h-3.5 w-3.5" /> हिंदी
                </button>
              </div>

              {/* Mic button */}
              <div className="relative">
                {isListening && (
                  <>
                    <div className="absolute inset-0 rounded-full bg-primary/20 animate-pulse-ring" />
                    <div className="absolute -inset-4 rounded-full bg-primary/10 animate-pulse-ring" style={{ animationDelay: "0.5s" }} />
                  </>
                )}
                <button
                  onClick={isListening ? stopListening : startListening}
                  className={`relative z-10 flex h-24 w-24 items-center justify-center rounded-full transition-all duration-300 ${isListening
                      ? "bg-primary text-primary-foreground shadow-lg glow-ring"
                      : "bg-secondary text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    }`}
                >
                  {isListening ? <Mic className="h-10 w-10" /> : <MicOff className="h-10 w-10" />}
                </button>
              </div>

              <p className="mt-5 font-display text-sm font-semibold">
                {isListening ? `Listening (${language === "hi-IN" ? "Hindi" : "English"})...` : "Tap to start"}
              </p>

              {/* Waveform */}
              {isListening && (
                <div className="mt-5 flex items-center gap-1">
                  {Array.from({ length: 28 }).map((_, i) => (
                    <WaveBar key={i} isListening={isListening} />
                  ))}
                </div>
              )}

              {/* Live Transcription */}
              <div className="mt-6 w-full rounded-2xl border border-border bg-secondary/30 p-5">
                <p className="text-xs font-medium text-muted-foreground">Live Transcription</p>
                <p className="mt-2 text-sm leading-relaxed min-h-[2.5rem]">
                  {renderTranscript()}
                </p>
              </div>

              {/* Unmatched phrases warning */}
              {unmatchedPhrases.length > 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 w-full rounded-xl border border-destructive/20 bg-destructive/5 p-3">
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                    <span className="text-xs font-semibold text-destructive">Could not match</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    "{unmatchedPhrases.join('", "')}" — not found in menu. Did you mean something else?
                  </p>
                </motion.div>
              )}

              {/* AI Upsell */}
              {detectedItems.length > 0 && detectedItems.some((i) => i.name.includes("Burger")) && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 w-full insight-card"
                >
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-accent" />
                    <span className="text-xs font-semibold text-accent">AI Upsell Suggestion</span>
                  </div>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    Customers who order burgers add fries <span className="font-semibold text-foreground">78% of the time</span>. Suggest <span className="font-semibold text-foreground">French Fries (₹120)</span>?
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => {
                        const fries = menuItems.find((i) => i.name === "French Fries");
                        if (fries) {
                          setDetectedItems((prev) => {
                            const existing = prev.find((i) => i.menuItemId === fries.id);
                            if (existing) return prev.map((i) => i.menuItemId === fries.id ? { ...i, qty: i.qty + 1 } : i);
                            return [...prev, { menuItemId: fries.id, name: fries.name, qty: 1, price: fries.price, cost: fries.cost }];
                          });
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground"
                    >
                      <Plus className="h-3 w-3" /> Add Fries
                    </button>
                    <button className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground">
                      No thanks
                    </button>
                  </div>
                </motion.div>
              )}
            </div>

            {/* JSON Output */}
            {detectedItems.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="glass-card overflow-hidden">
                <button
                  onClick={() => setShowJson(!showJson)}
                  className="flex w-full items-center gap-2 border-b border-border/30 bg-primary/[0.03] px-5 py-3 text-left"
                >
                  <Code2 className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold">Structured JSON Order Output</span>
                  <span className="ml-auto text-xs text-muted-foreground">{showJson ? "Hide" : "Show"}</span>
                </button>
                {showJson && (
                  <pre className="bg-[#0d1117] p-5 text-xs leading-relaxed overflow-x-auto">
                    <code className="text-emerald-400">{JSON.stringify(jsonOutput, null, 2)}</code>
                  </pre>
                )}
              </motion.div>
            )}
          </motion.div>

          {/* Right — Order Preview */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="command-panel flex flex-col"
          >
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
              <h2 className="font-display text-sm font-semibold">Detected Order</h2>
              {detectedItems.length > 0 && (
                <span className="ml-auto rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success">
                  {detectedItems.length} item{detectedItems.length > 1 ? "s" : ""}
                </span>
              )}
            </div>

            {detectedItems.length === 0 ? (
              <div className="flex flex-1 items-center justify-center py-12 text-center">
                <div>
                  <Mic className="mx-auto h-10 w-10 text-muted-foreground/30" />
                  <p className="mt-3 text-sm text-muted-foreground">No items detected</p>
                  <p className="text-xs text-muted-foreground/60">Speak your order to begin</p>
                </div>
              </div>
            ) : (
              <>
                <div className="mt-4 flex-1 space-y-2">
                  {detectedItems.map((item) => (
                    <motion.div
                      key={item.menuItemId}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center justify-between rounded-xl bg-secondary/50 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">×{item.qty} · ₹{item.price} each</p>
                      </div>
                      <p className="text-sm font-semibold">₹{item.price * item.qty}</p>
                    </motion.div>
                  ))}
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-border/50 pt-4">
                  <span className="text-sm font-medium text-muted-foreground">Total</span>
                  <span className="font-display text-xl font-bold">₹{total}</span>
                </div>

                <button
                  onClick={confirmOrder}
                  disabled={orderConfirmed}
                  className={`mt-4 w-full rounded-xl py-3 text-sm font-semibold transition-all ${orderConfirmed
                      ? "bg-success text-success-foreground"
                      : "bg-primary text-primary-foreground hover:brightness-110 glow-ring"
                    }`}
                >
                  {orderConfirmed ? "✓ Order Pushed to POS" : "Confirm & Push to POS"}
                </button>
              </>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default VoiceCopilot;
