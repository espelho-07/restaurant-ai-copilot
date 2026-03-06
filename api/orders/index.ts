import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthContext, parseNumber, supabase } from "../_lib/auth.js";

interface OrderRow {
  order_id: string;
  order_number?: number | null;
  item_name: string;
  quantity: number;
  channel: string;
  timestamp: string;
  delivery_address?: string | null;
  city?: string | null;
  pincode?: string | null;
  food_total?: number | null;
  delivery_charge?: number | null;
  total_amount?: number | null;
  pos_order_ref?: string | null;
}

interface MenuRow {
  item_name: string;
  selling_price: number;
  food_cost: number;
  id: number;
}

function isSchemaMismatch(message: string): boolean {
  const m = String(message || "").toLowerCase();
  return m.includes("does not exist") || m.includes("could not find") || m.includes("schema cache");
}

async function getNextOrderNumber(restaurantId: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("order_number,order_id")
      .eq("restaurant_id", restaurantId)
      .order("order_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error) {
      const latest = parseNumber((data as any)?.order_number, 0);
      if (latest > 0) return latest + 1;
      const orderId = String((data as any)?.order_id || "");
      const parsed = Number(orderId.replace(/[^\d]/g, ""));
      if (Number.isFinite(parsed) && parsed > 0) return parsed + 1;
    }
  } catch {
    // fallback below
  }

  try {
    const { count } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId);
    return Math.max(1, (count || 0) + 1);
  } catch {
    return 1;
  }
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
          .select("order_id,order_number,item_name,quantity,channel,timestamp,delivery_address,city,pincode,food_total,delivery_charge,total_amount,pos_order_ref")
          .eq("restaurant_id", restaurantId)
          .order("timestamp", { ascending: false }),
      ]);

      if (menuError || orderError) {
        const message = menuError?.message || orderError?.message || "Failed to load orders";
        if (isSchemaMismatch(message)) return res.status(200).json([]);
        return res.status(500).json({ error: message });
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

        const itemTotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
        const totalCost = items.reduce((sum, item) => sum + item.cost * item.qty, 0);
        const foodTotal = parseNumber(rows[0]?.food_total, itemTotal);
        const deliveryCharge = parseNumber(rows[0]?.delivery_charge, 0);
        const total = parseNumber(rows[0]?.total_amount, foodTotal + deliveryCharge);
        const margin = total > 0 ? ((total - totalCost) / total) * 100 : 0;

        return {
          id: orderId,
          orderNumber: parseNumber(rows[0]?.order_number, 0) || null,
          items,
          total,
          totalCost,
          margin,
          timestamp: rows[0]?.timestamp || new Date().toISOString(),
          channel: (rows[0]?.channel || "OFFLINE").toUpperCase(),
          deliveryAddress: rows[0]?.delivery_address || "",
          city: rows[0]?.city || "",
          pincode: rows[0]?.pincode || "",
          foodTotal,
          deliveryCharge,
          posOrderRef: rows[0]?.pos_order_ref || "",
        };
      });

      return res.status(200).json(orders);
    }

    if (req.method === "POST") {
      const {
        items,
        channel,
        orderId: incomingOrderId,
        orderNumber: incomingOrderNumber,
        deliveryAddress,
        city,
        pincode,
        deliveryCharge,
        totalAmount,
      } = req.body || {};

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Expected non-empty items array" });
      }
      if (items.length > 150) {
        return res.status(400).json({ error: "Too many items in one order" });
      }

      const allowedChannels = new Set(["OFFLINE", "ZOMATO", "SWIGGY", "CALL", "OTHER"]);
      const normalizedChannel = String(channel || "OFFLINE").toUpperCase();

      const orderNumber = incomingOrderNumber || await getNextOrderNumber(restaurantId);
      const orderId = incomingOrderId || `#${orderNumber}`;
      const timestamp = new Date().toISOString();

      const foodTotal = items.reduce((sum: number, item: Record<string, unknown>) => {
        const qty = Math.max(1, parseNumber(item.qty ?? item.quantity, 1));
        const price = parseNumber(item.price, 0);
        return sum + qty * price;
      }, 0);
      const appliedDelivery = parseNumber(deliveryCharge, 0);
      const appliedTotal = parseNumber(totalAmount, foodTotal + appliedDelivery);

      const rows = items.map((item: Record<string, unknown>) => ({
        restaurant_id: restaurantId,
        order_id: orderId,
        order_number: orderNumber,
        item_name: String(item.name || "").trim().slice(0, 120),
        quantity: Math.max(1, parseNumber(item.qty ?? item.quantity, 1)),
        channel: allowedChannels.has(normalizedChannel) ? normalizedChannel : "OFFLINE",
        timestamp,
        delivery_address: deliveryAddress ? String(deliveryAddress) : null,
        city: city ? String(city) : null,
        pincode: pincode ? String(pincode) : null,
        food_total: foodTotal,
        delivery_charge: appliedDelivery,
        total_amount: appliedTotal,
      })).filter((row) => row.item_name.length > 0);

      if (rows.length === 0) return res.status(400).json({ error: "No valid order items provided" });

      const { error } = await supabase.from("orders").insert(rows);
      if (error) {
        if (isSchemaMismatch(error.message)) {
          return res.status(503).json({ error: "Database schema mismatch. Run supabase_schema.sql." });
        }
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ orderId, orderNumber, insertedItems: rows.length, timestamp, totalAmount: appliedTotal });
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
