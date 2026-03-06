import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthContext, parseNumber, supabase } from "../_lib/auth.js";

function isSchemaMismatch(message: string): boolean {
  const m = String(message || "").toLowerCase();
  return m.includes("does not exist") || m.includes("could not find") || m.includes("schema cache");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { restaurantId } = await getAuthContext(req);

    const orders = req.body;
    if (!Array.isArray(orders)) return res.status(400).json({ error: "Expected array of orders" });

    const formatted = orders
      .map((order: any) => ({
        restaurant_id: restaurantId,
        order_id: String(order?.order_id || order?.id || `ORD-${Date.now()}`).trim(),
        item_name: String(order?.name || order?.item_name || "").trim(),
        quantity: Math.max(1, parseNumber(order?.qty ?? order?.quantity, 1)),
        channel: String(order?.channel || "OFFLINE").toUpperCase(),
        timestamp: String(order?.timestamp || new Date().toISOString()),
      }))
      .filter((row: any) => row.order_id.length > 0 && row.item_name.length > 0);

    if (formatted.length === 0) return res.status(400).json({ error: "No valid orders provided" });

    const { data, error } = await supabase.from("orders").insert(formatted).select("id");
    if (error) {
      if (isSchemaMismatch(error.message)) {
        return res.status(503).json({ error: "Database schema mismatch. Run supabase_schema.sql." });
      }
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ count: data?.length || 0 });
  } catch (error) {
    if (error instanceof Error) {
      const status = error.message === "Unauthorized" || error.message === "Invalid token" ? 401 : 500;
      return res.status(status).json({ error: error.message });
    }

    return res.status(500).json({ error: "Unexpected server error" });
  }
}
