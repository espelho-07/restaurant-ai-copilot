import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

    const { data: restaurant } = await supabase.from('restaurants').select('id').eq('user_id', user.id).single();
    if (!restaurant) return res.status(404).json({ error: 'Restaurant profile not found' });

    if (req.method === 'GET') {
        const { data: channels, error } = await supabase.from('channels').select('*').eq('restaurant_id', restaurant.id);
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json(channels);
    }

    if (req.method === 'POST') {
        const { name, commission_percentage } = req.body;

        // Upsert channel
        const { data, error } = await supabase.from('channels').upsert({
            restaurant_id: restaurant.id,
            name: name,
            commission_percentage: commission_percentage
        }, { onConflict: 'restaurant_id,name' }).select().single();

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json(data);
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
