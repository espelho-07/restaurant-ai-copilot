import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthContext } from "./_lib/auth";
import { fetchRestaurantDataset } from "./_lib/restaurantRead";
import { generatePriceRecommendations } from "../src/lib/aiEngine";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { restaurantId } = await getAuthContext(req);
    const { menuItems, orders, commissions } = await fetchRestaurantDataset(restaurantId);

    const recommendations = generatePriceRecommendations(menuItems, orders, commissions);
    return res.status(200).json(recommendations);
  } catch (error) {
    if (error instanceof Error) {
      const status = error.message === "Unauthorized" || error.message === "Invalid token" ? 401 : 500;
      return res.status(status).json({ error: error.message });
    }

    return res.status(500).json({ error: "Unexpected server error" });
  }
}
