import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthContext, parseNumber, supabase } from "../_lib/auth.js";

function mapMenuRow(row: any) {
  return {
    id: Number(row.id),
    name: String(row.item_name),
    category: String(row.category || "General"),
    price: parseNumber(row.selling_price, 0),
    cost: parseNumber(row.food_cost, 0),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { restaurantId } = await getAuthContext(req);

    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("menu_items")
        .select("id,item_name,category,selling_price,food_cost")
        .eq("restaurant_id", restaurantId)
        .order("item_name", { ascending: true });

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json((data || []).map(mapMenuRow));
    }

    if (req.method === "POST") {
      const payload = req.body;
      const items = Array.isArray(payload) ? payload : [payload];

      const rows = items
        .map((item: Record<string, unknown>) => ({
          restaurant_id: restaurantId,
          item_name: String(item.name || item.item_name || "").trim(),
          category: String(item.category || "General").trim(),
          selling_price: parseNumber(item.price ?? item.selling_price, 0),
          food_cost: parseNumber(item.cost ?? item.food_cost, 0),
        }))
        .filter((item) => item.item_name.length > 0);

      if (rows.length === 0) return res.status(400).json({ error: "No valid menu items provided" });

      const { data, error } = await supabase
        .from("menu_items")
        .insert(rows)
        .select("id,item_name,category,selling_price,food_cost");

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json((data || []).map(mapMenuRow));
    }

    if (req.method === "PUT") {
      const { id, ...updates } = req.body || {};
      if (!id) return res.status(400).json({ error: "Missing id" });

      const patch: Record<string, unknown> = {};
      if (updates.name !== undefined || updates.item_name !== undefined) patch.item_name = String(updates.name || updates.item_name || "").trim();
      if (updates.category !== undefined) patch.category = String(updates.category || "General");
      if (updates.price !== undefined || updates.selling_price !== undefined) patch.selling_price = parseNumber(updates.price ?? updates.selling_price, 0);
      if (updates.cost !== undefined || updates.food_cost !== undefined) patch.food_cost = parseNumber(updates.cost ?? updates.food_cost, 0);

      const { data, error } = await supabase
        .from("menu_items")
        .update(patch)
        .eq("restaurant_id", restaurantId)
        .eq("id", id)
        .select("id,item_name,category,selling_price,food_cost")
        .single();

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(mapMenuRow(data));
    }

    if (req.method === "DELETE") {
      const id = req.query.id || req.body?.id;
      if (!id) return res.status(400).json({ error: "Missing id" });

      const { error } = await supabase
        .from("menu_items")
        .delete()
        .eq("restaurant_id", restaurantId)
        .eq("id", id);

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true });
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
