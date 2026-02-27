# Operational Walkthrough: Functional Verification

*Note: This walkthrough validates the current working state of the build via deep-code analysis and local server telemetry.*

## 🟢 1. Persona-Driven Dashboards
- **Executive Persona**: High-level "Bird's Eye View". Can see all employees across projects, total payroll liability, and recruitment health. 
- **Manager Persona**: Operational control. Manages direct reports, assigns tasks, and handles administrative approvals (Leaves/Tasks).
- **Employee Persona**: Execution focused. A distraction-free environment to manage current tasks and personal attendance.

## 2. Task Lifecycle: The "Proof to Point" Engine
- **Creation**: Manager creates a task (e.g., "API Integration") and defines its steps.
- **Execution**: Employee starts the task, changing its state to `In Progress`.
- **Validation**: Employee uploads a screenshot/log. The task enters a "Validation Pending" state.
- **Approval**: Manager reviews the proof. If valid, they "Approve".
- **Points**: The `trg_calculate_points` trigger automatically awards points based on the time efficiency of this cycle.


## 🟢 2. Hiring Pipeline (ATS)
- **Flow**: Executive Dashboard → Hiring Portal → Candidates.
- **Logic**: Uses `ATSDataContext`. CRUD operations for candidates are fully functional.
- **UI State**: Responsive data tables with score progress bars (calculated from `candidate.score`).
- **Feature Check**: "Eye" icon triggers `CandidateProfile` view, pulling real-time metadata from the `profiles` table.

## 🟢 3. The "Attendance" Logic Flow
- **Step 1 (Check-in)**: Employee clicks "Clock In".
- **Backend Action**: `rpc_clock_in.sql` executes. It checks for open sessions today.
- **Safety**: Re-clicks are ignored (Idempotency check).
- **Step 2 (Check-out)**: Employee clicks "Clock Out".
- **Business Logic**: System calculates duration. If `< 4 hours`, status is auto-set to `'half_day'`.

## 🟢 4. Task Submission & Points
- **Flow**: Employee Dashboard → My Tasks → Lifecycle Steps.
- **Action**: User uploads "Proof" (triggers Supabase Storage).
- **Logic**: On completion, `trg_calculate_points` fires in the DB.
- **Result**: Global leaderboard is updated immediately with the new point tally.

## 🟢 5. Automated Payroll Run
- **Flow**: Executive → Module Page → Payroll.
- **Action**: Admin triggers monthly generation.
- **Execution**: `generate_monthly_payroll` batch-processes all active employees.
- **Data Integrity**: Uses `COALESCE` to handle missing financial records safely, preventing script crashes.

---

## 🛠️ Verification Verdict
**Build Status**: **STABLE**
The core "Decision-Making" engine has been migrated to the server-side, making the current version of TalentOps significantly more secure and faster than the previous iterations.
