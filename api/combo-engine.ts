import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthContext } from "./_lib/auth";
import { fetchRestaurantDataset } from "./_lib/restaurantRead";
import { generateComboRecommendations } from "../src/lib/aiEngine";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { restaurantId } = await getAuthContext(req);
    const { menuItems, orders } = await fetchRestaurantDataset(restaurantId);

    const combos = generateComboRecommendations(menuItems, orders);
    return res.status(200).json(combos);
  } catch (error) {
    if (error instanceof Error) {
      const status = error.message === "Unauthorized" || error.message === "Invalid token" ? 401 : 500;
      return res.status(status).json({ error: error.message });
    }

    return res.status(500).json({ error: "Unexpected server error" });
  }
}
