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

    const { items, channel } = req.body; // { items: [{ name, qty }], channel: 'OFFLINE' }
    if (!Array.isArray(items)) return res.status(400).json({ error: 'Expected array of items in cart' });

    const orderId = `SIM-${Date.now()}`;
    const timestamp = new Date().toISOString();

    const formatted = items.map((i: any) => ({
        restaurant_id: restaurant.id,
        order_id: orderId,
        item_name: i.name,
        quantity: i.qty,
        channel: channel || 'OFFLINE',
        timestamp: timestamp
    }));

    const { data, error } = await supabase.from('orders').insert(formatted).select();
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ order_id: orderId, items: data });
}
