import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthContext, parseNumber, supabase } from "../_lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { userId, restaurantId } = await getAuthContext(req);

    if (req.method === "GET") {
      const [{ data: restaurant }, { count: menuCount }, { count: orderCount }, { count: channelCount }] = await Promise.all([
        supabase
          .from("restaurants")
          .select("id,name,location,cuisine,uses_pos,setup_complete")
          .eq("id", restaurantId)
          .single(),
        supabase
          .from("menu_items")
          .select("id", { count: "exact", head: true })
          .eq("restaurant_id", restaurantId),
        supabase
          .from("orders")
          .select("order_id", { count: "exact", head: true })
          .eq("restaurant_id", restaurantId),
        supabase
          .from("channels")
          .select("id", { count: "exact", head: true })
          .eq("restaurant_id", restaurantId),
      ]);

      return res.status(200).json({
        restaurant: {
          id: String(restaurant?.id || restaurantId),
          name: restaurant?.name || "",
          location: restaurant?.location || "",
          cuisine: restaurant?.cuisine || "",
          usesPOS: Boolean(restaurant?.uses_pos),
          setupComplete: Boolean(restaurant?.setup_complete),
        },
        progress: {
          menuItems: menuCount || 0,
          orderRows: orderCount || 0,
          channels: channelCount || 0,
        },
      });
    }

    if (req.method === "POST" || req.method === "PUT") {
      const body = req.body || {};

      const patch = {
        user_id: userId,
        name: String(body.name || "").trim(),
        location: String(body.location || "").trim(),
        cuisine: String(body.cuisine || "").trim(),
        uses_pos: Boolean(body.usesPOS ?? body.uses_pos),
        setup_complete: Boolean(body.setupComplete ?? body.setup_complete ?? true),
        pos_type: body.posConfig?.posType ?? body.pos_type ?? null,
        pos_api_base_url: body.posConfig?.apiBaseUrl ?? body.pos_api_base_url ?? null,
        pos_api_key: body.posConfig?.apiKey ?? body.pos_api_key ?? null,
        pos_restaurant_id: body.posConfig?.restaurantId ?? body.pos_restaurant_id ?? null,
        pos_secret_key: body.posConfig?.secretKey ?? body.pos_secret_key ?? null,
        pos_auto_sync: Boolean(body.posConfig?.autoSync ?? body.pos_auto_sync),
        pos_sync_interval_minutes: parseNumber(body.posConfig?.syncIntervalMinutes ?? body.pos_sync_interval_minutes, 5),
      };

      const { data, error } = await supabase
        .from("restaurants")
        .update(patch)
        .eq("id", restaurantId)
        .select("id,name,location,cuisine,uses_pos,setup_complete")
        .single();

      if (error) return res.status(500).json({ error: error.message });

      return res.status(200).json({
        id: String(data.id),
        name: data.name || "",
        location: data.location || "",
        cuisine: data.cuisine || "",
        usesPOS: Boolean(data.uses_pos),
        setupComplete: Boolean(data.setup_complete),
      });
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
