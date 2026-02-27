# Implementation Plan: AI-Native Planning Assistant

This document outlines the step-by-step implementation for the AI-powered task planning feature in TalentOps.

## 1. Objective
Enable managers to automatically generate structured task execution steps from a task description using an LLM.

## 2. Architecture Adaptation

### 2.1 AI Service Layer — ✅ IMPLEMENTED
- **Supabase Edge Function**: `supabase/functions/generate-task-plan/index.ts`
  - Handles LLM interaction securely (API key in Supabase Secrets, never exposed to frontend)
  - Fetches similar past tasks via `rpc_get_similar_task_context` for context-aware suggestions
  - Strict JSON validation layer (2h/4h duration rule, max 8 steps)
  - PII scrubbing: Only task titles/steps sent to LLM, no user data
- **React Hook**: `services/modules/task/hooks/useAIPlanning.js`
  - Manages AI planning session state (loading, error, result, overlay visibility)
  - Calls `supabase.functions.invoke('generate-task-plan', ...)` securely
  - SRP: Only handles AI lifecycle, does not touch form or phase state

### 2.2 Hook Enhancement — ✅ IMPLEMENTED (`services/modules/task/hooks/useTaskPhases.js`)
- **Added**: `applyBatchPlan(suggestedSteps)` function
  - Maps AI response (flat step array) to `taskStepsToAdd` state grouped by phase
  - Replaces phases that have AI suggestions, keeps others intact

### 2.3 UI Components — ✅ IMPLEMENTED
- **AddTaskModal.jsx**: 
  - ✨ "Generate Steps (AI)" button with gradient styling, placed next to the Execution Steps header
  - Disabled state when title/description are empty (guards against empty prompts)
  - Loading spinner with "Generating..." text during LLM call
  - Error display for failed generations
  - Auto-calculates `Allocated Hours` when AI steps are applied
- **AISuggestionOverlay.jsx** (`services/modules/task/components/`):
  - Glassmorphic overlay popup for reviewing AI-generated steps
  - Groups steps by lifecycle phase with editable titles
  - Duration dropdowns (2h/4h only)
  - Risk badges (low/medium/high) per step
  - Remove step buttons
  - Summary badges (total steps, total hours, points)
  - Risks & Assumptions section from AI metadata
  - Actions: "Continue & Apply", "Cancel", "Regenerate"
  - All inline styles (matching codebase pattern, no Tailwind dependency)

### 2.4 Data Persistence — ✅ IMPLEMENTED (`services/modules/task/mutations.js`)
- `createTask` now accepts `aiMetadata` parameter
- Persists `ai_metadata` JSONB column on the `tasks` table when present
- Backwards-compatible: existing task creation without AI works unchanged

## 3. Implementation Phases

### Phase 1: AI Logic & Context Building — ✅ COMPLETE
- [x] Supabase Edge Function with LLM interaction
- [x] Context retrieval via `rpc_get_similar_task_context` RPC
- [x] Strict JSON validation layer (2h/4h rule enforcement)
- [x] PII scrubbing (no user data sent to LLM)

### Phase 2: React Hook Integration — ✅ COMPLETE
- [x] `useAIPlanning` hook (SRP: AI session management)
- [x] `useTaskPhases.applyBatchPlan()` for batch step insertion
- [x] Auto-calculation of `newTask.allocatedHours` from AI steps

### Phase 3: Premium UI Overlay — ✅ COMPLETE
- [x] AISuggestionOverlay component with inline styles
- [x] Editable AI steps (manager can modify titles, durations)
- [x] Phase-grouped display with risk badges
- [x] Summary statistics (steps, hours, points)
- [x] Micro-animations (fadeIn, slideUp, spinner)

### Phase 4: Database & Verification — ✅ COMPLETE
- [x] `feature_ai_planning_migration.sql` executed (ai_metadata column, RPCs)
- [x] `createTask` mutation passes `aiMetadata` to Supabase
- [x] `task_steps` include `estimated_hours` from AI steps

## 4. Files Modified/Created

| File | Status | Description |
|------|--------|-------------|
| `supabase/functions/generate-task-plan/index.ts` | ✅ Created | Edge Function for AI planning |
| `services/modules/task/hooks/useAIPlanning.js` | ✅ Created | AI planning session hook |
| `services/modules/task/components/AISuggestionOverlay.jsx` | ✅ Created | Review/edit overlay |
| `services/modules/task/hooks/useTaskPhases.js` | ✅ Modified | Added `applyBatchPlan` |
| `services/modules/task/AddTaskModal.jsx` | ✅ Modified | AI button, overlay, wiring |
| `services/modules/task/mutations.js` | ✅ Modified | `aiMetadata` persistence |
| `feature_ai_planning_migration.sql` | ✅ Executed | Schema + RPCs |

## 5. Deployment Checklist

- [ ] **Deploy Edge Function**: `supabase functions deploy generate-task-plan`
- [ ] **Set Secret**: `supabase secrets set OPENAI_API_KEY=sk-...`
- [ ] **Verify RPC**: Test `rpc_get_similar_task_context` with sample skills
- [ ] **End-to-End Test**: Create a task with AI-generated steps

## 6. Risks & Mitigations
- **Non-Deterministic Output**: Mitigation: The Strict Validation Layer rejects any JSON that doesn't follow the 2h/4h rule.
- **Hallucinations**: Mitigation: Manager remains the ultimate "Human-in-the-loop," approving or editing all AI drafts.
- **API Key Exposure**: Mitigation: Key stored in Supabase Secrets, never in frontend `.env`.

---
**Status**: ✅ Implementation Complete — Pending Deployment
