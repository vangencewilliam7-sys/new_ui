-- Inspect Constraints and Triggers
SELECT 
    con.conname AS constraint_name, 
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM 
    pg_catalog.pg_constraint con
WHERE 
    con.conrelid = 'public.leaves'::regclass;

SELECT 
    tgname AS trigger_name,
    pg_get_triggerdef(oid) AS trigger_definition
FROM 
    pg_trigger
WHERE 
    tgrelid = 'public.leaves'::regclass;
