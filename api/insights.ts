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

    if (!menuItems) return res.status(200).json({ menuItems: [], insights: [] });

    // Core metrics
    const totalRevenue = orders?.reduce((sum, o) => {
        const mi = menuItems.find(m => m.item_name === o.item_name);
        return sum + ((mi?.selling_price || 0) * o.quantity);
    }, 0) || 0;

    const orderCount = new Set(orders?.map(o => o.order_id)).size || 0;
    const aov = orderCount > 0 ? totalRevenue / orderCount : 0;

    // Generate basic insights mapping what a frontend would need
    const itemStats = menuItems.map(item => {
        const itemOrders = orders?.filter(o => o.item_name === item.item_name) || [];
        const count = itemOrders.reduce((sum, o) => sum + o.quantity, 0);
        const offlineMargin = item.selling_price > 0
            ? ((item.selling_price - item.food_cost) / item.selling_price) * 100
            : 0;

        // Check specific online channel profitability (assuming Zomato as proxy if exists)
        const zomato = channels?.find(c => c.name === 'ZOMATO');
        let onlineMargin = offlineMargin;
        let isRisk = false;

        if (zomato && zomato.commission_percentage > 0) {
            const commissionVal = item.selling_price * (zomato.commission_percentage / 100);
            onlineMargin = ((item.selling_price - commissionVal - item.food_cost) / item.selling_price) * 100;
            if (onlineMargin < 20) isRisk = true;
        }

        return {
            item_name: item.item_name,
            orders: count,
            offlineMargin,
            onlineMargin,
            isRisk,
            isHiddenStar: offlineMargin > 60 && count > 0 && count < (orders?.length || 0) / menuItems.length
        };
    });

    const hiddenStars = itemStats.filter(i => i.isHiddenStar);
    const riskItems = itemStats.filter(i => i.isRisk);
    const topSellers = [...itemStats].sort((a, b) => b.orders - a.orders).slice(0, 3);

    return res.status(200).json({
        metrics: { totalRevenue, orderCount, aov },
        insights: {
            hiddenStars,
            riskItems,
            topSellers
        },
        itemStats
    });
}
