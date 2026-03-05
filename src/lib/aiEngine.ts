// AI Revenue Intelligence Engine
// Channel-aware analysis with commission support

import type {
    MenuItem,
    Order,
    PriceRecommendation,
    ComboRecommendation,
    AIInsight,
    ImpactLevel,
    SalesChannel,
    ChannelCommission,
    ChannelMetrics,
} from "./types";

// ─── HELPERS ──────────────────────────────────────────────────────

export function calculateMargin(item: MenuItem): number {
    return ((item.price - item.cost) / item.price) * 100;
}

export function calculateOnlineMargin(item: MenuItem, commissionPct: number): number {
    const commission = item.price * (commissionPct / 100);
    const netRevenue = item.price - commission;
    return netRevenue > 0 ? ((netRevenue - item.cost) / item.price) * 100 : -100;
}

export function calculateOnlineContribution(item: MenuItem, commissionPct: number): number {
    const commission = item.price * (commissionPct / 100);
    return item.price - commission - item.cost;
}

export function getOrderCountForItem(itemId: number, orders: Order[]): number {
    return orders.reduce((count, order) => {
        const found = order.items.find((oi) => oi.menuItemId === itemId);
        return count + (found ? found.qty : 0);
    }, 0);
}

function clampConfidence(raw: number): number {
    return Math.round(Math.max(15, Math.min(98, raw)));
}

function calcImpactLevel(revenueChangePct: number, orderCount: number): ImpactLevel {
    if (Math.abs(revenueChangePct) >= 10 || orderCount >= 5) return "HIGH";
    if (Math.abs(revenueChangePct) >= 5 || orderCount >= 3) return "MEDIUM";
    return "LOW";
}

// ─── CHANNEL METRICS ──────────────────────────────────────────────

export function calculateChannelMetrics(
    menuItems: MenuItem[],
    orders: Order[]
): ChannelMetrics[] {
    const channelMap = new Map<SalesChannel, { orders: Order[] }>();
    for (const order of orders) {
        const ch = order.channel || "OFFLINE";
        if (!channelMap.has(ch)) channelMap.set(ch, { orders: [] });
        channelMap.get(ch)!.orders.push(order);
    }

    const metrics: ChannelMetrics[] = [];
    for (const [channel, data] of channelMap) {
        const revenue = data.orders.reduce((s, o) => s + o.total, 0);
        const avgMargin = data.orders.length > 0
            ? data.orders.reduce((s, o) => s + o.margin, 0) / data.orders.length : 0;
        const aov = data.orders.length > 0 ? revenue / data.orders.length : 0;

        // Top items for this channel
        const itemCounts = new Map<string, number>();
        for (const order of data.orders) {
            for (const oi of order.items) {
                itemCounts.set(oi.name, (itemCounts.get(oi.name) || 0) + oi.qty);
            }
        }
        const topItems = Array.from(itemCounts.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 3);

        metrics.push({ channel, orderCount: data.orders.length, revenue, avgMargin, avgOrderValue: aov, topItems });
    }

    return metrics.sort((a, b) => b.revenue - a.revenue);
}

// ─── PRICE OPTIMIZATION ENGINE (Channel-Aware) ───────────────────

export function generatePriceRecommendations(
    menuItems: MenuItem[],
    orders: Order[],
    commissions: ChannelCommission[] = []
): PriceRecommendation[] {
    const totalOrders = orders.length || 1;
    const avgCommission = commissions.length > 0
        ? commissions.filter((c) => c.channel !== "OFFLINE" && c.enabled).reduce((s, c) => s + c.commissionPct, 0) /
        Math.max(commissions.filter((c) => c.channel !== "OFFLINE" && c.enabled).length, 1) : 22;

    const recommendations: PriceRecommendation[] = [];

    for (const item of menuItems) {
        const offlineMargin = calculateMargin(item);
        const onlineMargin = calculateOnlineMargin(item, avgCommission);
        const onlineContribution = calculateOnlineContribution(item, avgCommission);
        const orderCount = getOrderCountForItem(item.id, orders);
        const orderFreq = orderCount / totalOrders;

        // Channel distribution
        const onlineOrders = orders.filter((o) => o.channel !== "OFFLINE" && o.items.some((oi) => oi.menuItemId === item.id));
        const offlineOrders = orders.filter((o) => o.channel === "OFFLINE" && o.items.some((oi) => oi.menuItemId === item.id));
        const onlinePct = orderCount > 0 ? Math.round((onlineOrders.length / Math.max(onlineOrders.length + offlineOrders.length, 1)) * 100) : 0;

        const demandLevel: "high" | "medium" | "low" = orderFreq > 0.5 ? "high" : orderFreq > 0.2 ? "medium" : "low";
        const marginLevel: "high" | "medium" | "low" = offlineMargin > 60 ? "high" : offlineMargin > 40 ? "medium" : "low";

        let suggestedPrice = item.price;
        let suggestedOnlinePrice: number | undefined;
        let reason = "";
        let estimatedRevenueChange = 0;
        const reasoning: string[] = [];
        const impactedMetrics: string[] = [];

        reasoning.push(`${item.name}: ₹${item.price} (cost ₹${item.cost}), offline margin ${offlineMargin.toFixed(1)}%.`);
        reasoning.push(`Online margin after ${avgCommission}% commission: ${onlineMargin.toFixed(1)}% (₹${onlineContribution.toFixed(0)} contribution).`);
        reasoning.push(`Ordered ${orderCount} times (${(orderFreq * 100).toFixed(0)}% frequency). ${onlinePct}% online, ${100 - onlinePct}% offline.`);

        if (onlineContribution < 0) {
            // UNPROFITABLE ONLINE
            const minOnlinePrice = Math.ceil((item.cost / (1 - avgCommission / 100)) / 5) * 5;
            suggestedOnlinePrice = minOnlinePrice + 10;
            reason = `⚠️ UNPROFITABLE ONLINE: ${item.name} loses ₹${Math.abs(onlineContribution).toFixed(0)} per online sale. Online price must be ≥₹${minOnlinePrice} to break even.`;
            estimatedRevenueChange = 15;
            reasoning.push(`CRITICAL: Online contribution = −₹${Math.abs(onlineContribution).toFixed(0)} per unit.`);
            reasoning.push(`Breakeven online price: ₹${minOnlinePrice}. Suggested: ₹${suggestedOnlinePrice}.`);
            impactedMetrics.push("Online Profitability", "Revenue Loss Prevention");
        } else if (demandLevel === "high" && marginLevel === "low") {
            const increase = Math.round(item.price * 0.12);
            suggestedPrice = item.price + increase;
            suggestedOnlinePrice = suggestedPrice + Math.round(suggestedPrice * (avgCommission / 100) * 0.5);
            reason = `High demand (${orderCount} orders) but low margin (${offlineMargin.toFixed(0)}%). Price increase + higher online price to offset commission.`;
            estimatedRevenueChange = 12;
            reasoning.push(`Recommendation: Offline ₹${item.price} → ₹${suggestedPrice}, Online ₹${suggestedOnlinePrice}.`);
            impactedMetrics.push("Revenue", "Profit Margin", "Online Profitability");
        } else if (demandLevel === "high" && marginLevel === "medium") {
            const increase = Math.round(item.price * 0.07);
            suggestedPrice = item.price + increase;
            suggestedOnlinePrice = suggestedPrice + Math.round(suggestedPrice * (avgCommission / 100) * 0.3);
            reason = `Strong demand supports a modest price increase. Online price adjusted to maintain margin after commission.`;
            estimatedRevenueChange = 7;
            reasoning.push(`Recommendation: Offline ₹${item.price} → ₹${suggestedPrice}, Online ₹${suggestedOnlinePrice}.`);
            impactedMetrics.push("Revenue", "Profit Margin");
        } else if (demandLevel === "low" && marginLevel === "high") {
            const discount = Math.round(item.price * 0.05);
            suggestedPrice = item.price - discount;
            reason = `Hidden Star: ${offlineMargin.toFixed(0)}% margin but only ${orderCount} orders. Promote to boost volume.`;
            estimatedRevenueChange = 15;
            reasoning.push(`This is a Hidden Star — high profitability but low visibility.`);
            impactedMetrics.push("Item Visibility", "Order Volume", "Revenue");
        } else if (demandLevel === "low" && marginLevel === "low") {
            const increase = Math.round(item.price * 0.15);
            suggestedPrice = item.price + increase;
            reason = `Poor performer: low demand and low margin. Increase price or consider replacing.`;
            estimatedRevenueChange = -5;
            impactedMetrics.push("Profit Margin", "Menu Efficiency");
        } else {
            reason = `Well-optimized. ${offlineMargin.toFixed(0)}% offline margin, ${onlineMargin.toFixed(0)}% online margin.`;
            estimatedRevenueChange = 0;
            impactedMetrics.push("Revenue");
        }

        suggestedPrice = Math.round(suggestedPrice / 5) * 5;
        if (suggestedOnlinePrice) suggestedOnlinePrice = Math.round(suggestedOnlinePrice / 5) * 5;

        const sampleFactor = Math.min(totalOrders / 10, 1) * 30;
        const freqFactor = Math.min(orderFreq * 2, 1) * 25;
        const marginClarity = (offlineMargin > 60 || offlineMargin < 35) ? 25 : 15;
        const confidence = clampConfidence(sampleFactor + freqFactor + marginClarity + 15);
        const impactLevel = calcImpactLevel(estimatedRevenueChange, orderCount);
        const estimatedMonthlyImpact = Math.round(item.price * (estimatedRevenueChange / 100) * Math.max(orderCount, 1) * 4.3);

        recommendations.push({
            menuItem: item,
            currentPrice: item.price,
            suggestedPrice,
            suggestedOnlinePrice,
            reason,
            estimatedRevenueChange,
            estimatedMonthlyImpact,
            demandLevel,
            marginLevel,
            orderCount,
            offlineMarginPct: offlineMargin,
            onlineMarginPct: onlineMargin,
            confidence,
            impactLevel,
            reasoning,
            impactedMetrics,
        });
    }

    return recommendations.sort((a, b) => Math.abs(b.estimatedRevenueChange) - Math.abs(a.estimatedRevenueChange));
}

// ─── CO-OCCURRENCE / COMBO ANALYSIS ───────────────────────────────

interface CoOccurrence { itemA: number; itemB: number; count: number; }

function buildCoOccurrenceMatrix(orders: Order[]): CoOccurrence[] {
    const matrix: Map<string, number> = new Map();
    for (const order of orders) {
        const uniqueItems = Array.from(new Set(order.items.map((i) => i.menuItemId)));
        for (let i = 0; i < uniqueItems.length; i++) {
            for (let j = i + 1; j < uniqueItems.length; j++) {
                const key = `${Math.min(uniqueItems[i], uniqueItems[j])}-${Math.max(uniqueItems[i], uniqueItems[j])}`;
                matrix.set(key, (matrix.get(key) || 0) + 1);
            }
        }
    }
    return Array.from(matrix.entries()).map(([key, count]) => {
        const [a, b] = key.split("-").map(Number);
        return { itemA: a, itemB: b, count };
    });
}

export function generateComboRecommendations(
    menuItems: MenuItem[],
    orders: Order[]
): ComboRecommendation[] {
    if (orders.length < 2) return generateSeedCombos(menuItems, orders.length);
    const coOccurrences = buildCoOccurrenceMatrix(orders);
    const totalOrders = orders.length;
    const sorted = coOccurrences.sort((a, b) => b.count - a.count);
    const combos: ComboRecommendation[] = [];
    const usedPairs = new Set<string>();
    // Deduplication: track combos by sorted item IDs so ABC == BAC == CBA
    const usedComboKeys = new Set<string>();

    for (const pair of sorted.slice(0, 12)) {
        const key = `${pair.itemA}-${pair.itemB}`;
        if (usedPairs.has(key)) continue;
        usedPairs.add(key);
        const itemA = menuItems.find((m) => m.id === pair.itemA);
        const itemB = menuItems.find((m) => m.id === pair.itemB);
        if (!itemA || !itemB) continue;

        const thirdItem = findThirdItem(pair.itemA, pair.itemB, sorted, menuItems);
        const comboItems = thirdItem ? [itemA, itemB, thirdItem] : [itemA, itemB];

        // Deduplicate: create a canonical key from sorted item IDs
        const comboKey = comboItems.map(i => i.id).sort((a, b) => a - b).join("-");
        if (usedComboKeys.has(comboKey)) continue;
        usedComboKeys.add(comboKey);

        const individualTotal = comboItems.reduce((s, i) => s + i.price, 0);
        const discount = Math.round(individualTotal * 0.1);
        const suggestedPrice = individualTotal - discount;
        const coOccPct = Math.round((pair.count / totalOrders) * 100);

        const freqA = getOrderCountForItem(itemA.id, orders);
        const freqB = getOrderCountForItem(itemB.id, orders);
        const coOccStrength = Math.min(coOccPct * 2, 40);
        const sampleStrength = Math.min((totalOrders / 10) * 20, 30);
        const pairStrength = Math.min(pair.count * 10, 25);
        const confidence = clampConfidence(coOccStrength + sampleStrength + pairStrength + 5);
        const impactLevel: ImpactLevel = pair.count >= 3 ? "HIGH" : pair.count >= 2 ? "MEDIUM" : "LOW";
        const aovIncrease = Math.round((discount / (individualTotal - discount)) * 100);

        const reasoning: string[] = [
            `${itemA.name} appears ${freqA} times (${Math.round((freqA / totalOrders) * 100)}% frequency).`,
            `${itemB.name} appears ${freqB} times (${Math.round((freqB / totalOrders) * 100)}% frequency).`,
            `Co-occurrence: ${pair.count}/${totalOrders} orders (${coOccPct}%).`,
        ];
        if (thirdItem) reasoning.push(`${thirdItem.name} frequently pairs with both items.`);
        reasoning.push(`Combo at ₹${suggestedPrice} = ${Math.round(((individualTotal - suggestedPrice) / individualTotal) * 100)}% discount.`);

        combos.push({
            items: comboItems, coOccurrenceCount: pair.count, totalOrders, confidence, suggestedPrice, individualTotal, aovIncrease,
            reason: `Ordered together ${pair.count}/${totalOrders} times (${coOccPct}%). Bundle at ₹${suggestedPrice}.`,
            impactLevel, reasoning, impactedMetrics: ["Average Order Value", "Revenue", "Customer Satisfaction"],
            estimatedMonthlyImpact: Math.round(suggestedPrice * pair.count * 4.3 * 0.15),
        });
    }
    return combos.length > 0 ? combos.slice(0, 4) : generateSeedCombos(menuItems, totalOrders);
}

function findThirdItem(idA: number, idB: number, coOccurrences: CoOccurrence[], menuItems: MenuItem[]): MenuItem | null {
    const candidates = new Map<number, number>();
    for (const p of coOccurrences) {
        if (p.itemA === idA && p.itemB !== idB) candidates.set(p.itemB, (candidates.get(p.itemB) || 0) + p.count);
        if (p.itemB === idA && p.itemA !== idB) candidates.set(p.itemA, (candidates.get(p.itemA) || 0) + p.count);
        if (p.itemA === idB && p.itemB !== idA) candidates.set(p.itemB, (candidates.get(p.itemB) || 0) + p.count);
        if (p.itemB === idB && p.itemA !== idA) candidates.set(p.itemA, (candidates.get(p.itemA) || 0) + p.count);
    }
    let bestId = -1; let bestScore = 0;
    for (const [id, score] of candidates) { if (score > bestScore) { bestScore = score; bestId = id; } }
    return bestId > 0 ? menuItems.find((m) => m.id === bestId) || null : null;
}

function generateSeedCombos(menuItems: MenuItem[], totalOrders: number): ComboRecommendation[] {
    const combos: ComboRecommendation[] = [];

    // Group items by broad types for logical pairing
    const mains = menuItems.filter(i => ["Main Course", "Pizza", "Biryani"].includes(i.category));
    const fastFood = menuItems.filter(i => ["Fast Food", "Burger", "Sandwich"].includes(i.category));
    const breads = menuItems.filter(i => ["Breads", "Roti", "Naan"].includes(i.category));
    const starters = menuItems.filter(i => ["Starters", "Snacks", "Fries"].includes(i.category));
    const beverages = menuItems.filter(i => ["Beverages", "Drinks", "Shakes"].includes(i.category));
    const desserts = menuItems.filter(i => ["Desserts", "Sweets", "Ice Cream"].includes(i.category));

    const templates = [
        { name: "Classic Meal", items: [mains[0], breads[0], beverages[0]] },
        { name: "Snack & Drink", items: [fastFood[0], starters[0], beverages[0]] },
        { name: "Quick Drink Combo", items: [fastFood[1] || fastFood[0], beverages[1] || beverages[0]] },
        { name: "Sweet Ending", items: [mains[1] || mains[0], desserts[0]] },
        { name: "Starter & Main", items: [starters[0], mains[0]] }
    ];

    for (const t of templates) {
        // Filter out nulls and deduplicate to ensure valid combinations
        const validItems = Array.from(new Set(t.items.filter(Boolean)));
        if (validItems.length < 2) continue; // Need at least 2 items for a combo

        const individualTotal = validItems.reduce((s, it) => s + it.price, 0);
        const suggestedPrice = Math.round((individualTotal * 0.88) / 5) * 5; // 12% discount rounded to 5

        combos.push({
            items: validItems,
            coOccurrenceCount: 0,
            totalOrders,
            confidence: 55 + Math.floor(Math.random() * 15),
            suggestedPrice,
            individualTotal,
            aovIncrease: Math.round(((individualTotal - suggestedPrice) / suggestedPrice) * 100),
            reason: `Curated ${t.name}: ${validItems.map(i => i.name).join(" + ")}.`,
            impactLevel: "MEDIUM",
            reasoning: [`No co-occurrence data yet.`, `Based on logical category pairing (${t.name}).`],
            impactedMetrics: ["Average Order Value", "Revenue"],
            estimatedMonthlyImpact: Math.round(suggestedPrice * 0.12 * 30),
        });

        if (combos.length >= 4) break;
    }

    // Fallback if templates fail (e.g. very limited menu)
    if (combos.length === 0 && menuItems.length >= 2) {
        const fallbackItems = menuItems.slice(0, 2);
        const total = fallbackItems[0].price + fallbackItems[1].price;
        combos.push({
            items: fallbackItems, coOccurrenceCount: 0, totalOrders, confidence: 50,
            suggestedPrice: Math.round((total * 0.9) / 5) * 5, individualTotal: total, aovIncrease: 10,
            reason: `Basic Combo: ${fallbackItems.map(i => i.name).join(' + ')}`,
            impactLevel: "LOW", reasoning: ["Basic fallback combo generated due to limited menu categories."], impactedMetrics: ["AOV"], estimatedMonthlyImpact: 0
        });
    }

    return combos.slice(0, 4);
}

// ─── DASHBOARD INSIGHTS (Channel-Aware) ───────────────────────────

export function generateDashboardInsights(
    menuItems: MenuItem[],
    orders: Order[],
    commissions: ChannelCommission[] = []
): AIInsight[] {
    const insights: AIInsight[] = [];
    const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
    const totalOrders = orders.length;
    const avgOrders = menuItems.reduce((s, m) => s + getOrderCountForItem(m.id, orders), 0) / (menuItems.length || 1);
    const avgCommission = commissions.filter((c) => c.channel !== "OFFLINE" && c.enabled).reduce((s, c) => s + c.commissionPct, 0) /
        Math.max(commissions.filter((c) => c.channel !== "OFFLINE" && c.enabled).length, 1) || 22;

    // 1. UNPROFITABLE SKU DETECTION (Online)
    for (const item of menuItems) {
        const onlineContribution = calculateOnlineContribution(item, avgCommission);
        if (onlineContribution < 0) {
            const onlineOrderCount = orders.filter((o) => o.channel !== "OFFLINE" && o.items.some((oi) => oi.menuItemId === item.id)).length;
            const lossPerMonth = Math.round(Math.abs(onlineContribution) * Math.max(onlineOrderCount, 1) * 4.3);
            insights.push({
                type: "risk",
                title: `🚨 Risk SKU: ${item.name}`,
                description: `${item.name} loses ₹${Math.abs(onlineContribution).toFixed(0)} per online sale (price ₹${item.price}, commission ₹${Math.round(item.price * avgCommission / 100)}, cost ₹${item.cost}). ${onlineOrderCount > 0 ? `Currently ${onlineOrderCount} online orders.` : ""}`,
                impact: `-₹${lossPerMonth}/month potential loss`,
                priority: "high",
                confidence: clampConfidence(75 + Math.min(totalOrders / 5, 15)),
                impactLevel: "HIGH",
                reasoning: [
                    `Selling price: ₹${item.price}.`,
                    `Commission (${avgCommission}%): ₹${Math.round(item.price * avgCommission / 100)}.`,
                    `Net revenue: ₹${(item.price - item.price * avgCommission / 100).toFixed(0)}.`,
                    `Food cost: ₹${item.cost}.`,
                    `Contribution: ₹${onlineContribution.toFixed(0)} (NEGATIVE = loss per sale).`,
                    `Action: Increase online price or remove from online platforms.`,
                ],
                impactedMetrics: ["Online Profitability", "Revenue Loss Prevention"],
            });
        }
    }

    // 2. Online vs Offline performance
    const onlineOrders = orders.filter((o) => o.channel !== "OFFLINE");
    const offlineOrders = orders.filter((o) => o.channel === "OFFLINE");
    if (onlineOrders.length > 0 && offlineOrders.length > 0) {
        const onlineRev = onlineOrders.reduce((s, o) => s + o.total, 0);
        const offlineRev = offlineOrders.reduce((s, o) => s + o.total, 0);
        const onlineAvgMargin = onlineOrders.reduce((s, o) => s + o.margin, 0) / onlineOrders.length;
        const offlineAvgMargin = offlineOrders.reduce((s, o) => s + o.margin, 0) / offlineOrders.length;
        const onlinePct = Math.round((onlineRev / totalRevenue) * 100);

        insights.push({
            type: "insight",
            title: "Online vs Offline Split",
            description: `${onlinePct}% revenue from online (${onlineOrders.length} orders, avg margin ${onlineAvgMargin.toFixed(0)}%) vs ${100 - onlinePct}% offline (${offlineOrders.length} orders, avg margin ${offlineAvgMargin.toFixed(0)}%). ${onlineAvgMargin < offlineAvgMargin ? "Online margins are lower due to commissions." : ""}`,
            priority: "medium",
            confidence: clampConfidence(60 + Math.min(totalOrders / 3, 25)),
            impactLevel: Math.abs(onlineAvgMargin - offlineAvgMargin) > 15 ? "HIGH" : "MEDIUM",
            reasoning: [
                `Online: ${onlineOrders.length} orders, ₹${onlineRev} revenue, ${onlineAvgMargin.toFixed(1)}% avg margin.`,
                `Offline: ${offlineOrders.length} orders, ₹${offlineRev} revenue, ${offlineAvgMargin.toFixed(1)}% avg margin.`,
                `Margin gap: ${Math.abs(onlineAvgMargin - offlineAvgMargin).toFixed(1)}% — ${onlineAvgMargin < offlineAvgMargin ? "commission impact on online orders." : "online orders perform better."}`,
            ],
            impactedMetrics: ["Channel Profitability", "Revenue Distribution"],
        });
    }

    // 3. Hidden Stars
    for (const item of menuItems) {
        const margin = calculateMargin(item);
        const orderCount = getOrderCountForItem(item.id, orders);
        if (margin > 55 && orderCount < avgOrders * 0.7) {
            const potentialRevenue = Math.round(item.price * 0.15 * Math.max(avgOrders - orderCount, 5));
            insights.push({
                type: "opportunity",
                title: `Hidden Star: ${item.name}`,
                description: `${margin.toFixed(0)}% margin but only ${orderCount} orders. Promoting could add ₹${potentialRevenue}/week.`,
                impact: `+₹${potentialRevenue}/week`,
                priority: "high",
                confidence: clampConfidence(Math.min(margin / 1.2, 40) + Math.min(totalOrders / 5, 30) + 15),
                impactLevel: "HIGH",
                reasoning: [
                    `Offline margin: ${margin.toFixed(1)}% (above 55% threshold).`,
                    `Online margin: ${calculateOnlineMargin(item, avgCommission).toFixed(1)}% after commission.`,
                    `Order frequency: ${orderCount} (${Math.round((orderCount / (avgOrders || 1)) * 100)}% of average).`,
                ],
                impactedMetrics: ["Item Visibility", "Revenue", "Menu Utilization"],
            });
        }
    }

    // 4. Low margin warnings
    for (const item of menuItems) {
        const margin = calculateMargin(item);
        const orderCount = getOrderCountForItem(item.id, orders);
        if (margin < 40 && orderCount > 0) {
            insights.push({
                type: "warning",
                title: `Low Margin: ${item.name}`,
                description: `${margin.toFixed(0)}% offline margin (₹${(item.price - item.cost)} profit). Online margin: ${calculateOnlineMargin(item, avgCommission).toFixed(0)}%.`,
                impact: `₹${item.price - item.cost}/order`,
                priority: margin < 35 ? "high" : "medium",
                confidence: clampConfidence(Math.min((40 - margin) * 2, 30) + Math.min(totalOrders / 5, 30) + 20),
                impactLevel: margin < 35 ? "HIGH" : "MEDIUM",
                reasoning: [
                    `Offline: ₹${item.price} − ₹${item.cost} = ₹${item.price - item.cost} (${margin.toFixed(1)}%).`,
                    `Online: ₹${item.price} − ₹${Math.round(item.price * avgCommission / 100)} commission − ₹${item.cost} = ₹${calculateOnlineContribution(item, avgCommission).toFixed(0)}.`,
                ],
                impactedMetrics: ["Profit Margin", "Revenue Efficiency"],
            });
        }
    }

    // 5. Revenue concentration
    if (totalOrders > 3) {
        const itemRevenue = menuItems.map((item) => ({
            name: item.name,
            revenue: orders.reduce((s, o) => { const oi = o.items.find((i) => i.menuItemId === item.id); return s + (oi ? oi.price * oi.qty : 0); }, 0),
        })).sort((a, b) => b.revenue - a.revenue);
        const top3Revenue = itemRevenue.slice(0, 3).reduce((s, i) => s + i.revenue, 0);
        const top3Pct = totalRevenue > 0 ? (top3Revenue / totalRevenue) * 100 : 0;
        if (top3Pct > 50) {
            insights.push({
                type: "warning",
                title: "Revenue Concentration Risk",
                description: `Top 3 items contribute ${Math.round(top3Pct)}% of revenue. Diversify to reduce dependency.`,
                priority: "medium",
                confidence: clampConfidence(60 + Math.min(totalOrders / 3, 25)),
                impactLevel: top3Pct > 65 ? "HIGH" : "MEDIUM",
                reasoning: itemRevenue.slice(0, 3).map((i) => `${i.name}: ₹${i.revenue}`),
                impactedMetrics: ["Revenue Stability", "Menu Diversification"],
            });
        }
    }

    // 6. AOV Forecast
    if (totalOrders > 0) {
        const aov = totalRevenue / totalOrders;
        const uplift = Math.round(aov * 0.18 * totalOrders);
        insights.push({
            type: "forecast",
            title: "Revenue Forecast",
            description: `AOV ₹${Math.round(aov)}. Combos + upsell could add ~₹${uplift}/month (+18%).`,
            impact: `+₹${uplift}/month`,
            priority: "high",
            confidence: clampConfidence(50 + Math.min(totalOrders / 2, 30)),
            impactLevel: uplift > 5000 ? "HIGH" : "MEDIUM",
            reasoning: [
                `Current AOV: ₹${Math.round(aov)} across ${totalOrders} orders.`,
                `Projected combo uplift: 15-22% based on industry benchmarks.`,
            ],
            impactedMetrics: ["Average Order Value", "Monthly Revenue"],
        });
    }

    return insights.sort((a, b) => {
        const prio = { high: 0, medium: 1, low: 2 };
        return prio[a.priority] - prio[b.priority];
    });
}

// ─── SALES VELOCITY & POPULARITY SCORING ──────────────────────────
// Module 3 from deep-research-report: composite score using
//   (a) total order frequency, (b) recency decay, (c) growth trend.

export interface SalesVelocityItem {
    item: MenuItem;
    totalOrders: number;
    recencyScore: number;   // 0-1, higher = ordered more recently
    growthScore: number;    // -1 to +1, positive = trending up
    velocityScore: number;  // 0-100 composite
    velocityLabel: string;
}

export function calculateSalesVelocity(
    menuItems: MenuItem[],
    orders: Order[]
): SalesVelocityItem[] {
    if (orders.length === 0 || menuItems.length === 0) {
        return menuItems.map((item) => ({
            item, totalOrders: 0, recencyScore: 0, growthScore: 0,
            velocityScore: 0, velocityLabel: "No Data",
        }));
    }

    const now = Date.now();
    const DECAY_LAMBDA = 0.05; // decay factor per day
    const ONE_DAY = 86400000;
    const ONE_WEEK = 7 * ONE_DAY;

    // Determine time boundaries
    const timestamps = orders.map((o) => new Date(o.timestamp).getTime());
    const minTime = Math.min(...timestamps);
    const dataSpanDays = Math.max((now - minTime) / ONE_DAY, 1);

    // Split orders into "recent" (last 7 days) vs "previous" (7-14 days ago)
    const recentCutoff = now - ONE_WEEK;
    const prevCutoff = now - 2 * ONE_WEEK;

    const results: SalesVelocityItem[] = [];
    let maxTotalOrders = 1;

    // Pre-calculate per-item metrics
    const itemData = menuItems.map((item) => {
        const itemOrders = orders.filter((o) =>
            o.items.some((oi) => oi.menuItemId === item.id)
        );
        const totalOrders = itemOrders.reduce((s, o) => {
            const oi = o.items.find((i) => i.menuItemId === item.id);
            return s + (oi ? oi.qty : 0);
        }, 0);
        if (totalOrders > maxTotalOrders) maxTotalOrders = totalOrders;

        // Recency: exponential decay weight of most recent order
        let recencyScore = 0;
        if (itemOrders.length > 0) {
            const mostRecent = Math.max(...itemOrders.map((o) => new Date(o.timestamp).getTime()));
            const daysSinceLast = (now - mostRecent) / ONE_DAY;
            recencyScore = Math.exp(-DECAY_LAMBDA * daysSinceLast);
        }

        // Growth: compare last-week qty vs previous-week qty
        const recentQty = itemOrders
            .filter((o) => new Date(o.timestamp).getTime() >= recentCutoff)
            .reduce((s, o) => {
                const oi = o.items.find((i) => i.menuItemId === item.id);
                return s + (oi ? oi.qty : 0);
            }, 0);
        const prevQty = itemOrders
            .filter((o) => {
                const t = new Date(o.timestamp).getTime();
                return t >= prevCutoff && t < recentCutoff;
            })
            .reduce((s, o) => {
                const oi = o.items.find((i) => i.menuItemId === item.id);
                return s + (oi ? oi.qty : 0);
            }, 0);
        const growthScore = prevQty > 0
            ? Math.max(-1, Math.min(1, (recentQty - prevQty) / prevQty))
            : recentQty > 0 ? 1 : 0;

        return { item, totalOrders, recencyScore, growthScore };
    });

    // Normalize and compute composite score
    for (const d of itemData) {
        const freqNorm = d.totalOrders / maxTotalOrders;           // 0-1
        const recNorm = d.recencyScore;                             // already 0-1
        const growthNorm = (d.growthScore + 1) / 2;                 // map -1..1 → 0..1

        // Weighted composite: 40% frequency, 35% recency, 25% growth
        const raw = 0.40 * freqNorm + 0.35 * recNorm + 0.25 * growthNorm;
        const velocityScore = Math.round(raw * 100);

        const velocityLabel = velocityScore >= 80 ? "🔥 Hot Seller"
            : velocityScore >= 60 ? "📈 Trending Up"
                : velocityScore >= 40 ? "➡️ Steady"
                    : velocityScore >= 20 ? "📉 Slowing Down"
                        : "❄️ Cold Item";

        results.push({ ...d, velocityScore, velocityLabel });
    }

    return results.sort((a, b) => b.velocityScore - a.velocityScore);
}

// ─── SMART UPSELL PRIORITIZATION ──────────────────────────────────
// Module 7 from deep-research-report:
//   upsell_score(A, B) = confidence(A→B) × (margin_B / max_margin)

export interface UpsellSuggestion {
    forItem: MenuItem;
    upsells: {
        item: MenuItem;
        score: number;         // 0-1, higher = better upsell
        confidence: number;    // P(B|A) as percentage
        marginPct: number;     // margin of upsell item
        reasoning: string;
    }[];
}

export function generateUpsellSuggestions(
    menuItems: MenuItem[],
    orders: Order[]
): UpsellSuggestion[] {
    if (orders.length < 3 || menuItems.length < 2) return [];

    // Step 1: Build item → orders-containing-item map
    const itemOrderSets = new Map<number, Set<string>>();
    for (const item of menuItems) {
        itemOrderSets.set(item.id, new Set());
    }
    for (const order of orders) {
        for (const oi of order.items) {
            if (itemOrderSets.has(oi.menuItemId)) {
                itemOrderSets.get(oi.menuItemId)!.add(order.id);
            }
        }
    }

    // Step 2: Compute confidence(A→B) = P(B|A) = |orders with A∩B| / |orders with A|
    const maxMargin = Math.max(...menuItems.map((m) => calculateMargin(m)), 1);

    const suggestions: UpsellSuggestion[] = [];

    for (const itemA of menuItems) {
        const ordersWithA = itemOrderSets.get(itemA.id);
        if (!ordersWithA || ordersWithA.size < 1) continue;

        const upsells: UpsellSuggestion["upsells"] = [];

        for (const itemB of menuItems) {
            if (itemB.id === itemA.id) continue;
            const ordersWithB = itemOrderSets.get(itemB.id);
            if (!ordersWithB || ordersWithB.size < 1) continue;

            // Intersection: orders containing both A and B
            let coCount = 0;
            for (const oid of ordersWithA) {
                if (ordersWithB.has(oid)) coCount++;
            }
            if (coCount < 1) continue;

            const confidence = coCount / ordersWithA.size;         // P(B|A)
            const marginB = calculateMargin(itemB);
            const normalizedMargin = marginB / maxMargin;

            // Upsell score = confidence × normalized margin
            const score = confidence * normalizedMargin;

            if (score > 0.05) { // threshold to avoid noise
                upsells.push({
                    item: itemB,
                    score: Math.round(score * 100) / 100,
                    confidence: Math.round(confidence * 100),
                    marginPct: Math.round(marginB * 10) / 10,
                    reasoning: `${Math.round(confidence * 100)}% of customers who ordered ${itemA.name} also ordered ${itemB.name} (${coCount}/${ordersWithA.size} orders). ${itemB.name} has ${marginB.toFixed(0)}% margin.`,
                });
            }
        }

        // Sort by upsell score and keep top 3
        upsells.sort((a, b) => b.score - a.score);
        if (upsells.length > 0) {
            suggestions.push({ forItem: itemA, upsells: upsells.slice(0, 3) });
        }
    }

    return suggestions.sort((a, b) =>
        (b.upsells[0]?.score || 0) - (a.upsells[0]?.score || 0)
    );
}

// ─── VOICE ORDER NLP PARSER ───────────────────────────────────────

const numberWords: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    ek: 1, do: 2, teen: 3, char: 4, paanch: 5, cheh: 6, saat: 7, aath: 8, nau: 9, das: 10,
    a: 1, an: 1,
};

const stopWords = [
    "aur", "and", "or", "please", "bhai", "yaar", "dena", "de", "do",
    "chahiye", "lao", "laga", "lagao", "with", "mein", "me", "ka", "ke", "ki",
    "mujhe", "hume", "humko", "i", "want", "would", "like", "to", "order",
    "give", "get", "can", "have", "also", "plus",
];

function normalizeText(text: string): string {
    return text.toLowerCase().replace(/[.,!?;:'"]/g, "").replace(/\s+/g, " ").trim();
}

function fuzzyMatch(input: string, target: string): number {
    const inputLower = input.toLowerCase(); const targetLower = target.toLowerCase();
    if (inputLower === targetLower) return 1;
    if (targetLower.includes(inputLower) || inputLower.includes(targetLower)) return 0.8;
    const inputWords = inputLower.split(" "); const targetWords = targetLower.split(" ");
    let matchedWords = 0;
    for (const iw of inputWords) {
        for (const tw of targetWords) {
            if (iw === tw || (iw.length > 3 && tw.startsWith(iw)) || (tw.length > 3 && iw.startsWith(tw))) { matchedWords++; break; }
        }
    }
    return matchedWords / Math.max(inputWords.length, targetWords.length);
}

export function parseVoiceOrder(
    transcript: string,
    menuItems: MenuItem[]
): { items: { menuItem: MenuItem; qty: number }[]; unmatched: string[] } {
    const normalized = normalizeText(transcript);
    const segments = normalized.split(/\b(?:and|aur|or|plus|also|,)\b/).map((s) => s.trim()).filter(Boolean);
    const results: { menuItem: MenuItem; qty: number }[] = [];
    const unmatched: string[] = [];

    for (let segment of segments) {
        const words = segment.split(" ").filter((w) => !stopWords.includes(w));
        segment = words.join(" ");
        if (!segment.trim()) continue;
        let qty = 1;
        const firstWord = words[0];
        if (firstWord && /^\d+$/.test(firstWord)) { qty = parseInt(firstWord); segment = words.slice(1).join(" "); }
        else if (firstWord && numberWords[firstWord] !== undefined) { qty = numberWords[firstWord]; segment = words.slice(1).join(" "); }
        if (!segment.trim()) continue;

        let bestMatch: MenuItem | null = null; let bestScore = 0;
        for (const item of menuItems) {
            const nameScore = fuzzyMatch(segment, item.name);
            if (nameScore > bestScore) { bestScore = nameScore; bestMatch = item; }
            if (item.aliases) {
                for (const alias of item.aliases) {
                    const aliasScore = fuzzyMatch(segment, alias);
                    if (aliasScore > bestScore) { bestScore = aliasScore; bestMatch = item; }
                }
            }
        }
        if (bestMatch && bestScore >= 0.5) {
            const existing = results.find((r) => r.menuItem.id === bestMatch!.id);
            if (existing) existing.qty += qty; else results.push({ menuItem: bestMatch, qty });
        } else { unmatched.push(segment); }
    }
    return { items: results, unmatched };
}

// ─── MENU ENGINEERING MATRIX (BCG-Style) ──────────────────────────
// Classifies items into Stars / Plowhorses / Puzzles / Dogs based on
// popularity (order count) and profitability (margin %).

export type MenuClass = "star" | "plowhorse" | "puzzle" | "dog";

export interface MenuEngineeringItem {
    item: MenuItem;
    orderCount: number;
    marginPct: number;
    revenue: number;
    profit: number;
    classification: MenuClass;
    recommendation: string;
}

export function generateMenuEngineering(
    menuItems: MenuItem[],
    orders: Order[]
): MenuEngineeringItem[] {
    if (menuItems.length === 0) return [];

    // Calculate metrics per item
    const itemMetrics = menuItems.map((item) => {
        const orderCount = getOrderCountForItem(item.id, orders);
        const marginPct = calculateMargin(item);
        const revenue = orderCount * item.price;
        const profit = orderCount * (item.price - item.cost);
        return { item, orderCount, marginPct, revenue, profit };
    });

    // Determine medians for classification
    const sortedByOrders = [...itemMetrics].sort((a, b) => a.orderCount - b.orderCount);
    const sortedByMargin = [...itemMetrics].sort((a, b) => a.marginPct - b.marginPct);
    const medianOrders = sortedByOrders[Math.floor(sortedByOrders.length / 2)]?.orderCount || 0;
    const medianMargin = sortedByMargin[Math.floor(sortedByMargin.length / 2)]?.marginPct || 50;

    return itemMetrics.map((m) => {
        const highPop = m.orderCount >= medianOrders;
        const highMargin = m.marginPct >= medianMargin;

        let classification: MenuClass;
        let recommendation: string;

        if (highPop && highMargin) {
            classification = "star";
            recommendation = "Maintain visibility and pricing. This is a top performer.";
        } else if (highPop && !highMargin) {
            classification = "plowhorse";
            recommendation = "Increase price gradually or reduce food cost. High demand tolerates small price changes.";
        } else if (!highPop && highMargin) {
            classification = "puzzle";
            recommendation = "Promote heavily — place prominently on menu. High margin potential if volume increases.";
        } else {
            classification = "dog";
            recommendation = "Consider removing or completely reworking. Low demand and low profitability.";
        }

        return { ...m, classification, recommendation };
    }).sort((a, b) => b.profit - a.profit);
}

// ─── PEAK HOUR / DAY ANALYSIS ─────────────────────────────────────

export interface TimeSlotAnalysis {
    dayOfWeek: string;
    hourSlot: string;
    orderCount: number;
    revenue: number;
    avgOrderValue: number;
    topItems: { name: string; count: number }[];
}

export function analyzeTimeTrends(orders: Order[]): {
    peakDays: { day: string; orders: number; revenue: number }[];
    peakHours: { hour: string; orders: number; revenue: number }[];
    heatmap: TimeSlotAnalysis[];
} {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayMap = new Map<string, { orders: number; revenue: number }>();
    const hourMap = new Map<string, { orders: number; revenue: number }>();
    const heatmapMap = new Map<string, { orders: Order[] }>();

    for (const order of orders) {
        const d = new Date(order.timestamp);
        const dayName = days[d.getDay()];
        const hour = d.getHours();
        const hourSlot = `${hour.toString().padStart(2, "0")}:00-${(hour + 1).toString().padStart(2, "0")}:00`;

        // Day aggregation
        const dayData = dayMap.get(dayName) || { orders: 0, revenue: 0 };
        dayData.orders++; dayData.revenue += order.total;
        dayMap.set(dayName, dayData);

        // Hour aggregation
        const hourData = hourMap.get(hourSlot) || { orders: 0, revenue: 0 };
        hourData.orders++; hourData.revenue += order.total;
        hourMap.set(hourSlot, hourData);

        // Heatmap
        const key = `${dayName}-${hourSlot}`;
        if (!heatmapMap.has(key)) heatmapMap.set(key, { orders: [] });
        heatmapMap.get(key)!.orders.push(order);
    }

    const peakDays = Array.from(dayMap.entries())
        .map(([day, d]) => ({ day, ...d }))
        .sort((a, b) => b.orders - a.orders);

    const peakHours = Array.from(hourMap.entries())
        .map(([hour, d]) => ({ hour, ...d }))
        .sort((a, b) => b.orders - a.orders);

    const heatmap: TimeSlotAnalysis[] = Array.from(heatmapMap.entries()).map(([key, data]) => {
        const [dayOfWeek, hourSlot] = key.split("-");
        const revenue = data.orders.reduce((s, o) => s + o.total, 0);
        const itemCounts = new Map<string, number>();
        for (const o of data.orders) for (const i of o.items) itemCounts.set(i.name, (itemCounts.get(i.name) || 0) + i.qty);
        const topItems = Array.from(itemCounts.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 3);
        return { dayOfWeek, hourSlot, orderCount: data.orders.length, revenue, avgOrderValue: revenue / data.orders.length, topItems };
    });

    return { peakDays, peakHours, heatmap };
}

// ─── CATEGORY HEALTH SCORING ──────────────────────────────────────

export interface CategoryHealth {
    category: string;
    itemCount: number;
    totalOrders: number;
    totalRevenue: number;
    avgMargin: number;
    healthScore: number;    // 0-100
    grade: "A" | "B" | "C" | "D" | "F";
    issues: string[];
    opportunities: string[];
}

export function analyzeCategoryHealth(
    menuItems: MenuItem[],
    orders: Order[]
): CategoryHealth[] {
    const categories = new Map<string, MenuItem[]>();
    for (const item of menuItems) {
        if (!categories.has(item.category)) categories.set(item.category, []);
        categories.get(item.category)!.push(item);
    }

    const results: CategoryHealth[] = [];
    const totalAllOrders = orders.length;

    for (const [category, items] of categories) {
        const catOrders = items.reduce((s, item) => s + getOrderCountForItem(item.id, orders), 0);
        const catRevenue = items.reduce((s, item) => s + getOrderCountForItem(item.id, orders) * item.price, 0);
        const avgMargin = items.reduce((s, item) => s + calculateMargin(item), 0) / items.length;
        const issues: string[] = [];
        const opportunities: string[] = [];

        // Scoring dimensions (each 0-25, total 0-100)
        const marginScore = Math.min(avgMargin / 60 * 25, 25);                           // Higher margin = better
        const demandScore = Math.min((catOrders / Math.max(totalAllOrders, 1)) * 100, 25); // More orders = better
        const diversityScore = Math.min(items.length / 5 * 25, 25);                       // More items in category = more options
        const profitScore = catRevenue > 0 ? Math.min((catRevenue / Math.max(totalAllOrders * 100, 1)) * 25, 25) : 0;

        const healthScore = Math.round(marginScore + demandScore + diversityScore + profitScore);

        // Identify issues
        if (avgMargin < 40) issues.push(`Low average margin (${avgMargin.toFixed(0)}%). Consider pricing review.`);
        if (catOrders === 0) issues.push(`Zero orders. Category may need promotion or menu changes.`);
        const lowMarginItems = items.filter(i => calculateMargin(i) < 35);
        if (lowMarginItems.length > 0) issues.push(`${lowMarginItems.length} item(s) below 35% margin: ${lowMarginItems.map(i => i.name).join(", ")}`);

        // Identify opportunities
        const highMarginLowDemand = items.filter(i => calculateMargin(i) > 55 && getOrderCountForItem(i.id, orders) < 3);
        if (highMarginLowDemand.length > 0) opportunities.push(`Promote high-margin items: ${highMarginLowDemand.map(i => i.name).join(", ")}`);
        if (items.length < 3) opportunities.push(`Add more items to this category for better customer choice.`);

        const grade: "A" | "B" | "C" | "D" | "F" = healthScore >= 80 ? "A" : healthScore >= 60 ? "B" : healthScore >= 40 ? "C" : healthScore >= 20 ? "D" : "F";

        results.push({ category, itemCount: items.length, totalOrders: catOrders, totalRevenue: catRevenue, avgMargin, healthScore, grade, issues, opportunities });
    }

    return results.sort((a, b) => b.healthScore - a.healthScore);
}

// ─── WASTAGE RISK DETECTION ───────────────────────────────────────

export interface WastageRisk {
    item: MenuItem;
    riskLevel: "high" | "medium" | "low";
    reason: string;
    weeklyOrderEstimate: number;
    costAtRisk: number;  // Estimated wastage cost/week
}

export function detectWastageRisks(
    menuItems: MenuItem[],
    orders: Order[]
): WastageRisk[] {
    const totalWeeks = Math.max(1, orders.length > 0
        ? Math.ceil((Date.now() - new Date(Math.min(...orders.map(o => new Date(o.timestamp).getTime()))).getTime()) / (7 * 24 * 60 * 60 * 1000))
        : 1);

    const risks: WastageRisk[] = [];

    for (const item of menuItems) {
        const orderCount = getOrderCountForItem(item.id, orders);
        const weeklyOrders = orderCount / totalWeeks;

        let riskLevel: "high" | "medium" | "low";
        let reason: string;

        if (weeklyOrders < 1 && item.cost > 50) {
            riskLevel = "high";
            reason = `Only ${orderCount} orders total (${weeklyOrders.toFixed(1)}/week). High food cost (₹${item.cost}) means significant wastage risk from spoiled perishables.`;
        } else if (weeklyOrders < 3 && item.cost > 30) {
            riskLevel = "medium";
            reason = `Low demand (${weeklyOrders.toFixed(1)}/week) with moderate food cost (₹${item.cost}). Consider batch-preparation or ingredient sharing.`;
        } else if (weeklyOrders < 2) {
            riskLevel = "low";
            reason = `Low volume (${weeklyOrders.toFixed(1)}/week) but manageable cost.`;
        } else {
            continue; // No risk
        }

        const costAtRisk = Math.round(item.cost * Math.max(3 - weeklyOrders, 0.5));
        risks.push({ item, riskLevel, reason, weeklyOrderEstimate: Math.round(weeklyOrders * 10) / 10, costAtRisk });
    }

    return risks.sort((a, b) => b.costAtRisk - a.costAtRisk);
}

// ─── PRICE ELASTICITY ESTIMATION ──────────────────────────────────

export interface ElasticityEstimate {
    item: MenuItem;
    currentPrice: number;
    priceFloor: number;       // Minimum viable price (cost + 20%)
    priceCeiling: number;     // Maximum estimated price before demand drops >20%
    elasticityScore: number;  // -3 (very elastic) to +3 (very inelastic)
    elasticityLabel: string;
    maxPriceIncrease: number; // Max safe increase in ₹
    reasoning: string;
}

export function estimatePriceElasticity(
    menuItems: MenuItem[],
    orders: Order[]
): ElasticityEstimate[] {
    const totalOrders = orders.length || 1;

    return menuItems.map((item) => {
        const orderCount = getOrderCountForItem(item.id, orders);
        const orderFreq = orderCount / totalOrders;
        const margin = calculateMargin(item);

        // Elasticity heuristics (no actual price change data, so we estimate)
        // High frequency + necessity → inelastic
        // Low frequency + luxury → elastic
        let elasticityScore = 0;

        // Demand factor: high demand items are more likely inelastic
        if (orderFreq > 0.5) elasticityScore += 2;
        else if (orderFreq > 0.2) elasticityScore += 1;
        else if (orderFreq < 0.05) elasticityScore -= 1;

        // Price point factor: cheaper items are more inelastic (people don't notice small changes)
        if (item.price < 100) elasticityScore += 1;
        else if (item.price > 300) elasticityScore -= 1;

        // Category factor: staples are inelastic, luxuries are elastic
        const stapleCategories = ["Main Course", "Breads", "Rice", "Beverages"];
        const luxuryCategories = ["Desserts", "Premium", "Specials"];
        if (stapleCategories.some(c => item.category.includes(c))) elasticityScore += 1;
        if (luxuryCategories.some(c => item.category.includes(c))) elasticityScore -= 1;

        // Clamp
        elasticityScore = Math.max(-3, Math.min(3, elasticityScore));

        const elasticityLabel = elasticityScore >= 2 ? "Very Inelastic (safe to increase)"
            : elasticityScore >= 1 ? "Inelastic (moderate increase OK)"
                : elasticityScore === 0 ? "Neutral"
                    : elasticityScore >= -1 ? "Elastic (price sensitive)"
                        : "Very Elastic (avoid price increase)";

        const priceFloor = Math.ceil(item.cost * 1.2);
        const maxIncreasePct = elasticityScore >= 2 ? 0.15 : elasticityScore >= 1 ? 0.10 : elasticityScore === 0 ? 0.05 : 0.02;
        const maxPriceIncrease = Math.round(item.price * maxIncreasePct / 5) * 5;
        const priceCeiling = item.price + maxPriceIncrease;

        const reasoning = `Demand: ${orderCount} orders (${(orderFreq * 100).toFixed(0)}% freq). ` +
            `Price: ₹${item.price} (${item.price < 100 ? "low" : item.price < 300 ? "mid" : "high"} range). ` +
            `Category: ${item.category}. Estimated safe increase: ₹${maxPriceIncrease}.`;

        return { item, currentPrice: item.price, priceFloor, priceCeiling, elasticityScore, elasticityLabel, maxPriceIncrease, reasoning };
    }).sort((a, b) => b.elasticityScore - a.elasticityScore);
}

// ─── REVENUE SUMMARY CALCULATOR ───────────────────────────────────

export interface RevenueSummary {
    totalRevenue: number;
    totalProfit: number;
    totalCost: number;
    overallMarginPct: number;
    avgOrderValue: number;
    avgItemsPerOrder: number;
    topRevenueItems: { name: string; revenue: number; orders: number }[];
    topProfitItems: { name: string; profit: number; marginPct: number }[];
    monthlySummary: { month: string; revenue: number; orders: number; avgMargin: number }[];
}

export function calculateRevenueSummary(
    menuItems: MenuItem[],
    orders: Order[]
): RevenueSummary {
    const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
    const totalCost = orders.reduce((s, o) => s + o.totalCost, 0);
    const totalProfit = totalRevenue - totalCost;
    const overallMarginPct = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    const avgOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;
    const avgItemsPerOrder = orders.length > 0 ? orders.reduce((s, o) => s + o.items.reduce((is, i) => is + i.qty, 0), 0) / orders.length : 0;

    // Top revenue items
    const itemRevenue = menuItems.map((item) => {
        const count = getOrderCountForItem(item.id, orders);
        return { name: item.name, revenue: count * item.price, orders: count };
    }).sort((a, b) => b.revenue - a.revenue);

    // Top profit items
    const itemProfit = menuItems.map((item) => {
        const count = getOrderCountForItem(item.id, orders);
        return { name: item.name, profit: count * (item.price - item.cost), marginPct: calculateMargin(item) };
    }).sort((a, b) => b.profit - a.profit);

    // Monthly summary
    const monthMap = new Map<string, { revenue: number; orders: number; margins: number[] }>();
    for (const order of orders) {
        const d = new Date(order.timestamp);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (!monthMap.has(key)) monthMap.set(key, { revenue: 0, orders: 0, margins: [] });
        const m = monthMap.get(key)!;
        m.revenue += order.total;
        m.orders++;
        m.margins.push(order.margin);
    }
    const monthlySummary = Array.from(monthMap.entries())
        .map(([month, d]) => ({ month, revenue: d.revenue, orders: d.orders, avgMargin: d.margins.reduce((s, m) => s + m, 0) / d.margins.length }))
        .sort((a, b) => a.month.localeCompare(b.month));

    return {
        totalRevenue, totalProfit, totalCost, overallMarginPct, avgOrderValue, avgItemsPerOrder,
        topRevenueItems: itemRevenue.slice(0, 5),
        topProfitItems: itemProfit.slice(0, 5),
        monthlySummary,
    };
}

