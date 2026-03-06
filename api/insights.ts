import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthContext } from "./_lib/auth";
import { fetchRestaurantDataset } from "./_lib/restaurantRead";
import { calculateMargin, getOrderCountForItem } from "../src/lib/aiEngine";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { restaurantId } = await getAuthContext(req);
    const { menuItems, orders } = await fetchRestaurantDataset(restaurantId);

    const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
    const orderCount = orders.length;
    const aov = orderCount > 0 ? totalRevenue / orderCount : 0;

    const avgOrdersPerItem = menuItems.length > 0
      ? menuItems.reduce((sum, item) => sum + getOrderCountForItem(item.id, orders), 0) / menuItems.length
      : 0;

    const itemStats = menuItems.map((item) => {
      const count = getOrderCountForItem(item.id, orders);
      const offlineMargin = calculateMargin(item);

      return {
        item_name: item.name,
        orders: count,
        offlineMargin,
        onlineMargin: offlineMargin,
        isRisk: offlineMargin < 35 && count >= avgOrdersPerItem,
        isHiddenStar: offlineMargin > 55 && count > 0 && count < avgOrdersPerItem,
      };
    });

    const hiddenStars = itemStats.filter((item) => item.isHiddenStar);
    const riskItems = itemStats.filter((item) => item.isRisk);
    const topSellers = [...itemStats].sort((a, b) => b.orders - a.orders).slice(0, 3);

    return res.status(200).json({
      metrics: { totalRevenue, orderCount, aov },
      insights: {
        hiddenStars,
        riskItems,
        topSellers,
      },
      itemStats,
    });
  } catch (error) {
    if (error instanceof Error) {
      const status = error.message === "Unauthorized" || error.message === "Invalid token" ? 401 : 500;
      return res.status(status).json({ error: error.message });
    }

    return res.status(500).json({ error: "Unexpected server error" });
  }
}
