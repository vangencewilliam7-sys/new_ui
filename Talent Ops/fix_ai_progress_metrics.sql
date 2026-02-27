-- ==============================================================================
-- FIX: AI PROGRESS CALCULATION BUG
-- ==============================================================================
-- 1. Updates the AI progress logic to use 'completed' (actual status) instead of 'done'
-- 2. Falls back to lifecycle phase completion if no granular steps exist
-- ==============================================================================

CREATE OR REPLACE FUNCTION rpc_compute_task_risk_metrics(p_task_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_task record;
    v_steps_completed int;
    v_total_steps int;
    v_elapsed_hours numeric;
    v_predicted_total numeric;
    v_predicted_delay numeric;
    v_risk_level text;
    v_progress_ratio numeric;
    v_phase_progress numeric := 0;
    v_active_phases_count int;
    v_completed_phases_count int := 0;
    v_phase_key text;
BEGIN
    SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
    IF NOT FOUND THEN RETURN NULL; END IF;

    -- Calculate Elapsed Time
    v_elapsed_hours := EXTRACT(EPOCH FROM (now() - COALESCE(v_task.started_at, v_task.created_at))) / 3600;
    
    -- 1. Calculate Step Progress (Granular Checklist)
    -- FIX: Changed 'done' to 'completed' to match task_steps.status
    SELECT count(*), count(*) FILTER (WHERE status = 'completed')
    INTO v_total_steps, v_steps_completed
    FROM task_steps WHERE task_id = p_task_id;

    -- 2. Calculate Phase Progress (High-Level Lifecycle)
    IF v_task.phase_validations ? 'active_phases' THEN
        v_active_phases_count := jsonb_array_length(v_task.phase_validations->'active_phases');
        -- Filter out 'closed' from active phases count for progress
        SELECT count(*) INTO v_active_phases_count 
        FROM jsonb_array_elements_text(v_task.phase_validations->'active_phases') AS p 
        WHERE p != 'closed';

        IF v_active_phases_count > 0 THEN
            -- Count phases that have approved status
            v_completed_phases_count := 0;
            FOR v_phase_key IN SELECT jsonb_array_elements_text(v_task.phase_validations->'active_phases')
            LOOP
                IF v_phase_key != 'closed' AND (v_task.phase_validations->v_phase_key->>'status' = 'approved') THEN
                    v_completed_phases_count := v_completed_phases_count + 1;
                END IF;
            END LOOP;
            v_phase_progress := v_completed_phases_count::numeric / v_active_phases_count;
        END IF;
    END IF;

    -- 3. Determine Final Progress Ratio
    -- If we have granular steps, they are the primary source (more accurate)
    -- If no steps, use lifecycle phases
    IF v_total_steps > 0 THEN
        v_progress_ratio := v_steps_completed::numeric / v_total_steps;
    ELSE
        v_progress_ratio := v_phase_progress;
    END IF;

    -- Prediction Logic
    IF v_progress_ratio > 0 THEN
        v_predicted_total := v_elapsed_hours / v_progress_ratio;
    ELSE
        -- Conservative estimate if no progress yet
        v_predicted_total := v_task.allocated_hours * 1.3; 
    END IF;

    v_predicted_delay := GREATEST(0, v_predicted_total - v_task.allocated_hours);

    -- Base Risk Level
    IF v_predicted_delay > 2 OR v_predicted_delay > (v_task.allocated_hours * 0.2) THEN 
        v_risk_level := 'high';
    ELSIF v_predicted_delay > 0.5 THEN 
        v_risk_level := 'medium';
    ELSE 
        v_risk_level := 'low';
    END IF;

    RETURN jsonb_build_object(
        'task_id', p_task_id,
        'org_id', v_task.org_id,
        'allocated_hours', v_task.allocated_hours,
        'elapsed_hours', round(v_elapsed_hours, 2),
        'steps_completed', v_steps_completed,
        'total_steps', v_total_steps,
        'progress_ratio', round(v_progress_ratio, 2),
        'predicted_total_hours', round(v_predicted_total, 2),
        'predicted_delay_hours', round(v_predicted_delay, 2),
        'base_risk_level', v_risk_level,
        'is_started', (v_task.started_at IS NOT NULL)
    );
END;
$$;
