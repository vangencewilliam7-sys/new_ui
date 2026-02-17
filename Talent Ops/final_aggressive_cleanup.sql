-- =========================================================
-- DROP EVERYTHING AGGRESSIVELY
-- =========================================================

-- Just in case we missed some, let's use a very broad brush
-- We can't iterate triggers in SQL block easily without complex PL/pgSQL
-- So we repeat known patterns.

-- 1. Tasks Triggers
DROP TRIGGER IF EXISTS trigger_calc_hours ON tasks CASCADE;
DROP TRIGGER IF EXISTS trg_calculate_allocated_hours ON tasks CASCADE;
DROP TRIGGER IF EXISTS trg_calc_duration ON tasks CASCADE;
DROP TRIGGER IF EXISTS calculate_duration ON tasks CASCADE;
DROP TRIGGER IF EXISTS trg_update_allocated_hours ON tasks CASCADE;
DROP TRIGGER IF EXISTS update_allocated_hours ON tasks CASCADE;
DROP TRIGGER IF EXISTS set_allocated_hours ON tasks CASCADE;

-- 2. Task Steps Triggers
DROP TRIGGER IF EXISTS trg_update_task_hours ON task_steps CASCADE;
DROP TRIGGER IF EXISTS update_task_hours_from_steps ON task_steps CASCADE;

-- 3. Functions
DROP FUNCTION IF EXISTS calculate_allocated_hours() CASCADE;
DROP FUNCTION IF EXISTS calculate_task_duration() CASCADE;
DROP FUNCTION IF EXISTS update_allocated_hours() CASCADE;
DROP FUNCTION IF EXISTS set_allocated_hours() CASCADE;
DROP FUNCTION IF EXISTS update_task_hours_from_steps() CASCADE;

-- 4. Check for constraints or generated column
ALTER TABLE tasks ALTER COLUMN allocated_hours DROP DEFAULT;
-- Dropping check constraints if any
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_allocated_hours_check;
