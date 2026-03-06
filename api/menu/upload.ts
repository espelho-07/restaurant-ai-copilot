import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthContext, parseNumber, supabase } from "../_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { restaurantId } = await getAuthContext(req);

    const items = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: "Expected array of items" });

    const formatted = items
      .map((item: any) => ({
        restaurant_id: restaurantId,
        item_name: String(item?.name || item?.item_name || "").trim(),
        category: String(item?.category || "General").trim(),
        selling_price: parseNumber(item?.price ?? item?.selling_price, 0),
        food_cost: parseNumber(item?.cost ?? item?.food_cost, 0),
      }))
      .filter((item: any) => item.item_name.length > 0);

    if (formatted.length === 0) return res.status(400).json({ error: "No valid menu items provided" });

    const { data, error } = await supabase.from("menu_items").insert(formatted).select("*");
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json(data || []);
  } catch (error) {
    if (error instanceof Error) {
      const status = error.message === "Unauthorized" || error.message === "Invalid token" ? 401 : 500;
      return res.status(status).json({ error: error.message });
    }

    return res.status(500).json({ error: "Unexpected server error" });
  }
}
