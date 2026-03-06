import type { VercelRequest } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "";
const supabaseKey = supabaseServiceRoleKey || supabaseAnonKey;

export const hasBackendSupabaseEnv = Boolean(supabaseUrl && supabaseKey);

if (!hasBackendSupabaseEnv) {
  console.error(
    "Missing backend Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
  );
}

const safeUrl = hasBackendSupabaseEnv ? supabaseUrl : "https://example.supabase.co";
const safeKey = hasBackendSupabaseEnv ? supabaseKey : "missing-supabase-key";

export const supabase = createClient(safeUrl, safeKey);

export interface AuthContext {
  userId: string;
  restaurantId: string;
}

function extractMissingColumn(errorMessage: string): string | null {
  const schemaCacheMatch = errorMessage.match(/Could not find the '([^']+)' column/i);
  if (schemaCacheMatch?.[1]) return schemaCacheMatch[1];

  const doesNotExistMatch = errorMessage.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+does not exist/i);
  if (doesNotExistMatch?.[1]) return doesNotExistMatch[1];

  return null;
}

function hasMissingTable(errorMessage: string): boolean {
  return /relation\s+"?[a-zA-Z0-9_]+"?\s+does not exist/i.test(errorMessage);
}

async function createRestaurantRow(userId: string): Promise<string> {
  const payload: Record<string, unknown> = {
    user_id: userId,
    name: "",
    location: "",
    cuisine: "",
    uses_pos: false,
    setup_complete: false,
  };

  while (true) {
    const { data, error } = await supabase
      .from("restaurants")
      .insert(payload)
      .select("id")
      .single();

    if (!error && data?.id) return String(data.id);

    const message = error?.message || "";
    const missingColumn = extractMissingColumn(message);
    if (missingColumn && Object.prototype.hasOwnProperty.call(payload, missingColumn)) {
      delete payload[missingColumn];
      continue;
    }

    if (hasMissingTable(message)) {
      throw new Error("Database schema mismatch: restaurants table is missing. Run supabase_schema.sql.");
    }

    throw new Error(message || "Restaurant profile not found");
  }
}

export async function getAuthContext(req: VercelRequest): Promise<AuthContext> {
  if (!hasBackendSupabaseEnv) {
    throw new Error("Server Supabase env is not configured");
  }

  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    throw new Error("Unauthorized");
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    throw new Error("Invalid token");
  }

  const { data: existingRestaurant, error: restaurantFetchError } = await supabase
    .from("restaurants")
    .select("id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (restaurantFetchError) {
    if (hasMissingTable(restaurantFetchError.message || "")) {
      throw new Error("Database schema mismatch: restaurants table is missing. Run supabase_schema.sql.");
    }
    throw new Error(restaurantFetchError.message || "Failed to load restaurant profile");
  }

  if (existingRestaurant?.id) {
    return { userId: user.id, restaurantId: String(existingRestaurant.id) };
  }

  const restaurantId = await createRestaurantRow(user.id);
  return { userId: user.id, restaurantId };
}

export function parseNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
