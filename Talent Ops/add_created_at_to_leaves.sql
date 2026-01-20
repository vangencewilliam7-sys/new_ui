-- Add created_at column to leaves table
ALTER TABLE leaves 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Update existing rows to have a created_at if they are null (though default handles new ones)
UPDATE leaves SET created_at = NOW() WHERE created_at IS NULL;
