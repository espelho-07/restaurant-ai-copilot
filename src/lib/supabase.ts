import { createClient } from "@supabase/supabase-js";

const viteSupabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
  import.meta.env.SUPABASE_URL;
const viteSupabaseAnon =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  import.meta.env.SUPABASE_ANON_KEY;

const legacySupabaseUrl = typeof process !== "undefined"
  ? process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  : undefined;
const legacySupabaseAnon = typeof process !== "undefined"
  ? process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  : undefined;

const supabaseUrl = (viteSupabaseUrl || legacySupabaseUrl || "").trim();
const supabaseKey = (viteSupabaseAnon || legacySupabaseAnon || "").trim();

export const hasSupabaseEnv = Boolean(supabaseUrl && supabaseKey);

if (!hasSupabaseEnv) {
  console.error(
    "Missing Supabase credentials. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or SUPABASE_URL/SUPABASE_ANON_KEY).",
  );
}

const safeUrl = hasSupabaseEnv ? supabaseUrl : "https://example.supabase.co";
const safeKey = hasSupabaseEnv ? supabaseKey : "missing-supabase-anon-key";

export const supabase = createClient(safeUrl, safeKey);
