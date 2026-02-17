
import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) process.exit(1);

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSkills() {
    console.log('--- Fetching Skills from "skills" table ---');
    const { data, error } = await supabase.from('skills').select('*');
    if (error) {
        console.error('Error skills:', error.message);
    } else {
        console.log('Skills in "skills":', data);
    }
}

checkSkills();
