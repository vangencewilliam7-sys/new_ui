-- Add skills column to tasks if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'skills') THEN 
        ALTER TABLE tasks ADD COLUMN skills text[] DEFAULT '{}'; 
    END IF; 
END $$;
