import { DashboardNav } from "@/components/DashboardNav";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone, PhoneForwarded, Bot, User, CheckCircle2,
  Clock, BarChart3, Activity, TrendingUp, MessageSquare,
  ShoppingCart, ArrowRight, ExternalLink, Settings2,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchRecentCalls, computeAnalytics, formatDuration, type RecentCall } from "@/lib/telephonyService";

// ─── Call Status Badge ──────────────────────────────────────────
const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { label: string; cls: string }> = {
    completed: { label: "Completed", cls: "bg-success/10 text-success" },
    transferred: { label: "Transferred", cls: "bg-destructive/10 text-destructive" },
    collecting_order: { label: "In Progress", cls: "bg-amber-500/10 text-amber-600" },
  };
  const c = map[status] || { label: status, cls: "bg-secondary text-muted-foreground" };
  return <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${c.cls}`}>{c.label}</span>;
};

// ─── Transcript Viewer ──────────────────────────────────────────
const TranscriptViewer = ({ transcript }: { transcript: { role: string; text: string }[] }) => {
  if (!transcript || transcript.length === 0) {
    return <p className="text-[10px] text-muted-foreground italic py-2">No transcript captured</p>;
  }
  return (
    <div className="space-y-1.5 py-2">
      {transcript.map((msg, i) => (
        <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
          {msg.role !== "user" && (
            <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${msg.role === "ai" ? "bg-emerald-500/10" : "bg-secondary"}`}>
              {msg.role === "ai" ? <Bot className="h-2.5 w-2.5 text-emerald-600" /> : <Activity className="h-2.5 w-2.5 text-muted-foreground" />}
            </div>
          )}
          <div className={`max-w-[85%] rounded-xl px-3 py-1.5 text-[10px] leading-relaxed ${
            msg.role === "user"
              ? "bg-primary text-primary-foreground rounded-br-sm"
              : msg.role === "ai"
                ? "bg-emerald-500/5 border border-emerald-500/10 rounded-bl-sm"
                : "bg-muted/50 text-muted-foreground italic"
          }`}>
            {msg.text}
          </div>
          {msg.role === "user" && (
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <User className="h-2.5 w-2.5 text-primary" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────
const VoiceCopilot = () => {
  const navigate = useNavigate();
  const [calls, setCalls] = useState<RecentCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [expandedCall, setExpandedCall] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(false);

  const analytics = computeAnalytics(calls);

  // Fetch real call data
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchRecentCalls().then((data) => {
      if (!cancelled) {
        setCalls(data);
        setLoading(false);
      }
    });

    // Poll every 15 seconds for live updates
    const interval = setInterval(() => {
      fetchRecentCalls().then((data) => {
        if (!cancelled) setCalls(data);
      });
    }, 15000);

    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Phone className="h-6 w-6 text-emerald-500" /> AI Call Ordering Agent
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Twilio-powered AI agent — handles real restaurant phone calls and converts them into POS orders
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowAnalytics(!showAnalytics)}
              className={`rounded-lg border border-border p-2 hover:bg-secondary transition-all ${showAnalytics ? "bg-secondary" : ""}`}
              title="Toggle Analytics">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </button>
            <button onClick={() => setShowSetup(!showSetup)}
              className={`rounded-lg border border-border p-2 hover:bg-secondary transition-all ${showSetup ? "bg-secondary" : ""}`}
              title="Twilio Setup Info">
              <Settings2 className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </motion.div>

        {/* Twilio Setup Panel */}
        <AnimatePresence>
          {showSetup && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="mb-6 overflow-hidden">
              <div className="glass-card p-5">
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-emerald-500" /> Twilio Webhook Configuration
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Voice Webhook URL</label>
                    <div className="mt-1 rounded-lg bg-[#0d1117] px-3 py-2 font-mono text-emerald-400 text-[11px] select-all">
                      https://your-domain.vercel.app/api/voice
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Method</label>
                    <div className="mt-1 rounded-lg bg-[#0d1117] px-3 py-2 font-mono text-emerald-400 text-[11px]">
                      POST
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Env Variables Required</label>
                    <div className="mt-1 space-y-1 font-mono text-[10px] text-muted-foreground">
                      <div><code className="bg-secondary px-1.5 py-0.5 rounded">NEXT_PUBLIC_SUPABASE_URL</code></div>
                      <div><code className="bg-secondary px-1.5 py-0.5 rounded">SUPABASE_SERVICE_ROLE_KEY</code></div>
                      <div><code className="bg-secondary px-1.5 py-0.5 rounded">RESTAURANT_ID</code></div>
                      <div><code className="bg-secondary px-1.5 py-0.5 rounded">RESTAURANT_FALLBACK_PHONE</code></div>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Call Flow</label>
                    <div className="mt-1 text-[10px] text-muted-foreground leading-relaxed">
                      <span className="text-emerald-500 font-semibold">1.</span> Customer calls Twilio number →{" "}
                      <span className="text-emerald-500 font-semibold">2.</span> Twilio hits <code className="bg-secondary px-1 py-0.5 rounded">/api/voice</code> →{" "}
                      <span className="text-emerald-500 font-semibold">3.</span> AI greets &amp; listens via Gather →{" "}
                      <span className="text-emerald-500 font-semibold">4.</span> Speech sent to <code className="bg-secondary px-1 py-0.5 rounded">/api/process-order</code> →{" "}
                      <span className="text-emerald-500 font-semibold">5.</span> NLP parses order → upsells → confirms → stores in Supabase
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Analytics Panel */}
        <AnimatePresence>
          {showAnalytics && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="mb-6 overflow-hidden">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: "Total Calls", value: analytics.totalCalls, icon: Phone },
                  { label: "Successful Orders", value: analytics.successfulOrders, icon: CheckCircle2 },
                  { label: "Transferred", value: analytics.transferredCalls, icon: PhoneForwarded },
                  { label: "Success Rate", value: `${analytics.successRate}%`, icon: TrendingUp },
                  { label: "Avg Order Value", value: `₹${analytics.avgOrderValue}`, icon: ShoppingCart },
                  { label: "Total Revenue", value: `₹${analytics.totalRevenue}`, icon: Activity },
                ].map((stat, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }} className="glass-card p-4 text-center">
                    <stat.icon className="h-4 w-4 mx-auto text-muted-foreground mb-1.5" />
                    <p className="text-lg font-bold">{stat.value}</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">{stat.label}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Call History */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-sm font-semibold flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-emerald-500" /> Recent Call Activity
            </h2>
            <span className="text-[10px] text-muted-foreground">
              {loading ? "Loading..." : `${calls.length} call${calls.length !== 1 ? "s" : ""}`} · Auto-refreshes every 15s
            </span>
          </div>

          {loading ? (
            <div className="glass-card p-12 text-center">
              <div className="animate-pulse flex flex-col items-center gap-3">
                <Phone className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Loading call data...</p>
              </div>
            </div>
          ) : calls.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <Phone className="mx-auto h-12 w-12 text-muted-foreground/20 mb-4" />
              <h3 className="text-sm font-bold text-muted-foreground">No Calls Yet</h3>
              <p className="mt-2 text-xs text-muted-foreground/70 max-w-sm mx-auto leading-relaxed">
                Configure your Twilio phone number to point to <code className="bg-secondary px-1.5 py-0.5 rounded text-[10px]">/api/voice</code> as the webhook URL.
                When a customer calls, the AI agent will handle the order automatically.
              </p>
              <button onClick={() => setShowSetup(true)}
                className="mt-4 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-semibold text-white hover:bg-emerald-600 transition-all">
                <Settings2 className="h-3.5 w-3.5 inline mr-1.5" /> View Setup Instructions
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {calls.map((call) => (
                <motion.div key={call.callSid} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} layout
                  className="glass-card overflow-hidden">
                  {/* Call summary row */}
                  <button onClick={() => setExpandedCall(expandedCall === call.callSid ? null : call.callSid)}
                    className="w-full text-left px-5 py-4 hover:bg-secondary/30 transition-all">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        call.status === "completed" ? "bg-emerald-500/10" : call.status === "transferred" ? "bg-destructive/10" : "bg-secondary"
                      }`}>
                        {call.status === "completed"
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          : call.status === "transferred"
                            ? <PhoneForwarded className="h-4 w-4 text-destructive" />
                            : <Phone className="h-4 w-4 text-muted-foreground" />
                        }
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold truncate">
                            {call.orderId ? `Order ${call.orderId}` : `Call ${call.callSid.slice(0, 12)}...`}
                          </span>
                          <StatusBadge status={call.status} />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {new Date(call.timestamp).toLocaleString("en-IN", {
                            day: "numeric", month: "short", year: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </p>
                      </div>

                      <div className="text-right">
                        {call.total > 0 && (
                          <p className="text-sm font-bold">₹{call.total}</p>
                        )}
                        <p className="text-[9px] text-muted-foreground">
                          {call.transcript?.length || 0} messages
                        </p>
                      </div>
                    </div>

                    {/* Quick transcript preview */}
                    <p className="mt-2 text-[10px] text-muted-foreground/70 line-clamp-1">
                      {call.transcript?.filter((e: any) => e.role === "user").map((e: any) => e.text).join(" → ") || "No speech captured"}
                    </p>
                  </button>

                  {/* Expanded transcript */}
                  <AnimatePresence>
                    {expandedCall === call.callSid && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-border/30">
                        <div className="px-5 py-3 max-h-64 overflow-y-auto">
                          <TranscriptViewer transcript={call.transcript} />
                        </div>
                        {call.orderId && (
                          <div className="px-5 py-3 border-t border-border/20">
                            <button onClick={() => navigate("/orders")}
                              className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600 hover:text-emerald-700 transition-all">
                              <ArrowRight className="h-3 w-3" /> View Order in Order Logs
                            </button>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* How It Works — always visible */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          className="mt-8 glass-card p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10">
              <Phone className="h-6 w-6 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold">How AI Call Ordering Works</h3>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                When a customer calls your Twilio number, the AI agent answers, greets them, captures their spoken
                order using Twilio's speech recognition, parses it through our NLP engine (English, Hindi, Hinglish),
                suggests upsells and combos, confirms the order, and pushes it to the POS system automatically.
                If the AI can't understand after 3 attempts, the call is transferred to restaurant staff.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {["Twilio Webhooks", "Speech-to-Text", "English & Hindi", "Smart Upsells", "Combo Detection", "POS Integration", "Staff Handoff"].map(tag => (
                  <span key={tag} className="rounded-full bg-secondary px-2.5 py-1 text-[9px] font-semibold">{tag}</span>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default VoiceCopilot;
