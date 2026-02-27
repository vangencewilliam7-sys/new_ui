# Technical Architecture: TalentOps Ecosystem

## Executive Summary
TalentOps is built on a modern, high-performance stack designed for scale and security. The architecture has evolved from a traditional "Thick Client" (where logic lived in the browser) to a sophisticated **Server-Authoritative RPC Model**, ensuring that business rules are immutable and tamper-proof.

---

## 🏗️ Core Technology Stack

| Layer | Technology | Rationale |
| :--- | :--- | :--- |
| **Frontend** | React 18 (TypeScript) + Vite | Sub-second HMR and strong typing for complex UI states. |
| **UI Framework** | TailwindCSS + Radix UI | Accessible, premium design system with utility-first speed. |
| **Animations** | Framer Motion + GSAP | High-fidelity micro-interactions and smooth transitions. |
| **Backend** | Supabase (PostgreSQL + PostgREST) | Real-time capabilities and enterprise-grade relational power. |
| **Logic Layer** | PL/pgSQL (Server-Side RPC) | High-performance execution, atomic transactions, and security. |
| **3D Rendering** | Three.js + R3F | Used for advanced data visualization and brand aesthetic. |

---

## 🔐 The "Secret Sauce": Server-Authoritative Logic
Unlike standard "No-Code" or "Simple CRUD" apps, TalentOps treats the database as the **Brain**, not just a storage box.

### 1. RPC-Driven Actions
Critical business flows (Payroll, Attendance, Task Proofs) do not happen in the React layers. They are orchestrated via **Supabase RPCs**.
- **Result**: Even if a user "hacks" the frontend, they cannot change their salary or clock-in time because the server derives weights and timestamps independently using `auth.uid()` and `NOW()`.

### 2. Automated Points Engine
A proprietary PostgreSQL trigger system (`trg_calculate_points`) automatically evaluates employee performance on every submission.
- **Formula**: `Base (Allocated Hrs) + Bonus (Early Completion) - Penalty (Late Completion)`.
- **Stat**: 100% automated performance scoring with zero human bias.

### 3. Real-Time Synchronization
Leveraging Supabase's Realtime broadcast, the `MessagingHub` and `AttendanceTracker` sync states across the organization in **<200ms**, eliminating the need for manual refreshes.

---

## 📡 Data Flow Overview
1.  **Trigger**: User performs an action (e.g., Submtting Task Proof).
2.  **Dispatch**: React component calls `supabase.rpc('complete_task')`.
3.  **Validate**: Postgres function verifies the user's role and task status.
4.  **Execute**: SQL performs atomic updates across `tasks`, `points`, and `notifications`.
5.  **Broadcast**: Change is emitted to the UI via Realtime subscriptions.

---

## 🛡️ Security Architecture
- **Defense-in-Depth**: Row Level Security (RLS) locks tables by default.
- **Controlled Access**: `SECURITY DEFINER` RPCs allow specific "privileged" paths for complex logic without exposing full table access to the client.
- **Enterprise IAM**: Integration with Supabase Auth for JWT-based session management and Role-Based Access Control (RBAC).

---

## 🎭 Role-Based Dashboard Architecture
TalentOps uses a modular dashboard pattern where the UI morphs based on the authenticated user's profile:

| Persona | Module | Core Logic Hook |
| :--- | :--- | :--- |
| **Executive** | `ExecutiveDashboard` | Org-wide analytics, P&L, across-the-board hiring and payroll. |
| **Org Manager** | `ManagerDashboard` | Team performance, task assignment, leave approvals. |
| **Employee** | `EmployeeDashboard` | Task execution, proof submission, personal growth tracking. |
| **Project Manager**| `TeamLeadDashboard`| Project milestones, technical roadblocks, team velocity. |

