# Technical Master: RPC Catalog & Implementation

## Technical Overview
This document serves as the comprehensive technical reference for the Remote Procedure Calls (RPCs) that power the TalentOps backend. It details the server-side logic, security constraints, and data flows for every major module.

---

## 🚀 The Global Pattern: End-to-End Data Flow
To maintain a high-performance and secure system, every module follows a standardized **"Request-Execute-Respond"** pipeline:

1.  **Frontend (React/UI):** The component triggers an action (e.g., `attendanceService.clockIn()`). It contains **zero** business logic; it only knows "what" it wants to achieve.
2.  **Payload (Supabase Client):** The service layer calls `supabase.rpc('function_name', { params })`. Authentication is handled via JWT, which the database resolves to `auth.uid()`.
3.  **Engine (PostgreSQL RPC):** The database function (marked `SECURITY DEFINER`) executes the logic:
    - **Identity:** Verifies the user via `auth.uid()`.
    - **Validation:** Ensures data types and business constraints are met.
    - **Transaction:** Performs atomic updates across multiple tables (e.g., Inserting a record + updating a status).
4.  **Sync (JSON Response):** The RPC returns a clean JSON object `{ "success": true, "data": {...} }`. The UI then uses a simple `setState` to display the new reality from the database.

---

## 📅 1. Attendance & Session Module
**Goal:** Centralize time-keeping and prevent session conflicts.

### `clock_in()`
- **Logic:** Ensures the user doesn't already have an open session (`check_out IS NULL`) for today. 
- **Security:** Hard-coded to the caller's `auth.uid()`.
```sql
CREATE OR REPLACE FUNCTION clock_in()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM attendance WHERE employee_id = auth.uid() AND check_out IS NULL AND date = CURRENT_DATE) THEN
        RETURN json_build_object('success', false, 'error', 'Already clocked in.');
    END IF;

    INSERT INTO attendance (employee_id, date, check_in, status)
    VALUES (auth.uid(), CURRENT_DATE, NOW(), 'present');

    RETURN json_build_object('success', true);
END;
$$;
```

---

## 👤 2. User Profile Module
**Goal:** Securely manage PII (Personal Identifiable Information).

### `update_my_profile(p_phone, p_location, p_avatar_url)`
- **Logic:** Allows modification of "safe" fields only. 
- **Security:** Prevents tampering with sensitive fields like `role`, `department`, or `salary`.
```sql
CREATE OR REPLACE FUNCTION update_my_profile(p_phone text, p_location text, p_avatar_url text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE public.profiles
    SET phone = p_phone, location = p_location, avatar_url = COALESCE(p_avatar_url, avatar_url)
    WHERE id = auth.uid();
    RETURN json_build_object('success', true);
END;
$$;
```

---

## 💰 3. Payroll & Finance Engine
**Goal:** Industrial-scale financial batch processing.

### `generate_monthly_payroll(p_month_str, p_total_working_days)`
- **Logic:** Loops through every active employee in the organization, joins their financial records, calculates pro-rata deductions for LOP (Loss of Pay), and inserts official payslips.
- **RBAC:** Strictly limited to `executive`, `manager`, or `admin` roles.
```sql
FOR v_emp IN SELECT ... FROM profiles LEFT JOIN employee_finance ...
LOOP
    v_gross := v_emp.basic_salary + v_emp.hra + v_emp.allowances;
    v_net := v_gross - v_lop_deduction - v_prof_tax;
    INSERT INTO payroll (..., net_salary, status, ...)
    VALUES (..., v_net, 'generated', ...);
END LOOP;
```

---

## 🤖 4. AI Risk & Productivity Module
**Goal:** Context-aware task progress monitoring.

### `rpc_compute_task_risk_metrics(p_task_id)`
- **Logic:** Calculates task progress by looking at both **granular checklist steps** AND **high-level lifecycle phases**. It fixes the status mismatch by looking for `'completed'` instead of `'done'`.
```sql
-- Step Progress
SELECT count(*), count(*) FILTER (WHERE status = 'completed') 
INTO v_total_steps, v_steps_completed FROM task_steps;

-- Phase Progress (Fallback)
IF v_total_steps = 0 THEN
    v_progress_ratio := v_completed_phases / v_active_phases;
END IF;
```

### `rpc_insert_task_risk_snapshot`
- **Logic:** Saves LLM insights and automatically triggers **Cross-Role Notifications** (e.g., alerting a manager if AI detects 'High Risk').

---

## 📢 5. Announcements Module
**Goal:** Automated broadcast system.

### `create_announcement_event`
- **Logic:** Inserts an announcement and uses a SQL trigger/loop to instantly bulk-insert notifications for every relevant team member (Org-wide or Team-specific).
