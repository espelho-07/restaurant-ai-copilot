import type { VercelRequest } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseKey);

export interface AuthContext {
  userId: string;
  restaurantId: string;
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

  const { data: createdRestaurant, error: createError } = await supabase
    .from("restaurants")
    .insert({
      user_id: user.id,
      name: "",
      location: "",
      cuisine: "",
      uses_pos: false,
      setup_complete: false,
    })
    .select("id")
    .single();

  if (createError || !createdRestaurant?.id) {
    throw new Error(createError?.message || "Restaurant profile not found");
  }

  return { userId: user.id, restaurantId: String(createdRestaurant.id) };
}

export function parseNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
