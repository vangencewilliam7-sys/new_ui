-- The Safest Reset:
-- 1. Wipe links from 'task_skills' or 'tasks' for invalid skills?
-- Actually, the user wants EXACTLY 9 skills.
-- Let's try to update existing rows in 'tasks' to NULL if they point to weird skills?
-- Or just create the 9 skills if they are missing.

-- The error "cannot truncate a table referenced in a foreign key constraint" means:
-- We tried to wipe `skills_master`. The `tasks` table has a column pointing to `skills_master`.
-- This column prevents deletion of rows in `skills_master`.

-- Solution:
-- 1. Clear the reference column in `tasks` (set to NULL) so we can wipe skills? No, that deletes history.
-- 2. Just ADD missing skills? Yes, safest.

-- Let's define the 9 skills clearly.
-- We want to ensure no duplicates.

DO $$
BEGIN
    -- Insert only if not exists (check by name)
    IF NOT EXISTS (SELECT 1 FROM skills_master WHERE skill_name = 'TypeScript') THEN
        INSERT INTO skills_master (skill_name, category) VALUES ('TypeScript', 'engineering');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM skills_master WHERE skill_name = 'Node.js') THEN
        INSERT INTO skills_master (skill_name, category) VALUES ('Node.js', 'engineering');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM skills_master WHERE skill_name = 'SQL') THEN
        INSERT INTO skills_master (skill_name, category) VALUES ('SQL', 'engineering');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM skills_master WHERE skill_name = 'Databases') THEN
        INSERT INTO skills_master (skill_name, category) VALUES ('Databases', 'engineering');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM skills_master WHERE skill_name = 'React') THEN
        INSERT INTO skills_master (skill_name, category) VALUES ('React', 'engineering');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM skills_master WHERE skill_name = 'Python') THEN
        INSERT INTO skills_master (skill_name, category) VALUES ('Python', 'engineering');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM skills_master WHERE skill_name = 'Non-popular LLMs') THEN
        INSERT INTO skills_master (skill_name, category) VALUES ('Non-popular LLMs', 'ai_ml');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM skills_master WHERE skill_name = 'Prompt Engineering') THEN
        INSERT INTO skills_master (skill_name, category) VALUES ('Prompt Engineering', 'ai_ml');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM skills_master WHERE skill_name = 'RAG') THEN
        INSERT INTO skills_master (skill_name, category) VALUES ('RAG', 'ai_ml');
    END IF;

    -- OPTIONAL: Clean up extra skills if you really want strictly 9.
    -- DELETE FROM skills_master WHERE skill_name NOT IN (
    --    'TypeScript', 'Node.js', 'SQL', 'Databases', 'React', 'Python',
    --    'Non-popular LLMs', 'Prompt Engineering', 'RAG'
    -- );
    -- WARNING: This DELETE line will FAIL if these extra skills are used in `tasks`.
    -- So for now, we just ensure the 9 exist.
END $$;
