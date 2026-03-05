import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTests() {
    console.log("=== SUPABASE DATABASE AUDIT ===");

    // Try direct insert assuming RLS is disabled as per our SQL script
    console.log("-> Testing insert into 'restaurants' using Anon Key...");
    const fakeId = "00000000-0000-0000-0000-000000000000";

    const { data: menuData, error: menuErr } = await supabase.from('menu_items').select('*').limit(1);

    if (menuErr) {
        if (menuErr.code === '42P01') {
            console.error("\n❌ ERROR: Database tables do not exist! The SQL script 'supabase_schema.sql' has NOT been executed on the Supabase project.");
        } else {
            console.error("\n❌ Database query error:", menuErr.message);
        }
    } else {
        console.log("\✅ 'menu_items' table is accessible. RLS policies allow read.");
    }

    const { data: restData, error: restErr } = await supabase.from('restaurants').select('*').limit(1);
    if (restErr) {
        console.error("\n❌ Database query error on restaurants:", restErr.message);
    } else {
        console.log("\✅ 'restaurants' table is accessible. Records found:", restData?.length);
    }
}
runTests();
