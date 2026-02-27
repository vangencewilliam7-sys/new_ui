
import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) process.exit(1);

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkReviewSkills() {
    console.log('--- Fetching Skills from employee_reviews ---');
    const { data, error } = await supabase
        .from('employee_reviews')
        .select('development_skills, manager_development_skills')
        .limit(5);

    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log('Skills in "employee_reviews":', JSON.stringify(data, null, 2));
    }
}

checkReviewSkills();
