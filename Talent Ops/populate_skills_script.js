import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY; // Using Anon key might fail RLS on delete/insert if policies are strict.
// But usually for reset scripts we might need service role key or assume anon has access (often true for dev).
// Let's try with Anon key first. If fails, I might need service role key if available in .env (but user didn't provide it).
// Wait, user provided .env content? No.
// I will assume Anon key has access or policies allow insert for authenticated user?
// Ah, `skills_master` is usually read-only for employees.
// I might need to run this as a "system" user or admin.
// BUT I don't have the service role key.
// Let's hope RLS allows insert for anon or I can get a token.
// Alternatively, I can provide the SQL to the user to run in dashboard if this fails.

const supabase = createClient(supabaseUrl, supabaseKey);

async function populate() {
    console.log('Resetting skills_master...');

    // 1. Delete all (might fail if RLS prevents delete)
    const { error: delError } = await supabase.from('skills_master').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Hack to delete all
    if (delError) console.error('Delete Error:', delError);

    const skills = [
        { skill_name: 'TypeScript', category: 'engineering' },
        { skill_name: 'Node.js', category: 'engineering' },
        { skill_name: 'SQL', category: 'engineering' },
        { skill_name: 'Databases', category: 'engineering' },
        { skill_name: 'React', category: 'engineering' },
        { skill_name: 'Python', category: 'engineering' },
        { skill_name: 'Non-popular LLMs', category: 'ai_ml' },
        { skill_name: 'Prompt Engineering', category: 'ai_ml' },
        { skill_name: 'RAG', category: 'ai_ml' }
    ];

    const { data, error } = await supabase.from('skills_master').insert(skills).select();

    if (error) {
        console.error('Insert Error:', error);
    } else {
        console.log('Successfully inserted skills:', data.length);
        console.log(JSON.stringify(data, null, 2));
    }
}

populate();
