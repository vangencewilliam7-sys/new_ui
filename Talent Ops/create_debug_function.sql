-- Create a specific function to reveal what triggers exist
-- Run this in Supabase SQL Editor

CREATE OR REPLACE FUNCTION get_debug_info()
RETURNS TABLE (
    schema_name text,
    table_name text,
    trigger_name text,
    definition text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        event_object_schema::text,
        event_object_table::text,
        trigger_name::text,
        action_statement::text
    FROM information_schema.triggers
    WHERE event_object_table IN ('tasks', 'task_steps', 'task_submissions');
END;
$$ LANGUAGE plpgsql;
