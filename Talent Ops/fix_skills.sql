-- Function to reset skills to default 9
CREATE OR REPLACE FUNCTION rpc_reset_skills()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- Clear existing (to avoid duplicates or bad data)
    DELETE FROM skills_master;
    
    -- Insert the 9 standard skills
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

-- Execute immediately
SELECT rpc_reset_skills();
