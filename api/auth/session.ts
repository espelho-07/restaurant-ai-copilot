import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthContext, supabase } from "../_lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { userId, restaurantId } = await getAuthContext(req);

    const { data: restaurant, error } = await supabase
      .from("restaurants")
      .select("id,name,location,cuisine,setup_complete")
      .eq("id", restaurantId)
      .single();

    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({
      userId,
      restaurantId,
      restaurant: {
        id: String(restaurant.id),
        name: restaurant.name || "",
        location: restaurant.location || "",
        cuisine: restaurant.cuisine || "",
        setupComplete: Boolean(restaurant.setup_complete),
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      const status = error.message === "Unauthorized" || error.message === "Invalid token" ? 401 : 500;
      return res.status(status).json({ error: error.message });
    }

    return res.status(500).json({ error: "Unexpected server error" });
  }
}
