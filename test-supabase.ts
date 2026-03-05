import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing env vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTests() {
    console.log("=== STARTING SUPABASE E2E TESTS ===");

    // 1. Auth Test
    console.log("-> Testing Auth (Signup & Login)...");
    const testEmail = `demo_audit_${Date.now()}@gmail.com`;
    const testPassword = "testpassword123!";

    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: testEmail,
        password: testPassword
    });

    if (signUpErr) {
        console.error("Auth Error:", signUpErr.message);
        process.exit(1);
    }
    console.log("Sign up successful. User ID:", signUpData.user?.id);

    // Since we created a trigger in SQL, it might have failed if SQL wasn't run. Let's check restaurants table length.
    console.log("-> Checking Database Tables...");
    const { data: restData, error: restErr } = await supabase.from('restaurants').select('*').eq('user_id', signUpData.user?.id);

    if (restErr) {
        if (restErr.code === '42P01') {
            console.error("\n❌ ERROR: Database tables do not exist! The SQL script 'supabase_schema.sql' has NOT been executed on the Supabase project.");
        } else {
            console.error("Database query error:", restErr.message);
        }
    } else {
        console.log("Restaurants table is accessible.");
        if (restData && restData.length > 0) {
            console.log("Trigger worked! Restaurant profile auto-created:", restData[0].id);
        } else {
            console.log("Trigger did NOT run. The 'handle_new_user' trigger was either not created or failed.");
        }
    }

    console.log("\n-> Testing Data Insert to Menu Items...");
    const { error: insertErr } = await supabase.from('menu_items').insert({
        restaurant_id: restData?.[0]?.id || '00000000-0000-0000-0000-000000000000',
        item_name: "Test Audit Item",
        category: "Audit",
        selling_price: 100,
        food_cost: 40
    });

    if (insertErr) {
        console.error("Insert failed (expected if tables missing or invalid IDs):", insertErr.message);
    }

    // Cleanup Auth
    // We can't delete user easily via client API without admin rights, but it's just a test project
    console.log("=== TESTS FINISHED ===");
}

runTests();
