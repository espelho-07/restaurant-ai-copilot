import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthContext, supabase } from "../_lib/auth.js";

function safeBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return fallback;
}

function safeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function extractMissingColumn(errorMessage: string): string | null {
  const schemaCacheMatch = errorMessage.match(/Could not find the '([^']+)' column/i);
  if (schemaCacheMatch?.[1]) return schemaCacheMatch[1];

  const doesNotExistMatch = errorMessage.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+does not exist/i);
  if (doesNotExistMatch?.[1]) return doesNotExistMatch[1];

  return null;
}

async function updateRestaurantWithFallback(restaurantId: string, patch: Record<string, unknown>) {
  const mutablePatch: Record<string, unknown> = { ...patch };

  while (true) {
    const { data, error } = await supabase
      .from("restaurants")
      .update(mutablePatch)
      .eq("id", restaurantId)
      .select("*")
      .single();

    if (!error) return data;

    const missingColumn = extractMissingColumn(error.message || "");
    if (missingColumn && Object.prototype.hasOwnProperty.call(mutablePatch, missingColumn)) {
      delete mutablePatch[missingColumn];
      continue;
    }

    throw new Error(error.message);
  }
}

function mapProfile(data: any) {
  return {
    id: String(data?.id || ""),
    name: data?.name || "",
    location: data?.location || "",
    cuisine: data?.cuisine || "",
    usesPOS: safeBoolean(data?.uses_pos, false),
    setupComplete: safeBoolean(data?.setup_complete, false),
    posConfig: {
      posType: data?.pos_type || "none",
      apiBaseUrl: data?.pos_api_base_url || "",
      apiKey: data?.pos_api_key || "",
      restaurantId: data?.pos_restaurant_id || "",
      secretKey: data?.pos_secret_key || "",
      autoSync: safeBoolean(data?.pos_auto_sync, false),
      syncIntervalMinutes: safeNumber(data?.pos_sync_interval_minutes, 5),
      connected: data?.pos_type ? true : false,
    },
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { userId, restaurantId } = await getAuthContext(req);

    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .eq("id", restaurantId)
        .single();

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(mapProfile(data));
    }

    if (req.method === "PUT") {
      const body = req.body || {};
      const posConfig = body.posConfig || body.pos_config || {};

      const patch: Record<string, unknown> = {
        user_id: userId,
        name: body.name ?? "",
        location: body.location ?? "",
        cuisine: body.cuisine ?? "",
        uses_pos: body.usesPOS ?? body.uses_pos ?? false,
        setup_complete: body.setupComplete ?? body.setup_complete ?? false,
        pos_type: posConfig.posType ?? posConfig.pos_type ?? null,
        pos_api_base_url: posConfig.apiBaseUrl ?? posConfig.api_base_url ?? null,
        pos_api_key: posConfig.apiKey ?? posConfig.api_key ?? null,
        pos_restaurant_id: posConfig.restaurantId ?? posConfig.restaurant_id ?? null,
        pos_secret_key: posConfig.secretKey ?? posConfig.secret_key ?? null,
        pos_auto_sync: posConfig.autoSync ?? posConfig.auto_sync ?? false,
        pos_sync_interval_minutes: posConfig.syncIntervalMinutes ?? posConfig.sync_interval_minutes ?? 5,
      };

      const updated = await updateRestaurantWithFallback(restaurantId, patch);
      return res.status(200).json(mapProfile(updated));
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    if (error instanceof Error) {
      const status = error.message === "Unauthorized" || error.message === "Invalid token" ? 401 : 500;
      return res.status(status).json({ error: error.message });
    }
    return res.status(500).json({ error: "Unexpected server error" });
  }
}
