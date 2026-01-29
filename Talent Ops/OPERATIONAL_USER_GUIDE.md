# Talent Ops Application: Operational & User Flow Guide

## 1. Introduction
This document serves as a comprehensive operational guide for the **Talent Ops** application. It details the user flows, screen features, and specific actions available within the Employee and Manager dashboards.

## 2. Authentication & Entry
All users enter through the standardized **Login Page**.
*   **Action**: Enter Email & Password -> Click "Login".
*   **System Logic**:
    *   Authenticates via Supabase Auth.
    *   Fetches the user's `role` from the `profiles` table.
    *   **Routing**: Automatically redirects to the appropriate dashboard (Employee, Manager, Executive, etc.) based on the assigned role.

---

## 3. Employee Dashboard Overview
Upon logging in, the Employee is greeted by the **Dashboard Home**.

### 3.1. Dashboard Home (`/dashboard`)
**Primary Function**: Daily attendance and quick status overview.

*   **Attendance Tracker (Centerpiece)**:
    *   **Visual**: A large, interactive card showing user status (Offline/Online/Break).
    *   **Action - Check In**: Click the large "Login" button.
        *   *Result*: Starts the session timer, updates status to "Active Session", and logs entry in `attendance` table.
    *   **Action - Check Out**: Click the "Check Out" button.
        *   *Result*: Stops the timer, calculates total hours, and logs exit time. Requires confirmation to ensure tasks are logged.
    *   **Action - Toggle Break**: Click "Coffee" icon button.
        *   *Result*: Updates status to "On Break" (yellow indicator). Timer continues but is flagged as break time.
    *   **Input - Current Focus**: A text field to type what you are currently working on. Saves automatically on blur.

*   **Quick Stats (Top row)**:
    *   **Attendance**: Shows number of Present vs Absent days for the month.
    *   **Leave Balance**: Shows remaining leaves vs Total quota.

*   **Timeline & Notes**:
    *   **Timeline**: Displays upcoming announcements or events targeted at the user's team.
    *   **Digital Sticky Notes**: A quick scratchpad for personal reminders (persisted locally or in DB).

---

## 4. Task Management (`/my-tasks`)
**Primary Function**: Managing daily work items through the **Task Lifecycle**.

*   **Interface**:
    *   **Dark Premium Header**: "Task Lifecycle" banner.
    *   **Filters**: Search bar (Title/Project), Date Picker, Status Dropdown.

*   **The "Lifecycle" Flow**:
    *   Each task moves through 5 phases: **Requirements -> Design -> Build -> Acceptance -> Deployment**.
    *   **Visual Indicator**: A stepper with 5 colored dots (Green = Done, Blue = Current, Grey = Future).

*   **Key Actions**:
    *   **Upload Proof (Primary Progress Driver)**:
        *   *Trigger*: Click the "Upload" (Cloud) icon on a task.
        *   *UI*: Opens "Submission" Modal.
        *   *Action*: Upload a file (image/doc) or type a text summary.
        *   *System Logic*:
            1.  Uploads file to Supabase Storage.
            2.  Updates the current lifecycle phase (e.g., marks "Design" as pending validation).
            3.  **Auto-Advance**: If valid, moves the task to the *next* phase automatically.
            4.  **Skill Capture**: If the task completes all phases, a **Skill Selection Modal** may appear, asking the user to tag skills used (e.g., "React", "SQL").

    *   **Log Issue**:
        *   *Trigger*: Click "Alert" (Triangle) icon.
        *   *Action*: Type an issue description.
        *   *Result*: Flags the task with `has_issues=true` and appends the note to the task history. Managers are alerted.

    *   **Request Access**:
        *   *Trigger*: Click "Lock" icon (if task is overdue/locked).
        *   *Action*: Request time extension or unlock.

---

## 5. Team & Role Management (`/team-members`)
**Primary Function**: Viewing the active roster and managing team roles.

*   **Interface**: A detailed `DataTable` listing all members of the current project.
*   **Columns**: Name, Role (Badge), Department, Status (Active/Offline), Join Date, Actions.

*   **Feature: Role Handover (NEW)**
    *   *Availability*: Only visible to **Project Managers** or **Team Leads**.
    *   *Flow*:
        1.  **Locate Target**: Find the team member you want to promote in the list.
        2.  **Open Menu**: Click the new **3-Dot Menu** (Kebab icon) in the "Actions" column.
        3.  **Select Action**: Click **"Handover Role"**.
        4.  **Confirmation Safety**:
            *   A modal appears with a **Warning**: "You are about to transfer your Project Manager role to [Name]. You will lose administrative privileges."
        5.  **Confirm**: Click "Confirm Handover".
    *   *System Logic*:
        *   Calls `handover_project_role` RPC.
        *   **Atomic Swap**: Target becomes Manager; You become Employee.
        *   **Real-time Refresh**: The UI immediately reloads permissions. You will see your buttons disappear and your badge change to "Employee" instantly.

---

## 6. Leave Management (`/leaves`)
**Primary Function**: Applying for time off and tracking approval status.

*   **Interface**:
    *   **Apply Modal**: Click "Apply Leave" (Plus button).
    *   **History Table**: Lists all past requests.

*   **Flow**:
    *   **User**: Selects Dates -> Selects Reason (Sick/Casual) -> Submits.
    *   **System**: Creates a `pending` record in `leaves` table.
    *   **Manager View**:
        *   Managers see an **"Approve Leaves"** page.
        *   Actions: **Approve** (Green Check) or **Reject** (Red X).
        *   *Result*: Updates status, notifies employee via `notifications` table.

---

## 7. Operational Technical Detail
This section explains "How it works" under the hood for technical context.

### 7.1. State Management (The "Brain")
The frontend uses **React Context** to keep data consistent across pages without reloading.
*   **`UserContext`**: Holds specific User ID, Team ID, and Org ID.
*   **`ProjectContext`**:
    *   Tracks which Project is currently active (e.g., "Talent Ops" vs "Website Redesign").
    *   Determines **Permissions** (e.g., "Can this user see the Handover button?").
    *   **Why this matters**: When you switch projects in the sidebar, the whole dashboard instantly filters tasks and members for *that* specific project.

### 7.2. "Universal" ModulePage
Many pages (Team Members, Leaves, Policies) share a single smart component: `ModulePage.jsx`.
*   **Efficiency**: Instead of coding 10 separate pages, we use one adaptable page that changes based on the "Type" passed to it.
*   **Example**:
    *   Pass `type="workforce"` -> Renders Team Table.
    *   Pass `type="policies"` -> Renders PDF List.
    *   Pass `type="leaves"` -> Renders Leave Forms.

### 7.3. Real-Time Updates
The dashboard uses **Supabase Realtime** channels.
*   **Effect**: If a Manager approves your leave, your screen updates *instantly* without you refreshing the page.
*   **Effect**: If you Handover your role, your permissions revoke *instantly*.

---

## 8. Summary of Capabilities by Role

| Feature | Employee | Project Manager |
| :--- | :--- | :--- |
| **Attendance** | Check In/Out | View Team Log |
| **Tasks** | View Own, Upload Proof, Log Issue | View All, Assign, Validate Proofs |
| **Team** | View Members | **Handover Role**, Manage Members |
| **Leaves** | Apply, View Status | **Approve/Reject Requests** |
| **Analytics** | Own Performance | Team Performance |
| **Settings** | Personal Profile | Project Settings |

