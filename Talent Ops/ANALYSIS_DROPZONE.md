# Analysis Dropzone

Paste the content you want me to analyze below. Once saved, I will provide a technical breakdown, identifying patterns, risks, and functional logic.

## 📥 Your Input Content
<!-- PASTE CONTENT HERE -->

The Antigravity Script-Generator Prompt
Role: You are a Senior Sales Engineer and Technical Product Manager.

Task: Create a 15-minute "Technical Storytelling" pitch script for TalentOps. The audience is a former Salesforce Recruiting Leader and Workday Platform Owner who values automation, scalability, and data integrity.

Analysis Required:

Extract Logic: Scan supabase/functions and database.sql (or your migrations). Specifically, find the code for trg_calculate_points, rpc_compute_task_risk_metrics, and the task_lifecycle states.

Map Personas: Analyze how the UI (shared/AllTasksView.jsx, DashboardHome.jsx) morphs for Executive, Manager, and Employee roles.

Audit AI Integration: Identify how analyze-task-risk (Edge Function) and task_risk_snapshots interact with the live task data.

Script Requirements (Output Format):
Produce an artifact named final_pitch_script.md structured as follows:

Introduction (3 mins): Focus on the "Operational Integrity" philosophy. Use the technical fact that we use a "Server-Authoritative" model to explain why this is better than standard HR tools.

The Task Engine (5 mins): A step-by-step walkthrough of the "Proof-to-Point" cycle. Use the actual column names and table logic (e.g., how the points formula is hardcoded in SQL to prevent tampering) to prove security.

The AI Governance (4 mins): Explain the "Risk Engine." Detail how the code calculates the 'Progress Ratio' and why the AI intervenes before a deadline. Mention the specific RPCs that handle this.

The Executive "ROI" (3 mins): Explain the automated payroll and global analytics.

Technical "Flex" Sidebar: Provide 3-5 high-level technical details (e.g., Row Level Security, Atomic Transactions, Real-time Broadcast) that will impress a Workday expert.

Constraint: The tone must be professional, sophisticated, and peer-to-peer. Avoid "salesy" language; focus on "Architectural Certainty."
---

## ⚡ Assistant Technical Analysis

### 1. Logic Extraction Summary
- **The Points Engine (`trg_calculate_points`)**: Located in `calculate_task_points.sql`. It uses a `BEFORE INSERT OR UPDATE` trigger on `task_submissions`. It calculates `final_points` based on `allocated_hours` vs `actual_hours`, applying a mathematical bonus for efficiency and a penalty for delays. This is hardcoded in SQL, ensuring **immutable business rules**.
- **The Risk Engine (`rpc_compute_task_risk_metrics`)**: A complex PL/pgSQL function that derives a `progress_ratio` and `predicted_delay_hours`. It categorizes risks (🔴 High, 🟡 Medium, 🟢 Low) based on velocity rather than just proximity to a deadline.
- **Task Lifecycle States**: Managed via a state machine (`Backlog` → `In Progress` → `Validation Pending` → `Approved/Rejected`) enforced through both table constraints and RPC orchestration.

### 2. Persona Mapping (UI Morphing)
- **Executive**: Focused on `DashboardHome.jsx` showing Org-Wide Analytics, Payroll liability, and Hiring Pipeline. Use `ATSDataContext` for high-level candidate scoring.
- **Manager**: Controls the "Validation Pending" queue in `AllTasksView.jsx`. Has the exclusive privilege to fire the "Approve/Reject" RPCs.
- **Employee**: Distraction-free view in `MyTasksPage.jsx` with the `AIAssistantPopup` for real-time risk remediation and proof upload.

### 3. AI Governance Audit
- **Edge Integration**: Metrics from `rpc_compute_task_risk_metrics` are passed to the `analyze-task-risk` Edge Function.
- **Persona Alignment**: The AI acts as a **High-Performance Productivity Coach**, generating human-centric "Reasons" and "Actions" to resolve technical debt before it becomes a delay.
- **Traceability**: All AI logic is snapshotted in `task_risk_snapshots` with a confidence score, ensuring a "Human-in-the-Loop" fallback.

### 🚀 Artifact Generated: `final_pitch_script.md`
I have produced a 15-minute technical storytelling script designed for a Workday/Salesforce-level audience. It emphasizes **Architectural Certainty**, **Atomic Transactions**, and **Server-Authoritative logic**.

