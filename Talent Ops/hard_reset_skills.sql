-- The logic is:
-- 1. Wipe the junction table first (removes the foreign key block)
DELETE FROM task_skills;

-- 2. NOW we can wipe skills_master (since its links are gone)
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

-- 4. Verify
SELECT * FROM skills_master;
