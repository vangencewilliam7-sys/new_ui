-- =========================================================
-- REMOVE TIME LOGIC TRIGGER
-- =========================================================
-- Based on the screenshots, 'trg_task_time_logic' calling 'handle_task_time_logic'
-- is the most likely culprit for overwriting allocated_hours.

-- 1. Drop the suspicious trigger
DROP TRIGGER IF EXISTS trg_task_time_logic ON tasks CASCADE;

-- 2. Drop the associated function
DROP FUNCTION IF EXISTS handle_task_time_logic() CASCADE;

-- 3. Also drop performance trigger if it recalculates hours (Backup precaution)
DROP TRIGGER IF EXISTS trg_task_performance ON tasks CASCADE;
DROP FUNCTION IF EXISTS calculate_task_performance() CASCADE;
