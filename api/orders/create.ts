import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthContext, parseNumber, supabase } from "../_lib/auth.js";

function isSchemaMismatch(message: string): boolean {
  const m = String(message || "").toLowerCase();
  return m.includes("does not exist") || m.includes("could not find") || m.includes("schema cache");
}

async function getNextOrderNumber(restaurantId: string): Promise<number> {
  try {
    const { data } = await supabase
      .from("orders")
      .select("order_number,order_id")
      .eq("restaurant_id", restaurantId)
      .order("order_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    const latest = parseNumber((data as any)?.order_number, 0);
    if (latest > 0) return latest + 1;
    const parsed = Number(String((data as any)?.order_id || "").replace(/[^\d]/g, ""));
    if (Number.isFinite(parsed) && parsed > 0) return parsed + 1;
  } catch {
    // fallback
  }

  return Math.max(1, Date.now() % 100000);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { restaurantId } = await getAuthContext(req);

    const {
      items,
      channel,
      deliveryAddress,
      city,
      pincode,
      deliveryCharge,
      totalAmount,
      orderId: incomingOrderId,
      orderNumber: incomingOrderNumber,
    } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Expected array of items in cart" });
    }

    const orderNumber = incomingOrderNumber || await getNextOrderNumber(restaurantId);
    const orderId = incomingOrderId || `#${orderNumber}`;
    const timestamp = new Date().toISOString();

    const foodTotal = items.reduce((sum: number, item: any) => {
      const qty = Math.max(1, parseNumber(item?.qty ?? item?.quantity, 1));
      const price = parseNumber(item?.price, 0);
      return sum + qty * price;
    }, 0);

    const charge = parseNumber(deliveryCharge, 0);
    const total = parseNumber(totalAmount, foodTotal + charge);

    const formatted = items
      .map((item: any) => ({
        restaurant_id: restaurantId,
        order_id: orderId,
        order_number: orderNumber,
        item_name: String(item?.name || item?.item_name || "").trim(),
        quantity: Math.max(1, parseNumber(item?.qty ?? item?.quantity, 1)),
        channel: String(channel || "OFFLINE").toUpperCase(),
        timestamp,
        delivery_address: deliveryAddress ? String(deliveryAddress) : null,
        city: city ? String(city) : null,
        pincode: pincode ? String(pincode) : null,
        food_total: foodTotal,
        delivery_charge: charge,
        total_amount: total,
      }))
      .filter((item: any) => item.item_name.length > 0);

    if (formatted.length === 0) {
      return res.status(400).json({ error: "No valid items provided" });
    }

    const { data, error } = await supabase.from("orders").insert(formatted).select("*");
    if (error) {
      if (isSchemaMismatch(error.message)) {
        return res.status(503).json({ error: "Database schema mismatch. Run supabase_schema.sql." });
      }
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ order_id: orderId, order_number: orderNumber, total_amount: total, items: data || [] });
  } catch (error) {
    if (error instanceof Error) {
      const status = error.message === "Unauthorized" || error.message === "Invalid token" ? 401 : 500;
      return res.status(status).json({ error: error.message });
    }

    return res.status(500).json({ error: "Unexpected server error" });
  }
}
