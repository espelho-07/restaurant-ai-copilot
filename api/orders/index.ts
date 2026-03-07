import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthContext, parseNumber, supabase } from "../_lib/auth.js";

interface OrderRow {
  id?: number | null;
  order_id: string;
  order_number?: number | null;
  item_name: string;
  quantity: number;
  channel: string;
  timestamp?: string | null;
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
  selling_price?: number;
  food_cost?: number;
  id: number;
}

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

function parseOptionalNumber(value: unknown): number | null {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toObjectArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord);
}

function normalizeMenuRows(value: unknown): MenuRow[] {
  return toObjectArray(value)
    .map((row) => ({
      id: parseNumber(row.id, 0),
      item_name: String(row.item_name || "").trim(),
      selling_price: parseOptionalNumber(row.selling_price) ?? undefined,
      food_cost: parseOptionalNumber(row.food_cost) ?? undefined,
    }))
    .filter((row) => row.item_name.length > 0);
}

function normalizeOrderRows(value: unknown): OrderRow[] {
  return toObjectArray(value)
    .map((row) => ({
      id: parseOptionalNumber(row.id),
      order_id: String(row.order_id || ""),
      order_number: parseOptionalNumber(row.order_number),
      item_name: String(row.item_name || "").trim(),
      quantity: Math.max(1, parseNumber(row.quantity, 1)),
      channel: String(row.channel || "OFFLINE"),
      timestamp: row.timestamp ? String(row.timestamp) : null,
      delivery_address: row.delivery_address ? String(row.delivery_address) : null,
      city: row.city ? String(row.city) : null,
      pincode: row.pincode ? String(row.pincode) : null,
      food_total: parseOptionalNumber(row.food_total),
      delivery_charge: parseOptionalNumber(row.delivery_charge),
      total_amount: parseOptionalNumber(row.total_amount),
      pos_order_ref: row.pos_order_ref ? String(row.pos_order_ref) : null,
    }))
    .filter((row) => row.item_name.length > 0);
}

function resolveOrderKey(row: OrderRow, index: number): string {
  const orderId = String(row.order_id || "").trim();
  if (orderId) return orderId;

  const orderNumber = parseNumber(row.order_number, 0);
  if (orderNumber > 0) return `#${orderNumber}`;

  const posRef = String(row.pos_order_ref || "").trim();
  if (posRef) return `POS-${posRef}`;

  const rowId = parseNumber(row.id, 0);
  if (rowId > 0) return `ROW-${rowId}`;

  const timestamp = String(row.timestamp || "").trim();
  if (timestamp) return `${timestamp}-${String(row.channel || "OFFLINE").toUpperCase()}`;

  return `UNKEYED-${index}`;
}

const REQUIRED_ORDER_COLUMNS = new Set(["restaurant_id", "item_name", "quantity"]);

async function insertOrderRowsWithFallback(rows: Record<string, unknown>[]): Promise<void> {
  let mutableRows = rows.map((row) => ({ ...row }));

  while (true) {
    const { error } = await supabase.from("orders").insert(mutableRows);
    if (!error) return;

    const missingColumn = extractMissingColumn(error.message || "");
    if (missingColumn && REQUIRED_ORDER_COLUMNS.has(missingColumn)) {
      throw new Error(`Required orders column missing: ${missingColumn}`);
    }

    if (missingColumn && Object.prototype.hasOwnProperty.call(mutableRows[0] || {}, missingColumn)) {
      mutableRows = mutableRows.map((row) => {
        const next = { ...row };
        delete (next as Record<string, unknown>)[missingColumn];
        return next;
      });
      continue;
    }

    throw error;
  }
}

async function fetchMenuRowsWithFallback(restaurantId: string): Promise<MenuRow[]> {
  let selectColumns = ["id", "item_name", "selling_price", "food_cost"];

  while (true) {
    const { data, error } = await supabase
      .from("menu_items")
      .select(selectColumns.join(","))
      .eq("restaurant_id", restaurantId);

    if (!error) return normalizeMenuRows(data);

    const missingColumn = extractMissingColumn(error.message || "");
    if (missingColumn && selectColumns.includes(missingColumn)) {
      selectColumns = selectColumns.filter((column) => column !== missingColumn);
      continue;
    }

    throw error;
  }
}

async function fetchOrderRowsWithFallback(restaurantId: string): Promise<OrderRow[]> {
  let selectColumns = [
    "id",
    "order_id",
    "order_number",
    "item_name",
    "quantity",
    "channel",
    "timestamp",
    "delivery_address",
    "city",
    "pincode",
    "food_total",
    "delivery_charge",
    "total_amount",
    "pos_order_ref",
  ];

  let orderByTimestamp = true;

  while (true) {
    let query = supabase
      .from("orders")
      .select(selectColumns.join(","))
      .eq("restaurant_id", restaurantId);

    if (orderByTimestamp) {
      query = query.order("timestamp", { ascending: false });
    }

    const { data, error } = await query;
    if (!error) return normalizeOrderRows(data);

    const missingColumn = extractMissingColumn(error.message || "");
    if (missingColumn === "timestamp") {
      orderByTimestamp = false;
      selectColumns = selectColumns.filter((column) => column !== "timestamp");
      continue;
    }

    if (missingColumn && selectColumns.includes(missingColumn)) {
      selectColumns = selectColumns.filter((column) => column !== missingColumn);
      continue;
    }

    throw error;
  }
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
      let menuRows: MenuRow[] = [];
      let orderRows: OrderRow[] = [];

      try {
        menuRows = await fetchMenuRowsWithFallback(restaurantId);
      } catch (menuError: any) {
        const message = String(menuError?.message || "Failed to load menu data");
        if (!isSchemaMismatch(message)) {
          return res.status(500).json({ error: message });
        }
        menuRows = [];
      }

      try {
        orderRows = await fetchOrderRowsWithFallback(restaurantId);
      } catch (orderError: any) {
        const message = String(orderError?.message || "Failed to load orders");
        if (isSchemaMismatch(message)) {
          return res.status(200).json([]);
        }
        return res.status(500).json({ error: message });
      }

      const menuByName = new Map(menuRows.map((row) => [String(row.item_name || "").toLowerCase(), row]));
      const grouped = new Map<string, OrderRow[]>();

      for (let i = 0; i < orderRows.length; i++) {
        const row = orderRows[i];
        const key = resolveOrderKey(row, i);
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)?.push(row);
      }

      const orders = Array.from(grouped.entries()).map(([orderId, rows]) => {
        const items = rows.map((row) => {
          const menu = menuByName.get(String(row.item_name || "").toLowerCase());
          return {
            menuItemId: Number(menu?.id || 0),
            name: String(row.item_name || ""),
            qty: Math.max(1, parseNumber(row.quantity, 1)),
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
          channel: String(rows[0]?.channel || "OFFLINE").toUpperCase(),
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

      try {
        await insertOrderRowsWithFallback(rows as Record<string, unknown>[]);
      } catch (insertError: any) {
        const message = String(insertError?.message || "Failed to insert order rows");
        if (isSchemaMismatch(message)) {
          return res.status(503).json({ error: "Database schema mismatch. Run supabase_schema.sql." });
        }
        return res.status(500).json({ error: message });
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

