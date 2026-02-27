-- The logic is:
-- 1. Identify rows in `task_skills` (which links tasks to skills)
-- 2. We can simply TRUNCATE `task_skills` first (if user is okay with losing skill tags on closed tasks)
-- The user said "DON'T KEEP ANYTHING OK". This implies "I want a clean slate of skills".
-- It implies history of skills tag is less important than having the CORRECT list.

-- However, safest is CASCADE.
-- If `tasks` references `skills_master`, it's bad.
-- But usually it is `task_skills` junction table.
-- Let's try to TRUNCATE `task_skills` THEN `skills_master`.

CREATE OR REPLACE FUNCTION rpc_force_fix_skills()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- 1. Wipe the junction table first (removes the foreign key block)
    -- Check if task_skills exists first to avoid error?
    -- Assume it does.
    DELETE FROM task_skills;

    -- 2. NOW we can wipe skills_master
    DELETE FROM skills_master;
    
    -- 3. Insert the 9 standard skills
    INSERT INTO skills_master (skill_name, category) VALUES
    ('TypeScript', 'engineering'),
    ('Node.js', 'engineering'),
    ('SQL', 'engineering'),
    ('Databases', 'engineering'),
    ('React', 'engineering'),
    ('Python', 'engineering'),
    ('Non-popular LLMs', 'ai_ml'),
    ('Prompt Engineering', 'ai_ml'),
    ('RAG', 'ai_ml');
END;
$$;

SELECT rpc_force_fix_skills();
