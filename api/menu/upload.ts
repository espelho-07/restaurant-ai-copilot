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

    const items = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'Expected array of items' });

    const formatted = items.map((i: any) => ({
        restaurant_id: restaurant.id,
        item_name: i.name || i.item_name,
        category: i.category,
        selling_price: i.price || i.selling_price,
        food_cost: i.cost || i.food_cost
    }));

    const { data, error } = await supabase.from('menu_items').insert(formatted).select();
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json(data);
}
