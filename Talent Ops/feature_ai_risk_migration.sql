-- 1. Compute Risk Metrics (Updated to handle unstarted tasks)
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
BEGIN
    SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
    IF NOT FOUND THEN RETURN NULL; END IF;

    -- Fallback to created_at if started_at is null
    v_elapsed_hours := EXTRACT(EPOCH FROM (now() - COALESCE(v_task.started_at, v_task.created_at))) / 3600;
    
    SELECT count(*), count(*) FILTER (WHERE status = 'done')
    INTO v_total_steps, v_steps_completed
    FROM task_steps WHERE task_id = p_task_id;

    IF v_total_steps = 0 THEN v_total_steps := COALESCE(v_task.steps_count, 1); END IF;
    IF v_total_steps = 0 THEN v_total_steps := 1; END IF;

    IF v_steps_completed > 0 THEN
        v_predicted_total := (v_elapsed_hours / v_steps_completed) * v_total_steps;
    ELSE
        v_predicted_total := v_task.allocated_hours * 1.3; 
    END IF;

    v_predicted_delay := GREATEST(0, v_predicted_total - v_task.allocated_hours);

    IF v_predicted_delay > 2 OR v_predicted_delay > (v_task.allocated_hours * 0.2) THEN v_risk_level := 'high';
    ELSIF v_predicted_delay > 0.5 THEN v_risk_level := 'medium';
    ELSE v_risk_level := 'low';
    END IF;

    RETURN jsonb_build_object(
        'task_id', p_task_id,
        'org_id', v_task.org_id,
        'allocated_hours', v_task.allocated_hours,
        'elapsed_hours', round(v_elapsed_hours, 2),
        'steps_completed', v_steps_completed,
        'total_steps', v_total_steps,
        'progress_ratio', CASE WHEN v_total_steps > 0 THEN v_steps_completed::numeric / v_total_steps ELSE 0 END,
        'predicted_total_hours', round(v_predicted_total, 2),
        'predicted_delay_hours', round(v_predicted_delay, 2),
        'base_risk_level', v_risk_level
    );
END;
$$;

-- 2. Insert Risk Snapshot (Updated with Half-Time and Deadline Alerts)
CREATE OR REPLACE FUNCTION rpc_insert_task_risk_snapshot(
    p_org_id uuid, p_task_id uuid, p_elapsed_hours numeric, p_steps_completed int,
    p_total_steps int, p_progress_ratio numeric, p_predicted_total_hours numeric,
    p_predicted_delay_hours numeric, p_risk_level text, p_confidence int,
    p_reasons text[], p_actions text[], p_model text, p_raw_response jsonb
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_id uuid;
    v_manager_id uuid;
    v_employee_id uuid;
    v_task_title text;
    v_allocated_hours numeric;
    v_due_date date;
    v_due_time time;
    v_is_half_time bool := false;
    v_is_near_deadline bool := false;
    v_already_notified_half bool := false;
    v_already_notified_near bool := false;
    v_already_notified_risk bool := false;
BEGIN
    -- 1. Insert Snapshot
    INSERT INTO task_risk_snapshots (
        org_id, task_id, elapsed_hours, steps_completed, total_steps, progress_ratio,
        predicted_total_hours, predicted_delay_hours, risk_level, confidence,
        reasons, recommended_actions, model_used, raw_llm_response
    ) VALUES (
        p_org_id, p_task_id, p_elapsed_hours, p_steps_completed, p_total_steps, p_progress_ratio,
        p_predicted_total_hours, p_predicted_delay_hours, p_risk_level, p_confidence,
        p_reasons, p_actions, p_model, p_raw_response
    ) RETURNING id INTO v_id;

    -- 2. Fetch Task Details
    SELECT assigned_by, assigned_to, title, allocated_hours, due_date, due_time
    INTO v_manager_id, v_employee_id, v_task_title, v_allocated_hours, v_due_date, v_due_time
    FROM tasks WHERE id = p_task_id;

    -- 3. Calculate Alert Conditions
    -- A. Half Time Used
    IF v_allocated_hours > 0 AND (p_elapsed_hours / v_allocated_hours) >= 0.5 THEN
        v_is_half_time := true;
    END IF;

    -- B. Near Deadline (e.g. < 2 hours left)
    IF v_due_date IS NOT NULL THEN
        IF (v_due_date + COALESCE(v_due_time, '23:59:59'::time)) <= (now() + interval '2 hours') THEN
            v_is_near_deadline := true;
        END IF;
    END IF;

    -- 4. EMPLOYEE ALERTS
    IF v_employee_id IS NOT NULL THEN
        -- Check spam for Half Time
        IF v_is_half_time THEN
             SELECT EXISTS (SELECT 1 FROM notifications WHERE receiver_id = v_employee_id AND type = 'task_halftime' AND message LIKE '%' || v_task_title || '%' AND created_at > now() - interval '24 hours')
             INTO v_already_notified_half;

             IF NOT v_already_notified_half THEN
                  INSERT INTO notifications (org_id, receiver_id, sender_name, message, type, is_read)
                  VALUES (p_org_id, v_employee_id, 'TalentOps Coach', 'Heads up! You have used 50% of the allocated time for "' || v_task_title || '".', 'task_halftime', false);
             END IF;
        END IF;

        -- Check spam for Near Deadline
        IF v_is_near_deadline THEN
             SELECT EXISTS (SELECT 1 FROM notifications WHERE receiver_id = v_employee_id AND type = 'task_deadline_near' AND message LIKE '%' || v_task_title || '%' AND created_at > now() - interval '4 hours')
             INTO v_already_notified_near;

             IF NOT v_already_notified_near THEN
                  INSERT INTO notifications (org_id, receiver_id, sender_name, message, type, is_read)
                  VALUES (p_org_id, v_employee_id, 'TalentOps Coach', 'Urgent: Task "' || v_task_title || '" is due in less than 2 hours!', 'task_deadline_near', false);
             END IF;
        END IF;
    END IF;

    -- 5. MANAGER ALERTS
    IF v_manager_id IS NOT NULL THEN
        -- Alert if Near Deadline (User request: "REMIND THE ASSINER... LIKE TIME GETTING NEAR")
        IF v_is_near_deadline THEN
             -- Check spam
             SELECT EXISTS (SELECT 1 FROM notifications WHERE receiver_id = v_manager_id AND type = 'task_deadline_near' AND message LIKE '%' || v_task_title || '%' AND created_at > now() - interval '4 hours')
             INTO v_already_notified_near;

             IF NOT v_already_notified_near THEN
                  INSERT INTO notifications (org_id, receiver_id, sender_name, message, type, is_read)
                  VALUES (p_org_id, v_manager_id, 'TalentOps Monitor', 'Alert: Task "' || v_task_title || '" is approaching deadline (< 2h).', 'task_deadline_near', false);
             END IF;
        END IF;
        
        -- High Risk AI Analysis Alert
        IF p_risk_level = 'high' THEN
             SELECT EXISTS (SELECT 1 FROM notifications WHERE receiver_id = v_manager_id AND type = 'ai_risk_alert' AND message LIKE '%' || v_task_title || '%' AND created_at > now() - interval '4 hours')
             INTO v_already_notified_risk;

             IF NOT v_already_notified_risk THEN
                INSERT INTO notifications (org_id, receiver_id, sender_name, message, type, is_read)
                VALUES (p_org_id, v_manager_id, 'TalentOps AI', 'AI ALERT: High risk detected for task "' || v_task_title || '".', 'ai_risk_alert', false);
             END IF;
        END IF;
    END IF;

    RETURN jsonb_build_object('success', true, 'snapshot_id', v_id);
END;
$$;

-- 3. Bulk Sync Function
CREATE OR REPLACE FUNCTION rpc_sync_daily_task_risks(p_task_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_task_id uuid;
    v_metrics jsonb;
    v_synced_count int := 0;
BEGIN
    FOREACH v_task_id IN ARRAY p_task_ids LOOP
        -- Calculate metrics
        v_metrics := rpc_compute_task_risk_metrics(v_task_id);

        -- If logic says task exists, insert a snapshot using the RPC to handle notifications
        IF v_metrics IS NOT NULL THEN
            PERFORM rpc_insert_task_risk_snapshot(
                (v_metrics->>'org_id')::uuid,
                v_task_id,
                (v_metrics->>'elapsed_hours')::numeric,
                (v_metrics->>'steps_completed')::int,
                (v_metrics->>'total_steps')::int,
                (v_metrics->>'progress_ratio')::numeric,
                (v_metrics->>'predicted_total_hours')::numeric,
                (v_metrics->>'predicted_delay_hours')::numeric,
                v_metrics->>'base_risk_level',
                0, -- confidence
                ARRAY[]::text[], -- reasons
                ARRAY[]::text[], -- actions
                'baseline-monitor',
                '{}'::jsonb -- raw response
            );
            v_synced_count := v_synced_count + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'count', v_synced_count);
END;
$$;
