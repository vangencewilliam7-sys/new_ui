# TalentOps: Comprehensive Application Documentation

## 1. Introduction
This document serves as the **Master Guide** for the TalentOps application. It details every dashboard, page, feature, and action available across all four user roles: **Executive (Org Admin)**, **Manager**, **Team Lead**, and **Employee**.

---

# Part 1: Executive Dashboard (Organization Admin)
**Route**: `/executive-dashboard`
**Purpose**: Full control and visibility over the entire organization, including all employees, projects, payroll, and hiring.

## 1.1. Organization Management

### 1.1.1. Dashboard Home (`/dashboard`)
*   **Purpose**: High-level overview of organization health.
*   **Key Features**:
    *   **Live Clock & Attendance Stats**: Real-time count of total employees present vs. absent.
    *   **Quick Actions**: Add New Employee, Post Announcement.
    *   **Timeline**: View upcoming organizational events.
*   **Button Actions**:
    *   `Add Employee` -> Opens modal to create a new user profile.
    *   `Post Announcement` -> Opens form to broadcast a message to specific teams or the whole org.

### 1.1.2. Employees (`/employees`)
*   **Purpose**: The central directory of all staff members.
*   **Key Features**:
    *   **DataTable**: Lists Name, Role, Team, Status, and Join Date.
    *   **Filtering**: Search by name or filter by department.
*   **Button Actions**:
    *   `View Profile` (Eye Icon) -> Sees detailed profile (contact info, skills).
    *   `Edit` (Pencil Icon) -> Updates user details (role, team assignment).
    *   `Delete` (Trash Icon) -> Removes user from the organization (soft delete).

### 1.1.3. Employee Status (`/employee-status`)
*   **Purpose**: Monitor real-time online/offline status of the workforce.
*   **Key Features**:
    *   **Live Status Indicators**: Green (Online), Yellow (Break), Grey (Offline).
    *   **Last Active**: Timestamp of last interaction.

### 1.1.4. Leave Requests (`/leaves`)
*   **Purpose**: Final approval authority for leave requests escalated or system-wide.
*   **Key Features**:
    *   **Request List**: Shows Employee Name, Date Range, Reason, and Current Status.
*   **Button Actions**:
    *   `Approve` (Green Check) -> Grants leave, deducts from quota, notifies user.
    *   `Reject` (Red X) -> Denies leave, refunds quota (if pre-deducted), sends notification.

### 1.1.5. Payroll (`/payroll`)
*   **Purpose**: Generate and manage monthly salaries.
*   **Key Features**:
    *   **Generation Tool**: Select Month/Year to calculate salaries based on attendance.
    *   **Review Table**: Verify calculated amounts before release.
*   **Button Actions**:
    *   `Run Payroll` -> Triggers backend calculation engine.
    *   `Release Slips` -> Publishes payslips to all employees for the selected period.

### 1.1.6. Payslips (`/payslips`)
*   **Purpose**: Archive of all generated payslips.
*   **Key Features**:
    *   **Search**: Find slips by employee name or date.
    *   **Download**: Export PDF versions of specific slips.

### 1.1.7. Invoice (`/invoice`)
*   **Purpose**: Manage billing for clients or internal cost centers.
*   **Key Features**:
    *   **Create Invoice**: Form to input items, rates, and client details.
    *   **History**: List of sent and paid invoices.

### 1.1.8. Hiring Portal (`/hiring`)
*   **Purpose**: Applicant Tracking System (ATS) for recruiting.
*   **Key Features**:
    *   **Job Postings**: Create and manage open roles.
    *   **Candidate Board**: Kanban board (Applied -> Interview -> Offer -> Hired).
*   **Button Actions**:
    *   `Create Job` -> Publishes new opening.
    *   `Drag & Drop` -> Moves candidate cards between stages.
    *   `Schedule Interview` -> Integrates with calendar to set meeting times.

### 1.1.9. Org Hierarchy (`/hierarchy`)
*   **Purpose**: Visual tree diagram of the entire organization structure (CEO -> Managers -> Leads -> Employees).

### 1.1.10. Announcements (`/announcements`)
*   **Purpose**: History of all broadcasted messages.
*   **Button Actions**: `Delete` -> Remove outdated announcements.

### 1.1.11. Policies (`/policies`)
*   **Purpose**: Repository of HR documents (Handbooks, NDAs).
*   **Button Actions**: `Upload Policy` (PDF) -> Adds new document to the library accessible by all.

### 1.1.12. Reviews & Rankings (`/executive-reviews`, `/rankings`)
*   **Purpose**: Performance management.
*   **Key Features**:
    *   **Performance Reviews**: Conduct monthly/quarterly assessments.
    *   **Leaderboard**: View top performing employees based on task completion and ratings.

## 1.2. Project Management

### 1.2.1. Projects (`/projects`)
*   **Purpose**: High-level portfolio view of all active projects.
*   **Key Features**:
    *   **Card View**: Each project shown with progress bar, budget status, and team lead.
*   **Button Actions**:
    *   `Create Project` -> Initialize new project workspace.
    *   `Assign Manager` -> Designate a Project Manager.

### 1.2.2. Tasks (`/tasks`)
*   **Purpose**: Master list of ALL tasks across the organization.
*   **Key Features**:
    *   **Global Search**: Find any task by ID or Title.
    *   **Filter**: By Status (Backlog, In Progress, Done) or Priority.

### 1.2.3. Project Analytics (`/project-analytics`)
*   **Purpose**: Data visualization for project health.
*   **Key Features**:
    *   **Burn-down Charts**: Track velocity.
    *   **Resource Allocation**: See which teams are overloaded.

---

# Part 2: Manager Dashboard
**Route**: `/manager-dashboard`
**Purpose**: Bridge between Executive strategy and Team execution. Manages specific projects and team welfare.

## 2.1. Organization & Team Management

### 2.1.1. Dashboard Home (`/dashboard`)
*   **Purpose**: Daily operational hub.
*   **Key Features**:
    *   **Team Attendance**: Who from my team is here?
    *   **Pending Approvals**: Quick links to leave requests or task reviews waiting for action.

### 2.1.2. Team Members (`/employees`)
*   **Purpose**: Manage direct reports.
*   **Key Features**: Same as Executive but scoped to the Manager's *Project/Department*.
*   **Button Actions**:
    *   `Handover Role` (Special): Transfer "Manager" permissions to a Team Lead (downgrades self to Employee). *Requires Confirmation*.

### 2.1.3. Leave Requests (`/leaves` & `/my-leaves`)
*   **Purpose**: Two-fold function:
    1.  **Approve Leaves**: Review requests from direct reports.
    2.  **My Leaves**: Apply for own time off (goes to Executive).

### 2.1.4. Payroll & Payslips (`/payroll`, `/payslips`)
*   **Purpose**: View-only access to team compensation data (if authorized) and personal payslips.

## 2.2. Project Execution

### 2.2.1. All Project Tasks (`/tasks`)
*   **Purpose**: Oversee all work items in the assigned project.
*   **Key Features**:
    *   **Filters**: View by Assignee (Member A vs Member B).
    *   **Validation**: Review status of tasks marked "Pending Validation".

### 2.2.2. My Tasks (`/personal-tasks`)
*   **Purpose**: Work items assigned specifically to the Manager (IC work).
*   **Key Features**: Upload Proof, Log Issues (same as Employee).

### 2.2.3. Documents (`/documents`)
*   **Purpose**: Project-specific file storage.
*   **Button Actions**: `Upload` -> Add specs, designs, or contracts.

---

# Part 3: Team Lead Dashboard
**Route**: `/teamlead-dashboard`
**Purpose**: Hands-on technical leadership. Coding/working alongside the team while unblocking them.

## 3.1. Team Oversight

### 3.1.1. Dashboard Home
*   **Purpose**: Tactical view of the sprint/week.
*   **Key Features**:
    *   **Blocker Alerts**: Highlight tasks with "Issues" logged.
    *   **Sprint Progress**: % of tasks completed vs due date.

### 3.1.2. Team Tasks (`/team-tasks`)
*   **Purpose**: Detailed view of what the squad is doing.
*   **Key Features**:
    *   **Re-assign**: Move tasks from overloaded member to free member.
    *   **Unlock**: Grant extensions for overdue tasks.

### 3.1.3. Performance (`/performance`)
*   **Purpose**: Track individual contributor metrics.
*   **Key Features**:
    *   **Velocity**: Tasks completed per week per member.
    *   **Quality**: Rejection rate of submitted proofs.

## 3.2. Personal Contribution

### 3.2.1. My Tasks (`/my-tasks`)
*   **Purpose**: The Team Lead's own deliverables.
*   **Features**: Full Task Lifecycle (Require -> Design -> Build -> Accept -> Deploy).

---

# Part 4: Employee Dashboard
**Route**: `/employee-dashboard`
**Purpose**: Individual Contributor focus. Doing work, logging time, and self-service HR.

## 4.1. Work Execution

### 4.1.1. Dashboard Home (`/dashboard`)
*   **Major Feature: Attendance Tracker**
    *   **Check In**: Starts timer.
    *   **Check Out**: Ends day, logs hours. (Requires confirmation).
    *   **Break**: Pauses active work timer.
    *   **Focus Input**: "What are you working on?" text field.

### 4.1.2. My Tasks (`/my-tasks`)
*   **Purpose**: The core work bench.
*   **The Lifecycle Flow**:
    1.  **View Task**: Read description & due date.
    2.  **Work**: Perform the task offline/in-code.
    3.  **Upload Proof** (Cloud Icon): Submit screenshot/link.
        *   *Auto-Action*: Moves task to next phase (e.g., Build -> Acceptance).
    4.  **Skill Tagging**: On completion, popup asks "What skills did you use?" (e.g., React, SQL).
    5.  **Log Issue**: Report blockers to Team Lead.

### 4.1.3. Team Members (`/team-members`)
*   **Purpose**: See who is on your project.
*   **Visibility**: Read-only view of name and role. (No edit/delete/handover permissions).

## 4.2. Self-Service HR

### 4.2.1. Leaves (`/leaves`)
*   **Action**: `Apply Leave` -> Select Dates + Reason.
*   **View**: See status (Pending -> Approved/Rejected).

### 4.2.2. Policies (`/policies`)
*   **Action**: Read/Download company handbooks.

### 4.2.3. Raise Ticket (`/raise-ticket`)
*   **Purpose**: Report IT or HR grievances.
*   **Action**: Submit form -> Goes to Admin queue.

### 4.2.4. My Analytics (`/analytics`)
*   **Purpose**: Self-improvement.
*   **Data**: View own task completion rate and attendance consistency.

---

# 5. Shared Features (All Roles)

### 5.1. Messaging Hub (`/messages`)
*   **Feature**: Real-time internal chat.
*   **Capabilities**: 1-on-1 DMs and Group (Project) channels.

### 5.2. Profile Settings (`/settings`)
*   **Feature**: Update password, profile picture, and contact phone number.

### 5.3. Notifications
*   **Feature**: Toast popups (Top-right) for:
    *   Task Assignments
    *   Leave Approvals
    *   Announcements
    *   Errors/Success messages

### 5.4. Role Handover
*   **Special Feature**: Available to **Managers** and **Team Leads**.
*   **Function**: Allows transferring leadership role to another member instantly via the "Team Members" page kebab menu.
