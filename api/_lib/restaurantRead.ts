import type { ChannelCommission, MenuItem, Order, OrderItem, SalesChannel } from "../../src/lib/types.js";
import { supabase } from "./auth.js";

interface MenuRow {
  id: number | string;
  item_name: string;
  category?: string | null;
  selling_price?: number | string | null;
  food_cost?: number | string | null;
}

interface OrderRow {
  order_id: string;
  item_name: string;
  quantity?: number | string | null;
  channel?: string | null;
  timestamp?: string | null;
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeChannel(channel: unknown): SalesChannel {
  const raw = String(channel || "OFFLINE").toUpperCase();
  if (["OFFLINE", "DINEIN", "DINE_IN"].includes(raw)) return "OFFLINE";
  if (raw === "ZOMATO") return "ZOMATO";
  if (raw === "SWIGGY") return "SWIGGY";
  if (["CALL", "PHONE"].includes(raw)) return "CALL";
  return "OTHER";
}

export async function fetchRestaurantDataset(restaurantId: string): Promise<{
  menuItems: MenuItem[];
  orders: Order[];
  commissions: ChannelCommission[];
}> {
  const [{ data: menuRows, error: menuError }, { data: orderRows, error: orderError }, { data: channelRows, error: channelError }] = await Promise.all([
    supabase
      .from("menu_items")
      .select("id,item_name,category,selling_price,food_cost")
      .eq("restaurant_id", restaurantId),
    supabase
      .from("orders")
      .select("order_id,item_name,quantity,channel,timestamp")
      .eq("restaurant_id", restaurantId)
      .order("timestamp", { ascending: false }),
    supabase
      .from("channels")
      .select("*")
      .eq("restaurant_id", restaurantId),
  ]);

  if (menuError) throw new Error(menuError.message);
  if (orderError) throw new Error(orderError.message);
  if (channelError) throw new Error(channelError.message);

  const menuItems: MenuItem[] = ((menuRows || []) as MenuRow[]).map((row) => ({
    id: toNumber(row.id, 0),
    name: String(row.item_name),
    category: String(row.category || "General"),
    price: toNumber(row.selling_price, 0),
    cost: toNumber(row.food_cost, 0),
  }));

  const menuByName = new Map(menuItems.map((item) => [item.name.toLowerCase(), item]));
  const grouped = new Map<string, OrderRow[]>();

  for (const row of (orderRows || []) as OrderRow[]) {
    const key = String(row.order_id || "");
    if (!key) continue;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(row);
  }

  const orders: Order[] = Array.from(grouped.entries()).map(([orderId, rows]) => {
    const items: OrderItem[] = rows.map((row) => {
      const matched = menuByName.get(String(row.item_name || "").toLowerCase());
      return {
        menuItemId: toNumber(matched?.id, 0),
        name: String(row.item_name),
        qty: Math.max(1, toNumber(row.quantity, 1)),
        price: toNumber(matched?.price, 0),
        cost: toNumber(matched?.cost, 0),
      };
    });

    const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    const totalCost = items.reduce((sum, item) => sum + item.cost * item.qty, 0);

    return {
      id: orderId,
      items,
      total,
      totalCost,
      margin: total > 0 ? ((total - totalCost) / total) * 100 : 0,
      timestamp: new Date(rows[0]?.timestamp || new Date().toISOString()),
      channel: normalizeChannel(rows[0]?.channel),
    };
  });

  const commissions: ChannelCommission[] = (channelRows || []).map((row: any) => {
    const channel = normalizeChannel(row?.name);
    const label = String(row?.name || channel);

    return {
      channel,
      label,
      commissionPct: toNumber(row?.commission_percentage, 0),
      enabled: typeof row?.enabled === "boolean" ? row.enabled : true,
    };
  });

  return { menuItems, orders, commissions };
}
