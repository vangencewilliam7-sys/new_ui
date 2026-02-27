import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    const { data, error } = await supabase.rpc('get_table_schema', { table_name_param: 'tasks' });
    if (error) {
        // Fallback if no RPC
        console.error('RPC Error, trying direct query (which might fail due to perms):', error);
    } else {
        console.log(data);
    }
}
// Actually, creating a simpler SQL query to run directly might be easier if I can't use RPC.
// Let's just create a function to list columns.
