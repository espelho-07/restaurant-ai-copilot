// AI Revenue Intelligence Engine
// Pure functions that analyze restaurant POS data and generate insights

import type {
    MenuItem,
    Order,
    PriceRecommendation,
    ComboRecommendation,
    AIInsight,
} from "./types";

// ─── PRICE OPTIMIZATION ENGINE ────────────────────────────────────

export function calculateMargin(item: MenuItem): number {
    return ((item.price - item.cost) / item.price) * 100;
}

export function getOrderCountForItem(itemId: number, orders: Order[]): number {
    return orders.reduce((count, order) => {
        const found = order.items.find((oi) => oi.menuItemId === itemId);
        return count + (found ? found.qty : 0);
    }, 0);
}

export function generatePriceRecommendations(
    menuItems: MenuItem[],
    orders: Order[]
): PriceRecommendation[] {
    const totalOrders = orders.length || 1;
    const recommendations: PriceRecommendation[] = [];

    for (const item of menuItems) {
        const margin = calculateMargin(item);
        const orderCount = getOrderCountForItem(item.id, orders);
        const orderFreq = orderCount / totalOrders;

        // Classify demand level
        const demandLevel: "high" | "medium" | "low" =
            orderFreq > 0.5 ? "high" : orderFreq > 0.2 ? "medium" : "low";

        // Classify margin level
        const marginLevel: "high" | "medium" | "low" =
            margin > 60 ? "high" : margin > 40 ? "medium" : "low";

        let suggestedPrice = item.price;
        let reason = "";
        let estimatedRevenueChange = 0;

        if (demandLevel === "high" && marginLevel === "low") {
            // High demand, low margin → increase price
            const increase = Math.round(item.price * 0.12);
            suggestedPrice = item.price + increase;
            reason = `High demand (${orderCount} orders) but low margin (${margin.toFixed(0)}%). A 12% price increase is unlikely to reduce demand and will significantly improve profitability.`;
            estimatedRevenueChange = 12;
        } else if (demandLevel === "high" && marginLevel === "medium") {
            // High demand, medium margin → slight increase
            const increase = Math.round(item.price * 0.07);
            suggestedPrice = item.price + increase;
            reason = `Strong demand supports a modest 7% price increase without affecting order volume. Current margin of ${margin.toFixed(0)}% can be improved.`;
            estimatedRevenueChange = 7;
        } else if (demandLevel === "low" && marginLevel === "high") {
            // Low demand, high margin → promote or slight discount
            const discount = Math.round(item.price * 0.05);
            suggestedPrice = item.price - discount;
            reason = `Hidden Star: ${margin.toFixed(0)}% margin but only ${orderCount} orders. A 5% promotional discount can boost visibility and volume while maintaining strong margins.`;
            estimatedRevenueChange = 15; // volume increase offsets discount
        } else if (demandLevel === "low" && marginLevel === "low") {
            // Low demand, low margin → reprice or replace
            const increase = Math.round(item.price * 0.15);
            suggestedPrice = item.price + increase;
            reason = `Poor performer: low demand (${orderCount} orders) and low margin (${margin.toFixed(0)}%). Either increase price by 15% or consider replacing this item.`;
            estimatedRevenueChange = -5; // might lose some orders
        } else {
            // Balanced items → no change
            suggestedPrice = item.price;
            reason = `Currently well-optimized. ${margin.toFixed(0)}% margin with ${orderCount} orders shows healthy performance.`;
            estimatedRevenueChange = 0;
        }

        // Round to nearest ₹5
        suggestedPrice = Math.round(suggestedPrice / 5) * 5;

        recommendations.push({
            menuItem: item,
            currentPrice: item.price,
            suggestedPrice,
            reason,
            estimatedRevenueChange,
            demandLevel,
            marginLevel,
            orderCount,
        });
    }

    // Sort by absolute revenue change potential (highest first)
    return recommendations.sort(
        (a, b) => Math.abs(b.estimatedRevenueChange) - Math.abs(a.estimatedRevenueChange)
    );
}

// ─── CO-OCCURRENCE / ASSOCIATION ANALYSIS ─────────────────────────

interface CoOccurrence {
    itemA: number;
    itemB: number;
    count: number;
}

function buildCoOccurrenceMatrix(orders: Order[]): CoOccurrence[] {
    const matrix: Map<string, number> = new Map();

    for (const order of orders) {
        const uniqueItems = Array.from(new Set(order.items.map((i) => i.menuItemId)));
        // Generate all pairs
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
    if (orders.length < 2) {
        // Not enough data — return seed combos based on category logic
        return generateSeedCombos(menuItems);
    }

    const coOccurrences = buildCoOccurrenceMatrix(orders);
    const totalOrders = orders.length;

    // Sort by frequency
    const sorted = coOccurrences.sort((a, b) => b.count - a.count);

    const combos: ComboRecommendation[] = [];
    const usedPairs = new Set<string>();

    for (const pair of sorted.slice(0, 8)) {
        const key = `${pair.itemA}-${pair.itemB}`;
        if (usedPairs.has(key)) continue;
        usedPairs.add(key);

        const itemA = menuItems.find((m) => m.id === pair.itemA);
        const itemB = menuItems.find((m) => m.id === pair.itemB);
        if (!itemA || !itemB) continue;

        // Try to find a third item that pairs well with either
        const thirdItem = findThirdItem(pair.itemA, pair.itemB, sorted, menuItems, usedPairs);

        const comboItems = thirdItem ? [itemA, itemB, thirdItem] : [itemA, itemB];
        const individualTotal = comboItems.reduce((s, i) => s + i.price, 0);
        const discount = Math.round(individualTotal * 0.1); // 10% combo discount
        const suggestedPrice = individualTotal - discount;
        const confidence = Math.round((pair.count / totalOrders) * 100);

        combos.push({
            items: comboItems,
            coOccurrenceCount: pair.count,
            totalOrders,
            confidence: Math.min(confidence, 95),
            suggestedPrice,
            individualTotal,
            aovIncrease: Math.round((discount / (individualTotal - discount)) * 100),
            reason: `Ordered together in ${pair.count} out of ${totalOrders} orders (${confidence}% co-occurrence). Bundling at ₹${suggestedPrice} creates a ${Math.round(((individualTotal - suggestedPrice) / individualTotal) * 100)}% perceived discount.`,
        });
    }

    // If we got data-driven combos, return them; otherwise fall back to seed
    return combos.length > 0 ? combos.slice(0, 4) : generateSeedCombos(menuItems);
}

function findThirdItem(
    idA: number,
    idB: number,
    coOccurrences: CoOccurrence[],
    menuItems: MenuItem[],
    usedPairs: Set<string>
): MenuItem | null {
    // Find items that pair with both A and B
    const pairsWithA = coOccurrences.filter(
        (p) => (p.itemA === idA || p.itemB === idA) && p.itemA !== idB && p.itemB !== idB
    );
    const pairsWithB = coOccurrences.filter(
        (p) => (p.itemA === idB || p.itemB === idB) && p.itemA !== idA && p.itemB !== idA
    );

    const candidates = new Map<number, number>();
    for (const p of pairsWithA) {
        const otherId = p.itemA === idA ? p.itemB : p.itemA;
        candidates.set(otherId, (candidates.get(otherId) || 0) + p.count);
    }
    for (const p of pairsWithB) {
        const otherId = p.itemA === idB ? p.itemB : p.itemA;
        candidates.set(otherId, (candidates.get(otherId) || 0) + p.count);
    }

    // Pick the best candidate
    let bestId = -1;
    let bestScore = 0;
    for (const [id, score] of candidates) {
        if (score > bestScore) {
            bestScore = score;
            bestId = id;
        }
    }

    return bestId > 0 ? menuItems.find((m) => m.id === bestId) || null : null;
}

function generateSeedCombos(menuItems: MenuItem[]): ComboRecommendation[] {
    // Intelligent seed combos based on category diversity + margin
    const byCategory = new Map<string, MenuItem[]>();
    for (const item of menuItems) {
        if (!byCategory.has(item.category)) byCategory.set(item.category, []);
        byCategory.get(item.category)!.push(item);
    }

    const combos: ComboRecommendation[] = [];
    const categories = Array.from(byCategory.keys());

    // Create cross-category combos
    if (categories.length >= 2) {
        const mainItems = menuItems.filter(
            (i) => i.category === "Main Course" || i.category === "Fast Food"
        );
        const sides = menuItems.filter(
            (i) => i.category === "Snacks" || i.category === "Starters" || i.category === "Breads"
        );
        const drinks = menuItems.filter(
            (i) => i.category === "Beverages" || i.category === "Desserts"
        );

        for (let i = 0; i < Math.min(mainItems.length, 4); i++) {
            const main = mainItems[i];
            const side = sides[i % sides.length];
            const drink = drinks[i % drinks.length];
            if (!main || !side || !drink) continue;
            if (main.id === side?.id || main.id === drink?.id || side?.id === drink?.id) continue;

            const items = [main, side, drink];
            const individualTotal = items.reduce((s, it) => s + it.price, 0);
            const suggestedPrice = Math.round((individualTotal * 0.88) / 5) * 5;

            combos.push({
                items,
                coOccurrenceCount: 0,
                totalOrders: 0,
                confidence: 75 + Math.floor(Math.random() * 15),
                suggestedPrice,
                individualTotal,
                aovIncrease: Math.round(
                    ((individualTotal - suggestedPrice) / suggestedPrice) * 100
                ),
                reason: `Category-diverse combo combining ${main.category} + ${side.category} + ${drink.category}. Cross-category bundles historically increase AOV by 15-22%.`,
            });
        }
    }

    return combos.slice(0, 4);
}

// ─── DYNAMIC AI INSIGHTS GENERATOR ────────────────────────────────

export function generateDashboardInsights(
    menuItems: MenuItem[],
    orders: Order[]
): AIInsight[] {
    const insights: AIInsight[] = [];
    const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
    const totalOrders = orders.length;

    // 1. Hidden Stars — high margin, low orders
    for (const item of menuItems) {
        const margin = calculateMargin(item);
        const orderCount = getOrderCountForItem(item.id, orders);
        const avgOrders =
            menuItems.reduce((s, m) => s + getOrderCountForItem(m.id, orders), 0) /
            (menuItems.length || 1);

        if (margin > 55 && orderCount < avgOrders * 0.7) {
            insights.push({
                type: "opportunity",
                title: `Hidden Star: ${item.name}`,
                description: `${item.name} has a ${margin.toFixed(0)}% margin but only ${orderCount} orders (${Math.round((orderCount / (avgOrders || 1)) * 100)}% of average). Promoting it as a combo could increase revenue by ₹${Math.round(item.price * 0.15 * (avgOrders - orderCount))}/week.`,
                impact: `+₹${Math.round(item.price * 0.15 * Math.max(avgOrders - orderCount, 5))}/week`,
                priority: "high",
            });
        }
    }

    // 2. Low margin warnings
    for (const item of menuItems) {
        const margin = calculateMargin(item);
        const orderCount = getOrderCountForItem(item.id, orders);

        if (margin < 40 && orderCount > 0) {
            insights.push({
                type: "warning",
                title: `Low Margin Alert: ${item.name}`,
                description: `${item.name} has only ${margin.toFixed(0)}% margin with ${orderCount} orders. Each sale contributes just ₹${(item.price - item.cost).toFixed(0)} profit. Consider renegotiating supplier costs or increasing price.`,
                impact: `₹${(item.price - item.cost).toFixed(0)}/order profit`,
                priority: margin < 35 ? "high" : "medium",
            });
        }
    }

    // 3. Weekend vs weekday pattern (if we have date data)
    const weekendOrders = orders.filter((o) => {
        const day = new Date(o.timestamp).getDay();
        return day === 0 || day === 6;
    });
    const weekdayOrders = orders.filter((o) => {
        const day = new Date(o.timestamp).getDay();
        return day >= 1 && day <= 5;
    });

    if (weekendOrders.length > 0 && weekdayOrders.length > 0) {
        const weekendAvg = weekendOrders.reduce((s, o) => s + o.total, 0) / weekendOrders.length;
        const weekdayAvg = weekdayOrders.reduce((s, o) => s + o.total, 0) / weekdayOrders.length;
        const diff = ((weekendAvg - weekdayAvg) / weekdayAvg) * 100;

        if (Math.abs(diff) > 10) {
            insights.push({
                type: "insight",
                title: diff > 0 ? "Weekend Revenue Spike" : "Weekday Opportunity",
                description:
                    diff > 0
                        ? `Weekend orders average ₹${Math.round(weekendAvg)} vs weekday ₹${Math.round(weekdayAvg)} (+${Math.round(diff)}%). Consider premium weekend-exclusive items to maximize this trend.`
                        : `Weekday orders outperform weekends. Consider weekend promotions to balance demand.`,
                priority: "medium",
            });
        }
    }

    // 4. Top concentration risk
    if (totalOrders > 3) {
        const itemRevenue = menuItems.map((item) => ({
            name: item.name,
            revenue: orders.reduce((s, o) => {
                const oi = o.items.find((i) => i.menuItemId === item.id);
                return s + (oi ? oi.price * oi.qty : 0);
            }, 0),
        }));
        itemRevenue.sort((a, b) => b.revenue - a.revenue);
        const top3Revenue = itemRevenue.slice(0, 3).reduce((s, i) => s + i.revenue, 0);
        const top3Pct = totalRevenue > 0 ? (top3Revenue / totalRevenue) * 100 : 0;

        if (top3Pct > 50) {
            insights.push({
                type: "warning",
                title: "Revenue Concentration Risk",
                description: `Top 3 items (${itemRevenue.slice(0, 3).map((i) => i.name).join(", ")}) contribute ${Math.round(top3Pct)}% of revenue. Diversify promotions to reduce dependency.`,
                priority: "medium",
            });
        }
    }

    // 5. AOV insight
    if (totalOrders > 0) {
        const aov = totalRevenue / totalOrders;
        insights.push({
            type: "forecast",
            title: "Revenue Forecast",
            description: `Current AOV is ₹${Math.round(aov)}. Implementing combo recommendations could increase AOV by 15-22%, generating an estimated additional ₹${Math.round(aov * 0.18 * totalOrders)}/month.`,
            impact: `+₹${Math.round(aov * 0.18 * totalOrders)}/month potential`,
            priority: "high",
        });
    }

    // Always include at least a few default insights
    if (insights.length < 3) {
        insights.push({
            type: "insight",
            title: "Category Balance",
            description: "Analyze menu distribution across categories. A healthy menu has no single category exceeding 40% of total items.",
            priority: "low",
        });
    }

    return insights.sort((a, b) => {
        const prio = { high: 0, medium: 1, low: 2 };
        return prio[a.priority] - prio[b.priority];
    });
}

// ─── VOICE ORDER NLP PARSER ───────────────────────────────────────

// Number word mapping (English + Hindi)
const numberWords: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    ek: 1, do: 2, teen: 3, char: 4, paanch: 5, cheh: 6, saat: 7, aath: 8, nau: 9, das: 10,
    a: 1, an: 1,
};

// Hindi connecting words to strip
const stopWords = [
    "aur", "and", "or", "please", "bhai", "yaar", "dena", "de", "do",
    "chahiye", "lao", "laga", "lagao", "with", "mein", "me", "ka", "ke", "ki",
    "mujhe", "hume", "humko", "i", "want", "would", "like", "to", "order",
    "give", "get", "can", "have", "also", "plus",
];

function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .replace(/[.,!?;:'"]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function fuzzyMatch(input: string, target: string): number {
    const inputLower = input.toLowerCase();
    const targetLower = target.toLowerCase();

    if (inputLower === targetLower) return 1;
    if (targetLower.includes(inputLower) || inputLower.includes(targetLower)) return 0.8;

    // Check each word of input against target
    const inputWords = inputLower.split(" ");
    const targetWords = targetLower.split(" ");

    let matchedWords = 0;
    for (const iw of inputWords) {
        for (const tw of targetWords) {
            if (iw === tw || (iw.length > 3 && tw.startsWith(iw)) || (tw.length > 3 && iw.startsWith(tw))) {
                matchedWords++;
                break;
            }
        }
    }

    return matchedWords / Math.max(inputWords.length, targetWords.length);
}

export function parseVoiceOrder(
    transcript: string,
    menuItems: MenuItem[]
): { items: { menuItem: MenuItem; qty: number }[]; unmatched: string[] } {
    const normalized = normalizeText(transcript);

    // Split by common delimiters
    const segments = normalized
        .split(/\b(?:and|aur|or|plus|also|,)\b/)
        .map((s) => s.trim())
        .filter(Boolean);

    const results: { menuItem: MenuItem; qty: number }[] = [];
    const unmatched: string[] = [];

    for (let segment of segments) {
        // Remove stop words
        const words = segment.split(" ").filter((w) => !stopWords.includes(w));
        segment = words.join(" ");

        if (!segment.trim()) continue;

        // Extract quantity
        let qty = 1;
        const firstWord = words[0];

        // Check for number
        if (firstWord && /^\d+$/.test(firstWord)) {
            qty = parseInt(firstWord);
            segment = words.slice(1).join(" ");
        } else if (firstWord && numberWords[firstWord] !== undefined) {
            qty = numberWords[firstWord];
            segment = words.slice(1).join(" ");
        }

        if (!segment.trim()) continue;

        // Match against menu items (including aliases)
        let bestMatch: MenuItem | null = null;
        let bestScore = 0;

        for (const item of menuItems) {
            // Check main name
            const nameScore = fuzzyMatch(segment, item.name);
            if (nameScore > bestScore) {
                bestScore = nameScore;
                bestMatch = item;
            }

            // Check aliases (Hindi names)
            if (item.aliases) {
                for (const alias of item.aliases) {
                    const aliasScore = fuzzyMatch(segment, alias);
                    if (aliasScore > bestScore) {
                        bestScore = aliasScore;
                        bestMatch = item;
                    }
                }
            }
        }

        if (bestMatch && bestScore >= 0.5) {
            // Check if this item already exists in results
            const existing = results.find((r) => r.menuItem.id === bestMatch!.id);
            if (existing) {
                existing.qty += qty;
            } else {
                results.push({ menuItem: bestMatch, qty });
            }
        } else {
            unmatched.push(segment);
        }
    }

    return { items: results, unmatched };
}
