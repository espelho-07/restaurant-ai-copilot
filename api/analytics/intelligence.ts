import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthContext } from "../_lib/auth";
import { fetchRestaurantDataset } from "../_lib/restaurantRead";
import {
  calculateMargin,
  calculateSalesVelocity,
  generateComboRecommendations,
  generateMenuEngineering,
  generatePriceRecommendations,
  generateUpsellSuggestions,
  getOrderCountForItem,
} from "../../src/lib/aiEngine";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { restaurantId } = await getAuthContext(req);
    const { menuItems, orders, commissions } = await fetchRestaurantDataset(restaurantId);

    const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
    const avgOrdersPerItem = menuItems.length > 0
      ? menuItems.reduce((sum, item) => sum + getOrderCountForItem(item.id, orders), 0) / menuItems.length
      : 0;

    const contributionMargin = menuItems.map((item) => {
      const orderCount = getOrderCountForItem(item.id, orders);
      const marginPct = calculateMargin(item);
      return {
        item,
        orderCount,
        marginPct,
        contributionPerUnit: item.price - item.cost,
        totalContribution: (item.price - item.cost) * orderCount,
      };
    });

    const hiddenStars = menuItems
      .filter((item) => {
        const margin = calculateMargin(item);
        const count = getOrderCountForItem(item.id, orders);
        return margin > 55 && count > 0 && count < avgOrdersPerItem;
      })
      .map((item) => ({
        item,
        marginPct: calculateMargin(item),
        orderCount: getOrderCountForItem(item.id, orders),
      }));

    const lowMarginRisk = menuItems
      .filter((item) => {
        const margin = calculateMargin(item);
        const count = getOrderCountForItem(item.id, orders);
        return margin < 40 && count > avgOrdersPerItem;
      })
      .map((item) => ({
        item,
        marginPct: calculateMargin(item),
        orderCount: getOrderCountForItem(item.id, orders),
      }));

    const payload = {
      summary: {
        totalRevenue,
        totalOrders: orders.length,
        totalMenuItems: menuItems.length,
      },
      modules: {
        contributionMargin,
        itemProfitability: generateMenuEngineering(menuItems, orders),
        salesVelocity: calculateSalesVelocity(menuItems, orders),
        hiddenStars,
        lowMarginRisk,
        comboRecommendations: generateComboRecommendations(menuItems, orders),
        upsellPrioritization: generateUpsellSuggestions(menuItems, orders),
        priceOptimization: generatePriceRecommendations(menuItems, orders, commissions),
      },
    };

    return res.status(200).json(payload);
  } catch (error) {
    if (error instanceof Error) {
      const status = error.message === "Unauthorized" || error.message === "Invalid token" ? 401 : 500;
      return res.status(status).json({ error: error.message });
    }

    return res.status(500).json({ error: "Unexpected server error" });
  }
}
