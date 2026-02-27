ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS skills text[] DEFAULT '{}';

-- Also ensure task_steps has specific columns if needed, but it seems fine from previous views.
-- Wait, user also mentioned "phases". Phases are conceptually handled by `phase_validations` JSONB in current code?
-- Let's check `phase_validations` usage. 
-- In AddTaskModal: `phase_validations: { active_phases: [...] }`
-- So I just need to make sure I update that JSONB structure when editing phases.

-- Just adding skills column for now.
