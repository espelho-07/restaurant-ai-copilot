import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

    const { data: restaurant } = await supabase.from('restaurants').select('id').eq('user_id', user.id).single();
    if (!restaurant) return res.status(404).json({ error: 'Restaurant profile not found' });

    const orders = req.body;
    if (!Array.isArray(orders)) return res.status(400).json({ error: 'Expected array of orders' });

    // Body expects array of { order_id, item_name, quantity, channel, timestamp }
    const formatted = orders.map((o: any) => ({
        restaurant_id: restaurant.id,
        order_id: o.order_id || o.id,
        item_name: o.name || o.item_name,
        quantity: o.qty || o.quantity,
        channel: o.channel || 'OFFLINE',
        timestamp: o.timestamp || new Date().toISOString()
    }));

    const { data, error } = await supabase.from('orders').insert(formatted).select();
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ count: data?.length || 0 });
}
