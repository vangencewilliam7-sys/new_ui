# Product Capabilities: TalentOps Suite

## 🚀 Current Module Matrix

### 1. Unified Applicant Tracking (ATS)
- **Dynamic Job Boards**: Create and manage job openings with custom requirements.
- **Candidate Pipeline**: Visual drag-and-drop progression (Applied → Interview → Offer).
- **Automated Scorecards**: AI-ready candidate scoring system based on tech scores and recruiter notes.
- **"Secret Sauce"**: Deep skill mapping linked directly to the `skills_master` table.

### 2. High-Precision Payroll Engine
- **One-Click Generation**: Batch-process payroll for the entire organization in seconds via `generate_monthly_payroll`.
- **Deduction Intelligence**: Automatic LOP (Loss of Pay) and PT (Professional Tax) calculations based on integrated attendance data.
- **Payslip Automation**: Secure PDF generation and distribution.

### 3. gamified Task & Performance System
- **Lifecycle Tracking**: Tasks broken into granular steps with required "Proof of Work" (Documents/Photos).
- **Points Economy**: Automatic rewarding of efficiency (Bonus for early completion) and accountability (Penalty for late completion).
- **Departmental Rankings**: Real-time leaderboards to drive healthy competition and meritocracy.

### 4. Enterprise Communication Hub
- **Internal Messaging**: Integrated DM, Team, and Org-wide channels.
- **Announcement Protocol**: Targeted broadcasting with read-tracking and notification pings.
- **Collaboration**: File sharing directly within the task context.

---

## 📈 The Potential (Enterprise Scale-Up)

| Capability | Current State | Enterprise Future |
| :--- | :--- | :--- |
| **Integrations** | Supabase Internal | Slack, Workday, and SAP SuccessFactors API Hooks. |
| **Automation** | Trigger-based logic | LLM-driven candidate pre-screening and task summarization. |
| **Analytics** | Individual Performance | Predictive Churn Analysis (AI Risk Model Evolution). |
| **Global Scale** | Single Org Support | Multi-tenant "Parent-Child" Org structures for conglomerates. |

---

## 🏗️ Technical Highlights
- **Zero-Knowledge UI**: Components don't know the DB schema. They only know what "Action" they want to take.
- **Atomic Operations**: An announcement never goes out without a notification. A payroll never runs twice for the same month.
- **State Sovereignty**: All "Clock-In" times are server-verified, preventing local machine clock manipulation.

---

## 🔄 Task Lifecycle & Step Generation
TalentOps features a sophisticated "Lifecycle" engine that transitions tasks from concept to completion.

### 1. Conceptualization & Persona Mapping
- **Exec/Manager View**: Tasks are created at the project level, assigned a priority (Low to Urgent), and allocated hours.
- **Dynamic Step Generation**: Tasks can be broken down into granular logical blocks (`task_steps`). 
    - *Example*: A "UI Design" task can have steps for "Wireframing", "Color Theory", and "Prototype".

### 2. Transition States
Tasks move through a strict state machine:
- **`Backlog`**: Created but not started.
- **`In Progress`**: Active work.
- **`Validation Pending`**: Employee has submitted proof; awaiting Manager review.
- **`Approved/Rejected`**: Terminal states. Rejection sends the task back to `In Progress` with feedback.

### 3. The Persona Loop
- **Employee Persona**: "Proof of Work" (images/logs) is uploaded via `shared/AllTasksView.jsx`.
- **Manager Persona**: Receives a notification, reviews the proof, and clicks "Approve" (triggers `handleApproveTask`).
- **Executive Persona**: Views the aggregated "Velocity" and "Org Accuracy" stats in the `DashboardHome`.

