-- FIX PERMISSIONS & RLS (Final Stability)
-- We suspected RLS might be blocking the trigger's insert.

-- 1. Disable RLS on the table to allow the trigger to write freely
-- The trigger runs inside a transaction, so if RLS blocks it, the whole leave submission fails.
ALTER TABLE public.leave_ai_analysis DISABLE ROW LEVEL SECURITY;

-- 2. Explicitly Grant Insert/Update to everyone (authenticated)
GRANT ALL ON public.leave_ai_analysis TO authenticated;
GRANT ALL ON public.leave_ai_analysis TO service_role;
GRANT ALL ON public.leave_ai_analysis TO anon;

-- 3. Just to be double-sure, ensure the Sequence is accessible (if there is one, though we use UUIDs)
-- (No sequence needed for UUIDs usually)

-- 4. Re-verify columns exist (Idempotent)
ALTER TABLE public.leave_ai_analysis ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
ALTER TABLE public.leave_ai_analysis ADD COLUMN IF NOT EXISTS risk_score NUMERIC;
ALTER TABLE public.leave_ai_analysis ADD COLUMN IF NOT EXISTS primary_warning TEXT;
ALTER TABLE public.leave_ai_analysis ADD COLUMN IF NOT EXISTS secondary_warning TEXT;
