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

    const formatted = orders
      .map((order: any) => {
        const qty = Math.max(1, parseNumber(order?.qty ?? order?.quantity, 1));
        const price = parseNumber(order?.price, 0);
        const foodTotal = parseNumber(order?.food_total, qty * price);
        const deliveryCharge = parseNumber(order?.delivery_charge, 0);
        const totalAmount = parseNumber(order?.total_amount, foodTotal + deliveryCharge);

        const parsedTimestamp = new Date(String(order?.timestamp || new Date().toISOString()));
        const safeTimestamp = Number.isNaN(parsedTimestamp.getTime()) ? new Date().toISOString() : parsedTimestamp.toISOString();
        const normalizedChannel = String(order?.channel || "OFFLINE").toUpperCase();

        return {
          restaurant_id: restaurantId,
          order_id: String(order?.order_id || order?.id || `#${Date.now()}`).trim(),
          order_number: parseNumber(order?.order_number, 0) || null,
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
      })
      .filter((row: any) => row.order_id.length > 0 && row.item_name.length > 0);

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
