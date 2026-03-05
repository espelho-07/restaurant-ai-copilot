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

    const [
        { data: menuItems },
        { data: orders },
        { data: channels }
    ] = await Promise.all([
        supabase.from('menu_items').select('*').eq('restaurant_id', restaurant.id),
        supabase.from('orders').select('*').eq('restaurant_id', restaurant.id),
        supabase.from('channels').select('*').eq('restaurant_id', restaurant.id)
    ]);

    if (!menuItems || !orders) return res.status(200).json([]);

    const recommendations = menuItems.map(item => {
        const itemOrders = orders.filter(o => o.item_name === item.item_name);
        const count = itemOrders.reduce((s, o) => s + o.quantity, 0);

        let suggestedPrice = item.selling_price;
        let suggestedOnlinePrice = item.selling_price;
        let reason = "Price is optimal.";
        let impactLevel = "LOW";

        const offlineMargin = ((item.selling_price - item.food_cost) / item.selling_price) * 100;

        // Check highest commission channel
        const highestCommission = channels?.reduce((max, c) => Math.max(max, c.commission_percentage), 0) || 0;
        const onlineMargin = ((item.selling_price - (item.selling_price * (highestCommission / 100)) - item.food_cost) / item.selling_price) * 100;

        if (onlineMargin < 20 && highestCommission > 0) {
            // Need higher online price
            suggestedOnlinePrice = Math.ceil(item.food_cost / (1 - 0.3 - (highestCommission / 100)));
            reason = `Online margin is critical (${onlineMargin.toFixed(0)}%). Increase online price to ₹${suggestedOnlinePrice} to maintain 30% margin after ${highestCommission}% commission.`;
            impactLevel = "HIGH";
        }

        if (offlineMargin < 40) {
            suggestedPrice = Math.ceil(item.food_cost / (1 - 0.5)); // Target 50%
            if (reason === "Price is optimal.") {
                reason = `Offline margin is low (${offlineMargin.toFixed(0)}%).`;
                impactLevel = "MEDIUM";
            }
        } else if (offlineMargin > 70 && count < (orders.length / menuItems.length) * 0.5) {
            reason = `High margin but low volume. Consider minor discount or combo promotion.`;
            impactLevel = "MEDIUM";
        }

        const demandLevel = count > (orders.length / menuItems.length) ? "high" : count > 0 ? "medium" : "low";
        const marginLevel = offlineMargin > 50 ? "high" : offlineMargin > 30 ? "medium" : "low";

        return {
            menuItem: { id: item.id, name: item.item_name, price: item.selling_price, cost: item.food_cost, category: item.category },
            currentPrice: item.selling_price,
            suggestedPrice,
            suggestedOnlinePrice,
            reason,
            impactLevel,
            demandLevel,
            marginLevel,
            confidence: Math.min(95, 40 + (count * 2)), // Naive confidence
            estimatedMonthlyImpact: (suggestedPrice - item.selling_price) * count * 4,
            estimatedRevenueChange: Math.round(((suggestedPrice - item.selling_price) / item.selling_price) * 100) || 0,
            reasoning: [
                `Current offline margin is ${offlineMargin.toFixed(0)}%`,
                `Volume is currently ${count} orders per month`,
                reason
            ],
            impactedMetrics: ["Unit Economics", "Profit Margin"]
        };
    });

    return res.status(200).json(recommendations.filter(r => r.suggestedPrice !== r.currentPrice || r.suggestedOnlinePrice !== r.currentPrice || r.impactLevel !== "LOW"));
}
