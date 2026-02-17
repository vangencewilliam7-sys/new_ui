import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) process.exit(1);

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConfig() {
    console.log('--- Inspecting Database Triggers ---');
    const { data, error } = await supabase.rpc('get_debug_info');
    if (error) {
        console.error('RPC Error:', error);
    } else {
        console.log('--- Found Triggers ---');
        data.forEach(t => {
            console.log(`Table: ${t.table_name} | Trigger: ${t.trigger_name}`);
            console.log(`Action: ${t.definition}`);
            console.log('');
        });
    }

    // Also verify allocated_hours column definition if possible
    // We can't access column constraints via RPC easily unless we add that to the function.
}

checkConfig();
