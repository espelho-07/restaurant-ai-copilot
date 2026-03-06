import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthContext, parseNumber, supabase } from "../_lib/auth.js";

type CallLogRow = {
  call_sid: string;
  status: string;
  order_id: string | null;
  total: number | null;
  started_at: string | null;
  updated_at: string | null;
  transcript: unknown;
  detected_items: any;
};

type OrderRow = {
  order_id: string;
  item_name: string;
  quantity?: number | string | null;
  timestamp?: string | null;
  total_amount?: number | string | null;
  delivery_charge?: number | string | null;
  food_total?: number | string | null;
  city?: string | null;
  pincode?: string | null;
  delivery_address?: string | null;
  order_number?: number | string | null;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let restaurantId = "";
  try {
    const auth = await getAuthContext(req);
    restaurantId = auth.restaurantId;
  } catch (error) {
    if (error instanceof Error && ["Unauthorized", "Invalid token"].includes(error.message)) {
      return res.status(401).json({ error: error.message });
    }
    return res.status(500).json({ error: "Failed to resolve auth context" });
  }

  try {
    const { data: callRows } = await supabase
      .from("call_logs")
      .select("call_sid,status,order_id,total,started_at,updated_at,transcript,detected_items")
      .eq("restaurant_id", restaurantId)
      .order("started_at", { ascending: false })
      .limit(20);

    if (callRows && callRows.length > 0) {
      const calls = (callRows as CallLogRow[]).map((row) => ({
        callSid: row.call_sid,
        status: row.status,
        orderId: row.order_id,
        total: parseNumber(row.total, 0),
        timestamp: row.started_at || row.updated_at,
        transcript: Array.isArray(row.transcript) ? row.transcript : [],
        restaurantName: String(row.detected_items?.restaurant_name || ""),
        selectedCity: String(row.detected_items?.selected_city || ""),
        deliveryAddress: String(row.detected_items?.delivery_address || ""),
        pincode: String(row.detected_items?.delivery_pincode || ""),
        orderNumber: parseNumber(row.detected_items?.order_number, 0) || null,
        deliveryCharge: parseNumber(row.detected_items?.delivery_charge, 0),
        foodTotal: parseNumber(row.detected_items?.food_total, 0),
        posOrderRef: String(row.detected_items?.pos_order_ref || ""),
      }));

      return res.status(200).json({ calls });
    }
  } catch {
    // If call_logs table is unavailable, fallback to CALL channel orders.
  }

  const { data: orderRows } = await supabase
    .from("orders")
    .select("order_id,item_name,quantity,timestamp,channel,total_amount,delivery_charge,food_total,city,pincode,delivery_address,order_number")
    .eq("restaurant_id", restaurantId)
    .eq("channel", "CALL")
    .order("timestamp", { ascending: false })
    .limit(200);

  const grouped = new Map<string, OrderRow[]>();
  for (const row of (orderRows || []) as OrderRow[]) {
    const key = String(row.order_id || "");
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(row);
  }

  const calls = Array.from(grouped.entries()).slice(0, 20).map(([orderId, rows]) => ({
    callSid: orderId,
    status: "completed",
    orderId,
    total: parseNumber(rows[0]?.total_amount, rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0)),
    timestamp: rows[0]?.timestamp || new Date().toISOString(),
    transcript: [{ role: "system", text: `Order generated from call: ${rows.map((r) => `${r.quantity}x ${r.item_name}`).join(", ")}` }],
    restaurantName: "",
    selectedCity: String(rows[0]?.city || ""),
    deliveryAddress: String(rows[0]?.delivery_address || ""),
    pincode: String(rows[0]?.pincode || ""),
    orderNumber: parseNumber(rows[0]?.order_number, 0) || null,
    deliveryCharge: parseNumber(rows[0]?.delivery_charge, 0),
    foodTotal: parseNumber(rows[0]?.food_total, 0),
    posOrderRef: "",
  }));

  return res.status(200).json({ calls });
}
