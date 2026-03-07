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

const DEFAULT_CALL_OWNER_EMAIL = "darpanparmar1707@gmail.com";

function normalizeEmail(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function mapCallRows(rows: CallLogRow[]) {
  return rows.map((row) => ({
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
}

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

  const ownerEmail = normalizeEmail(process.env.CALL_AGENT_OWNER_EMAIL || DEFAULT_CALL_OWNER_EMAIL);
  const fixedRestaurantId = String(process.env.RESTAURANT_ID || "").trim();
  const token = req.headers.authorization?.split(" ")[1] || "";

  try {
    if (!token) return res.status(200).json({ calls: [] });

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) return res.status(200).json({ calls: [] });

    const userEmail = normalizeEmail(user.email);
    if (ownerEmail && userEmail !== ownerEmail) {
      return res.status(200).json({ calls: [] });
    }
  } catch {
    return res.status(200).json({ calls: [] });
  }

  const targetRestaurantId = fixedRestaurantId || restaurantId;
  const candidateRestaurantIds = Array.from(new Set([targetRestaurantId, restaurantId].filter(Boolean)));

  try {
    let query: any = supabase
      .from("call_logs")
      .select("call_sid,status,order_id,total,started_at,updated_at,transcript,detected_items")
      .order("started_at", { ascending: false })
      .limit(20);

    if (candidateRestaurantIds.length === 1) {
      query = query.eq("restaurant_id", candidateRestaurantIds[0]);
    } else if (candidateRestaurantIds.length > 1) {
      query = query.in("restaurant_id", candidateRestaurantIds);
    }

    const { data } = await query;
    let callRows = (data || []) as CallLogRow[];

    // Owner-only fallback when configured restaurant mapping is stale.
    if (callRows.length === 0) {
      const { data: fallbackRows } = await supabase
        .from("call_logs")
        .select("call_sid,status,order_id,total,started_at,updated_at,transcript,detected_items")
        .order("started_at", { ascending: false })
        .limit(20);
      callRows = (fallbackRows || []) as CallLogRow[];
    }

    if (callRows.length > 0) {
      return res.status(200).json({ calls: mapCallRows(callRows) });
    }
  } catch {
    // If call_logs table is unavailable, fallback to CALL channel orders.
  }

  let orderRows: OrderRow[] = [];
  try {
    let orderQuery: any = supabase
      .from("orders")
      .select("order_id,item_name,quantity,timestamp,channel,total_amount,delivery_charge,food_total,city,pincode,delivery_address,order_number")
      .eq("channel", "CALL")
      .order("timestamp", { ascending: false })
      .limit(200);

    if (candidateRestaurantIds.length === 1) {
      orderQuery = orderQuery.eq("restaurant_id", candidateRestaurantIds[0]);
    } else if (candidateRestaurantIds.length > 1) {
      orderQuery = orderQuery.in("restaurant_id", candidateRestaurantIds);
    }

    const { data } = await orderQuery;
    orderRows = (data || []) as OrderRow[];

    if (orderRows.length === 0) {
      const { data: fallbackOrders } = await supabase
        .from("orders")
        .select("order_id,item_name,quantity,timestamp,channel,total_amount,delivery_charge,food_total,city,pincode,delivery_address,order_number")
        .eq("channel", "CALL")
        .order("timestamp", { ascending: false })
        .limit(200);
      orderRows = (fallbackOrders || []) as OrderRow[];
    }
  } catch {
    orderRows = [];
  }

  const grouped = new Map<string, OrderRow[]>();
  for (const row of orderRows) {
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
