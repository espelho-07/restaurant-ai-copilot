import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthContext } from "./_lib/auth.js";
import { fetchRestaurantDataset } from "./_lib/restaurantRead.js";
import {
  calculateChannelMetrics,
  calculateRevenueSummary,
  generateComboRecommendations,
  generateDashboardInsights,
  generatePriceRecommendations,
} from "../src/lib/aiEngine.js";

function isSchemaMismatch(message: string): boolean {
  const m = String(message || "").toLowerCase();
  return (
    m.includes("does not exist") ||
    m.includes("could not find") ||
    m.includes("schema cache")
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let restaurantId = "";
  try {
    const auth = await getAuthContext(req);
    restaurantId = auth.restaurantId;
  } catch (error) {
    if (error instanceof Error && ["Unauthorized", "Invalid token"].includes(error.message)) {
      return res.status(401).json({ error: error.message });
    }
    return res.status(500).json({ error: error instanceof Error ? error.message : "Auth error" });
  }

  try {
    const { menuItems, orders, commissions } = await fetchRestaurantDataset(restaurantId);

    const insights = generateDashboardInsights(menuItems, orders, commissions);
    const priceRecommendations = generatePriceRecommendations(menuItems, orders, commissions);
    const combos = generateComboRecommendations(menuItems, orders);
    const revenue = calculateRevenueSummary(menuItems, orders);
    const channelMetrics = calculateChannelMetrics(menuItems, orders);

    return res.status(200).json({
      insights,
      priceRecommendations,
      combos,
      revenue,
      channelMetrics,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";

    if (isSchemaMismatch(message)) {
      return res.status(200).json({
        insights: [],
        priceRecommendations: [],
        combos: [],
        revenue: {
          totalRevenue: 0,
          totalProfit: 0,
          totalCost: 0,
          overallMarginPct: 0,
          avgOrderValue: 0,
          avgItemsPerOrder: 0,
          topRevenueItems: [],
          topProfitItems: [],
          monthlySummary: [],
        },
        channelMetrics: [],
        warning: "Database schema mismatch detected. Run supabase_schema.sql.",
      });
    }

    return res.status(500).json({ error: message });
  }
}
