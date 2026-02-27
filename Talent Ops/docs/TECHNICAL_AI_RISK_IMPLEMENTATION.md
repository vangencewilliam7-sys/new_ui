# Technical Implementation: AI Risk RPC Migration

## Technical Overview
This document explains the technical implementation of the `rpc_compute_task_risk_metrics` function and how the frontend interacts with it.

## 1. The Database Layer (PostgreSQL / RPC)
The core logic resides in a PL/pgSQL function. This function takes a `task_id` and returns a JSON object containing the computed metrics.

### Fix: Status Alignment
The previous version used `status = 'done'`, whereas the `task_steps` table uses `status = 'completed'`.
```sql
-- Before (Broken progress)
count(*) FILTER (WHERE status = 'done')

-- After (Fixed)
count(*) FILTER (WHERE status = 'completed')
```

### New Feature: Phase-Aware Progress
We added logic to inspect the `phase_validations` JSONB column to calculate lifecycle progress:
1. Count the number of active phases (excluding 'closed').
2. Count how many of those phases have a status of `'approved'`.
3. If no granular steps exist, use this percentage as the primary progress metric.

## 2. The Logic Layer (Service Component)
The `riskService` in the frontend (located in `services/modules/risk/index.js`) acts as the bridge.

```javascript
// Calling the centralized math layer
computeRiskMetrics: async (taskId) => {
    const { data, error } = await supabase.rpc('rpc_compute_task_risk_metrics', { 
        p_task_id: taskId 
    });
    return data;
}
```

## 3. The UI Layer (React Integration)
In `MyTasksPage.jsx`, we removed all manual math calculations and replaced them with calls to the `riskService`.

### Data Flow for AI Analysis:
1. **Trigger:** The page loads or a task becomes "Urgent."
2. **Fetch Metrics:** The client calls `riskService.computeRiskMetrics(taskId)`.
3. **Analyze:** Those metrics are sent to the AI Edge Function (`analyze-task-risk`).
4. **Display:** The `AIAssistantPopup` receives the resulting data and displays the AI's recommendations.

## 4. Re-Open Capability
We updated the `RiskBadge` component to accept an `onClick` handler. This allows the `MyTasksPage` to pass a function that pulls the cached analysis from `riskSnapshots` and displays it in the `AIAssistantPopup` again, providing a better user experience for reviewing AI advice.

## Appendix: RPC Source Code Reference

### 1. `rpc_compute_task_risk_metrics`
This function is the "Brain" of the progress calculation. It computes exact elapsed hours and determines the progress percentage using either granular steps or high-level lifecycle phases.

```sql
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
    SELECT count(*), count(*) FILTER (WHERE status = 'completed')
    INTO v_total_steps, v_steps_completed
    FROM task_steps WHERE task_id = p_task_id;

    -- 2. Calculate Phase Progress (High-Level Lifecycle)
    IF v_task.phase_validations ? 'active_phases' THEN
        SELECT count(*) INTO v_active_phases_count 
        FROM jsonb_array_elements_text(v_task.phase_validations->'active_phases') AS p 
        WHERE p != 'closed';

        IF v_active_phases_count > 0 THEN
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
    IF v_total_steps > 0 THEN
        v_progress_ratio := v_steps_completed::numeric / v_total_steps;
    ELSE
        v_progress_ratio := v_phase_progress;
    END IF;

    -- Prediction & Risk Logic
    IF v_progress_ratio > 0 THEN
        v_predicted_total := v_elapsed_hours / v_progress_ratio;
    ELSE
        v_predicted_total := v_task.allocated_hours * 1.3; 
    END IF;

    v_predicted_delay := GREATEST(0, v_predicted_total - v_task.allocated_hours);

    IF v_predicted_delay > 2 OR v_predicted_delay > (v_task.allocated_hours * 0.2) THEN 
        v_risk_level := 'high';
    ELSIF v_predicted_delay > 0.5 THEN 
        v_risk_level := 'medium';
    ELSE 
        v_risk_level := 'low';
    END IF;

    RETURN jsonb_build_object(
        'task_id', p_task_id, 'org_id', v_task.org_id,
        'allocated_hours', v_task.allocated_hours, 'elapsed_hours', round(v_elapsed_hours, 2),
        'steps_completed', v_steps_completed, 'total_steps', v_total_steps,
        'progress_ratio', round(v_progress_ratio, 2), 'predicted_total_hours', round(v_predicted_total, 2),
        'predicted_delay_hours', round(v_predicted_delay, 2), 'base_risk_level', v_risk_level
    );
END;
$$;
```

### 2. `rpc_insert_task_risk_snapshot`
This function handles saving the AI's results and **triggering cross-role notifications** (Employee alerts for deadlines and Manager alerts for High Risk).

```sql
CREATE OR REPLACE FUNCTION rpc_insert_task_risk_snapshot(
    p_org_id uuid, p_task_id uuid, p_elapsed_hours numeric, p_steps_completed int,
    p_total_steps int, p_progress_ratio numeric, p_predicted_total_hours numeric,
    p_predicted_delay_hours numeric, p_risk_level text, p_confidence int,
    p_reasons text[], p_actions text[], p_model text, p_raw_response jsonb
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_id uuid;
    v_manager_id uuid; v_employee_id uuid; v_task_title text;
    v_allocated_hours numeric; v_due_date date; v_due_time time;
    v_is_half_time bool := false; v_is_near_deadline bool := false;
BEGIN
    -- 1. Insert Snapshot
    INSERT INTO task_risk_snapshots (...) VALUES (...) RETURNING id INTO v_id;

    -- 2. Fetch Metadata & Trigger Notifications
    SELECT assigned_by, assigned_to, title, allocated_hours, due_date, due_time
    INTO v_manager_id, v_employee_id, v_task_title, v_allocated_hours, v_due_date, v_due_time
    FROM tasks WHERE id = p_task_id;

    -- Logic for Half-Time (50%) and Near Deadline (< 2h) alerts...
    -- Logic for High Risk AI alerts to Manager...

    RETURN jsonb_build_object('success', true, 'snapshot_id', v_id);
END;
$$;
```
