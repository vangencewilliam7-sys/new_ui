# Architecture Evolution: AI Risk System Migration

## Overview
This document outlines the transition of the TalentOps AI Risk Coaching system from a frontend-heavy implementation to a robust, server-side architecture using Supabase Remote Procedure Calls (RPCs).

## The Issue: Frontend Fragmented Logic
Previously, the "math" behind task risk (calculating delays, progress percentages, and urgency) was performed directly in the React frontend. This led to several critical problems:
1. **Source of Truth Mismatch:** Different parts of the app (My Tasks vs. Manager Dashboard) could calculate risk slightly differently.
2. **"Dead Sync" Progress:** The AI Coach was only aware of granular checklist "Steps." If a user moved through high-level "Lifecycle Phases" without adding checklist steps, the AI would report 0% progress, causing confusion.
3. **Status Fragility:** The frontend logic used different naming conventions (like `done` vs `completed`) than the database, causing the AI to ignore actual progress.
4. **Performance:** Calculating complex predictions for dozens of tasks on every page load put unnecessary strain on the client's browser.

## The Solution: Centralized RPC Architecture
We refactored the system to move all mathematical reasoning into the database layer via a Supabase RPC function: `rpc_compute_task_risk_metrics`.

### Key Improvements:
1. **Single Source of Truth:** All parts of the application now call the same database function. There is zero chance of inconsistent data.
2. **Context-Aware Progress:** The logic now automatically falls back to "Lifecycle Phase" progress if no granular steps exist. If you finish 3 out of 5 phases, the AI now correctly recognizes 60% progress.
3. **Data Integrity:** The RPC handles the mapping between internal database statuses (`completed`) and the AI's requirements, ensuring the AI never misses a finished task.
4. **Reduced Complexity:** The React code is now significantly cleaner. It no longer does math; it simply asks the database for the "Risk Metrics" and displays the results.

## Impact on AI Accuracy
By moving logic to the RPC, the AI Productivity Coach is now "context-aware." It understands both the micro-details (checklist steps) and the macro-progress (lifecycle stages), making its advice more human, accurate, and reliable.
