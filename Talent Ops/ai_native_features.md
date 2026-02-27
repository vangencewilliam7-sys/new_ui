# AI Native Features Research

Paste your research here...
BUILD FEATURE: LLM-based “AI Predictive Overdue Alerts (Risk Analyst)” for Task Management.

GOAL
- Predict if a task will get delayed BEFORE it becomes overdue.
- Use 2-layer design:
  (A) Math/projection layer = compute truth metrics (no hallucination)
  (B) LLM layer = explain “why” + suggest actions (return strict JSON)
- Store every risk analysis snapshot for audit + UI rendering.

STACK ASSUMPTION
- Postgres/Supabase style DB + RPC functions.
- LLM call can be done in backend server (recommended) OR via Edge Function.
- If DB cannot call LLM directly, the RPC returns the math metrics and the backend calls LLM and inserts snapshot.

========================
1) DATABASE CHANGES
========================

A) Ensure tasks table has these fields (add if missing):
- started_at timestamptz
- allocated_hours numeric NOT NULL DEFAULT 0
- steps_count int NOT NULL DEFAULT 0
- step_duration_hours int NOT NULL DEFAULT 2  (allowed: 2 or 4)
- status text NOT NULL DEFAULT 'todo'  (todo/in_progress/review/done)
- last_activity_at timestamptz

B) Ensure task_steps table has:
- id uuid PK
- task_id uuid FK -> tasks.id
- step_number int
- title text
- status text NOT NULL DEFAULT 'todo' (todo/done)
- started_at timestamptz NULL
- completed_at timestamptz NULL

C) Create new table: task_risk_snapshots (store latest AI risk analysis)
Fields:
- id uuid PK default gen_random_uuid()
- org_id uuid NOT NULL
- task_id uuid NOT NULL references tasks(id) on delete cascade
- computed_at timestamptz NOT NULL default now()

Math metrics (truth layer):
- elapsed_hours numeric NOT NULL
- steps_completed int NOT NULL
- total_steps int NOT NULL
- progress_ratio numeric NOT NULL  (0 to 1)
- predicted_total_hours numeric NOT NULL
- predicted_delay_hours numeric NOT NULL

AI output:
- risk_level text NOT NULL  (low/medium/high)
- confidence int NOT NULL  (0–100)
- reasons text[] NOT NULL default '{}'::text[]
- recommended_actions text[] NOT NULL default '{}'::text[]
- model_used text NULL
- raw_llm_response jsonb NULL

Add indexes:
- idx_task_risk_latest on task_risk_snapshots(task_id, computed_at desc)

========================
2) RPC / FUNCTIONS
========================

A) Function: rpc_compute_task_risk_metrics(task_id uuid)
Purpose:
- Calculate truth metrics without LLM:
  - elapsed_hours
  - steps_completed
  - total_steps
  - progress_ratio
  - predicted_total_hours
  - predicted_delay_hours
  - base_risk_level (low/medium/high)
Return a JSON object with all metrics.
Rules:
- If started_at is null => return risk_level='low' and predicted_total_hours=allocated_hours and predicted_delay_hours=0.
- elapsed_hours = (now() - started_at) in hours
- total_steps = tasks.steps_count (fallback to count(task_steps) if steps_count = 0)
- steps_completed = count(task_steps where status='done')
- progress_ratio = steps_completed / total_steps (if total_steps=0 => 0)
- If steps_completed > 0:
    hours_per_step = elapsed_hours / steps_completed
    predicted_total_hours = hours_per_step * total_steps
  else:
    predicted_total_hours = allocated_hours (or allocated_hours*1.2 if you want conservative)
- predicted_delay_hours = max(0, predicted_total_hours - allocated_hours)

Base risk thresholds:
- if predicted_delay_hours = 0 => low
- if predicted_delay_hours > 0 and <= 2 => medium
- if predicted_delay_hours > 2 => high

Return JSON:
{
  "task_id": "...",
  "org_id": "...",
  "elapsed_hours": ...,
  "steps_completed": ...,
  "total_steps": ...,
  "progress_ratio": ...,
  "predicted_total_hours": ...,
  "predicted_delay_hours": ...,
  "base_risk_level": "low|medium|high"
}

B) Function: rpc_insert_task_risk_snapshot(...)
Purpose:
- Insert into task_risk_snapshots with both:
  - math metrics
  - LLM analysis outputs
Inputs:
- org_id, task_id,
- elapsed_hours, steps_completed, total_steps, progress_ratio,
- predicted_total_hours, predicted_delay_hours,
- risk_level, confidence, reasons[], recommended_actions[],
- model_used, raw_llm_response

Return inserted snapshot row.

========================
3) LLM “RISK ANALYST” CALL
========================

IMPORTANT:
- Do NOT send secrets or client data.
- Send only structured metrics + minimal metadata.

LLM INPUT JSON (example shape):
{
  "task_title": "...",
  "skill_tag": "...",
  "allocated_hours": 16,
  "elapsed_hours": 10,
  "steps_total": 4,
  "steps_completed": 2,
  "predicted_total_hours": 20,
  "predicted_delay_hours": 4,
  "employee_context": {
    "active_tasks_count": 3,
    "delay_rate_for_skill": 0.4
  }
}

LLM OUTPUT MUST BE STRICT JSON ONLY:
{
  "risk_level": "low|medium|high",
  "confidence": 0-100,
  "reasons": ["reason1","reason2","reason3"],
  "recommended_actions": ["action1","action2"]
}

Validation rules:
- risk_level must be low/medium/high
- confidence must be int 0..100
- reasons max 3 items
- recommended_actions max 2 items
If validation fails => fallback:
- risk_level = base_risk_level
- reasons = ["Based on current pace, predicted delay is X hours."]
- recommended_actions = ["Check blockers and update timeline.", "Rebalance workload if needed."]

MODEL CHOICE:
- Use LLM now (cloud): gpt-4o-mini / gpt-4.1-mini / similar.
- Keep same prompt + schema so later we can swap to SLM without redesign.

========================
4) WHEN TO RUN THIS
========================

Trigger risk calculation on these events:
- Start Task button => sets started_at, status=in_progress, last_activity_at=now()
- Step marked done => update task_steps + last_activity_at
- Comment/update posted => update last_activity_at
- Submit for review => final snapshot

Implementation:
- After each event, call rpc_compute_task_risk_metrics(task_id)
- Backend calls LLM with metrics payload
- Backend inserts snapshot using rpc_insert_task_risk_snapshot

Optional later:
- Cron job every 30 mins for in_progress tasks.

========================
5) UI REQUIREMENTS
========================

Manager Kanban / Task list:
- Show badge by risk_level:
  - low = none/green
  - medium = “At Risk”
  - high = “Likely Late”
- Tooltip / expandable panel shows:
  - predicted_delay_hours
  - reasons (bullets)
  - recommended_actions (bullets)

Employee view:
- Show softer message:
  - medium/high => “At risk — please update progress”
(avoid harsh tone)

========================
6) DELIVERABLES
========================

- SQL migration for new table + indexes + any missing columns.
- RPC functions:
  - rpc_compute_task_risk_metrics(task_id)
  - rpc_insert_task_risk_snapshot(...)
- Backend helper:
  - compute metrics -> call LLM -> validate -> insert snapshot
- UI rendering of latest snapshot (select latest by computed_at desc).

Make sure everything is auditable and no sensitive data is sent to LLM.
