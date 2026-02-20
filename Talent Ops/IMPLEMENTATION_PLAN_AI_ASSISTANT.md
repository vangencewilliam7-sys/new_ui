# Implementation Plan: AI-Native Planning Assistant

This document outlines the step-by-step implementation for the AI-powered task planning feature in TalentOps.

## 1. Objective
Enable managers to automatically generate structured task execution steps from a task description using an LLM.

## 2. Architecture Adaptation

### 2.1 AI Logic Layer: Supabase Edge Function (`supabase/functions/generate-task-plan`)
For security and consistency, the LLM logic will live in a server-side Edge Function.
- **Security**: The OpenAI API key is stored in **Supabase Secrets**, never exposed to the frontend.
- **Functionality**:
    *   **Data Scrubbing**: The function receives the task description and skill tags.
    *   **Context Retrieval**: It calls a specialized RPC to get generic step titles from past similar tasks.
    *   **LLM Call**: It builds the final prompt and calls OpenAI.
    *   **Validation**: It enforces the 2h/4h rule and JSON structure before sending data back to the UI.

### 2.2 Hook Enhancement (`services/modules/task/hooks/useTaskPhases.js`)
Update the hook to support bulk step updates.
- **Added Functionality**: `applyAISuggestedSteps(phaseKey, steps)`
- This will map the AI response to the `taskStepsToAdd` state and trigger the auto-calculation of total hours.

### 2.3 UI Components: AI Suggestion Overlay (`AISuggestionOverlay.jsx`)
Create a new glassmorphic popup that acts as the "Decision Point" for the manager.
- **Visual Structure**: 
    - A vertical list showing all participating phases (e.g. Requirements, Design, Build).
    - Under each phase title, the AI-suggested steps are listed.
- **Interactive Features**:
    - **Editable Steps**: Each suggested step title and duration (2h/4h) can be edited directly inside the popup.
    - **Phase Toggles**: Ability to exclude a suggested phase if the AI went too broad.
- **The "Three Paths" Action Bar**:
    1. **"Continue & Apply"**: Closes the popup and **immediately transfers** all suggested/edited steps into the main `AddTaskModal` UI. Each phase tab (Requirements, Build, etc.) will now show the AI-generated checklist.
    2. **"Edit Manually" (X Button/Dismiss)**: Closes the popup without applying, returning the manager to the standard empty manual entry view.
    3. **"Regenerate"**: Re-calls the AI service for a fresh perspective.

### 2.5 Database Schema & RPC Details
We will modify the existing schema and add two precise RPCs.

#### **A. Schema Updates (`tasks` table)**
- **New Column**: `ai_metadata` (JSONB)
    - Stores: `overall_risks` (array), `assumptions` (array), `model_used` (text), `generated_at` (timestamp).
    - Default: `{}` (Empty JSON object).

#### **B. Context Retrieval RPC (`rpc_get_similar_task_context`)**
- **Input**: `p_skill_tag` (text), `p_limit` (int, default 5)
- **Logic**:
    - Finds the last `p_limit` tasks with matching `skill_tag`.
    - Joins with `task_steps` to get step titles.
    - **Returns**: JSON array of `{ task_title, steps: [title1, title2...] }`.
    - **Security**: Strips all user IDs, timestamps, and sensitive info.

#### **C. Persistence RPC (`rpc_bulk_save_task_plan`)**
- **Input**: 
    - `p_task_id` (UUID)
    - `p_steps` (JSON array of step objects)
    - `p_ai_metadata` (JSON objects)
- **Logic (Transaction)**:
    1.  **Insert Steps**: Loops through `p_steps` and inserts into `task_steps` with correct `order_index`.
    2.  **Update Task**: Sets `tasks.ai_metadata = p_ai_metadata`.
    3.  **Recalculate**: Updates `tasks.allocated_hours` = SUM(step hours) and `tasks.points` = hours * 10.
    - **Returns**: Success boolean.

### Phase 2: React Hook Integration
- Extend `useTaskPhases` with `applyBatchPlan(fullPlan)` which efficiently updates the state for multiple phases simultaneously.

### Phase 3: The AI Suggestion Popup
- Build the `AISuggestionOverlay` component.
- Implement the "Edit-in-Place" logic for the suggested steps.
- Add smooth Framer Motion transitions for opening/closing the overlay.

### Phase 4: Integration & Verification
- Connect the "Generate" button in `AddTaskModal` to the new service and popup.
- Verify total hour auto-calculation logic when a batch plan is applied.
- Final database verification.

## 4. Risks & Mitigations
- **Non-Deterministic Output**: Mitigation: The Strict Validation Layer rejects any JSON that doesn't follow the 2h/4h rule.
- **Hallucinations**: Mitigation: Manager remains the ultimate "Human-in-the-loop," approving or editing all AI drafts.

---
**Status**: Ready for Review
