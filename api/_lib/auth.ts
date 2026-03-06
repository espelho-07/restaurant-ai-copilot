import type { VercelRequest } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseKey);

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

    const missingColumn = extractMissingColumn(error?.message || "");
    if (missingColumn && Object.prototype.hasOwnProperty.call(payload, missingColumn)) {
      delete payload[missingColumn];
      continue;
    }

    throw new Error(error?.message || "Restaurant profile not found");
  }
}

export async function getAuthContext(req: VercelRequest): Promise<AuthContext> {
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

  const { data: existingRestaurant } = await supabase
    .from("restaurants")
    .select("id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

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
