# Frontend Architecture & Implementation Guide

This document provides a detailed overview of the frontend architecture for the **Talent Ops** application (specifically the `new_ui/Talent Ops` directory). It covers the technology stack, folder structure, core components, state management, and the recent implementation of the "Role Handover" feature.

## 1. Technology Stack

*   **Framework**: React (Vite)
*   **Routing**: `react-router-dom` (v6)
*   **Styling**:
    *   Tailwind CSS (Configured in `tailwind.config.js`)
    *   Vanilla CSS (Variables and custom classes in `index.css` and `employee/index.css`)
    *   Inline styles (Heavily used in `ModulePage.jsx` for dynamic components)
*   **Icons**: `lucide-react`
*   **Backend Integration**: Supabase Client (`@supabase/supabase-js`)
*   **Charts/Visuals**: `recharts` (implied from typical "My Analytics" features)

## 2. Directory Structure

```
new_ui/Talent Ops/
├── components/
│   ├── employee/          # Components specific to Employee View
│   │   ├── components/    # UI elements (UI/DataTable, Demo/*, Layout/*)
│   │   ├── context/       # React Context Providers (User, Project, Toast)
│   │   └── pages/         # Page Logic (ModulePage, DashboardHome, etc.)
│   ├── manager/           # Components for Manager View
│   ├── pages/             # Main Dashboard Layouts (EmployeeDashboard.tsx, etc.)
│   └── shared/            # Shared components (MessagingHub, RoleGuard, etc.)
├── lib/                   # Utilities
│   └── supabaseClient.js  # Supabase configuration
├── App.tsx                # Main Application Entry & Routing
└── main.tsx               # ReactDOM Root
```

## 3. Core Architecture & Routing

### App.tsx
The application uses a centered routing strategy in `App.tsx`. usage of `react-router-dom`:
*   **Public Routes**: `/`, `/login`, `/forgot-password`.
*   **Protected Routes**: Wrapped in specific dashboard layouts (e.g., `/employee-dashboard/*`).
*   **Theme Provider**: A global `ThemeProvider` wraps the authenticated routes.

### Dashboard Layouts
Each role (Employee, Manager, etc.) has its own Dashboard Layout component (e.g., `components/pages/EmployeeDashboard.tsx`).
*   **RoleGuard**: Protects the route based on the user's role (e.g., `allowedRoles={['employee']}`).
*   **Context Wrappers**: The dashboard wraps all child routes with necessary providers:
    *   `UserProvider`: User session, profile, and team data.
    *   `ProjectProvider`: Logic for Project Switching and Role checks.
    *   `ToastProvider`: Global notification system.

## 4. State Management (Context API)

The application relies heavily on React Context for global state.

### UserContext (`components/employee/context/UserContext.jsx`)
*   **Purpose**: Manages Supabase Auth session, fetches user profile (`profiles` table), and determines the user's Organization and Team ID.
*   **Key Values**: `userName`, `userRole`, `userId`, `orgId`, `teamId`.

### ProjectContext (`components/employee/context/ProjectContext.jsx`)
*   **Purpose**: Manages the currently selected **Project** and the user's **Role** within that project.
*   **Logic**:
    *   Fetches multiple projects for the user from `project_members`.
    *   Calculates `projectRole` (e.g., 'manager', 'employee', 'team_lead').
    *   **Crucial for Handover**: Exposes `refreshProjects()` to re-fetch data immediately after role changes.

## 5. The "Universal" Page Component: ModulePage.jsx

The file `components/employee/pages/ModulePage.jsx` is a massive "Smart Component" that renders completely different UIs based on the `type` prop passed via the Router.

**Supported Types:**
*   `workforce`: Renders the "Team Members" list using `DataTable`.
*   `leaves`: Renders Leave Request forms and history.
*   `policies`: Renders list of downloadable PDF policies.
*   `analytics`: Renders analytical charts (via `AnalyticsDemo`).

**Data Handling in ModulePage:**
*   It uses `useEffect` hooks to fetch data based on the current `userId` and `type`.
*   It handles all actions: Downloading, Approving Leaves, Viewing Details, and **Handing Over Roles**.

## 6. Feature Deep Dive: Role Handover

The "Handover Role" feature was implemented to allow Project Managers/Team Leads to transfer their administrative duties to another member.

### Implementation Flow

1.  **Frontend (UI)**:
    *   Located in `ModulePage.jsx` (under `type === 'workforce'`).
    *   **Visibility Check**: Checks if `projectRole` is 'manager', 'project_manager', or 'team_lead'.
    *   **Action**: Clicking the "Kebab Menu" -> "Handover Role" triggers `initiatHandover`.

2.  **Confirmation (`showHandoverModal`)**:
    *   A modal warns the user that they will lose administrative privileges immediately.
    *   Confirming calls `confirmHandover`.

3.  **Backend (Supabase RPC)**:
    *   Function: `handover_project_role(project_id, target_user_id)`.
    *   **Logic**:
        1.  Verifies the caller is a Manager/Team Lead.
        2.  Updates the Target User's role to the Sender's role.
        3.  Downgrades the Sender's role to 'employee'.
        4.  Syncs changes to `team_members` table if applicable.

4.  **State Update (The "Refresh" Fix)**:
    *   Previously, the UI remained stale after the backend update.
    *   **Fix**: We exposed `refreshProjects` from `ProjectContext`.
    *   **Flow**: `confirmHandover` -> `await refreshProjects()` -> **Context Updates Role** -> **UI Re-renders**.

### Key Code Snippet (ModulePage.jsx)

```javascript
const confirmHandover = async () => {
    // 1. Call Backend
    const { error } = await supabase.rpc('handover_project_role', { ... });

    // 2. Refresh Context (Critical Step)
    if (refreshProjects) await refreshProjects();

    // 3. Trigger Local UI Refresh
    setRefreshTrigger(prev => prev + 1);
};
```

## 7. How to Extend

*   **Adding a New Page**:
    1.  Add a generic layout support in `ModulePage.jsx` for a new `type` OR create a standalone page in `components/employee/pages/`.
    2.  Register the route in `EmployeeDashboard.tsx`.
*   **Adding Global State**:
    1.  Create a Context in `components/employee/context/`.
    2.  Wrap the Layout in `EmployeeDashboard.tsx`.

## 8. Summary of Recent Fixes

*   **Role Handling**: Fixed logic to accept both `'manager'` and `'project_manager'` strings from the database.
*   **Real-time Update**: Implemented `refreshProjects` to ensure the user sees their new "Employee" view immediately after handing over the "Manager" role.
