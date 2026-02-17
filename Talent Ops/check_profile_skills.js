
import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) process.exit(1);

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProfileSkills() {
    console.log('--- Fetching Skills from profiles ---');
    const { data, error } = await supabase
        .from('profiles')
        .select('technical_scores')
        .limit(1);

    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log('Skills in "profiles":', JSON.stringify(data, null, 2));
    }
}

checkProfileSkills();
