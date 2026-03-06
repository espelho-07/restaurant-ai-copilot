import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthContext, parseNumber, supabase } from "../_lib/auth";

interface OrderRow {
  order_id: string;
  item_name: string;
  quantity: number;
  channel: string;
  timestamp: string;
}

interface MenuRow {
  item_name: string;
  selling_price: number;
  food_cost: number;
  id: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { restaurantId } = await getAuthContext(req);

    if (req.method === "GET") {
      const [{ data: menuRows, error: menuError }, { data: orderRows, error: orderError }] = await Promise.all([
        supabase
          .from("menu_items")
          .select("id,item_name,selling_price,food_cost")
          .eq("restaurant_id", restaurantId),
        supabase
          .from("orders")
          .select("order_id,item_name,quantity,channel,timestamp")
          .eq("restaurant_id", restaurantId)
          .order("timestamp", { ascending: false }),
      ]);

      if (menuError || orderError) {
        return res.status(500).json({ error: menuError?.message || orderError?.message || "Failed to load orders" });
      }

      const menuByName = new Map((menuRows || []).map((row: any) => [String(row.item_name).toLowerCase(), row as MenuRow]));
      const grouped = new Map<string, OrderRow[]>();

      for (const row of (orderRows || []) as OrderRow[]) {
        const key = String(row.order_id || "");
        if (!key) continue;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(row);
      }

      const orders = Array.from(grouped.entries()).map(([orderId, rows]) => {
        const items = rows.map((row) => {
          const menu = menuByName.get(String(row.item_name || "").toLowerCase());
          return {
            menuItemId: Number(menu?.id || 0),
            name: String(row.item_name),
            qty: parseNumber(row.quantity, 1),
            price: parseNumber(menu?.selling_price, 0),
            cost: parseNumber(menu?.food_cost, 0),
          };
        });

        const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
        const totalCost = items.reduce((sum, item) => sum + item.cost * item.qty, 0);
        const margin = total > 0 ? ((total - totalCost) / total) * 100 : 0;

        return {
          id: orderId,
          items,
          total,
          totalCost,
          margin,
          timestamp: rows[0]?.timestamp || new Date().toISOString(),
          channel: (rows[0]?.channel || "OFFLINE").toUpperCase(),
        };
      });

      return res.status(200).json(orders);
    }

    if (req.method === "POST") {
      const { items, channel, orderId: incomingOrderId } = req.body || {};
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Expected non-empty items array" });
      }

      const orderId = incomingOrderId || `ORD-${Date.now()}`;
      const timestamp = new Date().toISOString();

      const rows = items.map((item: Record<string, unknown>) => ({
        restaurant_id: restaurantId,
        order_id: orderId,
        item_name: String(item.name || "").trim(),
        quantity: Math.max(1, parseNumber(item.qty ?? item.quantity, 1)),
        channel: String(channel || "OFFLINE").toUpperCase(),
        timestamp,
      })).filter((row) => row.item_name.length > 0);

      if (rows.length === 0) return res.status(400).json({ error: "No valid order items provided" });

      const { error } = await supabase.from("orders").insert(rows);
      if (error) return res.status(500).json({ error: error.message });

      return res.status(200).json({ orderId, insertedItems: rows.length, timestamp });
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
