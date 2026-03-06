import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthContext, parseNumber, supabase } from "../_lib/auth";

function toIso(value: unknown): string {
  const parsed = new Date(String(value || ""));
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { restaurantId } = await getAuthContext(req);

    if (req.method === "GET") {
      const [{ data: profile }, { count: menuCount }, { count: orderCount }] = await Promise.all([
        supabase
          .from("restaurants")
          .select("id,name,uses_pos,pos_type,pos_api_base_url,pos_restaurant_id,pos_auto_sync,pos_sync_interval_minutes")
          .eq("id", restaurantId)
          .single(),
        supabase
          .from("menu_items")
          .select("id", { count: "exact", head: true })
          .eq("restaurant_id", restaurantId),
        supabase
          .from("orders")
          .select("order_id", { count: "exact", head: true })
          .eq("restaurant_id", restaurantId),
      ]);

      return res.status(200).json({
        restaurantId,
        config: {
          usesPOS: Boolean(profile?.uses_pos),
          posType: profile?.pos_type || "none",
          apiBaseUrl: profile?.pos_api_base_url || "",
          restaurantRef: profile?.pos_restaurant_id || "",
          autoSync: Boolean(profile?.pos_auto_sync),
          syncIntervalMinutes: parseNumber(profile?.pos_sync_interval_minutes, 5),
        },
        stats: {
          menuItems: menuCount || 0,
          orderRows: orderCount || 0,
        },
      });
    }

    if (req.method === "POST") {
      const action = String(req.body?.action || "sync").toLowerCase();

      if (action === "create-kot") {
        const orderId = String(req.body?.orderId || "").trim();
        if (!orderId) return res.status(400).json({ error: "orderId is required" });

        const { data: rows, error } = await supabase
          .from("orders")
          .select("order_id,item_name,quantity,channel,timestamp")
          .eq("restaurant_id", restaurantId)
          .eq("order_id", orderId);

        if (error) return res.status(500).json({ error: error.message });
        if (!rows || rows.length === 0) return res.status(404).json({ error: "Order not found" });

        const kot = {
          orderId,
          channel: rows[0].channel || "OFFLINE",
          createdAt: rows[0].timestamp || new Date().toISOString(),
          items: rows.map((row: any) => ({
            name: row.item_name,
            quantity: parseNumber(row.quantity, 1),
          })),
        };

        return res.status(200).json({ success: true, kot });
      }

      const menuItems = Array.isArray(req.body?.menuItems) ? req.body.menuItems : [];
      const orders = Array.isArray(req.body?.orders) ? req.body.orders : [];

      let insertedMenu = 0;
      let insertedOrders = 0;

      if (menuItems.length > 0) {
        const menuRows = menuItems
          .map((item: any) => ({
            restaurant_id: restaurantId,
            item_name: String(item?.name || item?.item_name || "").trim(),
            category: String(item?.category || "General").trim(),
            selling_price: parseNumber(item?.price ?? item?.selling_price, 0),
            food_cost: parseNumber(item?.cost ?? item?.food_cost, 0),
          }))
          .filter((row: any) => row.item_name.length > 0);

        if (menuRows.length > 0) {
          const { data, error } = await supabase.from("menu_items").insert(menuRows).select("id");
          if (error) return res.status(500).json({ error: error.message });
          insertedMenu = data?.length || 0;
        }
      }

      if (orders.length > 0) {
        const orderRows = orders
          .flatMap((order: any) => {
            const orderId = String(order?.order_id || order?.id || `POS-${Date.now()}`);
            const channel = String(order?.channel || "OFFLINE").toUpperCase();
            const timestamp = toIso(order?.timestamp);
            const items = Array.isArray(order?.items) ? order.items : [order];

            return items.map((item: any) => ({
              restaurant_id: restaurantId,
              order_id: orderId,
              item_name: String(item?.name || item?.item_name || "").trim(),
              quantity: Math.max(1, parseNumber(item?.qty ?? item?.quantity, 1)),
              channel,
              timestamp,
            }));
          })
          .filter((row: any) => row.item_name.length > 0);

        if (orderRows.length > 0) {
          const { data, error } = await supabase.from("orders").insert(orderRows).select("id");
          if (error) return res.status(500).json({ error: error.message });
          insertedOrders = data?.length || 0;
        }
      }

      return res.status(200).json({
        success: true,
        insertedMenu,
        insertedOrders,
      });
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
