import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    console.log("Checking restaurants...");
    const { data: res, error: e1 } = await supabase.from('restaurants').select('*').limit(1);
    console.log(e1 ? `Error: ${e1.message}` : `Success! Found ${res?.length} restaurants`);
    if (res?.length) {
        const r_id = res[0].id;
        console.log(`Using restaurant_id: ${r_id}`);
        
        console.log("Checking orders...");
        const { data: orders, error: e2 } = await supabase.from('orders').select('*').eq('restaurant_id', r_id).limit(2);
        console.log(e2 ? `Order Error: ${e2.message}` : `Orders: ${JSON.stringify(orders, null, 2)}`);

        console.log("Checking menu...");
        const { data: menu, error: e3 } = await supabase.from('menu_items').select('id,item_name,selling_price,food_cost').eq('restaurant_id', r_id).limit(2);
        console.log(e3 ? `Menu Error: ${e3.message}` : `Menu: ${JSON.stringify(menu, null, 2)}`);
    }
}

test();
