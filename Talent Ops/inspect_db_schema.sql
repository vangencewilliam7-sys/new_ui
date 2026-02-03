-- RUN THIS IN SUPABASE SQL EDITOR to debug the schema mismatch

-- 1. Check if the 'leave_ai_analysis' table actually has the columns we added
SELECT 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'leave_ai_analysis';

-- 2. Check the Trigger Definition on the 'leaves' table
-- This will tell us valid exact Function Name it calls
SELECT 
    tgname as trigger_name,
    pg_get_triggerdef(oid) as trigger_definition
FROM pg_trigger 
WHERE tgrelid = 'public.leaves'::regclass;
