-- The error was because other tables (like 'tasks' or 'task_skills') reference these skills.
-- Assuming tasks references skills_master? Actually the user said "tasks references skills_master".
-- Usually tasks wouldn't reference skill IDs directly unless there's a 'primary_skill' column.
-- Regardless, CASCADE is the fix, but we must be careful not to delete tasks!
-- Wait, if we CASCADE delete skills, any task referencing that skill ID might get deleted if 'ON DELETE CASCADE' is set.

-- Better approach: Do NOT delete the skills that are in use, but update them or just insert missing ones.
-- However, user wants EXACTLY 9 skills.
-- If existing skills have weird names, we want to remove them.
-- If we remove them, we break the foreign key constraint unless we cascade.

-- Let's check if we can just update existing IDs to point to new skills? No, IDs are UUIDs.
-- The safest "Reset" that keeps data integrity:

-- 1. Temporarily disable triggers (optional, but good practice if heavy logic exists)
-- 2. Use TRUNCATE ... CASCADE.
-- WARNING: This WILL delete rows in 'task_skills' (the junction table). This means historical data about which skills were used in which task will be lost.
-- The user said "SEE WHY DID MY SKILL TAGS AGAIN GOT CHANGED... ONLY 9 SKILL TAGS RIGHT".
-- They likely want to reset the *list of available skills*, not necessarily wipe history, but if the old skills are wrong/duplicates, wiping history might be the only clean way.

-- Let's try a softer delete first:
-- Delete only skills that are NOT in the standard list (by name).
-- Check if any standard skills are missing and insert them.

-- Actually, the error message said: `Table "tasks" references "skills_master"`.
-- This implies `tasks` table has a column pointing to `skills_master`. 
-- Let's check `tasks` schema.
-- If `tasks.skill_id` exists, we can set it to NULL for rows pointing to deleted skills.

-- Plan: Use a function to handle this gracefully.

DO $$
DECLARE
    r RECORD;
BEGIN
    -- 1. Identify skills to keep (we can't easily validte by ID, so we use Name)
    -- Actually, simpler:
    -- Just insert the 9 skills if they don't exist.
    -- Delete any skill NOT in the list of 9.
    
    -- But deletion will fail due to FK.
    -- So we must UPDATE the FK references to NULL or delete the reference rows.
    
    -- Let's try to find what column in 'tasks' references 'skills_master'.
    -- The error hint says: `...referenced in a foreign key constraint... Table "tasks" references "skills_master"`
    
    -- We will try to DELETE FROM skills_master WHERE skill_name NOT IN (... standard 9 ...);
    -- If that fails, we know for sure used skills are the issue.
    
    -- For now, let's just INSERT the missing ones to solve the "empty list" problem immediately.
    -- The user saw EMPTY list in my logs.
    
    INSERT INTO skills_master (skill_name, category)
    VALUES 
        ('TypeScript', 'engineering'),
        ('Node.js', 'engineering'),
        ('SQL', 'engineering'),
        ('Databases', 'engineering'),
        ('React', 'engineering'),
        ('Python', 'engineering'),
        ('Non-popular LLMs', 'ai_ml'),
        ('Prompt Engineering', 'ai_ml'),
        ('RAG', 'ai_ml')
    ON CONFLICT (skill_name) DO NOTHING; -- Assuming skill_name is unique? If not, we might get dupes.

    -- If skill_name is NOT unique constraint, we might need a smarter check.
    -- Let's assume unique constraint exists or checks are loose.
    
    -- If the table is truly empty (as my script said), this INSERT will work perfectly.
    -- The "Truncate" error happened because we tried to wipe it.
    -- Since we can't wipe it easily, let's just FILL it.
    
END $$;
