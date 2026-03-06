import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthContext, parseNumber, supabase } from "../_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { restaurantId } = await getAuthContext(req);

    const { items, channel } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Expected array of items in cart" });
    }

    const orderId = `SIM-${Date.now()}`;
    const timestamp = new Date().toISOString();

    const formatted = items
      .map((item: any) => ({
        restaurant_id: restaurantId,
        order_id: orderId,
        item_name: String(item?.name || item?.item_name || "").trim(),
        quantity: Math.max(1, parseNumber(item?.qty ?? item?.quantity, 1)),
        channel: String(channel || "OFFLINE").toUpperCase(),
        timestamp,
      }))
      .filter((item: any) => item.item_name.length > 0);

    if (formatted.length === 0) {
      return res.status(400).json({ error: "No valid items provided" });
    }

    const { data, error } = await supabase.from("orders").insert(formatted).select("*");
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ order_id: orderId, items: data || [] });
  } catch (error) {
    if (error instanceof Error) {
      const status = error.message === "Unauthorized" || error.message === "Invalid token" ? 401 : 500;
      return res.status(status).json({ error: error.message });
    }

    return res.status(500).json({ error: "Unexpected server error" });
  }
}
