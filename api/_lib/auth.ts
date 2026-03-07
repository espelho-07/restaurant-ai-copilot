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

type RestaurantIdentityRow = {
  id: string;
  setup_complete?: boolean | null;
  updated_at?: string | null;
  created_at?: string | null;
  name?: string | null;
};

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

function isUniqueViolation(errorMessage: string): boolean {
  const message = String(errorMessage || "").toLowerCase();
  return message.includes("duplicate key value violates unique constraint") || message.includes("23505");
}

function pickPreferredRestaurant(rows: RestaurantIdentityRow[]): string | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const scored = rows
    .filter((row) => row?.id)
    .map((row) => {
      const setupScore = row.setup_complete ? 1 : 0;
      const nameScore = row.name && String(row.name).trim().length > 0 ? 1 : 0;
      const updatedScore = row.updated_at ? new Date(row.updated_at).getTime() : 0;
      const createdScore = row.created_at ? new Date(row.created_at).getTime() : 0;

      return {
        id: String(row.id),
        setupScore,
        nameScore,
        updatedScore: Number.isFinite(updatedScore) ? updatedScore : 0,
        createdScore: Number.isFinite(createdScore) ? createdScore : 0,
      };
    });

  scored.sort((a, b) => {
    if (b.setupScore !== a.setupScore) return b.setupScore - a.setupScore;
    if (b.nameScore !== a.nameScore) return b.nameScore - a.nameScore;
    if (b.updatedScore !== a.updatedScore) return b.updatedScore - a.updatedScore;
    if (b.createdScore !== a.createdScore) return b.createdScore - a.createdScore;
    return a.id.localeCompare(b.id);
  });

  return scored[0]?.id || null;
}

async function findExistingRestaurantId(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("restaurants")
    .select("id,setup_complete,updated_at,created_at,name")
    .eq("user_id", userId)
    .limit(100);

  if (error) {
    if (hasMissingTable(error.message || "")) {
      throw new Error("Database schema mismatch: restaurants table is missing. Run supabase_schema.sql.");
    }
    return null;
  }

  return pickPreferredRestaurant((data || []) as RestaurantIdentityRow[]);
}

async function createRestaurantRow(userId: string): Promise<string> {
  const payload: Record<string, unknown> = {
    user_id: userId,
    name: "",
    location: "",
    cuisine: "",
    city: "",
    area: "",
    total_orders: 0,
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

    if (isUniqueViolation(message)) {
      const existingId = await findExistingRestaurantId(userId);
      if (existingId) return existingId;
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

  const preferredRestaurantId = await findExistingRestaurantId(user.id);
  if (preferredRestaurantId) {
    return { userId: user.id, restaurantId: preferredRestaurantId };
  }

  const restaurantId = await createRestaurantRow(user.id);
  return { userId: user.id, restaurantId };
}

export function parseNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
