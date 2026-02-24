import { supabase } from '../../../lib/supabaseClient';
import { uploadMultipleFiles } from '../../storageService';

/**
 * Task Workflow
 * Handles complex state transitions: Approvals, Rejections, Proofs, Reviews.
 */

// Lifecycle Definitions
const LIFECYCLE_PHASES = [
    { key: 'requirement_refiner', label: 'Requirements', short: 'R' },
    { key: 'design_guidance', label: 'Design', short: 'Ds' },
    { key: 'build_guidance', label: 'Build', short: 'B' },
    { key: 'acceptance_criteria', label: 'Acceptance', short: 'A' },
    { key: 'deployment', label: 'Deployment', short: 'D' }
];

const getPhaseIndex = (phase) => LIFECYCLE_PHASES.findIndex(p => p.key === phase);

/**
 * Submit Proof for a task phase.
 * 
 * FOLLOWS SOLID PRINCIPLES:
 * - SRP: Storage logic moved to StorageService.
 * - Dependency Inversion: Workflow logic depends on an abstraction (service) not raw bucket calls.
 */
export const submitTaskProof = async ({
    task,
    user,
    proofFile = null,
    proofFiles = [],
    proofText = '',
    proofHours,
    orgId,
    onProgress
}) => {
    try {
        // Normalize files: support both single file and array
        const filesToUpload = proofFile ? [proofFile] : (proofFiles || []);

        if (!proofText?.trim() && filesToUpload.length === 0) {
            throw new Error('Please provide proof text or upload files');
        }

        // ── 1. Upload Files ──
        let newFileUrls = [];
        let evidenceRecords = [];

        if (filesToUpload.length > 0) {
            // Use the new StorageService to handle sanitization and upload
            // We use a clean nested path [org]/[user]/[task] for organization
            // and original naming (with light sanitization) for the file.
            const uploadResults = await uploadMultipleFiles({
                bucket: 'task-proofs',
                path: `${orgId || 'no-org'}/${user.id}/${task.id}`,
                files: filesToUpload,
                onProgress: (p) => onProgress?.(Math.round(p * 0.6) + 10) // 10% to 70% range
            });

            newFileUrls = uploadResults.map(r => r.publicUrl);
            evidenceRecords = uploadResults.map(r => ({
                file_url: r.publicUrl,
                file_type: r.fileType,
                file_name: r.fileName
            }));
        }

        // ── 2. Determine Current Phase ──
        const activePhases = task.phase_validations?.active_phases
            || LIFECYCLE_PHASES.map(p => p.key);
        const validActivePhases = activePhases.filter(
            pk => pk !== 'closed' && LIFECYCLE_PHASES.some(p => p.key === pk)
        );

        let currentPhase = task.lifecycle_state || validActivePhases[0] || 'requirement_refiner';
        if (!validActivePhases.includes(currentPhase)) {
            currentPhase = validActivePhases[0] || 'requirement_refiner';
        }

        // ── 3. Merge Proof URLs with Existing ──
        const currentValidations = task.phase_validations || {};
        const existingPhaseVal = currentValidations[currentPhase] || {};

        let combinedUrls = [];
        if (existingPhaseVal.proof_url) {
            try {
                const parsed = JSON.parse(existingPhaseVal.proof_url);
                combinedUrls = Array.isArray(parsed) ? parsed : [existingPhaseVal.proof_url];
            } catch {
                combinedUrls = [existingPhaseVal.proof_url];
            }
        }
        combinedUrls = [...combinedUrls, ...newFileUrls];
        const combinedUrlsString = combinedUrls.length > 0 ? JSON.stringify(combinedUrls) : null;

        // Merge proof text
        const combinedText = [existingPhaseVal.proof_text, proofText].filter(Boolean).join('\n---\n');

        // ── 4. Phase Advancement ──
        let nextPhase = currentPhase;
        const currentActiveIndex = validActivePhases.indexOf(currentPhase);

        if (currentActiveIndex !== -1 && currentActiveIndex < validActivePhases.length - 1) {
            for (let i = currentActiveIndex + 1; i < validActivePhases.length; i++) {
                const pKey = validActivePhases[i];
                const phaseVal = currentValidations[pKey];
                if (!phaseVal?.proof_url && !phaseVal?.proof_text) {
                    nextPhase = pKey;
                    break;
                }
                if (i === validActivePhases.length - 1) {
                    nextPhase = validActivePhases[validActivePhases.length - 1];
                }
            }
        }

        // ── 5. Build Updated Validations ──
        const updatedValidations = {
            ...currentValidations,
            [currentPhase]: {
                ...existingPhaseVal,
                status: 'pending',
                proof_url: combinedUrlsString,
                proof_text: combinedText || null,
                submitted_at: new Date().toISOString(),
                validated: false
            }
        };

        // ── 6. Prepare Task Updates ──
        const updates = {
            phase_validations: updatedValidations,
            proof_url: combinedUrlsString,    // Legacy column
            proof_text: combinedText || null,  // Legacy column
            sub_state: nextPhase !== currentPhase ? 'in_progress' : 'pending_validation',
            status: 'in_progress',
            updated_at: new Date().toISOString()
        };

        if (nextPhase !== currentPhase) {
            updates.lifecycle_state = nextPhase;
        }

        onProgress?.(75);

        const { error } = await supabase.from('tasks').update(updates).eq('id', task.id);
        if (error) throw error;

        // ── 7. Record Submission ──
        let submissionId = null;
        try {
            const { data: existingSub } = await supabase
                .from('task_submissions')
                .select('id')
                .eq('task_id', task.id)
                .eq('user_id', user.id)
                .maybeSingle();

            if (existingSub) {
                submissionId = existingSub.id;
                const subUpdates = {
                    submitted_at: new Date().toISOString()
                };
                if (proofHours) subUpdates.actual_hours = parseFloat(proofHours);
                if (proofText) subUpdates.description = proofText;

                await supabase
                    .from('task_submissions')
                    .update(subUpdates)
                    .eq('id', existingSub.id);
            } else {
                const insertPayload = {
                    task_id: task.id,
                    user_id: user.id,
                    submitted_at: new Date().toISOString()
                };
                if (proofHours) insertPayload.actual_hours = parseFloat(proofHours);
                if (proofText) insertPayload.description = proofText;
                if (orgId) insertPayload.org_id = orgId;

                const { data: newSub } = await supabase
                    .from('task_submissions')
                    .insert(insertPayload)
                    .select('id')
                    .maybeSingle();

                submissionId = newSub?.id;
            }
        } catch (subErr) {
            // Non-fatal: task was already updated, just log the submission error
            console.warn('Service: task_submissions record failed (non-fatal):', subErr.message);
        }

        // ── 8. Record Evidence ──
        if (submissionId && evidenceRecords.length > 0) {
            try {
                const evidencePayload = evidenceRecords.map(e => ({
                    submission_id: submissionId,
                    file_url: e.file_url,
                    file_type: e.file_type,
                    org_id: orgId || null,
                    uploaded_at: new Date().toISOString()
                }));

                await supabase.from('task_evidence').insert(evidencePayload);
            } catch (evErr) {
                console.warn('Service: task_evidence insert failed (non-fatal):', evErr.message);
            }
        }

        onProgress?.(100);

        // ── 9. Fetch Points Feedback ──
        let pointData = null;
        try {
            const { data } = await supabase
                .from('task_submissions')
                .select('final_points, bonus_points, penalty_points')
                .eq('task_id', task.id)
                .eq('user_id', user.id)
                .maybeSingle();
            pointData = data;
        } catch {
            // Non-fatal
        }

        return { updatedValidations, pointData };

    } catch (error) {
        console.error('Service: Submit Proof Error:', error);
        throw error;
    }
};

export const processAccessReview = async ({
    task,
    action, // 'approve', 'close', 'reassign'
    user,
    orgId,
    reason, // for close
    reassignTarget // id
}) => {
    try {
        if (action === 'approve') {
            await supabase.from('tasks').update({
                access_status: 'approved',
                is_locked: false
            }).eq('id', task.id).eq('org_id', orgId);

            await supabase.from('notifications').insert({
                receiver_id: task.assigned_to,
                sender_id: user.id,
                message: `Access approved for task: ${task.title}`,
                type: 'access_approved',
                is_read: false,
                created_at: new Date().toISOString(),
                org_id: orgId
            });

        } else if (action === 'close') {
            await supabase.from('tasks').update({
                status: 'completed',
                closed_by_manager: true,
                closed_reason: reason,
                access_status: 'rejected',
                is_locked: true
            }).eq('id', task.id).eq('org_id', orgId);

            await supabase.from('notifications').insert({
                receiver_id: task.assigned_to,
                sender_id: user.id,
                message: `Task closed by manager: ${task.title}. Reason: ${reason}`,
                type: 'task_closed',
                is_read: false,
                created_at: new Date().toISOString(),
                org_id: orgId
            });

        } else if (action === 'reassign') {
            // 1. Ensure new assignee is in project
            if (task.project_id) {
                const { data: existingMembers } = await supabase
                    .from('project_members')
                    .select('id')
                    .eq('project_id', task.project_id)
                    .eq('user_id', reassignTarget)
                    .eq('org_id', orgId);

                if (!existingMembers || existingMembers.length === 0) {
                    await supabase.from('project_members').insert({
                        project_id: task.project_id,
                        user_id: reassignTarget,
                        role: 'employee',
                        org_id: orgId
                    });
                }
            }

            // 2. Close OLD task
            await supabase.from('tasks').update({
                status: 'completed',
                closed_by_manager: true,
                closed_reason: `Reassigned`,
                reassigned_to: reassignTarget,
                reassigned_at: new Date().toISOString(),
                access_status: 'rejected',
                is_locked: true
            }).eq('id', task.id).eq('org_id', orgId);

            // 3. Create NEW task
            const {
                id, created_at, updated_at,
                assignee_name, assignee_avatar, assigned_by_name, project_name,
                reassigned_from_name, reassigned_to_name,
                ...taskData
            } = task;

            const newTaskPayload = {
                ...taskData,
                assigned_to: reassignTarget,
                org_id: orgId,
                status: 'pending',
                lifecycle_state: 'requirement_refiner',
                sub_state: 'pending_validation',
                phase_validations: {
                    active_phases: taskData.phase_validations?.active_phases || ['requirement_refiner', 'design_guidance', 'build_guidance', 'acceptance_criteria', 'deployment']
                },
                proof_url: null,
                proof_text: null,
                reassigned_to: null,
                reassigned_at: new Date().toISOString(),
                access_requested: false,
                access_status: 'approved',
                access_reason: 'Reassigned by manager',
                access_requested_at: null,
                closed_by_manager: false,
                closed_reason: null,
                is_locked: false
            };

            await supabase.from('tasks').insert(newTaskPayload);

            // 4. Notify NEW assignee
            await supabase.from('notifications').insert({
                receiver_id: reassignTarget,
                sender_id: user.id,
                message: `You have been reassigned task: ${task.title}`,
                type: 'task_assigned',
                is_read: false,
                created_at: new Date().toISOString(),
                org_id: orgId
            });

            // 5. Notify OLD assignee
            await supabase.from('notifications').insert({
                receiver_id: task.assigned_to,
                sender_id: user.id,
                message: `Task "${task.title}" has been reassigned to another team member.`,
                type: 'task_closed',
                is_read: false,
                created_at: new Date().toISOString(),
                org_id: orgId
            });
        }
    } catch (error) {
        console.error('Service: Process Access Review Error:', error);
        throw error;
    }
};

export const approveTaskPhase = async (task, phaseKey, orgId) => {
    const currentValidations = task.phase_validations || {};
    const phaseData = currentValidations[phaseKey];
    if (!phaseData) throw new Error('Phase data not found');

    const updatedValidations = {
        ...currentValidations,
        [phaseKey]: {
            ...phaseData,
            status: 'approved',
            validated: true, // Set validated to true for Green UI
            approved_at: new Date().toISOString()
        }
    };

    // Determine Active Phases
    const activePhases = task.phase_validations?.active_phases || LIFECYCLE_PHASES.map(p => p.key);

    // Check if we need to advance the lifecycle state
    let nextPhase = task.lifecycle_state;
    const currentIndex = activePhases.indexOf(phaseKey);

    if (currentIndex !== -1 && currentIndex < activePhases.length - 1) {
        nextPhase = activePhases[currentIndex + 1];
    }

    // New Sub State Logic
    const hasOtherPending = Object.entries(updatedValidations).some(([key, val]) => key !== phaseKey && val.status === 'pending');
    const newSubState = hasOtherPending ? 'pending_validation' : 'in_progress';

    const updates = {
        phase_validations: updatedValidations,
        sub_state: newSubState,
        lifecycle_state: nextPhase,
        updated_at: new Date().toISOString()
    };

    await supabase.from('tasks').update(updates).eq('id', task.id).eq('org_id', orgId);

    // Check completion (All phases approved?)
    const lastPhaseKey = activePhases[activePhases.length - 1];
    const isLastPhaseApproved = updatedValidations[lastPhaseKey]?.status === 'approved';

    if (isLastPhaseApproved && task.status !== 'completed') {
        await supabase.from('tasks').update({ status: 'completed' }).eq('id', task.id).eq('org_id', orgId);
    }

    return { updatedValidations, newSubState, isCompleted: isLastPhaseApproved };
};

export const rejectTaskPhase = async (task, phaseKey, orgId) => {
    const currentValidations = task.phase_validations || {};
    const phaseData = currentValidations[phaseKey];
    if (!phaseData) throw new Error('Phase data not found');

    const updatedValidations = {
        ...currentValidations,
        [phaseKey]: {
            ...phaseData,
            status: 'rejected',
            rejected_at: new Date().toISOString()
        }
    };

    const updates = {
        phase_validations: updatedValidations,
        sub_state: 'in_progress',
        updated_at: new Date().toISOString()
    };

    await supabase.from('tasks').update(updates).eq('id', task.id).eq('org_id', orgId);
    return updatedValidations;
};

export const approveTaskLegacy = async (task, orgId) => {
    // Approve all pending phases
    const validations = task.phase_validations || {};
    const pendingPhases = Object.keys(validations).filter(key => validations[key].status === 'pending');

    const updatedValidations = { ...validations };
    pendingPhases.forEach(key => {
        updatedValidations[key] = { ...updatedValidations[key], status: 'approved', approved_at: new Date().toISOString() };
    });

    const updates = {
        phase_validations: updatedValidations,
        updated_at: new Date().toISOString(),
        sub_state: 'in_progress'
    };

    await supabase.from('tasks').update(updates).eq('id', task.id).eq('org_id', orgId);

    // Check completion
    const phasesToCheck = updatedValidations.active_phases || LIFECYCLE_PHASES.map(p => p.key);
    const lastPhaseKey = phasesToCheck[phasesToCheck.length - 1];
    const isLastPhaseApproved = updatedValidations[lastPhaseKey]?.status === 'approved';

    if (isLastPhaseApproved && task.status !== 'completed') {
        await supabase.from('tasks').update({ status: 'completed' }).eq('id', task.id).eq('org_id', orgId);
    }

    return { updatedValidations, isCompleted: isLastPhaseApproved };
};

export const rejectTaskLegacy = async (task, orgId) => {
    await supabase
        .from('tasks')
        .update({
            sub_state: 'in_progress',
            updated_at: new Date().toISOString()
        })
        .eq('id', task.id)
        .eq('org_id', orgId);
    return true;
};
