-- Migration to time-based task system

-- 1. Add new columns
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS start_time TIME,
ADD COLUMN IF NOT EXISTS due_time TIME,
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_overdue BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS access_requested BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS access_reason TEXT,
ADD COLUMN IF NOT EXISTS access_requested_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS access_status TEXT DEFAULT 'none', 
ADD COLUMN IF NOT EXISTS closed_by_manager BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS closed_reason TEXT,
ADD COLUMN IF NOT EXISTS reassigned_to UUID,
ADD COLUMN IF NOT EXISTS reassigned_from UUID,
ADD COLUMN IF NOT EXISTS reassigned_at TIMESTAMPTZ;

-- 2. Function to calculate allocated hours automatically
CREATE OR REPLACE FUNCTION calculate_allocated_hours()
RETURNS TRIGGER AS $$
DECLARE
    start_ts TIMESTAMP;
    end_ts TIMESTAMP;
    diff_hours NUMERIC;
BEGIN
    start_ts := (NEW.start_date || ' ' || COALESCE(NEW.start_time, '09:00:00'))::TIMESTAMP;
    end_ts := (NEW.due_date || ' ' || COALESCE(NEW.due_time, '17:00:00'))::TIMESTAMP;
    
    diff_hours := EXTRACT(EPOCH FROM (end_ts - start_ts)) / 3600;
    
    IF diff_hours < 0 THEN diff_hours := 0; END IF;
    
    NEW.allocated_hours := ROUND(diff_hours, 2);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calc_hours ON tasks;
CREATE TRIGGER trigger_calc_hours
BEFORE INSERT OR UPDATE OF start_date, due_date, start_time, due_time ON tasks
FOR EACH ROW
EXECUTE FUNCTION calculate_allocated_hours();

-- 3. Function to handle Locking (checking overdue)
CREATE OR REPLACE FUNCTION check_task_lock_status()
RETURNS TRIGGER AS $$
DECLARE
  due_ts TIMESTAMP;
BEGIN
  due_ts := (NEW.due_date || ' ' || COALESCE(NEW.due_time, '23:59:59'))::TIMESTAMP;
  
  IF NOW() > due_ts AND NEW.status != 'completed' AND NEW.access_status != 'approved' THEN
    NEW.is_locked := TRUE;
    NEW.is_overdue := TRUE;
  ELSE
    IF NEW.access_status = 'approved' THEN
        NEW.is_locked := FALSE;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_lock ON tasks;
CREATE TRIGGER trigger_check_lock
BEFORE INSERT OR UPDATE ON tasks
FOR EACH ROW
EXECUTE FUNCTION check_task_lock_status();
