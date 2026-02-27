-- Reset skills_master table to the standard 9 skills
DELETE FROM skills_master;

INSERT INTO skills_master (skill_name, category) VALUES
-- Engineering
('TypeScript', 'engineering'),
('Node.js', 'engineering'),
('SQL', 'engineering'),
('Databases', 'engineering'),
('React', 'engineering'),
('Python', 'engineering'),

-- AI/ML
('Non-popular LLMs', 'ai_ml'),
('Prompt Engineering', 'ai_ml'),
('RAG', 'ai_ml');
