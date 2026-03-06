import { useState } from "react";
import { hasSupabaseEnv, supabase } from "@/lib/supabase";
import {
    BarChart3,
    CheckCircle2,
    Eye,
    EyeOff,
    KeyRound,
    Loader2,
    Mail,
    PhoneCall,
    Sparkles,
    Terminal,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email.trim() || !password) {
            toast.error("Please fill in all fields");
            setLoading(false);
            return;
        }

        if (password.length < 6) {
            toast.error("Password must be at least 6 characters");
            setLoading(false);
            return;
        }

        if (!hasSupabaseEnv) {
            toast.error("Supabase is not configured. Add env vars on Vercel and redeploy.");
            return;
        }

        setLoading(true);

        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({ email, password });
                if (error) throw error;
                toast.success("Account created successfully. Please sign in.");
                setIsSignUp(false);
                setPassword("");
            } else {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                toast.success("Logged in successfully");
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Authentication failed";
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen overflow-hidden bg-background">
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute -top-24 left-[-8%] h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
                <div className="absolute -bottom-24 right-[-8%] h-72 w-72 rounded-full bg-emerald-500/15 blur-3xl" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.14),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.10),transparent_40%)]" />
            </div>

            <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col lg:flex-row">
                <section className="flex w-full items-center justify-center px-4 py-10 sm:px-8 lg:w-1/2 lg:py-0">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35 }}
                        className="w-full max-w-md"
                    >
                        <div className="rounded-3xl border border-border/60 bg-card/90 p-6 shadow-2xl shadow-primary/10 backdrop-blur-xl sm:p-8">
                            <div className="mb-6 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
                                        <Terminal className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="font-display text-lg font-bold leading-tight tracking-tight text-foreground">
                                            AI Revenue Copilot
                                        </p>
                                        <p className="text-xs text-muted-foreground">Restaurant Control Center</p>
                                    </div>
                                </div>
                                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
                                    Secure Auth
                                </span>
                            </div>

                            <div className="mb-6 grid grid-cols-2 rounded-xl bg-secondary/70 p-1.5">
                                <button
                                    type="button"
                                    onClick={() => setIsSignUp(false)}
                                    className={`rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
                                        !isSignUp
                                            ? "bg-background text-foreground shadow"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    Sign In
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsSignUp(true)}
                                    className={`rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
                                        isSignUp
                                            ? "bg-background text-foreground shadow"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    Sign Up
                                </button>
                            </div>

                            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
                                {isSignUp ? "Create your restaurant account" : "Welcome back"}
                            </h1>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {isSignUp
                                    ? "Start managing menu, voice calls, and POS orders in one dashboard."
                                    : "Log in to view live orders, insights, and call transcripts."}
                            </p>

                            <form onSubmit={handleAuth} className="mt-6 space-y-5">
                                <div>
                                    <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium text-foreground">
                                        Email
                                    </label>
                                    <div className="relative">
                                        <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                        <input
                                            id="login-email"
                                            type="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="you@restaurant.com"
                                            className="block w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium text-foreground">
                                        Password
                                    </label>
                                    <div className="relative">
                                        <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                        <input
                                            id="login-password"
                                            type={showPassword ? "text" : "password"}
                                            required
                                            minLength={6}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="Minimum 6 characters"
                                            className="block w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-12 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword((prev) => !prev)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                                            aria-label={showPassword ? "Hide password" : "Show password"}
                                        >
                                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between text-xs">
                                    <label className="inline-flex items-center gap-2 text-muted-foreground">
                                        <input type="checkbox" className="h-4 w-4 rounded border-border text-primary accent-primary" />
                                        Keep me signed in
                                    </label>
                                    <button type="button" className="font-medium text-primary hover:text-primary/80">
                                        Forgot password?
                                    </button>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                                    {isSignUp ? "Create Account" : "Sign In"}
                                </button>
                            </form>

                            <p className="mt-4 text-center text-xs text-muted-foreground">
                                {isSignUp ? "Already have an account?" : "Need an account?"}{" "}
                                <button
                                    type="button"
                                    onClick={() => setIsSignUp((prev) => !prev)}
                                    className="font-semibold text-primary hover:text-primary/80"
                                >
                                    {isSignUp ? "Sign in" : "Create one"}
                                </button>
                            </p>
                        </div>
                    </motion.div>
                </section>

                <section className="hidden w-1/2 items-center px-8 py-10 lg:flex">
                    <motion.div
                        initial={{ opacity: 0, x: 24 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.45, delay: 0.1 }}
                        className="relative w-full overflow-hidden rounded-3xl border border-border/40 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 p-8 text-white shadow-2xl"
                    >
                        <div className="absolute right-[-50px] top-[-50px] h-40 w-40 rounded-full bg-emerald-400/20 blur-2xl" />
                        <div className="absolute bottom-[-50px] left-[-50px] h-44 w-44 rounded-full bg-cyan-400/15 blur-2xl" />

                        <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide">
                            <Sparkles className="h-3.5 w-3.5" />
                            AI Restaurant Ops
                        </p>

                        <h2 className="mt-4 font-display text-3xl font-bold leading-tight">
                            One command center for menu, calls, and revenue growth.
                        </h2>
                        <p className="mt-3 max-w-lg text-sm text-white/80">
                            Use live data from your restaurant to optimize pricing, automate phone ordering, and sync orders to POS.
                        </p>

                        <div className="mt-8 grid grid-cols-3 gap-3">
                            <div className="rounded-2xl border border-white/15 bg-white/10 p-3">
                                <BarChart3 className="h-4 w-4 text-emerald-300" />
                                <p className="mt-2 text-2xl font-bold">9</p>
                                <p className="text-[11px] text-white/70">AI modules</p>
                            </div>
                            <div className="rounded-2xl border border-white/15 bg-white/10 p-3">
                                <PhoneCall className="h-4 w-4 text-cyan-300" />
                                <p className="mt-2 text-2xl font-bold">24/7</p>
                                <p className="text-[11px] text-white/70">Voice ordering</p>
                            </div>
                            <div className="rounded-2xl border border-white/15 bg-white/10 p-3">
                                <CheckCircle2 className="h-4 w-4 text-lime-300" />
                                <p className="mt-2 text-2xl font-bold">Live</p>
                                <p className="text-[11px] text-white/70">Dashboard data</p>
                            </div>
                        </div>

                        <div className="mt-7 space-y-2 text-sm text-white/85">
                            <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-300" /> Twilio call transcripts and order capture</p>
                            <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-300" /> Supabase-backed auth and restaurant data</p>
                            <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-300" /> POS sync plus analytics APIs</p>
                        </div>
                    </motion.div>
                </section>
            </div>
        </div>
    );
}

