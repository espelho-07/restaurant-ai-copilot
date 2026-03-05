import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

    const { data: restaurant } = await supabase.from('restaurants').select('id').eq('user_id', user.id).single();
    if (!restaurant) return res.status(404).json({ error: 'Restaurant profile not found' });

    // Fetch all menu items and orders to calculate combo matrix
    const [
        { data: menuItems, error: menuErr },
        { data: orders, error: orderErr }
    ] = await Promise.all([
        supabase.from('menu_items').select('*').eq('restaurant_id', restaurant.id),
        supabase.from('orders').select('order_id, item_name').eq('restaurant_id', restaurant.id)
    ]);

    if (menuErr || orderErr) return res.status(500).json({ error: 'Failed to fetch tracking data' });
    if (!menuItems?.length || !orders?.length) return res.status(200).json({ combinations: [] });

    // Group orders by order_id
    const orderGroups = new Map<string, string[]>();
    for (const o of orders) {
        if (!orderGroups.has(o.order_id)) orderGroups.set(o.order_id, []);
        orderGroups.get(o.order_id)!.push(o.item_name);
    }

    const combinations = new Map<string, { count: number, names: string[] }>();
    const orderCount = orderGroups.size;

    for (const items of orderGroups.values()) {
        const uniqueItems = Array.from(new Set(items)).sort();
        for (let i = 0; i < uniqueItems.length; i++) {
            for (let j = i + 1; j < uniqueItems.length; j++) {
                const key = `${uniqueItems[i]}|${uniqueItems[j]}`;
                if (!combinations.has(key)) {
                    combinations.set(key, { count: 0, names: [uniqueItems[i], uniqueItems[j]] });
                }
                combinations.get(key)!.count += 1;
            }
        }
    }

    const result = Array.from(combinations.values())
        .map(c => {
            const pct = Math.round((c.count / orderCount) * 100);

            // Reconstruct item objects
            const itemObjects = c.names.map(name => {
                const m = menuItems.find(mi => mi.item_name === name);
                return { id: m?.id || name, name: name, price: m?.selling_price || 0, cost: m?.food_cost || 0 };
            });

            const individualTotal = itemObjects.reduce((s, i) => s + i.price, 0);
            const suggestedPrice = Math.max(1, individualTotal - Math.round(individualTotal * 0.15));

            return {
                items: itemObjects,
                coOccurrenceCount: c.count,
                totalOrders: orderCount,
                reason: `These items are frequently ordered together (${pct}% of orders). Bundling them provides perceived value and increases average order volume.`,
                impactLevel: pct > 15 ? "HIGH" : pct > 10 ? "MEDIUM" : "LOW",
                confidence: Math.min(95, 40 + c.count * 5),
                individualTotal,
                suggestedPrice,
                aovIncrease: Math.round(((suggestedPrice - (individualTotal / 2)) / (individualTotal / 2)) * 100),
                estimatedMonthlyImpact: (suggestedPrice - itemObjects.reduce((s, i) => s + i.cost, 0)) * c.count * 4,
                reasoning: [
                    `${c.names.join(" and ")} show a ${pct}% co-occurrence rate.`,
                    `Current combined price is ₹${individualTotal}.`,
                    `A 15% combo discount creates strong customer incentive.`
                ],
                impactedMetrics: ["AOV", "Order Volume", "Customer Retention"]
            };
        })
        .filter(c => c.coOccurrenceCount > 1) // basic threshold
        .sort((a, b) => b.coOccurrenceCount - a.coOccurrenceCount);

    return res.status(200).json(result);
}
