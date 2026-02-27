# Architecture Evolution: Centralized Server-Side Logic

## Overview
This document outlines the systematic migration of core business logic from the frontend React application to the Supabase database layer using Remote Procedure Calls (RPCs). This architectural shift ensures data integrity, security, and a single source of truth across the TalentOps platform.

## The Issue: Fragmented Frontend Logic
Previously, critical business rules for Attendance, Profile Management, and Payroll were implemented directly in the frontend components. This approach had several drawbacks:
1.  **Security Risks:** Users could potentially bypass frontend checks (e.g., manually changing their role or salary in the local state).
2.  **Logic Inconsistency:** Different components might calculate stay duration or payroll tax slightly differently, leading to data mismatches.
3.  **Performance Overhead:** The client browser was forced to perform complex batch calculations, especially in the Payroll and Attendance modules.
4.  **Limited Scalability:** Adding new platforms (like a mobile app) would require duplicating all the business logic.

## The Logic Migration Flow: End-to-End

To ensure consistency, every module now follows a standardized **"Request-Execute-Respond"** flow:

1.  **UI Interaction (React):** A user performs an action (e.g., clicks "Clock In", updates profile).
2.  **Service Call:** The React frontend triggers a service call (e.g., `attendanceService`).
3.  **RPC Invocation:** The service invokes the appropriate **Supabase RPC** (SQL function).
4.  **Database Processing:** All calculations, security checks, and data updates are handled by the database in one atomic move.
5.  **Clean Response:** The DB returns a simple JSON object (success/failure + data).
6.  **UI Sync:** The React frontend displays the result immediately to the user with zero complex local calculation.

## The Solution: Remote Procedure Calls (RPCs)
We refactored these modules to use **Supabase RPCs**. Instead of the frontend *performing* the logic, it now *requests* the logic to be executed by the database.

### Key Strategic Benefits:
*   **Single Source of Truth:** One SQL function manages the rules for the entire platform.
*   **Server-Side Validation:** All role checks and data constraints are enforced at the database level (`SECURITY DEFINER`), making them impossible to bypass from the UI.
*   **Atomic Operations:** Complex multi-table updates (like generating payroll for an entire organization) now happen in a single database transaction.
*   **Simplified Frontend:** React components are now "thin" and focused purely on UI, making the codebase easier to maintain.

## Impact on System Modules
*   **Attendance:** Clocks and session management are now managed by a centralized timer in the DB.
*   **Profile:** Updates are restricted to a "Safe List" of columns, protecting sensitive organization data.
*   **Payroll:** Financial calculations are standardized and locked, ensuring every employee's payslip is generated using the exact same formula.
*   **AI Risk:** Calculations now account for both checklist steps and high-level project phases, providing much more accurate coaching insights.
