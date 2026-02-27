# AI Native Feature Research

Please paste your research and requirements for the next AI Native feature below this line.
-----------------------------------------------------------------------------------------
0️⃣ OBJECTIVE (Explain This First to Antigravity)

We are building an AI-native planning assistant.

When a manager creates a task and enters a description, instead of manually writing task steps, the system should:

Send the task description to an LLM.

The LLM generates structured steps.

Each step includes:

Title

Duration (only 2h or 4h)

Risk level

Optional note

Manager edits the generated steps.

On save, steps are stored in task_steps.

Allocated hours and points are auto-calculated.

The AI does NOT auto-save.
It generates a draft plan.
Manager remains in control.

1️⃣ HIGH LEVEL ARCHITECTURE

There are 4 layers:

1. UI Layer

“Generate Steps (AI)” button

Preview panel

Editable step list

2. Application Layer (Backend Logic)

Build LLM payload

Call LLM

Validate response

Return structured result

3. Data Layer (Database)

Store generated steps

Update allocated_hours

Update points

Store AI metadata (risks, assumptions)

4. AI Layer

LLM call

Strict schema output

JSON-only response

2️⃣ UI IMPLEMENTATION
On Create Task Screen

Manager fills:

task_title

task_description

skill_tag

task_type (optional)

Add button:

“Generate Steps (AI)”

When clicked:

Call backend endpoint /generate_task_steps

3️⃣ BACKEND ENDPOINT DESIGN

Create endpoint:

POST /tasks/:task_id/generate_steps

Input:
{
  "task_id": "...",
  "title": "...",
  "description": "...",
  "skill_tag": "Backend",
  "task_type": "Integration"
}

4️⃣ CONTEXT BUILDING (CRITICAL PART)

Before calling LLM, backend must:

Step A – Fetch Similar Past Tasks (Optional but powerful)

Query:

same skill_tag

same task_type

last 10 tasks

Extract:

step titles

step durations

This helps AI imitate your internal structure.

If none found → proceed without it.

5️⃣ LLM PROMPT STRUCTURE (THIS IS THE CORE)

You must enforce structure.

System Prompt

"You are a senior technical project planner.
Break tasks into structured execution steps.
Return ONLY valid JSON.
Do not include markdown.
Do not explain outside JSON.
Max 8 steps.
Duration must be either 2 or 4 hours only."

User Prompt Structure

Include:

Task title

Task description

Skill tag

Standard step template example

Similar past steps (if available)

Output schema

Required Output Schema
{
  "steps": [
    {
      "title": "Requirement Clarification",
      "duration_hours": 2,
      "risk": "medium",
      "note": "Confirm provider and payment flow"
    }
  ],
  "overall_risks": ["Webhook retry logic may increase complexity"],
  "assumptions": ["Using Stripe", "Only one-time payments"]
}

6️⃣ VALIDATION LAYER (MUST BE STRICT)

After receiving LLM response:

Validate:

JSON parse success

steps array exists

step count <= 8

each step has:

title not empty

duration_hours = 2 or 4 only

risk = low/medium/high

overall_risks is array

assumptions is array

If validation fails:

Return error

Ask UI to show “AI response invalid, try again”

Never auto-save invalid AI output.

7️⃣ RETURN TO UI (PREVIEW MODE)

Backend returns structured response.

UI displays:

For each step:

Editable text field (title)

Duration dropdown (2h/4h)

Risk tag display

Delete button

Also display:

Overall risks

Assumptions

Manager can:

Edit

Remove

Add new steps manually

8️⃣ SAVE FLOW

When manager clicks “Save Steps”:

Backend should:

1️⃣ Insert into task_steps

For each step:

task_id

step_number

title

duration_hours

status = 'todo'

2️⃣ Update tasks table

steps_count = total steps

allocated_hours = sum(duration_hours)

points = allocated_hours × 10 (if applicable)

3️⃣ Store AI Metadata

In tasks.ai_metadata (jsonb):

{
  "overall_risks": [...],
  "assumptions": [...],
  "generated_by_ai": true,
  "model_used": "gpt-4o-mini"
}

9️⃣ HOW THIS IMPACTS YOUR EXISTING SYSTEM

This strengthens:

Predictive Overdue

More accurate because:

Steps are structured

Progress tracking improves

Points System

More realistic allocation

Review Process

Better clarity

🔟 SECURITY DESIGN

We send to LLM:

Task title

Task description

Skill tag

Similar past steps (titles only)

We DO NOT send:

PII

Salary

Client confidential data

Raw DB dumps

Safe feature.

1️⃣1️⃣ FUTURE SLM MIGRATION PLAN

We designed:

Input JSON → LLM → Strict JSON Output

Later:

Replace OpenAI call with local SLM inference

Keep same schema

Keep same validation

No redesign required.

1️⃣2️⃣ EDGE CASE HANDLING
Case 1: Very short task

AI may generate generic steps.
Solution:

Show confidence indicator later (optional).

Case 2: Too many steps

Backend truncates after 8.

Case 3: Wrong durations

Reject response.

1️⃣3️⃣ WHAT YOU WILL TELL ANTIGRAVITY (FINAL SUMMARY)

We are implementing an AI-powered task planning assistant.

Flow:

Manager enters task description.

Clicks Generate Steps.

Backend builds context and calls LLM.

LLM returns structured JSON steps.

Backend validates structure strictly.

UI shows editable preview.

On confirmation, steps are saved into task_steps.

Allocated hours and points auto-calculated.

AI metadata stored for audit.

No auto-save without manager approval.

This feature uses LLM only for structured planning and reasoning.