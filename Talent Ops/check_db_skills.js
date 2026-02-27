
import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) process.exit(1);

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSkills() {
    console.log('--- Fetching Skills from skills_master ---');
    const { data, error } = await supabase
        .from('skills_master')
        .select('*');

    if (error) {
        console.error('Error:', error.message);
        // Try fallback table names if skills_master doesn't exist
        console.log('Trying "skills" table...');
        const { data: data2, error: error2 } = await supabase.from('skills').select('*');
        if (error2) console.error('Error skills:', error2.message);
        else console.log('Skills in "skills":', data2);
    } else {
        console.log('Skills in "skills_master":', data);
    }
}

checkSkills();
