# Archive Feature — SQL Queries

Run these in your **Supabase SQL Editor** in order.

---

## Step 1: Add 'archived' to Allowed Status Values

```sql
-- Drop the existing check constraint
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

-- Add new constraint that includes 'archived'
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check 
CHECK (status IN ('pending', 'in_progress', 'completed', 'on_hold', 'rejected', 'archived'));
```

---

## Step 2: Archive ALL Tasks

```sql
-- After running Step 1, you can archive all tasks
UPDATE tasks SET status = 'archived';
```

---

## How to Run

1. Open Supabase Dashboard → **SQL Editor**
2. Run **Step 1** first (drop and recreate constraint)
3. Run **Step 2** to archive all tasks

Done!
