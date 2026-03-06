import { createClient } from "@supabase/supabase-js";

const viteSupabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
const viteSupabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const legacySupabaseUrl = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_SUPABASE_URL : undefined;
const legacySupabaseAnon = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY : undefined;

const supabaseUrl = (viteSupabaseUrl || legacySupabaseUrl || "").trim();
const supabaseKey = (viteSupabaseAnon || legacySupabaseAnon || "").trim();

if (!supabaseUrl || !supabaseKey) {
    console.warn("Missing Supabase credentials. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
}

export const supabase = createClient(supabaseUrl, supabaseKey);