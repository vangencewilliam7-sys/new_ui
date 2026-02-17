-- =========================================================
-- DISABLE AUTO-CALCULATION FROM STEPS & WALL-CLOCK
-- =========================================================
-- There are two mechanisms identified that overwrite your hours:
-- 1. Wall-clock trigger (which we targeted before).
-- 2. "Step-based" trigger which recalculates hours based on the number of lifecycle steps.

-- We must disable BOTH to ensure your manual "12 hours" input is preserved.

-- A. DROP STEP-BASED OVERRIDE (Likely the persistence cause)
DROP TRIGGER IF EXISTS trg_update_task_hours ON task_steps CASCADE;
DROP FUNCTION IF EXISTS update_task_hours_from_steps() CASCADE;

-- B. DROP WALL-CLOCK OVERRIDE (Safety Cleanup)
-- Repeating this to ensure it's gone
DROP TRIGGER IF EXISTS trigger_calc_hours ON tasks CASCADE;
DROP TRIGGER IF EXISTS trg_calculate_allocated_hours ON tasks CASCADE;
DROP TRIGGER IF EXISTS calculate_allocated_hours ON tasks CASCADE;
DROP TRIGGER IF EXISTS update_allocated_hours ON tasks CASCADE;
DROP TRIGGER IF EXISTS trg_update_allocated_hours ON tasks CASCADE;
DROP TRIGGER IF EXISTS set_allocated_hours ON tasks CASCADE;
DROP TRIGGER IF EXISTS trg_calc_duration ON tasks CASCADE;

-- C. DROP ANY ASSOCIATED FUNCTIONS
DROP FUNCTION IF EXISTS calculate_allocated_hours() CASCADE;
DROP FUNCTION IF EXISTS update_allocated_hours() CASCADE;
DROP FUNCTION IF EXISTS set_allocated_hours() CASCADE;
DROP FUNCTION IF EXISTS calculate_task_duration() CASCADE;

-- D. VERIFICATION MSG
-- If you see an error "trigger does not exist", that is GOOD. It means it's already gone.
