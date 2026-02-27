# Deep Dive: The TalentOps Task Module

## 1. Module Philosophy
The Task Module is the engine of TalentOps. It transforms raw labor into measurable productivity through a **Verification-Based Lifecycle**. Unlike generic to-do lists, no task is considered "Done" until its "Proof of Work" is validated by a human authority and audited by a server-side point engine.

---

## 2. The Data Core
The module spans three primary tables with high-integrity relational links:
- **`tasks`**: The definition layer. Stores title, priority, allocated hours, and the target persona/assignee.
- **`task_steps`**: The granularity layer. Each task is a collection of steps, ensuring complex items are manageable.
- **`task_submissions`**: The evidence layer. Stores the actual time spent, proof-of-work URLs, and the final audited points.

---

## 3. Persona Workflows

### 🛡️ The Executive Persona (The Observer)
- **Objective**: Operational oversight.
- **Capabilities**: Views the "Org-Wide Accuracy" and "Project Velocity."
- **Insight**: Analyzes which projects are hitting roadblocks and where point-tally performance is lagging.

### 👔 The Manager Persona (The Architect)
- **Objective**: Task creation and quality control.
- **Workflow**:
    1. **Initialization**: Creates a task and assigns it to a Project/Employee.
    2. **Refinement**: Generates `task_steps` to guide the worker.
    3. **Review**: Monitors the "Validation Pending" queue. Reviews uploaded proofs and decides to **Approve** (settles points) or **Reject** (returns to worker).

### 👥 The Team Lead Persona (The Milestone Manager)
- **Objective**: Removing technical roadblocks.
- **Capability**: Focuses on "In Progress" tasks. Can reassign or modify priorities based on shifting project requirements.

### 👷 The Employee Persona (The Performer)
- **Objective**: Execution and evidence gathering.
- **Workflow**:
    1. **Pick-up**: Views "Pending" tasks, changes state to `In Progress`.
    2. **Execution**: Logic tracks time spent.
    3. **Submission**: Uploads "Proof" (screenshot/log/document) via the `AllTasksView` interface.

---

## 4. The Task Lifecycle State Machine

| State | Who is Active? | Significance |
| :--- | :--- | :--- |
| **Backlog** | Manager | Task is defined but unassigned or not started. |
| **In Progress** | Employee | Active work session. The "timer" is effectively running. |
| **Validation Pending** | Manager | The "Hand-off." Employee has finished; Manager must verify the quality. |
| **Approved** | Server (Audit) | Terminal Success. Points are awarded via `trg_calculate_points`. |
| **Rejected** | Employee | Terminal Failure. Task returns to `In Progress` for remediation. |

---

## 5. The "Secret Sauce": Automated Points Engine
When a Manager clicks **Approve**, a PostgreSQL trigger (`trg_calculate_points`) executes the following logic:

1.  **Base Pay**: `allocated_hours * 10`.
2.  **Efficiency Bonus**: If `actual_hours < allocated_hours`, points are increased.
3.  **Delay Penalty**: If `actual_hours > allocated_hours`, points are docked.
4.  **Immutability**: Once points are set in the `task_submissions` record, they cannot be edited manually, ensuring a tamper-proof meritocracy.

---

## 6. Technical Implementation
- **Frontend Component**: `shared/AllTasksView.jsx` (Orchestrates the UI state and filtering).
- **Backend Orchestration**: `supabase.rpc('handle_task_lifecycle')` (Ensures that state transitions are valid and role-checked).
- **Real-Time Context**: The `TaskLifecyclePage` uses Supabase Realtime to push status updates to Managers as soon as an Employee hits "Submit Proof".

---

## 7. AI-Native Intelligence Layer
TalentOps goes beyond simple tracking by embedding a predictive AI layer directly into the task lifecycle.

### 🧠 A. Predictive Risk Modeling (`rpc_compute_task_risk_metrics`)
The system doesn't wait for a deadline to pass to flag a problem. Instead, the "Risk Engine" runs constantly:
- **Velocity Tracking**: It compares `steps_completed` against `elapsed_hours` to calculate a real-time **Progress Ratio**.
- **Predicted Outcomes**: The system mathematically predicts the `predicted_total_hours` required to finish the task.
- **Risk Categorization**:
    - 🔴 **High Risk**: Predicted delay > 2 hours or > 20% of the total budget.
    - 🟡 **Medium Risk**: Predicted delay > 0.5 hours.

### 🤖 B. AI Assistant & Edge Analysis
When a task is flagged as **High Risk**, the "AI Native" architecture kicks into gear:
- **Edge Processing**: Task metrics are sent to the `analyze-task-risk` Edge Function.
- **Root Cause Analysis**: The AI analyzes the specific steps lagging and provides actionable advice.
- **Assistant Popup**: Employees receive proactive recommendations in the `AIAssistantPopup` (e.g., *"You've spent 4 hours on Step 1, which usually takes 1 hour. Consider asking for assistance on the technical documentation."*)

### 📸 C. Risk Snapshots & Historical Learning
Every AI analysis is captured in the **`task_risk_snapshots`** table.
- **Audit Trail**: Managers can see the AI's "Confidence Score" and "Reasons" for every risk flag.
- **Actions Taken**: The system tracks which AI-recommended actions was implemented by the employee.

### 🔔 D. Smart Proactive Notifications
Managed via `rpc_insert_task_risk_snapshot`, the AI triggers role-specific alerts:
- **Employee Alerts**: "Near Deadline" warnings (when < 2h remain) and "Half-Time" checkpoints (at 50% elapsed hours).
- **Manager Alerts**: Immediate notification of "High Risk" predictions to allow for early intervention.

