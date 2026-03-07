import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthContext, parseNumber, supabase } from "../_lib/auth.js";

function isSchemaMismatch(message: string): boolean {
  const m = String(message || "").toLowerCase();
  return m.includes("does not exist") || m.includes("could not find") || m.includes("schema cache");
}

function extractMissingColumn(errorMessage: string): string | null {
  const schemaCacheMatch = errorMessage.match(/Could not find the '([^']+)' column/i);
  if (schemaCacheMatch?.[1]) return schemaCacheMatch[1];

  const doesNotExistMatch = errorMessage.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+does not exist/i);
  if (doesNotExistMatch?.[1]) return doesNotExistMatch[1];

  return null;
}

const REQUIRED_ORDER_COLUMNS = new Set(["restaurant_id", "item_name", "quantity"]);

function normalizeItemKey(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchMenuPriceMap(restaurantId: string): Promise<Map<string, number>> {
  const map = new Map<string, number>();

  try {
    const { data } = await supabase
      .from("menu_items")
      .select("item_name,selling_price")
      .eq("restaurant_id", restaurantId)
      .limit(20000);

    for (const row of (data || []) as any[]) {
      const key = normalizeItemKey(row?.item_name);
      if (!key) continue;
      const price = parseNumber(row?.selling_price, 0);
      if (!map.has(key) || price > 0) {
        map.set(key, price);
      }
    }
  } catch {
    // Ignore menu lookup errors and continue with CSV-provided prices.
  }

  return map;
}

async function getNextOrderNumber(restaurantId: string): Promise<number> {
  try {
    const { data } = await supabase
      .from("orders")
      .select("order_number")
      .eq("restaurant_id", restaurantId)
      .order("order_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    const latest = parseNumber((data as any)?.order_number, 0);
    if (latest > 0) return latest + 1;
  } catch {
    // fallback
  }

  return 1;
}

async function insertOrderRowsWithFallback(rows: Record<string, unknown>[]) {
  let mutableRows = rows.map((row) => ({ ...row }));

  while (true) {
    const { data, error } = await supabase.from("orders").insert(mutableRows).select("id");
    if (!error) return data || [];

    const missingColumn = extractMissingColumn(error.message || "");
    if (missingColumn && REQUIRED_ORDER_COLUMNS.has(missingColumn)) {
      throw new Error(`Required orders column missing: ${missingColumn}`);
    }

    if (missingColumn && Object.prototype.hasOwnProperty.call(mutableRows[0] || {}, missingColumn)) {
      mutableRows = mutableRows.map((row) => {
        const next = { ...row };
        delete (next as any)[missingColumn];
        return next;
      });
      continue;
    }

    throw error;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { restaurantId } = await getAuthContext(req);

    const orders = req.body;
    if (!Array.isArray(orders)) return res.status(400).json({ error: "Expected array of orders" });
    if (orders.length > 5000) return res.status(400).json({ error: "Too many rows in one request (max 5000)" });

    const allowedChannels = new Set(["OFFLINE", "ZOMATO", "SWIGGY", "CALL", "OTHER"]);
    const menuPriceByKey = await fetchMenuPriceMap(restaurantId);

    // Group orders by order_id to assign sequential order numbers
    const orderGroups = new Map<string, any[]>();
    orders.forEach((order: any) => {
      const orderId = String(order?.order_id || order?.id || "").trim();
      if (!orderGroups.has(orderId)) orderGroups.set(orderId, []);
      orderGroups.get(orderId)!.push(order);
    });

    let nextOrderNumber = await getNextOrderNumber(restaurantId);

    const formatted = Array.from(orderGroups.entries()).flatMap(([orderId, orderItems]) => {
      const typedOrderItems = orderItems as any[];
      const hasOrderNumber = typedOrderItems.some((item: any) => parseNumber(item?.order_number, 0) > 0);
      const orderNumber = hasOrderNumber ? parseNumber(typedOrderItems[0]?.order_number, 0) : nextOrderNumber++;

      const derivedFoodTotal = typedOrderItems.reduce((sum, order) => {
        const qty = Math.max(1, parseNumber(order?.qty ?? order?.quantity, 1));
        const inlinePrice = parseNumber(order?.price, 0);
        const menuPrice = parseNumber(menuPriceByKey.get(normalizeItemKey(order?.name || order?.item_name)), 0);
        const unitPrice = inlinePrice > 0 ? inlinePrice : menuPrice;
        return sum + (qty * unitPrice);
      }, 0);
      const derivedDelivery = typedOrderItems.reduce((maxCharge, order) => {
        return Math.max(maxCharge, parseNumber(order?.delivery_charge, 0));
      }, 0);
      const storedFoodTotal = typedOrderItems.reduce((maxValue, order) => {
        return Math.max(maxValue, parseNumber(order?.food_total, 0));
      }, 0);
      const storedTotalAmount = typedOrderItems.reduce((maxValue, order) => {
        return Math.max(maxValue, parseNumber(order?.total_amount, 0));
      }, 0);
      const resolvedFoodTotal = storedFoodTotal > 0 ? storedFoodTotal : derivedFoodTotal;
      const resolvedTotalAmount = storedTotalAmount > 0
        ? storedTotalAmount
        : (resolvedFoodTotal + derivedDelivery);

      return typedOrderItems.map((order: any) => {
        const qty = Math.max(1, parseNumber(order?.qty ?? order?.quantity, 1));
        const price = parseNumber(order?.price, 0);
        const menuPrice = parseNumber(menuPriceByKey.get(normalizeItemKey(order?.name || order?.item_name)), 0);
        const inferredLineFoodTotal = qty * (price > 0 ? price : menuPrice);
        const foodTotal = parseNumber(order?.food_total, resolvedFoodTotal > 0 ? resolvedFoodTotal : inferredLineFoodTotal);
        const deliveryCharge = parseNumber(order?.delivery_charge, derivedDelivery);
        const totalAmount = parseNumber(order?.total_amount, resolvedTotalAmount > 0 ? resolvedTotalAmount : (foodTotal + deliveryCharge));

        const parsedTimestamp = new Date(String(order?.timestamp || new Date().toISOString()));
        const safeTimestamp = Number.isNaN(parsedTimestamp.getTime()) ? new Date().toISOString() : parsedTimestamp.toISOString();
        const normalizedChannel = String(order?.channel || "OFFLINE").toUpperCase();

        return {
          restaurant_id: restaurantId,
          order_id: orderId || `#${orderNumber}`,
          order_number: orderNumber,
          item_name: String(order?.name || order?.item_name || "").trim().slice(0, 120),
          quantity: qty,
          channel: allowedChannels.has(normalizedChannel) ? normalizedChannel : "OFFLINE",
          timestamp: safeTimestamp,
          delivery_address: order?.delivery_address ? String(order.delivery_address) : null,
          city: order?.city ? String(order.city) : null,
          pincode: order?.pincode ? String(order.pincode) : null,
          food_total: foodTotal,
          delivery_charge: deliveryCharge,
          total_amount: totalAmount,
          pos_order_ref: order?.pos_order_ref ? String(order.pos_order_ref) : null,
        };
      });
    }).filter((row: any) => row.order_id.length > 0 && row.item_name.length > 0);

    if (formatted.length === 0) return res.status(400).json({ error: "No valid orders provided" });

    try {
      const data = await insertOrderRowsWithFallback(formatted as Record<string, unknown>[]);
      return res.status(200).json({ count: data.length || 0 });
    } catch (insertError: any) {
      const message = String(insertError?.message || "Failed to insert orders");
      if (isSchemaMismatch(message)) {
        return res.status(503).json({ error: "Database schema mismatch. Run supabase_schema.sql." });
      }
      return res.status(500).json({ error: message });
    }
  } catch (error) {
    if (error instanceof Error) {
      const status = error.message === "Unauthorized" || error.message === "Invalid token" ? 401 : 500;
      return res.status(status).json({ error: error.message });
    }

    return res.status(500).json({ error: "Unexpected server error" });
  }
}
