# Performance Evaluation Module Integration

I have successfully integrated the **Performance Evaluation** module into your application.

## Changes Made

### 1. Sidebar Updates (New!)
I added a **Review** tab under the **Organization** section in the sidebar for all roles:
- **Employee**: Links to `/employee-dashboard/review`
- **Manager**: Links to `/manager-dashboard/team-reviews`
- **Executive**: Links to `/executive-dashboard/executive-reviews`
- **Team Lead**: Links to `/teamlead-dashboard/team-reviews`

### 2. Dashboard Routes Updated
The following dashboard routers now include performance routes:

**Employee Dashboard (`EmployeeDashboard.tsx`):**
- `/performance` -> `TeamPerformanceAnalytics.jsx`
- `/review` -> `EmployeeReviewPage.jsx`
- `/rankings` -> `FullRankingPage.jsx`

**Manager Dashboard (`ManagerDashboard.tsx`):**
- `/team-reviews` -> `ManagerReviewPage.jsx`
- `/rankings` -> `FullRankingPage.jsx`
- `/performance` -> `TeamPerformanceAnalytics.jsx`

**Executive Dashboard (`ExecutiveDashboard.tsx`):**
- `/executive-reviews` -> `ExecutiveReviewPage.jsx`
- `/rankings` -> `FullRankingPage.jsx`

**Team Lead Dashboard (`TeamLeadDashboard.tsx`):**
- `/team-reviews` -> `ManagerReviewPage.jsx`

### 3. Database Schema
I created a SQL migration file at:
`new_ui/Talent Ops/performance_evaluation_schema.sql`

### 4. Module Relocation
- Moved files to `new_ui/Talent Ops/components/performance`.

## Next Steps for You

1.  **Install Dependencies:**
    ```bash
    cd "new_ui/Talent Ops"
    npm install
    ```

2.  **Run Database Migration:**
    - Execute `new_ui/Talent Ops/performance_evaluation_schema.sql` in your Supabase SQL Editor.

3.  **Start the Server:**
    ```bash
    npm run dev
    ```

## Verification
- Click on the new **Review** tab in the sidebar (under Organization) to access the module.
