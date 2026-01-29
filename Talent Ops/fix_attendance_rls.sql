
-- Fix RLS for attendance table to allow team members to see each other's status
-- This ensures that the 'Active' status correctly reflects in the Team Members list

-- 1. Drop existing restrictive select policy if it exists
DROP POLICY IF EXISTS "Users can only view their own attendance" ON attendance;
DROP POLICY IF EXISTS "Users can view team attendance" ON attendance;
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON attendance;

-- 2. Create a new policy that allows everyone in the same organization to view attendance
-- This is necessary for the 'Team Members' list to show who is active
CREATE POLICY "Allow users to view all attendance records in their organization"
ON public.attendance
FOR SELECT
TO authenticated
USING (
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
);

-- 3. Ensure users can still only manage their own records
DROP POLICY IF EXISTS "Users can only insert their own attendance" ON attendance;
CREATE POLICY "Users can insert their own attendance"
ON public.attendance
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = employee_id
);

DROP POLICY IF EXISTS "Users can only update their own attendance" ON attendance;
CREATE POLICY "Users can update their own attendance"
ON public.attendance
FOR UPDATE
TO authenticated
USING (
    auth.uid() = employee_id
);

-- 4. Enable RLS if not already enabled
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
