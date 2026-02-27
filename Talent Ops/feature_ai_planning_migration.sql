-- ==============================================================================
-- MIGRATION: AI-NATIVE PLANNING ASSISTANT
-- Run this in your Supabase SQL Editor.
-- ==============================================================================

-- 1. Schema Updates (Open/Closed Principle)
-- We extend the `tasks` and `task_steps` tables to support AI features logic
-- without modifying their core behavior for existing tasks.

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS ai_metadata JSONB DEFAULT '{}'::jsonb;

-- Adding duration tracking to steps so we can recalculate totals accurately
ALTER TABLE task_steps
ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC DEFAULT 0;


-- 2. Context Retrieval RPC (Single Responsibility)
-- FETCHES generic step titles from past similar tasks to guide the AI.
-- Anonymizes data by only returning titles, not user info.

CREATE OR REPLACE FUNCTION rpc_get_similar_task_context(
    p_skill_tags text[], 
    p_limit int DEFAULT 5
)
RETURNS TABLE (
    task_title text,
    step_titles text[]
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.title as task_title,
        array_agg(ts.step_title) as step_titles
    FROM tasks t
    JOIN task_steps ts ON t.id = ts.task_id
    WHERE 
        t.skills && p_skill_tags       -- Finds overlap between task skills and requested skills
        AND t.created_at > (now() - interval '6 months') -- Only relevant recent history
    GROUP BY t.id, t.title
    ORDER BY t.created_at DESC
    LIMIT p_limit;
END;
$$;


-- 3. Bulk Planning Save RPC (Transaction Management)
-- PROCESSSES the AI plan atomically:
-- 1. Updates task metadata
-- 2. Inserts all steps
-- 3. Recalculates total hours and points

CREATE OR REPLACE FUNCTION rpc_bulk_save_task_plan(
    p_task_id uuid,
    p_steps jsonb,       -- Expected: Array of { "phase": "...", "title": "...", "hours": 2, "order": 1 }
    p_ai_metadata jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_step jsonb;
    v_total_hours numeric := 0;
    v_step_count int := 0;
BEGIN
    -- A. Update Task Metadata (Risks, Assumptions)
    UPDATE tasks 
    SET ai_metadata = p_ai_metadata
    WHERE id = p_task_id;

    -- B. Insert Steps
    FOR v_step IN SELECT * FROM jsonb_array_elements(p_steps)
    LOOP
        INSERT INTO task_steps (
            org_id,
            task_id,
            stage_id,
            step_title,
            estimated_hours,
            order_index,
            status,
            created_at
        )
        SELECT 
            org_id, 
            p_task_id, 
            v_step->>'phase', 
            v_step->>'title', 
            COALESCE((v_step->>'hours')::numeric, 0),
            COALESCE((v_step->>'order')::int, 0),
            'pending',
            now()
        FROM tasks WHERE id = p_task_id;

        -- Accumulate stats
        v_total_hours := v_total_hours + COALESCE((v_step->>'hours')::numeric, 0);
        v_step_count := v_step_count + 1;
    END LOOP;

    -- C. Update Task Stats (Allocated Hours & Points)
    -- Rule: Points = Hours * 10
    UPDATE tasks
    SET 
        allocated_hours = v_total_hours,
        steps_count = v_step_count,
        task_points = (v_total_hours * 10)::int
    WHERE id = p_task_id;

    RETURN true;
EXCEPTION WHEN OTHERS THEN
    -- If anything fails, the entire transaction rolls back
    RETURN false;
END;
$$;
