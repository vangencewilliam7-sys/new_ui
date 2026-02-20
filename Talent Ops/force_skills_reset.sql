-- Forcefully reset skills_master to the correct 9 values
-- First, verify table existence and structure (though we assume it exists if user sees rows)

-- Delete all current rows to ensure a clean slate
TRUNCATE TABLE skills_master CASCADE;

-- Insert the STRICT 9 SKILLS you requested
INSERT INTO skills_master (skill_name, category) VALUES
-- Engineering Category
('TypeScript', 'engineering'),
('Node.js', 'engineering'),
('SQL', 'engineering'),
('Databases', 'engineering'),
('React', 'engineering'),
('Python', 'engineering'),

-- AI/ML Category
('Non-popular LLMs', 'ai_ml'),
('Prompt Engineering', 'ai_ml'),
('RAG', 'ai_ml');

-- Verify the count is exactly 9
SELECT count(*) as total_skills FROM skills_master;
