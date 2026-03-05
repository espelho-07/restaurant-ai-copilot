import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Store, Terminal, Loader2, KeyRound, Mail } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (error) throw error;
                toast.success("Account created successfully! You can now log in.");
                setIsSignUp(false);
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                toast.success("Logged in successfully!");
                // App.tsx router will automatically detect auth state change and redirect
            }
        } catch (err: any) {
            toast.error(err.message || "Authentication failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen border-t-[6px] border-primary bg-background">
            <div className="flex w-full flex-col justify-center px-4 sm:px-6 lg:flex-none lg:w-1/2 lg:px-20 xl:px-24">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto w-full max-w-sm lg:w-96">
                    <div className="flex items-center gap-2 mb-8">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/20">
                            <Terminal className="h-5 w-5 text-primary-foreground" />
                        </div>
                        <div>
                            <h2 className="font-display font-bold text-lg leading-tight tracking-tight">AI Revenue<br />Copilot</h2>
                        </div>
                    </div>

                    <h2 className="mt-8 text-2xl font-display font-bold leading-9 tracking-tight text-foreground">
                        {isSignUp ? "Create your restaurant account" : "Sign in to your dashboard"}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {isSignUp ? "Already have an account? " : "Not a member? "}
                        <button onClick={() => setIsSignUp(!isSignUp)} className="font-semibold text-primary hover:text-primary/80 transition-colors">
                            {isSignUp ? "Sign in" : "Start a 14-day free trial"}
                        </button>
                    </p>

                    <div className="mt-10">
                        <form onSubmit={handleAuth} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium leading-6 text-foreground">
                                    Email address
                                </label>
                                <div className="relative mt-2">
                                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="block w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-4 text-sm shadow-sm placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium leading-6 text-foreground">
                                    Password
                                </label>
                                <div className="relative mt-2">
                                    <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <input
                                        type="password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="block w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-4 text-sm shadow-sm placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <input id="remember-me" name="remember-me" type="checkbox" className="h-4 w-4 rounded border-border text-primary focus:ring-primary accent-primary" />
                                    <label htmlFor="remember-me" className="ml-2 pl-1 text-sm leading-6 text-muted-foreground">
                                        Remember me
                                    </label>
                                </div>

                                <div className="text-sm leading-6">
                                    <a href="#" className="font-semibold text-primary hover:text-primary/80">
                                        Forgot password?
                                    </a>
                                </div>
                            </div>

                            <div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-all disabled:opacity-50"
                                >
                                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                                    {isSignUp ? "Create Account" : "Sign In"}
                                </button>
                            </div>
                        </form>
                    </div>
                </motion.div>
            </div>
            <div className="hidden lg:relative lg:block lg:w-1/2 overflow-hidden border-l border-border/50">
                <div className="absolute inset-0 bg-secondary/30" />
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1555396273-367ea4eb4db5?ixlib=rb-4.0.3&auto=format&fit=crop&w=1974&q=80')] bg-cover bg-center opacity-40 mix-blend-luminosity" />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
                <div className="relative h-full flex flex-col justify-end p-20 z-10 text-center">
                    <h3 className="font-display font-bold text-3xl mb-4 text-foreground drop-shadow-md">Data-driven decisions for modern restaurants.</h3>
                    <p className="text-muted-foreground text-sm font-medium">Connect your POS. Discover hidden margins. Maximize your revenue automatically.</p>
                </div>
            </div>
        </div>
    );
}
