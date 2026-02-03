-- Inspect triggers on the 'leaves' table
SELECT 
    tgname as trigger_name,
    pg_get_triggerdef(oid) as trigger_definition
FROM pg_trigger
WHERE tgrelid = 'public.leaves'::regclass;
