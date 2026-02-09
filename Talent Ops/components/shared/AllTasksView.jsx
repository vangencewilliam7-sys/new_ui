import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Eye, Calendar, ChevronDown, X, Clock, ExternalLink, ThumbsUp, ThumbsDown, AlertTriangle, CheckCircle2, AlertCircle, Edit2, Trash2, Upload, FileText, Send, ListTodo, Award, StickyNote, Archive } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { supabaseRequest } from '../../lib/supabaseRequest';
import { useProject } from '../employee/context/ProjectContext';
import SkillBadgeIndicator from './SkillBadgeIndicator';
import TaskSkillsSection from './TaskSkillsSection';
import { calculateDueDateTime } from '../../lib/businessHoursUtils';
import TaskNotesModal from './TaskNotesModal';
import TaskDetailOverlay from '../employee/components/UI/TaskDetailOverlay';


const AllTasksView = ({ userRole = 'employee', projectRole = 'employee', userId, orgId, addToast, viewMode = 'default', projectId, onBack }) => {
    const { currentProject, projectRole: contextProjectRole } = useProject();

    // Determine which project ID to use: Prop takes precedence over context
    const effectiveProjectId = projectId || currentProject?.id;

    // Use context role if available AND we are using context project, otherwise prop
    const effectiveProjectRole = (currentProject && !projectId) ? contextProjectRole : projectRole;

    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [employees, setEmployees] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilters, setStatusFilters] = useState(['pending', 'in_progress', 'on_hold']); // Default active statuses
    const [showStatusDropdown, setShowStatusDropdown] = useState(false);
    const [dateFilter, setDateFilter] = useState('');

    const [showAddTaskModal, setShowAddTaskModal] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [processingApproval, setProcessingApproval] = useState(false);

    // Issue Resolution State
    const [showIssueModal, setShowIssueModal] = useState(false);
    const [taskWithIssue, setTaskWithIssue] = useState(null);
    const [resolvingIssue, setResolvingIssue] = useState(false);
    const [allocatedHoursError, setAllocatedHoursError] = useState('');

    // Edit Task State
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingTask, setEditingTask] = useState(null);

    // Proof Submission State
    const [showProofModal, setShowProofModal] = useState(false);
    const [taskForProof, setTaskForProof] = useState(null);
    const [proofFile, setProofFile] = useState(null);
    const [proofText, setProofText] = useState('');
    const [proofHours, setProofHours] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    // Access Request State
    const [showAccessRequestModal, setShowAccessRequestModal] = useState(false);
    const [accessReason, setAccessReason] = useState('');
    const [taskForAccess, setTaskForAccess] = useState(null);
    const [requestingAccess, setRequestingAccess] = useState(false);

    // Task Notes State
    const [showNotesModal, setShowNotesModal] = useState(false);
    const [taskForNotes, setTaskForNotes] = useState(null);

    const handleRequestAccess = async () => {
        if (!accessReason.trim()) {
            addToast?.('Please provide a reason', 'error');
            return;
        }
        setRequestingAccess(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();

            const { error } = await supabase
                .from('tasks')
                .update({
                    access_requested: true,
                    access_reason: accessReason,
                    access_requested_at: new Date().toISOString(),
                    access_status: 'pending'
                })
                .eq('id', taskForAccess.id)
                .eq('org_id', orgId);

            if (error) throw error;

            // Notify Manager
            if (taskForAccess.assigned_by) {
                await supabase.from('notifications').insert({
                    receiver_id: taskForAccess.assigned_by,
                    sender_id: user.id,
                    message: `Access requested for task: ${taskForAccess.title}`,
                    type: 'access_requested',
                    is_read: false,
                    created_at: new Date().toISOString(),
                    org_id: orgId
                });
            }

            addToast?.('Access requested successfully', 'success');
            setShowAccessRequestModal(false);
            setAccessReason('');
            setTaskForAccess(null);
            fetchData();
        } catch (error) {
            console.error('Access Request Error:', error);
            addToast?.('Failed to request access', 'error');
        } finally {
            setRequestingAccess(false);
        }
    };

    const handleApproveAccess = async (task) => {
        // Legacy direct approval - keeping as fallback or utility if needed, 
        // but UI now routes to handleProcessAccessReview via Modal
        setAccessReviewTask(task);
        setShowAccessReviewModal(true);
    };

    // Access Review Logic
    const [accessReviewTask, setAccessReviewTask] = useState(null);
    const [showAccessReviewModal, setShowAccessReviewModal] = useState(false);
    const [reviewAction, setReviewAction] = useState('approve'); // 'approve', 'reassign', 'close'
    const [closureReason, setClosureReason] = useState('');
    const [reassignTarget, setReassignTarget] = useState('');
    const [processingReview, setProcessingReview] = useState(false);

    const handleProcessAccessReview = async () => {
        if (!accessReviewTask) return;
        setProcessingReview(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (reviewAction === 'approve') {
                await supabase.from('tasks').update({
                    access_status: 'approved',
                    is_locked: false // Explicit unlock
                }).eq('id', accessReviewTask.id).eq('org_id', orgId);

                await supabase.from('notifications').insert({
                    receiver_id: accessReviewTask.assigned_to,
                    sender_id: user.id,
                    message: `Access approved for task: ${accessReviewTask.title}`,
                    type: 'access_approved',
                    is_read: false,
                    created_at: new Date().toISOString(),
                    org_id: orgId
                });

            } else if (reviewAction === 'close') {
                if (!closureReason.trim()) {
                    addToast('Please provide a reason for closing.', 'error');
                    setProcessingReview(false);
                    return;
                }
                await supabase.from('tasks').update({
                    status: 'completed', // Use 'completed' as 'closed' is not a valid enum value
                    closed_by_manager: true,
                    closed_reason: closureReason,
                    access_status: 'rejected', // Request denied implies rejection
                    is_locked: true // Remain locked
                }).eq('id', accessReviewTask.id).eq('org_id', orgId);

                await supabase.from('notifications').insert({
                    receiver_id: accessReviewTask.assigned_to,
                    sender_id: user.id,
                    message: `Task closed by manager: ${accessReviewTask.title}. Reason: ${closureReason}`,
                    type: 'task_closed',
                    is_read: false,
                    created_at: new Date().toISOString(),
                    org_id: orgId
                });

            } else if (reviewAction === 'reassign') {
                if (!reassignTarget) {
                    addToast('Please select a new assignee.', 'error');
                    setProcessingReview(false);
                    return;
                }

                // Find the new assignee's details for the log
                const targetEmp = employees.find(e => e.id === reassignTarget);
                const targetName = targetEmp ? targetEmp.full_name : 'Unknown';

                // Ensure new assignee is part of the project so the task is visible
                if (accessReviewTask.project_id) {
                    const { data: existingMembers, error: memberCheckError } = await supabase
                        .from('project_members')
                        .select('id')
                        .eq('project_id', accessReviewTask.project_id)
                        .eq('user_id', reassignTarget)
                        .eq('org_id', orgId);

                    if (memberCheckError) throw memberCheckError;

                    if (!existingMembers || existingMembers.length === 0) {
                        const { error: memberInsertError } = await supabase
                            .from('project_members')
                            .insert({
                                project_id: accessReviewTask.project_id,
                                user_id: reassignTarget,
                                role: 'employee',
                                org_id: orgId
                            });
                        if (memberInsertError) throw memberInsertError;
                    }
                }

                // 1. Close the OLD task for the original assignee
                const { error: closeError } = await supabase.from('tasks').update({
                    status: 'completed', // Use 'completed' as 'closed' is not a valid enum value
                    closed_by_manager: true,
                    closed_reason: `Reassigned to ${targetName}`,
                    reassigned_to: reassignTarget, // Keep trace
                    reassigned_at: new Date().toISOString(),
                    access_status: 'rejected', // Original request rejected/mooted
                    is_locked: true
                }).eq('id', accessReviewTask.id).eq('org_id', orgId);

                if (closeError) throw closeError;

                // 2. Create NEW task for the new assignee
                // Extract pure DB columns by destructuring out UI-only or auto-generated fields
                const {
                    id, created_at, updated_at,
                    assignee_name, assignee_avatar, assigned_by_name, project_name,
                    reassigned_from_name, reassigned_to_name,
                    ...taskData
                } = accessReviewTask;

                const newTaskPayload = {
                    ...taskData,
                    assigned_to: reassignTarget,
                    org_id: orgId,
                    status: 'pending', // Fresh start logic
                    lifecycle_state: 'requirement_refiner', // Reset to start
                    sub_state: 'pending_validation',
                    phase_validations: {
                        active_phases: taskData.phase_validations?.active_phases || ['requirement_refiner', 'design_guidance', 'build_guidance', 'acceptance_criteria', 'deployment']
                    },
                    proof_url: null, // Clear proofs
                    proof_text: null,
                    reassigned_to: null, // Ensure this is null
                    reassigned_at: new Date().toISOString(),
                    // Clear access/lock flags
                    access_requested: false,
                    access_status: 'approved', // Auto-approve to bypass overdue lock
                    access_reason: 'Reassigned by manager',
                    access_requested_at: null,
                    // access_reviewer_id/access_reviewed_at omitted (columns not present in schema)
                    closed_by_manager: false,
                    closed_reason: null,
                    is_locked: false // Explicitly unlock for new user
                };

                const { error: createError } = await supabase.from('tasks').insert(newTaskPayload);
                if (createError) throw createError;

                // 3. Notify NEW assignee
                await supabase.from('notifications').insert({
                    receiver_id: reassignTarget,
                    sender_id: user.id,
                    message: `You have been reassigned task: ${accessReviewTask.title}`,
                    type: 'task_assigned',
                    is_read: false,
                    created_at: new Date().toISOString(),
                    org_id: orgId
                });

                // 4. Notify OLD assignee (Optional but good)
                await supabase.from('notifications').insert({
                    receiver_id: accessReviewTask.assigned_to,
                    sender_id: user.id,
                    message: `Task "${accessReviewTask.title}" has been reassigned to another team member.`,
                    type: 'task_closed',
                    is_read: false,
                    created_at: new Date().toISOString(),
                    org_id: orgId
                });
            }

            addToast('Review processed successfully', 'success');
            setShowAccessReviewModal(false);
            setAccessReviewTask(null);
            setClosureReason('');
            setReassignTarget('');
            fetchData(); // Refresh list to show new status/assignee
        } catch (error) {
            console.error('Review Error:', error);
            addToast('Failed to process review', 'error');
        } finally {
            setProcessingReview(false);
        }
    };


    // New Task Form State
    const [newTask, setNewTask] = useState({
        title: '',
        description: '',
        assignType: 'individual',
        assignedTo: '',
        selectedAssignees: [],
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        startTime: '09:00',
        dueTime: '17:00',
        priority: 'Medium',
        skill: '',
        allocatedHours: 10,
        riskTag: null, // 'red' | 'yellow' | null
        requiredPhases: ['requirement_refiner', 'design_guidance', 'build_guidance', 'acceptance_criteria', 'deployment'],
        stepDuration: '2h' // '2h' or '4h'
    });

    // Task Steps State for Manager Assignment
    const [taskStepsToAdd, setTaskStepsToAdd] = useState({}); // { phase_key: [{title: '', hours: 2}] }
    const [newStepInput, setNewStepInput] = useState('');
    const [newStepHours, setNewStepHours] = useState(2); // Default 2 hours per step
    const [activeStepPhase, setActiveStepPhase] = useState('requirement_refiner');

    // Smart Sort for Employees based on selected skill
    const sortedEmployees = useMemo(() => {
        if (!Array.isArray(employees)) return [];
        if (!newTask.skill) return employees;

        return [...employees].sort((a, b) => {
            const scoreA = a.technical_scores?.[newTask.skill] || 0;
            const scoreB = b.technical_scores?.[newTask.skill] || 0;
            return scoreA - scoreB; // Ascending Order (Least skilled first) per user requirement
        });
    }, [employees, newTask.skill]);

    // Auto-calculate Allocated Hours based on Steps and Duration Setting
    useEffect(() => {
        const stepCount = Object.values(taskStepsToAdd).flat().length;
        const durationPerStep = newTask.stepDuration === '4h' ? 4 : 2;
        const totalHours = stepCount * durationPerStep;

        // Only override if steps are present, otherwise allow manual input (if no steps mode)
        // But per requirements, steps drive the hours.
        if (stepCount > 0) {
            setNewTask(prev => ({ ...prev, allocatedHours: totalHours }));
        }
    }, [taskStepsToAdd, newStepHours]); // Changed dependency to newStepHours

    // Auto-sync newStepHours with stepDuration
    useEffect(() => {
        const h = parseFloat(newTask.stepDuration) || 2;
        setNewStepHours(h);
    }, [newTask.stepDuration]);

    // Auto-calculate Due Time based on Allocated Hours and Start Date/Time
    useEffect(() => {
        if (newTask.allocatedHours > 0) {
            try {
                const startDateStr = `${newTask.startDate}T${newTask.startTime}`;
                const { dueDate, dueTime } = calculateDueDateTime(new Date(startDateStr), newTask.allocatedHours);
                setNewTask(prev => ({
                    ...prev,
                    // Auto-calculate both Date and Time to handle rollovers (e.g. next day)
                    endDate: dueDate,
                    dueTime: dueTime
                }));
            } catch (err) {
                console.error("Error calculating due date:", err);
            }
        }
    }, [newTask.allocatedHours, newTask.startDate, newTask.startTime]);



    const fetchEmployees = async () => {
        if (!orgId) {
            setEmployees([]);
            return;
        }

        const fetchWithFallback = async (queryFn, isProject = false) => {
            try {
                // Try Full Fetch (with technical_scores)
                const { data, error } = await queryFn(true);
                if (error) throw error;
                return { data, isFallback: false };
            } catch (err) {
                console.warn('Full fetch failed, trying fallback without technical_scores...', err.message);
                // Fallback Fetch (basic info only)
                const { data, error } = await queryFn(false);
                if (error) {
                    console.error('Fallback fetch also failed:', error);
                    return { data: [], isFallback: true };
                }
                return { data, isFallback: true };
            }
        };

        if (effectiveProjectId) {
            const queryFn = async (includeScores) => {
                const selectString = includeScores
                    ? `user_id, role, profiles:user_id (id, full_name, email, role, avatar_url, technical_scores)`
                    : `user_id, role, profiles:user_id (id, full_name, email, role, avatar_url)`;

                return await supabase
                    .from('project_members')
                    .select(selectString)
                    .eq('project_id', effectiveProjectId)
                    .eq('org_id', orgId);
            };

            const { data: members } = await fetchWithFallback(queryFn, true);

            // Fetch reviews to get actual scores if technical_scores is empty/missing
            // (Since technical_scores columns in profiles might be empty until synced)
            const memberIds = members?.map(m => m.user_id).filter(Boolean) || [];
            let reviewsMap = {};
            if (memberIds.length > 0) {
                const { data: reviews } = await supabase
                    .from('employee_reviews')
                    .select('user_id, manager_development_skills, development_skills')
                    .in('user_id', memberIds);

                (reviews || []).forEach(r => {
                    reviewsMap[r.user_id] = r.manager_development_skills || r.development_skills || {};
                });
            }

            if (members && members.length > 0) {
                const teamMembers = members
                    .filter(m => m.profiles)
                    .map(m => {
                        // Priority: Review Data -> Profile Data -> Empty
                        const reviewScores = reviewsMap[m.profiles.id];
                        const profileScores = m.profiles.technical_scores;
                        const finalScores = (reviewScores && Object.keys(reviewScores).length > 0)
                            ? reviewScores
                            : (profileScores || {});

                        return {
                            id: m.profiles.id,
                            full_name: m.profiles.full_name,
                            email: m.profiles.email,
                            role: m.role || m.profiles.role,
                            avatar_url: m.profiles.avatar_url,
                            technical_scores: finalScores
                        };
                    });
                setEmployees(teamMembers);
            } else {
                setEmployees([]);
            }
        } else {
            const queryFn = async (includeScores) => {
                const selectString = includeScores
                    ? 'id, full_name, email, role, avatar_url, technical_scores'
                    : 'id, full_name, email, role, avatar_url';

                return await supabase
                    .from('profiles')
                    .select(selectString)
                    .eq('org_id', orgId);
            };

            const { data } = await fetchWithFallback(queryFn, false);

            // Fetch reviews for ALL profiles fetched
            const userIds = data?.map(u => u.id).filter(Boolean) || [];
            let reviewsMap = {};
            if (userIds.length > 0) {
                const { data: reviews } = await supabase
                    .from('employee_reviews')
                    .select('user_id, manager_development_skills, development_skills')
                    .in('user_id', userIds);

                (reviews || []).forEach(r => {
                    reviewsMap[r.user_id] = r.manager_development_skills || r.development_skills || {};
                });
            }

            const mergedEmployees = (data || []).map(p => {
                const reviewScores = reviewsMap[p.id];
                const profileScores = p.technical_scores;
                const finalScores = (reviewScores && Object.keys(reviewScores).length > 0)
                    ? reviewScores
                    : (profileScores || {});

                return { ...p, technical_scores: finalScores };
            });

            setEmployees(mergedEmployees);
        }
    };

    const fetchData = async () => {
        if (!orgId) {
            console.log('fetchData skipped: No orgId');
            return;
        }

        setLoading(true);
        try {
            console.log('--- Fetching Tasks ---');
            console.log('Params:', { orgId, effectiveProjectId, viewMode, userRole, userId });

            let query = supabase.from('tasks').select('*, phase_validations');

            if (userRole === 'executive' || viewMode === 'global_tasks') {
                query = query.eq('org_id', orgId);
                if (effectiveProjectId) query = query.eq('project_id', effectiveProjectId);
            } else {
                if (!effectiveProjectId) {
                    console.warn('fetchData skipped: No effectiveProjectId for non-executive');
                    setLoading(false);
                    return;
                }

                // Base filter for project context
                query = query.eq('project_id', effectiveProjectId).eq('org_id', orgId);
                console.log('Applying filtering: Project:', effectiveProjectId, 'Org:', orgId);

                if (viewMode === 'my_tasks') {
                    query = query.eq('assigned_to', userId);
                    console.log('Filtering by Assignee (My Tasks):', userId);
                } else {
                    console.log('Fetching ALL Team Tasks (No assignee filter)');
                }
            }

            // Order by most recent
            query = query.order('id', { ascending: false });

            // Execute RAW query to debug
            const { data: tasksData, error } = await query;

            if (error) {
                console.error('Supabase Query Error:', error);
                throw error;
            }

            console.log('Raw Tasks Found:', tasksData?.length);

            // Efficiently fetch profiles
            const userIds = [...new Set((tasksData || []).flatMap(t => [t.assigned_to, t.assigned_by, t.reassigned_to, t.reassigned_from].filter(Boolean)))];
            let profileMap = {};
            if (userIds.length > 0) {
                const { data: profiles } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', userIds);
                profiles?.forEach(p => { profileMap[p.id] = p; });
            }

            const enhanced = (tasksData || []).map(task => ({
                ...task,
                assignee_name: profileMap[task.assigned_to]?.full_name || 'Unassigned',
                assignee_avatar: profileMap[task.assigned_to]?.avatar_url,
                assigned_by_name: task.assigned_by_name || profileMap[task.assigned_by]?.full_name || 'Unknown',
                reassigned_from_name: profileMap[task.reassigned_from]?.full_name,
                reassigned_to_name: profileMap[task.reassigned_to]?.full_name,
                project_name: currentProject?.name || 'Project'
            }));

            setTasks(enhanced);
        } catch (error) {
            console.error('FetchData Final Error:', error);
            addToast?.('Failed to load tasks', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        fetchEmployees();

        const channel = supabase.channel('tasks_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
                fetchData();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [orgId, effectiveProjectId, viewMode, userRole, userId]);

    const handleUpdateTask = async (taskId, updates) => {
        const { error } = await supabase.from('tasks').update(updates).eq('id', taskId);
        if (error) {
            addToast?.('Update failed', 'error');
            throw error;
        }
        fetchData();
    };

    const handleDeleteTask = async (taskId) => {
        if (!window.confirm('Are you sure you want to delete this task?')) return;
        try {
            await supabase.from('tasks').delete().eq('id', taskId);
            addToast?.('Task deleted', 'success');
            fetchData();
        } catch (error) {
            addToast?.('Failed to delete task', 'error');
        }
    };

    const handleArchiveTask = async (taskId) => {
        try {
            await supabase.from('tasks').update({ status: 'archived' }).eq('id', taskId);
            addToast?.('Task archived', 'success');
            fetchData();
        } catch (error) {
            addToast?.('Failed to archive task', 'error');
        }
    };

    const handleDeleteProof = async (task, phaseKey) => {
        if (!window.confirm('Are you sure you want to delete this proof?')) return;
        try {
            const validations = { ...task.phase_validations };
            if (validations[phaseKey]) {
                delete validations[phaseKey].proof_url;
                delete validations[phaseKey].proof_text;
                validations[phaseKey].status = 'pending';
            }
            await handleUpdateTask(task.id, { phase_validations: validations });
            addToast?.('Proof deleted', 'success');
        } catch (e) {
            console.error(e);
        }
    };

    const handleEditTask = (task) => {
        setEditingTask(task);
        setShowEditModal(true);
    };

    const handleSaveEdit = async () => {
        if (!editingTask) return;
        try {
            const updates = {
                title: editingTask.title,
                description: editingTask.description,
                start_date: editingTask.start_date,
                start_time: editingTask.start_time,
                due_date: editingTask.due_date,
                due_time: editingTask.due_time,
                priority: editingTask.priority
            };
            await handleUpdateTask(editingTask.id, updates);
            setShowEditModal(false);
            setEditingTask(null);
            addToast?.('Task updated', 'success');
        } catch (error) {
            addToast?.('Failed to save changes', 'error');
        }
    };

    const [phaseFiles, setPhaseFiles] = useState({});
    const [phaseDescriptions, setPhaseDescriptions] = useState({});

    const handleAddTask = async (e) => {
        e.preventDefault();
        if (!newTask.title) {
            addToast?.('Please enter a task title', 'error');
            return;
        }

        // Time validation (basic)
        if (!newTask.startTime || !newTask.dueTime) {
            addToast?.('Please select start and due times', 'error');
            return;
        }

        setSubmitting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const { data: senderProfile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', user.id)
                .eq('org_id', orgId)
                .single();
            const senderName = senderProfile?.full_name || (userRole === 'manager' ? 'Management' : (userRole === 'team_lead' ? 'Team Lead' : 'Task Manager'));

            // 1. Upload Phase Guidance Files
            const guidanceData = {};
            const uploadPromises = Object.entries(phaseFiles).map(async ([phaseKey, file]) => {
                if (!file) return;

                const fileExt = file.name.split('.').pop();
                const fileName = `guidance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
                const filePath = `guidance/${effectiveProjectId || 'general'}/${phaseKey}/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('project-docs')
                    .upload(filePath, file, { cacheControl: '3600', upsert: false });

                if (uploadError) {
                    console.error(`Failed to upload guidance for ${phaseKey}`, uploadError);
                    return; // Continue without this file or throw?
                }

                const { data: urlData } = supabase.storage.from('project-docs').getPublicUrl(filePath);

                guidanceData[phaseKey] = {
                    guidance_doc_url: urlData.publicUrl,
                    guidance_doc_name: file.name
                };
            });

            await Promise.all(uploadPromises);

            // Helper to build validation object
            const buildPhaseValidations = () => {
                const validations = {
                    active_phases: newTask.requiredPhases
                };

                // Merge guidance data and descriptions into the validation object structure
                newTask.requiredPhases.forEach(phase => {
                    validations[phase] = {
                        status: 'pending',
                        description: phaseDescriptions[phase] || '',
                        ...(guidanceData[phase] || {})
                    };
                });

                return validations;
            };

            const preparedValidations = buildPhaseValidations();
            console.log('--- Creating Task with Phase Validations ---', preparedValidations);


            if (newTask.assignType === 'multi') {
                if (newTask.selectedAssignees.length === 0) {
                    addToast?.('Please select at least one employee', 'error');
                    setSubmitting(false);
                    return;
                }

                // Calculate due date/time based on allocated hours and business hours
                const allocatedHrs = parseFloat(newTask.allocatedHours) || 0;
                const startDateStr = `${newTask.startDate}T${newTask.startTime}`;
                const { dueDate, dueTime } = calculateDueDateTime(new Date(startDateStr), allocatedHrs);

                const tasksToInsert = newTask.selectedAssignees.map(empId => ({
                    title: newTask.title,
                    description: newTask.description,
                    assigned_to: empId,
                    assigned_by: user.id,
                    assigned_by_name: senderName,
                    project_id: effectiveProjectId,
                    start_date: newTask.startDate,
                    start_time: newTask.startTime,
                    due_date: dueDate, // Calculated based on business hours
                    due_time: dueTime, // Calculated based on business hours
                    priority: newTask.priority.toLowerCase(),
                    status: 'pending',
                    phase_validations: preparedValidations,
                    org_id: orgId,
                    // skill_required removed - not in schema
                    allocated_hours: allocatedHrs,
                    risk_tag: newTask.riskTag
                }));

                const { data: createdMultiTasks, error: multiTaskError } = await supabase.from('tasks').insert(tasksToInsert).select('id');
                if (multiTaskError) throw multiTaskError;

                // Insert manager-defined steps for all created tasks
                if (createdMultiTasks && createdMultiTasks.length > 0) {
                    const allStepsToInsert = [];

                    createdMultiTasks.forEach(createdTask => {
                        Object.entries(taskStepsToAdd).forEach(([phaseKey, steps]) => {
                            steps.forEach((step, idx) => {
                                if (step.title.trim()) {
                                    allStepsToInsert.push({
                                        org_id: orgId,
                                        task_id: createdTask.id,
                                        stage_id: phaseKey,
                                        step_title: step.title.trim(),
                                        order_index: idx,
                                        status: 'pending',
                                        created_by: user.id,
                                        created_by_role: 'manager',
                                        estimated_hours: step.hours || 2
                                    });
                                }
                            });
                        });
                    });

                    if (allStepsToInsert.length > 0) {
                        const { error: stepsError } = await supabase.from('task_steps').insert(allStepsToInsert);
                        if (stepsError) console.error('Error inserting steps for multi-assign:', stepsError);
                    }
                }

                // Notifications for multi
                const notifications = tasksToInsert.map(task => ({
                    receiver_id: task.assigned_to,
                    sender_id: user.id,
                    sender_name: senderName,
                    message: `New task assigned: ${task.title}`,
                    type: 'task_assigned',
                    is_read: false,
                    created_at: new Date().toISOString(),
                    org_id: orgId
                }));
                await supabase.from('notifications').insert(notifications);

            } else {

                // Calculate due date/time based on allocated hours and business hours
                const allocatedHrs = parseFloat(newTask.allocatedHours) || 0;
                const startDateStr = `${newTask.startDate}T${newTask.startTime}`;
                const { dueDate, dueTime } = calculateDueDateTime(new Date(startDateStr), allocatedHrs);

                const taskToInsert = {
                    title: newTask.title,
                    description: newTask.description,
                    assigned_to: newTask.assignType === 'individual' ? newTask.assignedTo : null,
                    assigned_by: user.id,
                    assigned_by_name: senderName,
                    project_id: effectiveProjectId,
                    start_date: newTask.startDate,
                    start_time: newTask.startTime,
                    due_date: dueDate, // Calculated based on business hours
                    due_time: dueTime, // Calculated based on business hours
                    priority: newTask.priority.toLowerCase(),
                    status: 'pending',
                    phase_validations: preparedValidations,
                    org_id: orgId,
                    // skill_required removed - not in schema
                    allocated_hours: allocatedHrs,
                    risk_tag: newTask.riskTag
                };

                const { data: createdTasks, error: taskError } = await supabase.from('tasks').insert([taskToInsert]).select('id');
                if (taskError) throw taskError;

                // Insert manager-defined steps for this task
                if (createdTasks && createdTasks.length > 0) {
                    const taskId = createdTasks[0].id;
                    const stepsToInsert = [];

                    Object.entries(taskStepsToAdd).forEach(([phaseKey, steps]) => {
                        steps.forEach((step, idx) => {
                            if (step.title.trim()) {
                                stepsToInsert.push({
                                    org_id: orgId,
                                    task_id: taskId,
                                    stage_id: phaseKey,
                                    step_title: step.title.trim(),
                                    order_index: idx,
                                    status: 'pending',
                                    created_by: user.id,
                                    created_by_role: 'manager',
                                    estimated_hours: step.hours || 2
                                });
                            }
                        });
                    });

                    if (stepsToInsert.length > 0) {
                        const { error: stepsError } = await supabase.from('task_steps').insert(stepsToInsert);
                        if (stepsError) console.error('Error inserting steps:', stepsError);
                    }
                }

                // Send Notifications
                try {
                    if (newTask.assignType === 'individual' && newTask.assignedTo) {
                        await supabase.from('notifications').insert({
                            receiver_id: newTask.assignedTo,
                            sender_id: user.id,
                            sender_name: senderName,
                            message: `New task assigned: ${newTask.title}`,
                            type: 'task_assigned',
                            is_read: false,
                            created_at: new Date().toISOString(),
                            org_id: orgId
                        });
                    } else if (newTask.assignType === 'team' && employees.length > 0) {
                        const notifications = employees.map(emp => ({
                            receiver_id: emp.id,
                            sender_id: user.id,
                            sender_name: senderName,
                            message: `New team task created: ${newTask.title}`,
                            type: 'task_assigned',
                            is_read: false,
                            created_at: new Date().toISOString(),
                            org_id: orgId
                        }));
                        await supabase.from('notifications').insert(notifications);
                    }
                } catch (notifyError) {
                    console.error('Error sending notification:', notifyError);
                }
            }

            addToast?.('Task assigned successfully!', 'success');
            setShowAddTaskModal(false);
            setNewTask({
                title: '',
                description: '',
                assignType: 'individual',
                assignedTo: '',
                selectedAssignees: [],
                startDate: new Date().toISOString().split('T')[0],
                endDate: new Date().toISOString().split('T')[0],
                startTime: '09:00',
                dueTime: '17:00',
                priority: 'Medium',
                skill: '',
                allocatedHours: 10,
                pointsPerHour: 100,
                requiredPhases: ['requirement_refiner', 'design_guidance', 'build_guidance', 'acceptance_criteria', 'deployment']
            });
            setPhaseFiles({}); // Clear files
            setPhaseDescriptions({}); // Clear descriptions
            setTaskStepsToAdd({}); // Clear steps
            setNewStepInput(''); // Clear step input
            fetchData();
        } catch (error) {
            console.error('Error adding task:', error);
            addToast?.('Failed to assign task', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const downloadCSV = () => {
        if (!tasks.length) return;
        const headers = ['ID', 'Title', 'Assignee', 'Project', 'Status', 'Priority', 'Allocated Hours', 'Due Date'];
        const csvContent = [
            headers.join(','),
            ...tasks.map(t => [
                t.id,
                `"${t.title.replace(/"/g, '""')}"`,
                `"${t.assignee_name}"`,
                `"${t.project_name}"`,
                t.status,
                t.priority,
                t.allocated_hours || 0,
                t.due_date
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `tasks_export_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const handleApproveTask = async () => {
        if (!selectedTask) return;

        // Check phase_validations for any 'pending' status
        const validations = selectedTask.phase_validations || {};
        const pendingPhases = Object.keys(validations).filter(key => validations[key].status === 'pending');

        // Allow approval if legacy sub_state is pending OR if we have pending phases using new system
        if (pendingPhases.length === 0 && selectedTask.sub_state !== 'pending_validation') {
            addToast?.('No pending validations to approve', 'error');
            return;
        }

        if (processingApproval) return;

        setProcessingApproval(true);
        try {
            // Update all pending phases to approved
            const updatedValidations = { ...validations };
            pendingPhases.forEach(key => {
                updatedValidations[key] = { ...updatedValidations[key], status: 'approved', approved_at: new Date().toISOString() };
            });

            const updates = {
                phase_validations: updatedValidations,
                updated_at: new Date().toISOString()
            };

            // Legacy Support/Cleanup:
            // If the task was strictly in 'pending_validation' sub_state (legacy blocking), we advance it?
            // User said "all yellow become green".
            // Phase advancing logic is typically handled by 'Next' flow, but here we just approve.
            // If sub_state is pending_validation, we should probably set it to in_progress or leave it?
            // Usually approval means "Proof Accepted".
            updates.sub_state = 'in_progress';

            const { error } = await supabase
                .from('tasks')
                .update(updates)
                .eq('id', selectedTask.id)
                .eq('org_id', orgId);

            if (error) throw error;

            addToast?.('Task approved successfully', 'success');
            setShowIssueModal(false); // Reuse issue modal state? No, view modal
            // We need to close View modal or update it
            // Re-fetch will update list.
            if (selectedTask) {
                // Update local selected task to reflect changes immediately

                // Check if the FINAL phase is approved. If so, mark task as completed.
                // We relax the "All Phases" requirement because some intermediate phases might be auto-skipped or implicitly approved.
                const phasesToCheck = updatedValidations.active_phases || LIFECYCLE_PHASES.map(p => p.key);
                const lastPhaseKey = phasesToCheck[phasesToCheck.length - 1]; // e.g. 'deployment'
                const isLastPhaseApproved = updatedValidations[lastPhaseKey]?.status === 'approved';

                const finalStatus = isLastPhaseApproved ? 'completed' : selectedTask.status;

                // Sync to DB if completed
                if (isLastPhaseApproved && selectedTask.status !== 'completed') {
                    await supabase.from('tasks').update({ status: 'completed' }).eq('id', selectedTask.id).eq('org_id', orgId);
                }

                setSelectedTask({
                    ...selectedTask,
                    phase_validations: updatedValidations,
                    sub_state: 'in_progress',
                    status: finalStatus
                });

                if (finalStatus === 'completed') {
                    addToast?.('Task marked as fully completed!', 'success');
                }
            }
            fetchData();
        } catch (error) {
            console.error('Error approving task:', error);
            addToast?.('Failed to approve task: ' + error.message, 'error');
        } finally {
            setProcessingApproval(false);
        }
    };

    const handleRejectTask = async () => {
        if (!selectedTask) return;

        // Validate that task is in pending_validation state
        if (selectedTask.sub_state !== 'pending_validation') {
            addToast?.('Task is not pending validation', 'error');
            return;
        }

        if (processingApproval) return; // Prevent double-clicks

        setProcessingApproval(true);
        try {
            // Rejection just sends it back to in_progress in the SAME phase
            const { error } = await supabase
                .from('tasks')
                .update({
                    sub_state: 'in_progress',
                    updated_at: new Date().toISOString()
                })
                .eq('id', selectedTask.id)
                .eq('org_id', orgId)
                .eq('sub_state', 'pending_validation'); // Double-check in DB query

            if (error) throw error;

            addToast?.('Task rejected and sent back for revision', 'info');
            setSelectedTask(null);
            fetchData();
        } catch (error) {
            console.error('Error rejecting task:', error);
            addToast?.('Failed to reject task', 'error');
        } finally {
            setProcessingApproval(false);
        }
    };

    const handleApprovePhase = async (phaseKey) => {
        if (!selectedTask) return;
        if (processingApproval) return;

        setProcessingApproval(true);
        try {
            const currentValidations = selectedTask.phase_validations || {};
            const phaseData = currentValidations[phaseKey];

            if (!phaseData) throw new Error('Phase data not found');

            const updatedValidations = {
                ...currentValidations,
                [phaseKey]: {
                    ...phaseData,
                    status: 'approved',
                    approved_at: new Date().toISOString()
                }
            };

            // Calculate new sub_state
            // If there are NO other pending validations, we can set sub_state to 'in_progress'
            const hasOtherPending = Object.entries(updatedValidations).some(([key, val]) => key !== phaseKey && val.status === 'pending');
            const newSubState = hasOtherPending ? 'pending_validation' : 'in_progress';

            const updates = {
                phase_validations: updatedValidations,
                sub_state: newSubState,
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase
                .from('tasks')
                .update(updates)
                .eq('id', selectedTask.id)
                .eq('org_id', orgId);

            if (error) throw error;

            addToast?.('Phase approved successfully', 'success');

            // Check for completion
            const phasesToCheck = updatedValidations.active_phases || LIFECYCLE_PHASES.map(p => p.key);
            const lastPhaseKey = phasesToCheck[phasesToCheck.length - 1];
            const isLastPhaseApproved = updatedValidations[lastPhaseKey]?.status === 'approved';

            const finalStatus = isLastPhaseApproved ? 'completed' : selectedTask.status;

            if (isLastPhaseApproved && selectedTask.status !== 'completed') {
                await supabase.from('tasks').update({ status: 'completed' }).eq('id', selectedTask.id).eq('org_id', orgId);
            }

            // Update local state
            const updatedTask = {
                ...selectedTask,
                phase_validations: updatedValidations,
                sub_state: newSubState,
                status: finalStatus
            };
            setSelectedTask(updatedTask);

            // Update tasks list
            setTasks(prev => prev.map(t => t.id === selectedTask.id ? updatedTask : t));

        } catch (error) {
            console.error('Error approving phase:', error);
            addToast?.('Failed to approve phase: ' + error.message, 'error');
        } finally {
            setProcessingApproval(false);
        }
    };

    const handleRejectPhase = async (phaseKey) => {
        if (!selectedTask) return;
        if (processingApproval) return;

        setProcessingApproval(true);
        try {
            const currentValidations = selectedTask.phase_validations || {};
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
                sub_state: 'in_progress', // Reset to in_progress on rejection so they can try again
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase
                .from('tasks')
                .update(updates)
                .eq('id', selectedTask.id)
                .eq('org_id', orgId);

            if (error) throw error;

            addToast?.('Phase rejected', 'info');

            // Update local state
            const updatedTask = {
                ...selectedTask,
                phase_validations: updatedValidations,
                sub_state: 'in_progress'
            };
            setSelectedTask(updatedTask);
            setTasks(prev => prev.map(t => t.id === selectedTask.id ? updatedTask : t));

        } catch (error) {
            console.error('Error rejecting phase:', error);
            addToast?.('Failed to reject phase: ' + error.message, 'error');
        } finally {
            setProcessingApproval(false);
        }
    };

    const openIssueModal = (task) => {
        // Validation: Check if locked
        const curTime = new Date();
        let dueDateTime = null;
        if (task.due_date) {
            const datePart = task.due_date;
            const timePart = task.due_time ? task.due_time : '23:59:00';
            dueDateTime = new Date(`${datePart}T${timePart}`);
        }
        const isOverdue = dueDateTime && curTime > dueDateTime;
        const isLocked = (task.is_locked || isOverdue) && task.status !== 'completed' && task.access_status !== 'approved';

        if (isLocked) {
            addToast('Task is locked (Overdue). Please request access.', 'error');
            return;
        }

        setTaskWithIssue(task);
        setShowIssueModal(true);
    };

    const resolveIssue = async () => {
        if (!taskWithIssue) return;

        setResolvingIssue(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            // Get user profile for name
            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name, email')
                .eq('id', user.id)
                .eq('org_id', orgId)
                .single();

            const userName = profile?.full_name || profile?.email || 'Manager';
            const timestamp = new Date().toISOString();

            // Add resolution note to issues
            const resolutionEntry = `\n\n[${new Date(timestamp).toLocaleString()}] RESOLVED by ${userName}`;
            const updatedIssues = (taskWithIssue.issues || '') + resolutionEntry;

            const { error } = await supabase
                .from('tasks')
                .update({
                    issues: updatedIssues,
                    updated_at: timestamp
                })
                .eq('id', taskWithIssue.id)
                .eq('org_id', orgId);

            if (error) throw error;

            addToast?.('Issue marked as resolved!', 'success');
            setShowIssueModal(false);
            setTaskWithIssue(null);
            fetchData(); // Refresh tasks
        } catch (error) {
            console.error('Error resolving issue:', error);
            addToast?.('Failed to resolve issue: ' + error.message, 'error');
        } finally {
            setResolvingIssue(false);
        }
    };

    const getPriorityStyle = (priority) => {
        const styles = {
            high: { bg: '#fee2e2', text: '#991b1b', label: 'HIGH' },
            medium: { bg: '#fef3c7', text: '#92400e', label: 'MEDIUM' },
            low: { bg: '#dbeafe', text: '#1e40af', label: 'LOW' }
        };
        return styles[priority?.toLowerCase()] || styles.medium;
    };

    const getStatusStyle = (status) => {
        const styles = {
            pending: { bg: '#fef3c7', text: '#92400e' },
            'in progress': { bg: '#dbeafe', text: '#1e40af' },
            completed: { bg: '#d1fae5', text: '#065f46' },
            'on hold': { bg: '#fee2e2', text: '#991b1b' }
        };
        return styles[status?.toLowerCase()] || styles.pending;
    };

    // Lifecycle phases for progress visualization
    const LIFECYCLE_PHASES = [
        { key: 'requirement_refiner', label: 'Requirements', short: 'R' },
        { key: 'design_guidance', label: 'Design', short: 'Ds' },
        { key: 'build_guidance', label: 'Build', short: 'B' },
        { key: 'acceptance_criteria', label: 'Acceptance', short: 'A' },
        { key: 'deployment', label: 'Deployment', short: 'D' }
    ];

    const getPhaseIndex = (phase) => LIFECYCLE_PHASES.findIndex(p => p.key === phase);

    const openProofModal = (task) => {
        // Validation: Check if locked
        const curTime = new Date();
        let dueDateTime = null;
        if (task.due_date) {
            const datePart = task.due_date;
            const timePart = task.due_time ? task.due_time : '23:59:00';
            dueDateTime = new Date(`${datePart}T${timePart}`);
        }
        const isOverdue = dueDateTime && curTime > dueDateTime;
        const isLocked = (task.is_locked || isOverdue) && task.status !== 'completed' && task.access_status !== 'approved';

        if (isLocked) {
            addToast('Task is locked (Overdue). Please request access.', 'error');
            return;
        }

        setTaskForProof(task);
        setProofFile(null);
        setProofText('');
        setUploadProgress(0);
        setShowProofModal(true);
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 10 * 1024 * 1024) {
                addToast?.('File size must be less than 10MB', 'error');
                return;
            }
            setProofFile(file);
        }
    };

    const handleSubmitProof = async (e) => {
        e.preventDefault();
        if (!taskForProof) return;

        // CRITICAL LOCK CHECK: Re-verify against current time in case it expired while modal was open
        const curTime = new Date();
        let dueDateTime = null;
        if (taskForProof.due_date) {
            const datePart = taskForProof.due_date;
            const timePart = taskForProof.due_time ? taskForProof.due_time : '23:59:00';
            dueDateTime = new Date(`${datePart}T${timePart}`);
        }
        const isOverdue = dueDateTime && curTime > dueDateTime;
        const isLocked = (taskForProof.is_locked || isOverdue) && taskForProof.status !== 'completed' && taskForProof.access_status !== 'approved';

        if (isLocked) {
            addToast('Time exceeded! Submission locked. Please request access.', 'error');
            setShowProofModal(false); // Force close modal
            return;
        }

        if (!proofFile && !proofText.trim()) {
            addToast?.('Please upload a document OR enter a text message', 'error');
            return;
        }

        if (!proofHours) {
            addToast?.('Please enter actual hours spent.', 'error');
            return;
        }

        setUploading(true);
        setUploadProgress(10);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            let proofUrl = null;

            // 1. Upload File if present
            if (proofFile) {
                const fileExt = proofFile.name.split('.').pop();
                const fileName = `${taskForProof.id}_${Date.now()}.${fileExt}`;
                const filePath = `${user.id}/${fileName}`;

                setUploadProgress(30);

                const { error: uploadError } = await supabase.storage
                    .from('task-proofs')
                    .upload(filePath, proofFile, { cacheControl: '3600', upsert: false });

                if (uploadError) throw uploadError;

                const { data: urlData } = supabase.storage.from('task-proofs').getPublicUrl(filePath);
                proofUrl = urlData?.publicUrl;
                setUploadProgress(70);
            }

            // 2. Update Task
            const currentPhase = taskForProof.lifecycle_state;
            const currentIndex = getPhaseIndex(currentPhase);

            // Auto-Advance Logic:
            // Find the next phase that DOES NOT have a proof yet.
            let nextPhase = currentPhase;
            let foundNext = false;

            if (currentIndex < LIFECYCLE_PHASES.length - 2) { // Ensure we don't go past Deployment
                let probeIndex = currentIndex + 1;
                while (probeIndex < LIFECYCLE_PHASES.length - 1) {
                    const probePhaseKey = LIFECYCLE_PHASES[probeIndex].key;
                    // Check if this phase already has a proof in the EXISTING validations (before this upload)
                    const hasProof = taskForProof.phase_validations &&
                        taskForProof.phase_validations[probePhaseKey] &&
                        (taskForProof.phase_validations[probePhaseKey].proof_url || taskForProof.phase_validations[probePhaseKey].proof_text);

                    if (hasProof) {
                        // This phase is already done, check next
                        probeIndex++;
                    } else {
                        // Found a phase with no proof, this is our next target
                        nextPhase = probePhaseKey;
                        foundNext = true;
                        break;
                    }
                }

                // If we went through all subsequent phases and they ALL had proofs, 
                // we should probably be at the very end (Deployment or Completed).
                if (!foundNext && probeIndex >= LIFECYCLE_PHASES.length - 1) {
                    // All intermediate phases done. 
                    nextPhase = LIFECYCLE_PHASES[LIFECYCLE_PHASES.length - 1].key;
                }
            } else {
                // Already at end
                nextPhase = currentPhase;
            }

            const currentValidations = taskForProof.phase_validations || {};

            // Preserve existing data if any, overwrite with new
            const updatedPhaseData = {
                ...(currentValidations[currentPhase] || {}),
                status: 'pending',
                submitted_at: new Date().toISOString()
            };

            if (proofUrl) updatedPhaseData.proof_url = proofUrl;
            if (proofText) updatedPhaseData.proof_text = proofText;

            const updatedValidations = {
                ...currentValidations,
                [currentPhase]: updatedPhaseData
            };

            const updates = {
                phase_validations: updatedValidations,
                updated_at: new Date().toISOString()
            };

            // Legacy column support
            if (proofUrl) updates.proof_url = proofUrl;

            // Advance Phase Logic
            if (nextPhase !== currentPhase) {
                updates.lifecycle_state = nextPhase;
                updates.sub_state = 'in_progress';
            }

            const { error } = await supabase
                .from('tasks')
                .update(updates)
                .eq('id', taskForProof.id);

            if (error) throw error;

            // 3. Record Submission & Hours for Points Calculation
            const { data: existingSub } = await supabase
                .from('task_submissions')
                .select('id')
                .eq('task_id', taskForProof.id)
                .eq('user_id', user.id)
                .single();

            let subError;
            if (existingSub) {
                const { error: upError } = await supabase
                    .from('task_submissions')
                    .update({
                        actual_hours: parseFloat(proofHours),
                        submitted_at: new Date().toISOString()
                    })
                    .eq('id', existingSub.id);
                subError = upError;
            } else {
                const { error: inError } = await supabase
                    .from('task_submissions')
                    .insert({
                        task_id: taskForProof.id,
                        user_id: user.id,
                        actual_hours: parseFloat(proofHours),
                        submitted_at: new Date().toISOString()
                    });
                subError = inError;
            }

            if (subError) throw subError;

            // 4. Fetch Calculated Points Feedback
            const { data: pointData } = await supabase
                .from('task_submissions')
                .select('final_points, bonus_points, penalty_points')
                .eq('task_id', taskForProof.id)
                .eq('user_id', user.id)
                .single();

            setUploadProgress(100);

            if (pointData) {
                addToast?.(`Submitted! Earned: ${pointData.final_points} Points (Bonus: ${pointData.bonus_points || 0}, Penalty: ${pointData.penalty_points || 0})`, 'success');
            } else {
                addToast?.('Proof submitted successfully!', 'success');
            }

            setShowProofModal(false);
            setTaskForProof(null);
            setProofFile(null);
            setProofText('');
            setProofHours('');
            fetchData(); // Refresh tasks

        } catch (error) {
            console.error('Submit proof error:', error);
            addToast?.('Failed to submit proof: ' + error.message, 'error');
        } finally {
            setUploading(false);
            setUploadProgress(0);
        }
    };

    const LifecycleProgress = ({ currentPhase, subState, validations, taskStatus }) => {
        let parsedValidations = validations;
        if (typeof validations === 'string') {
            try {
                parsedValidations = JSON.parse(validations);
            } catch (e) {
                console.error("Error parsing validations JSON", e);
            }
        }
        const activePhases = parsedValidations?.active_phases || LIFECYCLE_PHASES.map(p => p.key);
        const filteredPhases = LIFECYCLE_PHASES.filter(p => activePhases.includes(p.key));

        // Find index in the FILTERED list
        const currentPhaseObj = filteredPhases.find(p => p.key === currentPhase) || filteredPhases[0];
        const currentIndex = filteredPhases.findIndex(p => p.key === (currentPhase || filteredPhases[0]?.key));

        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {filteredPhases.map((phase, idx) => {
                    const validation = parsedValidations?.[phase.key];
                    const status = validation?.status;
                    let color = '#e5e7eb'; // Default Grey
                    let isYellow = false;

                    const hasProof = validation?.proof_url || validation?.proof_text;

                    if (taskStatus === 'completed') {
                        color = '#10b981';
                    } else if (idx < currentIndex) {
                        // Past Phase
                        if (status === 'pending') { color = '#f59e0b'; isYellow = true; }
                        else if (status === 'rejected') color = '#fee2e2';
                        else color = '#10b981';
                    } else if (idx === currentIndex) {
                        // Current Phase
                        if (status === 'approved') color = '#10b981';
                        else if (status === 'pending' || subState === 'pending_validation') { color = '#f59e0b'; isYellow = true; }
                        else color = '#3b82f6';
                    } else if (hasProof) {
                        // Future Phase but has proof (e.g. reverted state)
                        if (status === 'pending') { color = '#f59e0b'; isYellow = true; }
                        else if (status === 'rejected') color = '#fee2e2';
                        else color = '#10b981'; // Assuming green if exists or approved
                    }

                    const isCompleted = color === '#10b981';
                    // Note: We don't distinguish isCurrent purely by index anymore for color, but for checks

                    return (
                        <React.Fragment key={phase.key}>
                            <div style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.65rem',
                                fontWeight: 600,
                                backgroundColor: color,
                                color: color === '#e5e7eb' ? '#9ca3af' : color === '#fee2e2' ? '#991b1b' : 'white',
                                transition: 'all 0.3s'
                            }} title={phase.label}>
                                {isCompleted ? '✓' : phase.short}
                            </div>
                            {idx < filteredPhases.length - 1 && (
                                <div style={{ width: '12px', height: '2px', backgroundColor: (isCompleted || (idx < currentIndex && !isYellow)) ? '#10b981' : '#e5e7eb' }} />
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        );
    };

    const normalizeDate = (value) => {
        if (!value) return null;
        let datePart = value;
        if (typeof datePart === 'string' && datePart.includes('/')) {
            const parts = datePart.split('/');
            if (parts.length === 3 && parts[2].length === 4) {
                datePart = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
        }
        const parsed = new Date(datePart);
        if (Number.isNaN(parsed.getTime())) return null;
        return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    };

    const isWithinDateRange = (target, start, end) => {
        if (!target) return false;
        if (!start && !end) return true;
        if (!start) return target <= end;
        if (!end) return target >= start;
        return target >= start && target <= end;
    };

    const filteredTasks = tasks.filter(task => {
        const matchesSearch = (task.title?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
            (task.assignee_name?.toLowerCase() || '').includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilters.includes('all') || statusFilters.includes(task.status?.toLowerCase());

        // Date filter: show tasks active on selected date (start_date..due_date)
        let matchesDate = true;
        if (dateFilter) {
            const selectedDate = normalizeDate(dateFilter);
            const startDate = normalizeDate(task.start_date || task.due_date);
            const endDate = normalizeDate(task.due_date || task.start_date);
            matchesDate = isWithinDateRange(selectedDate, startDate, endDate);
        }

        return matchesSearch && matchesStatus && matchesDate;
    });

    if (loading) {
        return <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading tasks...</div>;
    }

    if (!tasks) return <div className="p-8 text-red-500">Error: Tasks state is null</div>;
    // Debug info
    // return <div className="p-4 bg-gray-100">DEBUG: Loading: {String(loading)}, Tasks: {tasks.length}, Project: {currentProject?.name}</div>;

    return (
        <>
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.7; }
                }
            `}</style>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Premium Dark Header */}
                <div style={{
                    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
                    borderRadius: '20px',
                    padding: '32px 36px',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.15)'
                }}>
                    {/* Subtle Grid Pattern */}
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundImage: `
                        linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
                    `,
                        backgroundSize: '32px 32px',
                        pointerEvents: 'none'
                    }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                        <div>
                            {/* Back Button + Badge */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                {onBack && (
                                    <button
                                        onClick={onBack}
                                        style={{
                                            background: 'rgba(255,255,255,0.1)',
                                            border: 'none',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            color: 'rgba(255,255,255,0.7)',
                                            padding: '8px',
                                            borderRadius: '8px',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        <ChevronDown size={20} style={{ transform: 'rotate(90deg)' }} />
                                    </button>
                                )}
                                <span style={{
                                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                    color: 'white',
                                    padding: '6px 14px',
                                    borderRadius: '20px',
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    letterSpacing: '0.1em',
                                    textTransform: 'uppercase',
                                    boxShadow: '0 4px 12px rgba(245,158,11,0.4)'
                                }}>
                                    TASK MANAGEMENT
                                </span>
                                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.5rem' }}>●</span>
                                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', fontWeight: 500 }}>
                                    {viewMode === 'my_tasks' ? 'Personal Tasks' : 'Team Collaboration'}
                                </span>
                            </div>

                            {/* Main Title with Gradient */}
                            <h1 style={{
                                fontSize: '2rem',
                                fontWeight: 800,
                                background: 'linear-gradient(135deg, #ffffff 0%, #94a3b8 50%, #f59e0b 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                                marginBottom: '8px',
                                letterSpacing: '-0.02em'
                            }}>
                                {viewMode === 'my_tasks' ? 'My ' : 'Team '}<span style={{
                                    background: 'linear-gradient(135deg, #f59e0b 0%, #06b6d4 100%)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    backgroundClip: 'text'
                                }}>Tasks</span>
                            </h1>

                            {/* Description */}
                            <p style={{
                                color: 'rgba(255,255,255,0.6)',
                                fontSize: '0.95rem',
                                maxWidth: '500px',
                                lineHeight: 1.5
                            }}>
                                {viewMode === 'my_tasks' ? 'Track your personal tasks through the lifecycle' : 'Manage and track all team tasks in one place'}
                            </p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-end' }}>
                            {(userRole === 'manager' || userRole === 'executive') && (!effectiveProjectRole || effectiveProjectRole === 'manager' || effectiveProjectRole === 'team_lead') && (
                                <button
                                    onClick={() => setShowAddTaskModal(true)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '12px 20px',
                                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '12px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        fontSize: '0.9rem',
                                        boxShadow: '0 4px 14px rgba(16,185,129,0.4)',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <Plus size={18} />
                                    New Task
                                </button>
                            )}
                            <button
                                onClick={downloadCSV}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '10px 16px',
                                    backgroundColor: 'rgba(255,255,255,0.1)',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    borderRadius: '10px',
                                    color: 'rgba(255,255,255,0.8)',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <ExternalLink size={16} /> Export CSV
                            </button>
                        </div>
                    </div>
                </div>

                {/* Premium Toolbar */}
                <div style={{
                    display: 'flex',
                    gap: '16px',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    backgroundColor: 'white',
                    padding: '12px 16px',
                    borderRadius: '16px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
                    border: '1px solid rgba(226, 232, 240, 0.8)'
                }}>
                    {/* Search */}
                    <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
                        <Search size={18} style={{
                            position: 'absolute',
                            left: '14px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: '#94a3b8'
                        }} />
                        <input
                            type="text"
                            placeholder="Search tasks..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '12px 16px 12px 42px',
                                borderRadius: '12px',
                                border: '1px solid #e2e8f0',
                                fontSize: '0.9rem',
                                outline: 'none',
                                backgroundColor: '#f8fafc',
                                transition: 'all 0.2s',
                                color: '#334155'
                            }}
                            onFocus={(e) => {
                                e.target.style.backgroundColor = 'white';
                                e.target.style.borderColor = '#3b82f6';
                                e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                            }}
                            onBlur={(e) => {
                                e.target.style.backgroundColor = '#f8fafc';
                                e.target.style.borderColor = '#e2e8f0';
                                e.target.style.boxShadow = 'none';
                            }}
                        />
                    </div>

                    {/* Filters Group */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {/* Date Picker */}
                        <div style={{
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            backgroundColor: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '12px',
                            padding: '4px',
                            transition: 'all 0.2s'
                        }}>
                            <div style={{
                                padding: '8px 12px',
                                color: '#64748b',
                                display: 'flex',
                                alignItems: 'center',
                                borderRight: '1px solid #e2e8f0'
                            }}>
                                <Calendar size={16} />
                            </div>
                            <input
                                type="date"
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                                style={{
                                    padding: '8px 12px',
                                    border: 'none',
                                    outline: 'none',
                                    backgroundColor: 'transparent',
                                    color: '#334155',
                                    fontSize: '0.9rem',
                                    cursor: 'pointer',
                                    height: '24px',
                                    fontFamily: 'inherit',
                                    fontWeight: 500
                                }}
                            />
                        </div>

                        {/* Today Button */}
                        <button
                            onClick={() => setDateFilter(new Date().toISOString().split('T')[0])}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '10px 18px',
                                borderRadius: '12px',
                                border: 'none',
                                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                color: 'white',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
                                transition: 'all 0.2s'
                            }}
                            title="Show Today's Tasks"
                            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                            <Clock size={16} />
                            <span>Today</span>
                        </button>

                        {dateFilter && (
                            <button
                                onClick={() => setDateFilter('')}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '42px',
                                    height: '42px',
                                    borderRadius: '12px',
                                    border: '1px solid #fee2e2',
                                    backgroundColor: '#fff1f2',
                                    color: '#e11d48',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    boxShadow: '0 2px 8px rgba(225, 29, 72, 0.05)'
                                }}
                                title="Clear Date Filter"
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#ffe4e6';
                                    e.currentTarget.style.transform = 'rotate(90deg)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = '#fff1f2';
                                    e.currentTarget.style.transform = 'rotate(0deg)';
                                }}
                            >
                                <X size={18} />
                            </button>
                        )}
                    </div>



                    {/* Status Filter Multi-Select */}
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                            style={{
                                padding: '10px 16px',
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                fontSize: '0.9rem',
                                fontWeight: 600,
                                backgroundColor: 'white',
                                color: '#334155',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                            }}
                        >
                            <span>{statusFilters.includes('all') ? 'All Statuses' : `${statusFilters.length} Selected`}</span>
                            <ChevronDown size={14} />
                        </button>

                        {showStatusDropdown && (
                            <>
                                <div
                                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 40 }}
                                    onClick={() => setShowStatusDropdown(false)}
                                />
                                <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    right: 0,
                                    marginTop: '8px',
                                    backgroundColor: 'white',
                                    borderRadius: '12px',
                                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                                    border: '1px solid #e2e8f0',
                                    padding: '8px',
                                    zIndex: 50,
                                    width: '200px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '2px'
                                }}>
                                    {[
                                        { value: 'all', label: 'All Statuses' },
                                        { value: 'pending', label: 'Pending' },
                                        { value: 'in_progress', label: 'In Progress' },
                                        { value: 'completed', label: 'Completed' },
                                        { value: 'on_hold', label: 'On Hold' },
                                        { value: 'rejected', label: 'Rejected' },
                                        { value: 'archived', label: 'Archived' }
                                    ].map(option => (
                                        <div
                                            key={option.value}
                                            onClick={() => {
                                                if (option.value === 'all') {
                                                    setStatusFilters(['all']);
                                                } else {
                                                    let newFilters = statusFilters.filter(f => f !== 'all');
                                                    if (newFilters.includes(option.value)) {
                                                        newFilters = newFilters.filter(f => f !== option.value);
                                                    } else {
                                                        newFilters.push(option.value);
                                                    }
                                                    if (newFilters.length === 0) newFilters = ['all'];
                                                    setStatusFilters(newFilters);
                                                }
                                            }}
                                            style={{
                                                padding: '8px 12px',
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                fontSize: '0.85rem',
                                                fontWeight: 500,
                                                color: '#334155',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                backgroundColor: statusFilters.includes(option.value) ? '#f0f9ff' : 'transparent',
                                                transition: 'background-color 0.15s'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = statusFilters.includes(option.value) ? '#e0f2fe' : '#f8fafc'}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = statusFilters.includes(option.value) ? '#f0f9ff' : 'transparent'}
                                        >
                                            <div style={{
                                                width: '16px',
                                                height: '16px',
                                                borderRadius: '4px',
                                                border: `2px solid ${statusFilters.includes(option.value) ? '#3b82f6' : '#cbd5e1'}`,
                                                backgroundColor: statusFilters.includes(option.value) ? '#3b82f6' : 'white',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                {statusFilters.includes(option.value) && <CheckCircle2 size={10} color="white" />}
                                            </div>
                                            {option.label}
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Task List */}
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                ) : tasks.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px', color: '#6b7280' }}>
                        <ListTodo size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                        <p style={{ fontSize: '1.125rem', fontWeight: 500 }}>No tasks found</p>
                        <p style={{ fontSize: '0.875rem' }}>You're all caught up!</p>
                    </div>
                ) : (
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        overflow: 'hidden'
                    }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                        <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Task</th>
                                        <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Assignee</th>
                                        <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Lifecycle</th>
                                        <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Due</th>
                                        <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Hrs</th>
                                        <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Priority</th>
                                        <th style={{ padding: '10px', textAlign: 'center', fontWeight: 600, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em', minWidth: '140px' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredTasks.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
                                                No tasks found
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredTasks.map((task, index) => {
                                            const priorityStyle = getPriorityStyle(task.priority);
                                            const statusStyle = getStatusStyle(task.status);
                                            const reassignmentLabel = task.reassigned_from
                                                ? `Reassigned from ${task.reassigned_from_name || 'Unknown'}`
                                                : (task.reassigned_to
                                                    ? `Reassigned to ${task.reassigned_to_name || 'Unknown'}`
                                                    : (task.access_reason === 'Reassigned by manager' ? 'Reassigned' : null));
                                            return (
                                                <tr key={task.id} style={{
                                                    borderBottom: index < filteredTasks.length - 1 ? '1px solid #f1f5f9' : 'none',
                                                    transition: 'background-color 0.15s'
                                                }}
                                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}
                                                >
                                                    <td style={{ padding: '12px', verticalAlign: 'middle', maxWidth: '200px' }}>
                                                        <div style={{
                                                            fontWeight: 600,
                                                            color: '#0f172a',
                                                            fontSize: '0.85rem',
                                                            lineHeight: '1.3',
                                                            display: '-webkit-box',
                                                            WebkitLineClamp: 2,
                                                            WebkitBoxOrient: 'vertical',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis'
                                                        }}>
                                                            {task.title}
                                                        </div>
                                                        {/* Skill Badge & Review Indicator */}
                                                        <div style={{ marginTop: '6px', display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                            {/* Skill Badge */}
                                                            <SkillBadgeIndicator taskId={task.id} employeeId={task.assigned_to} />

                                                            {/* Review Needed Indicator - Show for managers when task has pending validations */}
                                                            {(userRole === 'manager' || projectRole === 'manager' || userRole === 'team_lead' || projectRole === 'team_lead') && (() => {
                                                                const validations = task.phase_validations || {};
                                                                const hasPendingProof = Object.keys(validations).some(key => {
                                                                    if (key === 'active_phases') return false;
                                                                    const phaseData = validations[key];
                                                                    return phaseData && (phaseData.proof_url || phaseData.proof_text) && phaseData.status === 'pending';
                                                                });

                                                                if (hasPendingProof) {
                                                                    return (
                                                                        <div style={{
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            padding: '4px 8px',
                                                                            borderRadius: '12px',
                                                                            backgroundColor: '#fef3c7',
                                                                            border: '1px solid #fbbf24',
                                                                            fontSize: '10px',
                                                                            fontWeight: 700,
                                                                            color: '#92400e',
                                                                            textTransform: 'uppercase',
                                                                            letterSpacing: '0.05em',
                                                                            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                                                                        }}>
                                                                            <AlertCircle size={10} style={{ marginRight: '4px' }} />
                                                                            Review Needed
                                                                        </div>
                                                                    );
                                                                }
                                                                return null;
                                                            })()}

                                                            {reassignmentLabel && (
                                                                <div style={{
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    padding: '2px 8px',
                                                                    borderRadius: '999px',
                                                                    backgroundColor: '#fef3c7',
                                                                    color: '#92400e',
                                                                    fontSize: '0.7rem',
                                                                    fontWeight: 600,
                                                                    whiteSpace: 'nowrap'
                                                                }}>
                                                                    {reassignmentLabel}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '12px', verticalAlign: 'middle' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <div style={{
                                                                width: '20px',
                                                                height: '20px',
                                                                borderRadius: '50%',
                                                                backgroundColor: '#e2e8f0',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                overflow: 'hidden',
                                                                fontSize: '0.65rem',
                                                                fontWeight: 600,
                                                                color: '#64748b'
                                                            }}>
                                                                {task.assignee_avatar ? (
                                                                    <img src={task.assignee_avatar} alt={task.assignee_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                ) : (
                                                                    task.assignee_name.charAt(0)
                                                                )}
                                                            </div>
                                                            <span style={{ fontWeight: 500, color: '#0f172a', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{task.assignee_name}</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '12px', verticalAlign: 'middle' }}>
                                                        <LifecycleProgress currentPhase={task.lifecycle_state} subState={task.sub_state} validations={task.phase_validations} taskStatus={task.status} />
                                                    </td>
                                                    <td style={{ padding: '12px', verticalAlign: 'middle' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64748b', whiteSpace: 'nowrap' }}>
                                                            <Calendar size={12} />
                                                            <span style={{ fontSize: '0.75rem' }}>
                                                                {task.due_date ? new Date(task.due_date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }) : '-'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '12px', verticalAlign: 'middle' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64748b', whiteSpace: 'nowrap' }}>
                                                            <Clock size={12} />
                                                            <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>
                                                                {task.allocated_hours ? `${task.allocated_hours}h` : '-'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '12px', verticalAlign: 'middle' }}>
                                                        <div style={{ position: 'relative', display: 'inline-block' }}>
                                                            <select
                                                                value={task.priority || 'medium'}
                                                                onChange={(e) => handleUpdateTask(task.id, { priority: e.target.value.toLowerCase() })}
                                                                style={{
                                                                    padding: '4px 24px 4px 10px',
                                                                    backgroundColor: priorityStyle.bg,
                                                                    color: priorityStyle.text,
                                                                    border: 'none',
                                                                    borderRadius: '4px',
                                                                    fontSize: '0.7rem',
                                                                    fontWeight: 700,
                                                                    textTransform: 'uppercase',
                                                                    cursor: 'pointer',
                                                                    outline: 'none',
                                                                    appearance: 'none',
                                                                    minWidth: '80px'
                                                                }}
                                                            >
                                                                <option value="high">HIGH</option>
                                                                <option value="medium">MEDIUM</option>
                                                                <option value="low">LOW</option>
                                                            </select>
                                                            <ChevronDown size={10} style={{
                                                                position: 'absolute',
                                                                right: '6px',
                                                                top: '50%',
                                                                transform: 'translateY(-50%)',
                                                                pointerEvents: 'none',
                                                                color: priorityStyle.text
                                                            }} />
                                                        </div>
                                                    </td>

                                                    <td style={{ padding: '12px', verticalAlign: 'middle', textAlign: 'center' }}>
                                                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                                                            <button
                                                                onClick={() => setSelectedTask(task)}
                                                                style={{
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px',
                                                                    padding: '6px 10px',
                                                                    backgroundColor: '#f1f5f9',
                                                                    color: '#0f172a',
                                                                    border: 'none',
                                                                    borderRadius: '4px',
                                                                    fontSize: '0.75rem',
                                                                    fontWeight: 600,
                                                                    cursor: 'pointer',
                                                                    whiteSpace: 'nowrap'
                                                                }}
                                                                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#e2e8f0'}
                                                                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                                                            >
                                                                <Eye size={12} />
                                                                View
                                                            </button>

                                                            {/* Edit Button */}
                                                            {(userRole === 'manager' || userRole === 'team_lead') && task.status !== 'completed' && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleEditTask(task);
                                                                    }}
                                                                    style={{
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: '4px',
                                                                        padding: '6px 10px',
                                                                        backgroundColor: '#3b82f6',
                                                                        color: 'white',
                                                                        border: 'none',
                                                                        borderRadius: '4px',
                                                                        fontSize: '0.75rem',
                                                                        fontWeight: 600,
                                                                        cursor: 'pointer',
                                                                        whiteSpace: 'nowrap'
                                                                    }}
                                                                >
                                                                    <Edit2 size={12} />
                                                                    Edit
                                                                </button>
                                                            )}

                                                            {/* Archive Button - Available for ALL tasks */}
                                                            {task.status !== 'archived' && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleArchiveTask(task.id);
                                                                    }}
                                                                    title="Archive this task"
                                                                    style={{
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: '4px',
                                                                        padding: '6px 10px',
                                                                        backgroundColor: '#6366f1',
                                                                        color: 'white',
                                                                        border: 'none',
                                                                        borderRadius: '4px',
                                                                        fontSize: '0.75rem',
                                                                        fontWeight: 600,
                                                                        cursor: 'pointer',
                                                                        whiteSpace: 'nowrap'
                                                                    }}
                                                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#4f46e5'}
                                                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#6366f1'}
                                                                >
                                                                    <Archive size={12} />
                                                                    Archive
                                                                </button>
                                                            )}

                                                            {/* Employee Actions: Show for My Tasks OR if I am the assignee */}
                                                            {(viewMode === 'my_tasks' || (task.assigned_to === userId)) && (
                                                                <>
                                                                    {/* Check Locking Logic */}
                                                                    {(() => {
                                                                        const curTime = new Date();
                                                                        let dueDateTime = null;
                                                                        let isInvalidDate = false;

                                                                        if (task.due_date) {
                                                                            let datePart = task.due_date;
                                                                            // Handle DD/MM/YYYY format if present
                                                                            if (datePart.includes('/')) {
                                                                                const parts = datePart.split('/');
                                                                                if (parts.length === 3) {
                                                                                    // Assume DD/MM/YYYY -> YYYY-MM-DD
                                                                                    datePart = `${parts[2]}-${parts[1]}-${parts[0]}`;
                                                                                }
                                                                            }

                                                                            const timePart = task.due_time ? task.due_time : '23:59:00';
                                                                            const isoString = `${datePart}T${timePart}`;
                                                                            dueDateTime = new Date(isoString);

                                                                            if (isNaN(dueDateTime.getTime())) {
                                                                                console.warn('Invalid Date Parsed:', isoString);
                                                                                isInvalidDate = true;
                                                                            }
                                                                        }

                                                                        // If date is invalid but existed, treat as overdue/locked (Fail Secure)
                                                                        const isOverdue = isInvalidDate || (dueDateTime && curTime > dueDateTime);

                                                                        const isLocked = (task.is_locked || isOverdue) &&
                                                                            task.status !== 'completed' &&
                                                                            task.access_status !== 'approved';

                                                                        if (isLocked) {
                                                                            if (task.access_requested && task.access_status === 'pending') {
                                                                                return (
                                                                                    <span style={{ fontSize: '0.7rem', padding: '6px 10px', borderRadius: '4px', backgroundColor: '#fef3c7', color: '#d97706', fontWeight: 600 }}>
                                                                                        Access Pending
                                                                                    </span>
                                                                                );
                                                                            }
                                                                            return (
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        setTaskForAccess(task);
                                                                                        setShowAccessRequestModal(true);
                                                                                    }}
                                                                                    style={{
                                                                                        display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 10px',
                                                                                        backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '4px',
                                                                                        fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer'
                                                                                    }}
                                                                                >
                                                                                    Request Access
                                                                                </button>
                                                                            );
                                                                        }

                                                                        // Not Locked
                                                                        return null;
                                                                    })()}
                                                                </>
                                                            )}

                                                            {/* Manager: Access Requests */}
                                                            {(userRole === 'manager' || userRole === 'team_lead') && task.access_requested && task.access_status === 'pending' && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setAccessReviewTask(task);
                                                                        setReviewAction('approve');
                                                                        setShowAccessReviewModal(true);
                                                                    }}
                                                                    title={`Reason: ${task.access_reason}`}
                                                                    style={{
                                                                        display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 10px',
                                                                        backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '4px',
                                                                        fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer'
                                                                    }}
                                                                >
                                                                    Review Access
                                                                </button>
                                                            )}

                                                            {(userRole === 'manager' || userRole === 'team_lead') && task.issues && !task.issues.includes('RESOLVED') && (
                                                                <button
                                                                    onClick={() => openIssueModal(task)}
                                                                    style={{
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: '6px',
                                                                        padding: '8px 12px',
                                                                        backgroundColor: '#f59e0b',
                                                                        color: 'white',
                                                                        border: 'none',
                                                                        borderRadius: '6px',
                                                                        fontSize: '0.85rem',
                                                                        fontWeight: 600,
                                                                        cursor: 'pointer',
                                                                        whiteSpace: 'nowrap'
                                                                    }}
                                                                >
                                                                    <AlertTriangle size={14} />
                                                                    Resolve
                                                                </button>
                                                            )}


                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
                {/* Add Task Modal */}
                {
                    showAddTaskModal && (
                        <div style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: 'rgba(0, 0, 0, 0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '20px',
                            zIndex: 1000,
                            backdropFilter: 'blur(4px)'
                        }}>
                            <div style={{
                                backgroundColor: 'white',
                                borderRadius: '16px',
                                width: '100%',
                                maxWidth: '550px',
                                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                                display: 'flex',
                                flexDirection: 'column',
                                maxHeight: '90vh'
                            }}>
                                {/* Modal Header */}
                                <div style={{
                                    padding: '20px 24px',
                                    borderBottom: '1px solid #f1f5f9',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>Assign New Task</h2>
                                    <button
                                        onClick={() => setShowAddTaskModal(false)}
                                        style={{
                                            border: 'none',
                                            background: 'none',
                                            color: '#64748b',
                                            cursor: 'pointer',
                                            padding: '4px'
                                        }}
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                {/* Modal Body */}
                                <form onSubmit={handleAddTask} style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    {/* Task Title */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                                            Task Title <span style={{ color: '#ef4444' }}>*</span>
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Enter task title"
                                            value={newTask.title}
                                            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                                            required
                                            style={{
                                                width: '100%',
                                                padding: '10px 12px',
                                                border: '1px solid #e2e8f0',
                                                borderRadius: '8px',
                                                fontSize: '0.95rem',
                                                outline: 'none'
                                            }}
                                        />
                                    </div>

                                    {/* Description */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                                            Description
                                        </label>
                                        <textarea
                                            placeholder="Enter task description (use new lines for points)"
                                            value={newTask.description}
                                            onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                                            style={{
                                                width: '100%',
                                                padding: '10px 12px',
                                                border: '1px solid #e2e8f0',
                                                borderRadius: '8px',
                                                fontSize: '0.95rem',
                                                outline: 'none',
                                                minHeight: '100px',
                                                resize: 'vertical'
                                            }}
                                        />
                                    </div>

                                    {/* Assign To */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#334155', marginBottom: '12px' }}>
                                            Assign To <span style={{ color: '#ef4444' }}>*</span>
                                        </label>
                                        <div style={{ display: 'flex', gap: '24px', marginBottom: '12px' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.95rem' }}>
                                                <input
                                                    type="radio"
                                                    checked={newTask.assignType === 'individual'}
                                                    onChange={() => setNewTask({ ...newTask, assignType: 'individual' })}
                                                    style={{ cursor: 'pointer' }}
                                                />
                                                Individual Employee
                                            </label>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.95rem' }}>
                                                <input
                                                    type="radio"
                                                    checked={newTask.assignType === 'team'}
                                                    onChange={() => setNewTask({ ...newTask, assignType: 'team', assignedTo: currentProject?.id })}
                                                    disabled={!currentProject?.id}
                                                    style={{ cursor: !currentProject?.id ? 'not-allowed' : 'pointer' }}
                                                />
                                                Entire Team
                                            </label>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.95rem' }}>
                                                <input
                                                    type="radio"
                                                    checked={newTask.assignType === 'multi'}
                                                    onChange={() => setNewTask({ ...newTask, assignType: 'multi' })}
                                                    style={{ cursor: 'pointer' }}
                                                />
                                                Multiple Members
                                            </label>
                                        </div>

                                        {newTask.assignType === 'multi' ? (
                                            <div style={{
                                                display: 'flex',
                                                flexWrap: 'wrap',
                                                gap: '12px',
                                                padding: '12px',
                                                backgroundColor: '#f8fafc',
                                                borderRadius: '8px',
                                                border: '1px solid #e2e8f0',
                                                maxHeight: '200px',
                                                overflowY: 'auto'
                                            }}>
                                                {employees.length === 0 ? (
                                                    <p style={{ color: '#94a3b8', width: '100%', textAlign: 'center' }}>No employees found.</p>
                                                ) : (
                                                    sortedEmployees.map(emp => {
                                                        const score = newTask.skill ? (emp.technical_scores?.[newTask.skill] || 0) : null;
                                                        return (
                                                            <label
                                                                key={emp.id}
                                                                style={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '6px',
                                                                    fontSize: '0.9rem',
                                                                    cursor: 'pointer',
                                                                    userSelect: 'none',
                                                                    backgroundColor: 'white',
                                                                    padding: '4px 8px',
                                                                    borderRadius: '6px',
                                                                    border: newTask.selectedAssignees.includes(emp.id) ? '1px solid #3b82f6' : '1px solid #e2e8f0'
                                                                }}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={newTask.selectedAssignees.includes(emp.id)}
                                                                    onChange={(e) => {
                                                                        if (e.target.checked) {
                                                                            setNewTask({ ...newTask, selectedAssignees: [...newTask.selectedAssignees, emp.id] });
                                                                        } else {
                                                                            setNewTask({ ...newTask, selectedAssignees: newTask.selectedAssignees.filter(id => id !== emp.id) });
                                                                        }
                                                                    }}
                                                                    style={{ accentColor: '#3b82f6' }}
                                                                />
                                                                <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between' }}>
                                                                    <span>{emp.full_name}</span>
                                                                    {score !== null && <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Score: {score}</span>}
                                                                </div>
                                                            </label>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        ) : (
                                            <div style={{ position: 'relative' }}>
                                                <select
                                                    value={newTask.assignedTo}
                                                    onChange={(e) => setNewTask({ ...newTask, assignedTo: e.target.value })}
                                                    required={newTask.assignType === 'individual'}
                                                    disabled={newTask.assignType === 'team'}
                                                    style={{
                                                        width: '100%',
                                                        padding: '10px 12px',
                                                        border: '1px solid #e2e8f0',
                                                        borderRadius: '8px',
                                                        fontSize: '0.95rem',
                                                        backgroundColor: newTask.assignType === 'team' ? '#f1f5f9' : 'white',
                                                        appearance: 'none',
                                                        outline: 'none',
                                                        color: newTask.assignType === 'team' ? '#64748b' : 'inherit'
                                                    }}
                                                >
                                                    <option value="">{newTask.assignType === 'individual' ? 'Select Employee' : `Entire ${currentProject?.name} Team`}</option>
                                                    {newTask.assignType === 'individual' && (
                                                        sortedEmployees.map(emp => {
                                                            const score = newTask.skill ? (emp.technical_scores?.[newTask.skill] || 0) : null;
                                                            return (
                                                                <option key={emp.id} value={emp.id}>
                                                                    {emp.full_name} {score !== null ? `(Score: ${score})` : ''}
                                                                </option>
                                                            );
                                                        })
                                                    )}
                                                </select>
                                                <ChevronDown size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b' }} />
                                            </div>
                                        )}
                                    </div>

                                    {/* Date and Time Grid */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                        {/* Start Date */}
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>Start Date</label>
                                            <input
                                                type="date"
                                                value={newTask.startDate}
                                                onChange={(e) => setNewTask({ ...newTask, startDate: e.target.value })}
                                                style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.9rem', outline: 'none' }}
                                            />
                                        </div>
                                        {/* Start Time */}
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>Start Time</label>
                                            <input
                                                type="time"
                                                value={newTask.startTime}
                                                onChange={(e) => setNewTask({ ...newTask, startTime: e.target.value })}
                                                style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.9rem', outline: 'none' }}
                                            />
                                        </div>
                                        {/* Due Date */}
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                                <label style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155', margin: 0 }}>Due Date</label>
                                            </div>
                                            <input
                                                type="date"
                                                value={newTask.endDate}
                                                onChange={(e) => setNewTask({ ...newTask, endDate: e.target.value })}
                                                style={{
                                                    width: '100%',
                                                    padding: '10px 12px',
                                                    border: '1px solid #e2e8f0',
                                                    borderRadius: '8px',
                                                    fontSize: '0.9rem',
                                                    outline: 'none',
                                                    backgroundColor: 'white'
                                                }}
                                            />
                                        </div>
                                        {/* Due Time */}
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                                <label style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155', margin: 0 }}>Due Time</label>
                                                {newTask.allocatedHours > 0 && <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#2563eb', backgroundColor: '#eff6ff', padding: '1px 6px', borderRadius: '4px' }}>AUTO</span>}
                                            </div>
                                            <input
                                                type="time"
                                                value={newTask.dueTime}
                                                readOnly={newTask.allocatedHours > 0}
                                                onChange={(e) => !newTask.allocatedHours && setNewTask({ ...newTask, dueTime: e.target.value })}
                                                style={{
                                                    width: '100%',
                                                    padding: '10px 12px',
                                                    border: '1px solid #e2e8f0',
                                                    borderRadius: '8px',
                                                    fontSize: '0.9rem',
                                                    outline: 'none',
                                                    backgroundColor: newTask.allocatedHours > 0 ? '#f8fafc' : 'white',
                                                    color: newTask.allocatedHours > 0 ? '#64748b' : 'inherit'
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {/* Value Configuration */}
                                    <div style={{ padding: '16px', backgroundColor: '#f0f9ff', borderRadius: '12px', border: '1px solid #e0f2fe', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#0369a1', marginBottom: '8px' }}>Required Skill</label>
                                                <select
                                                    value={newTask.skill}
                                                    onChange={(e) => setNewTask({ ...newTask, skill: e.target.value })}
                                                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #bae6fd', borderRadius: '8px', fontSize: '0.9rem', outline: 'none' }}
                                                >
                                                    <option value="">Select Skill</option>
                                                    {['Frontend', 'Backend', 'Workflows', 'Databases', 'Prompting', 'Non-popular LLMs', 'Fine-tuning', 'Data Labelling', 'Content Generation'].map(s => (
                                                        <option key={s} value={s}>{s}</option>
                                                    ))}
                                                </select>


                                            </div>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0369a1', margin: 0 }}>Allocated Hours</label>
                                                    {Object.values(taskStepsToAdd).flat().length > 0 && <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#0369a1', backgroundColor: '#e0f2fe', padding: '1px 4px', borderRadius: '3px' }}>CALCULATED</span>}
                                                </div>
                                                <input
                                                    type="number"
                                                    value={newTask.allocatedHours}
                                                    readOnly={Object.values(taskStepsToAdd).flat().length > 0}
                                                    onChange={(e) => setNewTask({ ...newTask, allocatedHours: e.target.value })}
                                                    style={{
                                                        width: '100%',
                                                        padding: '10px 12px',
                                                        border: Object.values(taskStepsToAdd).flat().length > 0 ? '1px solid #e2e8f0' : '1px solid #bae6fd',
                                                        borderRadius: '8px',
                                                        fontSize: '0.9rem',
                                                        outline: 'none',
                                                        backgroundColor: Object.values(taskStepsToAdd).flat().length > 0 ? '#f8fafc' : 'white',
                                                        color: Object.values(taskStepsToAdd).flat().length > 0 ? '#64748b' : 'inherit'
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>



                                    {/* Lifecycle Stages Selection */}
                                    <div style={{ marginTop: '12px' }}>
                                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#334155', marginBottom: '12px' }}>
                                            Required Lifecycle Stages <span style={{ color: '#ef4444' }}>*</span>
                                        </label>
                                        <div id="lifecycle-container" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {LIFECYCLE_PHASES.map(phase => {
                                                const active = newTask.requiredPhases.includes(phase.key);
                                                const file = phaseFiles[phase.key];

                                                return (
                                                    <div key={phase.key} style={{
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        padding: '12px 14px',
                                                        backgroundColor: active ? '#f8fafc' : 'white',
                                                        border: `1px solid ${active ? '#e2e8f0' : '#f1f5f9'}`,
                                                        borderRadius: '12px',
                                                        transition: 'all 0.2s ease',
                                                        marginBottom: '8px',
                                                        cursor: 'pointer'
                                                    }} onClick={() => {
                                                        const isChecked = newTask.requiredPhases.includes(phase.key);
                                                        if (!isChecked) {
                                                            const newPhases = [...newTask.requiredPhases, phase.key].sort((a, b) =>
                                                                LIFECYCLE_PHASES.findIndex(p => p.key === a) - LIFECYCLE_PHASES.findIndex(p => p.key === b)
                                                            );
                                                            setNewTask({ ...newTask, requiredPhases: newPhases });
                                                        } else if (newTask.requiredPhases.length > 1) {
                                                            setNewTask({ ...newTask, requiredPhases: newTask.requiredPhases.filter(p => p !== phase.key) });
                                                            const newFiles = { ...phaseFiles };
                                                            delete newFiles[phase.key];
                                                            setPhaseFiles(newFiles);
                                                            const newDescs = { ...phaseDescriptions };
                                                            delete newDescs[phase.key];
                                                            setPhaseDescriptions(newDescs);
                                                        }
                                                    }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                                                                <div style={{
                                                                    width: '18px',
                                                                    height: '18px',
                                                                    borderRadius: '4px',
                                                                    border: `2px solid ${active ? '#0f172a' : '#cbd5e1'}`,
                                                                    backgroundColor: active ? '#0f172a' : 'white',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center'
                                                                }}>
                                                                    {active && <div style={{ width: '6px', height: '6px', backgroundColor: 'white', borderRadius: '1.5px' }} />}
                                                                </div>
                                                                <span style={{
                                                                    fontSize: '0.9rem',
                                                                    fontWeight: active ? 600 : 400,
                                                                    color: active ? '#0f172a' : '#64748b'
                                                                }}>{phase.label}</span>
                                                            </div>

                                                            {active && (
                                                                <div
                                                                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                >
                                                                    <input
                                                                        type="file"
                                                                        id={`guidance-${phase.key}`}
                                                                        style={{ display: 'none' }}
                                                                        onChange={(e) => {
                                                                            if (e.target.files[0]) {
                                                                                setPhaseFiles({ ...phaseFiles, [phase.key]: e.target.files[0] });
                                                                            }
                                                                        }}
                                                                    />

                                                                    {file ? (
                                                                        <div style={{
                                                                            display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#eff6ff',
                                                                            padding: '6px 12px', borderRadius: '8px', border: '1px solid #dbeafe',
                                                                            fontSize: '0.8rem', color: '#2563eb'
                                                                        }}>
                                                                            <FileText size={14} />
                                                                            <span style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                                {file.name}
                                                                            </span>
                                                                            <X
                                                                                size={14} style={{ cursor: 'pointer' }}
                                                                                onClick={() => {
                                                                                    const n = { ...phaseFiles };
                                                                                    delete n[phase.key];
                                                                                    setPhaseFiles(n);
                                                                                }}
                                                                            />
                                                                        </div>
                                                                    ) : (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => document.getElementById(`guidance-${phase.key}`).click()}
                                                                            style={{
                                                                                display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
                                                                                borderRadius: '8px', border: '1px dashed #cbd5e1', backgroundColor: 'white',
                                                                                color: '#64748b', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer'
                                                                            }}
                                                                        >
                                                                            <Upload size={14} /> Add Specs
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {active && (
                                                            <div style={{ marginTop: '10px', width: '100%' }} onClick={e => e.stopPropagation()}>
                                                                <textarea
                                                                    placeholder={`Add specific instructions or requirements for the ${phase.label} stage...`}
                                                                    value={phaseDescriptions[phase.key] || ''}
                                                                    onChange={e => setPhaseDescriptions({ ...phaseDescriptions, [phase.key]: e.target.value })}
                                                                    style={{
                                                                        width: '100%',
                                                                        minHeight: '60px',
                                                                        padding: '10px',
                                                                        borderRadius: '8px',
                                                                        border: '1px solid #e2e8f0',
                                                                        fontSize: '0.85rem',
                                                                        color: '#334155',
                                                                        fontFamily: 'inherit',
                                                                        resize: 'vertical',
                                                                        outline: 'none',
                                                                        backgroundColor: 'white'
                                                                    }}
                                                                    onFocus={(e) => e.target.style.borderColor = '#2563eb'}
                                                                    onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                        <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                                            Uncheck stages not needed. Upload guidance docs for stages if necessary.
                                        </p>
                                    </div>

                                    {/* Execution Steps Section */}
                                    <div style={{ marginTop: '16px' }}>
                                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#334155', marginBottom: '12px' }}>
                                            📝 Pre-define Execution Steps (Optional)
                                        </label>

                                        <div style={{ marginBottom: '16px' }}>
                                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#0369a1', marginBottom: '8px' }}>Step Duration Setting</label>
                                            <div style={{ display: 'flex', gap: '8px', backgroundColor: 'white', padding: '4px', borderRadius: '8px', border: '1px solid #bae6fd', width: 'fit-content' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => setNewTask(prev => ({ ...prev, stepDuration: '2h' }))}
                                                    style={{
                                                        padding: '6px 12px',
                                                        borderRadius: '6px',
                                                        fontSize: '0.8rem',
                                                        fontWeight: 600,
                                                        backgroundColor: newTask.stepDuration === '2h' ? '#0ea5e9' : 'transparent',
                                                        color: newTask.stepDuration === '2h' ? 'white' : '#64748b',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    2 Hours / Step
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setNewTask(prev => ({ ...prev, stepDuration: '4h' }))}
                                                    style={{
                                                        padding: '6px 12px',
                                                        borderRadius: '6px',
                                                        fontSize: '0.8rem',
                                                        fontWeight: 600,
                                                        backgroundColor: newTask.stepDuration === '4h' ? '#0ea5e9' : 'transparent',
                                                        color: newTask.stepDuration === '4h' ? 'white' : '#64748b',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    4 Hours / Step
                                                </button>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
                                                Checklist for each lifecycle phase
                                            </p>
                                            {Object.values(taskStepsToAdd).flat().reduce((sum, s) => sum + (s.hours || 0), 0) > 0 && (
                                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#2563eb', backgroundColor: '#eff6ff', padding: '4px 10px', borderRadius: '12px' }}>
                                                    Total Estimated Time: {Object.values(taskStepsToAdd).flat().reduce((sum, s) => sum + (s.hours || 0), 0)}h
                                                </span>
                                            )}
                                        </div>

                                        {/* Phase Tabs */}
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                                            {newTask.requiredPhases.map(phaseKey => {
                                                const phaseLabel = {
                                                    'requirement_refiner': 'Requirements',
                                                    'design_guidance': 'Design',
                                                    'build_guidance': 'Build',
                                                    'acceptance_criteria': 'Acceptance',
                                                    'deployment': 'Deployment'
                                                }[phaseKey] || phaseKey;
                                                const stepCount = (taskStepsToAdd[phaseKey] || []).length;
                                                return (
                                                    <button
                                                        key={phaseKey}
                                                        type="button"
                                                        onClick={() => setActiveStepPhase(phaseKey)}
                                                        style={{
                                                            padding: '6px 12px',
                                                            borderRadius: '6px',
                                                            border: activeStepPhase === phaseKey ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                                                            backgroundColor: activeStepPhase === phaseKey ? '#eff6ff' : 'white',
                                                            color: activeStepPhase === phaseKey ? '#1d4ed8' : '#64748b',
                                                            fontWeight: 600,
                                                            fontSize: '0.8rem',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '6px'
                                                        }}
                                                    >
                                                        {phaseLabel}
                                                        {stepCount > 0 && (
                                                            <span style={{
                                                                backgroundColor: '#3b82f6',
                                                                color: 'white',
                                                                borderRadius: '10px',
                                                                padding: '1px 6px',
                                                                fontSize: '0.7rem'
                                                            }}>{stepCount}</span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {/* Steps List for Active Phase */}
                                        <div style={{
                                            backgroundColor: '#f8fafc',
                                            borderRadius: '8px',
                                            border: '1px solid #e2e8f0',
                                            padding: '12px'
                                        }}>
                                            {(taskStepsToAdd[activeStepPhase] || []).length > 0 ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                                                    {(taskStepsToAdd[activeStepPhase] || []).map((step, idx) => (
                                                        <div key={idx} style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '8px',
                                                            padding: '8px 10px',
                                                            backgroundColor: 'white',
                                                            borderRadius: '6px',
                                                            border: '1px solid #e2e8f0'
                                                        }}>
                                                            <span style={{ fontSize: '0.85rem', color: '#334155', flex: 1 }}>
                                                                {idx + 1}. {step.title}
                                                            </span>
                                                            <span style={{
                                                                fontSize: '0.75rem',
                                                                color: '#64748b',
                                                                backgroundColor: '#f1f5f9',
                                                                padding: '2px 6px',
                                                                borderRadius: '4px',
                                                                fontWeight: 600
                                                            }}>
                                                                {step.hours}h
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const updated = [...(taskStepsToAdd[activeStepPhase] || [])];
                                                                    updated.splice(idx, 1);
                                                                    setTaskStepsToAdd({ ...taskStepsToAdd, [activeStepPhase]: updated });
                                                                }}
                                                                style={{
                                                                    border: 'none',
                                                                    background: 'none',
                                                                    color: '#ef4444',
                                                                    cursor: 'pointer',
                                                                    padding: '4px'
                                                                }}
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p style={{ fontSize: '0.8rem', color: '#94a3b8', textAlign: 'center', marginBottom: '12px' }}>
                                                    No steps added for this phase yet.
                                                </p>
                                            )}

                                            {/* Add Step Input */}
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                <input
                                                    type="text"
                                                    value={newStepInput}
                                                    onChange={(e) => setNewStepInput(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && newStepInput.trim()) {
                                                            e.preventDefault();
                                                            const existing = taskStepsToAdd[activeStepPhase] || [];
                                                            const defaultDuration = parseFloat(newTask.stepDuration) || 2;
                                                            setTaskStepsToAdd({
                                                                ...taskStepsToAdd,
                                                                [activeStepPhase]: [...existing, { title: newStepInput.trim(), hours: parseFloat(newStepHours) || defaultDuration }]
                                                            });
                                                            setNewStepInput('');
                                                            setNewStepHours(defaultDuration);
                                                        }
                                                    }}
                                                    placeholder="+ Add a step for this phase..."
                                                    style={{
                                                        flex: 1,
                                                        padding: '8px 12px',
                                                        borderRadius: '6px',
                                                        border: '1px solid #e2e8f0',
                                                        fontSize: '0.85rem',
                                                        outline: 'none'
                                                    }}
                                                />
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <input
                                                        type="number"
                                                        value={newStepHours}
                                                        onChange={(e) => setNewStepHours(e.target.value)}
                                                        min="0.5"
                                                        step="0.5"
                                                        style={{
                                                            width: '60px',
                                                            padding: '8px 6px',
                                                            borderRadius: '6px',
                                                            border: '1px solid #e2e8f0',
                                                            fontSize: '0.85rem',
                                                            outline: 'none',
                                                            textAlign: 'center'
                                                        }}
                                                    />
                                                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>hrs</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (newStepInput.trim()) {
                                                            const existing = taskStepsToAdd[activeStepPhase] || [];
                                                            setTaskStepsToAdd({
                                                                ...taskStepsToAdd,
                                                                [activeStepPhase]: [...existing, { title: newStepInput.trim(), hours: parseFloat(newStepHours) || 2 }]
                                                            });
                                                            setNewStepInput('');
                                                            setNewStepHours(2);
                                                        }
                                                    }}
                                                    disabled={!newStepInput.trim()}
                                                    style={{
                                                        padding: '8px 16px',
                                                        borderRadius: '6px',
                                                        border: 'none',
                                                        backgroundColor: newStepInput.trim() ? '#3b82f6' : '#e2e8f0',
                                                        color: newStepInput.trim() ? 'white' : '#94a3b8',
                                                        fontWeight: 600,
                                                        fontSize: '0.8rem',
                                                        cursor: newStepInput.trim() ? 'pointer' : 'default'
                                                    }}
                                                >
                                                    Add
                                                </button>
                                            </div>
                                        </div>
                                    </div>


                                    {/* Modal Footer */}
                                    <div style={{
                                        marginTop: '12px',
                                        display: 'flex',
                                        gap: '12px',
                                        justifyContent: 'flex-end'
                                    }}>
                                        <button
                                            type="button"
                                            onClick={() => setShowAddTaskModal(false)}
                                            style={{
                                                padding: '10px 20px',
                                                borderRadius: '8px',
                                                border: '1px solid #e2e8f0',
                                                backgroundColor: 'white',
                                                color: '#64748b',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                fontSize: '0.95rem'
                                            }}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={submitting}
                                            style={{
                                                padding: '10px 24px',
                                                borderRadius: '8px',
                                                border: 'none',
                                                backgroundColor: '#0f172a',
                                                color: 'white',
                                                fontWeight: 600,
                                                cursor: submitting ? 'not-allowed' : 'pointer',
                                                fontSize: '0.95rem',
                                                opacity: submitting ? 0.7 : 1
                                            }}
                                        >
                                            {submitting ? 'Assigning...' : 'Assign Task'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div >
                    )
                }
                {/* Task Detail Modal */}
                <TaskDetailOverlay
                    isOpen={!!selectedTask}
                    onClose={() => setSelectedTask(null)}
                    task={selectedTask}
                    onRefresh={fetchData}
                    addToast={addToast}
                    userId={userId}
                    userRole={userRole}
                    orgId={orgId}
                    onApprovePhase={handleApprovePhase}
                    onRejectPhase={handleRejectPhase}
                    onShowAccessRequest={(t) => {
                        setTaskForAccess(t);
                        setShowAccessRequestModal(true);
                    }}
                    onShowAccessReview={(t) => {
                        setAccessReviewTask(t);
                        setShowAccessReviewModal(true);
                    }}
                />


                {/* Issue Resolution Modal */}
                {
                    showIssueModal && taskWithIssue && (
                        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1002, backdropFilter: 'blur(4px)' }}>
                            <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '20px', width: '600px', maxWidth: '90%', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                                    <div style={{ backgroundColor: '#fef2f2', borderRadius: '12px', padding: '12px' }}>
                                        <AlertTriangle size={24} color="#f59e0b" />
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>Task Issue Details</h3>
                                        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>{taskWithIssue.title}</p>
                                    </div>
                                </div>

                                <div style={{ marginBottom: '24px', padding: '20px', backgroundColor: '#fef2f2', borderRadius: '12px', border: '2px solid #fecaca' }}>
                                    <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#991b1b', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <AlertCircle size={18} /> Issue Log
                                    </h4>
                                    <div style={{ fontSize: '0.9rem', color: '#7f1d1d', whiteSpace: 'pre-wrap', lineHeight: '1.8', maxHeight: '300px', overflowY: 'auto' }}>
                                        {taskWithIssue.issues || 'No issues reported'}
                                    </div>
                                </div>

                                <div style={{ padding: '16px', backgroundColor: '#fef3c7', borderRadius: '12px', marginBottom: '24px', border: '1px solid #fde047' }}>
                                    <p style={{ fontSize: '0.9rem', color: '#92400e', lineHeight: '1.6' }}>
                                        <strong>Note:</strong> Clicking "Mark as Resolved" will add a resolution timestamp to this issue log.
                                        The employee will be able to see that the issue has been acknowledged and resolved.
                                    </p>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                    <button
                                        onClick={() => { setShowIssueModal(false); setTaskWithIssue(null); }}
                                        disabled={resolvingIssue}
                                        style={{ padding: '12px 24px', borderRadius: '10px', backgroundColor: 'white', border: '1px solid #e2e8f0', cursor: 'pointer', fontWeight: 600, color: '#64748b' }}
                                    >
                                        Close
                                    </button>
                                    <button
                                        onClick={resolveIssue}
                                        disabled={resolvingIssue}
                                        style={{
                                            padding: '12px 24px',
                                            borderRadius: '10px',
                                            background: 'linear-gradient(135deg, #10b981, #059669)',
                                            color: 'white',
                                            border: 'none',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)'
                                        }}
                                    >
                                        <CheckCircle2 size={16} />
                                        {resolvingIssue ? 'Resolving...' : 'Mark as Resolved'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Edit Task Modal */}
                {
                    showEditModal && editingTask && (
                        <div style={{
                            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                        }}>
                            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', width: '500px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>Edit Task</h3>
                                    <button onClick={() => { setShowEditModal(false); setEditingTask(null); }} style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>Task Title *</label>
                                        <input
                                            type="text"
                                            value={editingTask.title}
                                            onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                                            placeholder="Enter task title"
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.95rem' }}
                                            autoFocus
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>Description</label>
                                        <textarea
                                            value={editingTask.description}
                                            onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                                            placeholder="Enter task description (use new lines for points)"
                                            rows="3"
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.95rem', resize: 'vertical' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>Allocated Hours *</label>
                                        <input
                                            type="number"
                                            min="0.5"
                                            step="0.5"
                                            value={editingTask.allocated_hours}
                                            onChange={(e) => setEditingTask({ ...editingTask, allocated_hours: e.target.value })}
                                            placeholder="e.g. 8.0"
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.95rem' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>Assigned To *</label>
                                        <select
                                            value={editingTask.assigned_to}
                                            onChange={(e) => setEditingTask({ ...editingTask, assigned_to: e.target.value })}
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.95rem', backgroundColor: 'white' }}
                                        >
                                            <option value="">Select Employee</option>
                                            {employees.map(emp => (
                                                <option key={emp.id} value={emp.id}>
                                                    {emp.full_name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>Due Date</label>
                                        <input
                                            type="date"
                                            value={editingTask.due_date}
                                            onChange={(e) => setEditingTask({ ...editingTask, due_date: e.target.value })}
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.95rem' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>Priority</label>
                                        <select
                                            value={editingTask.priority}
                                            onChange={(e) => setEditingTask({ ...editingTask, priority: e.target.value })}
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.95rem', backgroundColor: 'white' }}
                                        >
                                            <option value="low">Low</option>
                                            <option value="medium">Medium</option>
                                            <option value="high">High</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>Status</label>
                                        <select
                                            value={editingTask.status}
                                            onChange={(e) => setEditingTask({ ...editingTask, status: e.target.value })}
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.95rem', backgroundColor: 'white' }}
                                        >
                                            <option value="pending">Pending</option>
                                            <option value="in progress">In Progress</option>
                                            <option value="completed">Completed</option>
                                            <option value="on hold">On Hold</option>
                                        </select>
                                    </div>

                                    {/* Lifecycle Stages Selection for Edit - Managers/Team Leads */}
                                    {(userRole === 'manager' || userRole === 'team_lead') && (
                                        <div style={{ marginTop: '16px', marginBottom: '8px' }}>
                                            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                                                Required Lifecycle Stages <span style={{ color: '#ef4444' }}>*</span>
                                            </label>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                                {LIFECYCLE_PHASES.map(phase => (
                                                    <label key={phase.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={editingTask.requiredPhases ? editingTask.requiredPhases.includes(phase.key) : false}
                                                            onChange={(e) => {
                                                                const currentPhases = editingTask.requiredPhases || [];
                                                                if (e.target.checked) {
                                                                    const newPhases = [...currentPhases, phase.key];
                                                                    // Sort to keep order
                                                                    newPhases.sort((a, b) => {
                                                                        const idxA = LIFECYCLE_PHASES.findIndex(p => p.key === a);
                                                                        const idxB = LIFECYCLE_PHASES.findIndex(p => p.key === b);
                                                                        return idxA - idxB;
                                                                    });
                                                                    setEditingTask({ ...editingTask, requiredPhases: newPhases });
                                                                } else {
                                                                    if (currentPhases.length > 1) {
                                                                        setEditingTask({ ...editingTask, requiredPhases: currentPhases.filter(p => p !== phase.key) });
                                                                    }
                                                                }
                                                            }}
                                                            disabled={editingTask.status === 'completed' || editingTask.status === 'cancelled'}
                                                            style={{ accentColor: '#3b82f6', cursor: 'pointer' }}
                                                        />
                                                        {phase.label}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                                        <button
                                            onClick={() => { setShowEditModal(false); setEditingTask(null); }}
                                            style={{ flex: 1, padding: '12px', borderRadius: '8px', fontWeight: 600, border: '1px solid #e2e8f0', backgroundColor: 'white', cursor: 'pointer', color: '#64748b' }}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (window.confirm(`Are you sure you want to delete task "${editingTask.title}"?`)) {
                                                    handleDeleteTask(editingTask.id);
                                                    setShowEditModal(false);
                                                    setEditingTask(null);
                                                }
                                            }}
                                            style={{ flex: 1, backgroundColor: '#ef4444', color: 'white', padding: '12px', borderRadius: '8px', fontWeight: 600, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                        >
                                            <Trash2 size={16} />
                                            Delete
                                        </button>
                                        <button
                                            onClick={handleSaveEdit}
                                            style={{ flex: 1, backgroundColor: '#0f172a', color: 'white', padding: '12px', borderRadius: '8px', fontWeight: 600, border: 'none', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                        >
                                            Save Changes
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }
                {/* Proof Submission Modal */}
                {
                    showProofModal && taskForProof && (
                        <div style={{
                            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                            backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001, backdropFilter: 'blur(4px)'
                        }}>
                            <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '20px', width: '550px', maxWidth: '90%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                                    <div style={{ backgroundColor: '#ede9fe', borderRadius: '12px', padding: '12px' }}>
                                        <Upload size={24} color="#8b5cf6" />
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#1e293b' }}>Submit Proof for Validation</h3>
                                        <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '4px 0 0 0' }}>{taskForProof.title}</p>
                                    </div>
                                </div>

                                <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#fef3c7', borderRadius: '12px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                    <div style={{ flexShrink: 0, marginTop: '2px' }}><AlertTriangle size={18} color="#b45309" /></div>
                                    <div style={{ fontSize: '0.9rem', color: '#92400e', lineHeight: '1.5' }}>
                                        <strong>Submission Required:</strong> Please upload a document OR enter a text description as proof of completion to proceed to the next phase.
                                    </div>
                                </div>

                                {/* File Upload Section */}
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '0.9rem', color: '#334155' }}>
                                        Upload Document (Optional)
                                    </label>
                                    <div style={{
                                        border: '2px dashed #e2e8f0',
                                        borderRadius: '12px',
                                        padding: '24px',
                                        textAlign: 'center',
                                        backgroundColor: proofFile ? '#f0fdf4' : '#f8fafc',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        borderColor: proofFile ? '#86efac' : '#e2e8f0'
                                    }}
                                        onClick={() => document.getElementById('proof-file-input').click()}
                                    >
                                        <input id="proof-file-input" type="file" onChange={handleFileChange} style={{ display: 'none' }}
                                            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.gif,.zip,.txt" />
                                        {proofFile ? (
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                                                <FileText size={32} color="#10b981" />
                                                <div style={{ textAlign: 'left' }}>
                                                    <div style={{ fontWeight: 600, color: '#166534', fontSize: '0.95rem' }}>{proofFile.name}</div>
                                                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{(proofFile.size / 1024).toFixed(1)} KB</div>
                                                </div>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setProofFile(null); }}
                                                    style={{
                                                        marginLeft: 'auto',
                                                        background: 'none',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        color: '#ef4444',
                                                        padding: '4px'
                                                    }}
                                                    title="Remove file"
                                                >
                                                    <X size={18} />
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <Upload size={32} color="#94a3b8" style={{ marginBottom: '12px' }} />
                                                <div style={{ color: '#64748b', marginBottom: '4px', fontWeight: 500 }}>Click to upload file</div>
                                                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>PDF, DOC, Images, ZIP (max 10MB)</div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div style={{ width: '100%', height: '1px', backgroundColor: '#e2e8f0', margin: '24px 0' }}></div>

                                {/* Actual Hours Input */}
                                <div style={{ marginBottom: '24px' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '0.9rem', color: '#334155' }}>
                                        Actual Hours Spent <span style={{ color: '#ef4444' }}>*</span>
                                    </label>
                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                        <input
                                            type="number"
                                            value={proofHours}
                                            onChange={(e) => setProofHours(e.target.value)}
                                            placeholder="e.g., 4.5"
                                            step="0.5"
                                            style={{
                                                padding: '12px',
                                                borderRadius: '10px',
                                                border: '1px solid #e2e8f0',
                                                fontSize: '0.95rem',
                                                outline: 'none',
                                                width: '120px'
                                            }}
                                        />
                                        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                            Allocated: <span style={{ fontWeight: 700 }}>{taskForProof?.allocated_hours || 0}h</span>
                                        </span>
                                    </div>
                                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                                        Enter total hours spent on this task. Used for points calculation.
                                    </p>
                                </div>

                                {/* Text Input Section */}
                                <div style={{ marginBottom: '24px' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '0.9rem', color: '#334155' }}>
                                        Text Submission / Notes (Optional)
                                    </label>
                                    <textarea
                                        value={proofText}
                                        onChange={(e) => setProofText(e.target.value)}
                                        placeholder="Enter details, links, or notes about your submission..."
                                        rows="4"
                                        style={{
                                            width: '100%',
                                            padding: '12px',
                                            borderRadius: '12px',
                                            border: '1px solid #e2e8f0',
                                            fontSize: '0.95rem',
                                            resize: 'vertical',
                                            outline: 'none',
                                            fontFamily: 'inherit',
                                            minHeight: '100px'
                                        }}
                                        onFocus={(e) => e.target.style.borderColor = '#8b5cf6'}
                                        onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                                    />
                                </div>

                                {uploading && (
                                    <div style={{ marginBottom: '24px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem', color: '#64748b' }}>
                                            <span>Processing Submission...</span>
                                            <span>{uploadProgress}%</span>
                                        </div>
                                        <div style={{ height: '6px', backgroundColor: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${uploadProgress}%`, backgroundColor: '#8b5cf6', transition: 'width 0.3s', borderRadius: '3px' }} />
                                        </div>
                                    </div>
                                )}

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                    <button
                                        onClick={() => { setShowProofModal(false); setTaskForProof(null); setProofFile(null); setProofText(''); }}
                                        disabled={uploading}
                                        style={{
                                            padding: '12px 24px',
                                            borderRadius: '10px',
                                            backgroundColor: 'white',
                                            border: '1px solid #e2e8f0',
                                            cursor: 'pointer',
                                            fontWeight: 600,
                                            color: '#64748b',
                                            fontSize: '0.95rem'
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSubmitProof}
                                        disabled={(!proofFile && !proofText.trim()) || uploading}
                                        style={{
                                            padding: '12px 24px',
                                            borderRadius: '10px',
                                            background: (!proofFile && !proofText.trim()) ? '#e2e8f0' : 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                                            color: (!proofFile && !proofText.trim()) ? '#94a3b8' : 'white',
                                            border: 'none',
                                            fontWeight: 600,
                                            cursor: (!proofFile && !proofText.trim()) ? 'not-allowed' : 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            fontSize: '0.95rem',
                                            boxShadow: (!proofFile && !proofText.trim()) ? 'none' : '0 4px 15px rgba(139, 92, 246, 0.3)'
                                        }}
                                    >
                                        <Send size={16} />
                                        {uploading ? 'Submitting...' : 'Submit Proof'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }
                {/* Access Request Modal */}
                {
                    showAccessRequestModal && (
                        <div style={{
                            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                            backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(4px)'
                        }}>
                            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', width: '450px', maxWidth: '90%', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
                                <h3 style={{ marginTop: 0, fontSize: '1.25rem', color: '#111827' }}>Request Task Access</h3>
                                <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '16px' }}>
                                    The deadline for this task has passed. Please provide a reason to request renewed access.
                                </p>

                                <textarea
                                    value={accessReason}
                                    onChange={(e) => setAccessReason(e.target.value)}
                                    placeholder="Reason for late submission or access request..."
                                    style={{
                                        width: '100%', minHeight: '100px', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.95rem', marginBottom: '16px', outline: 'none'
                                    }}
                                />

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                    <button
                                        onClick={() => setShowAccessRequestModal(false)}
                                        style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: 'white', color: '#374151', cursor: 'pointer', fontWeight: 500 }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleRequestAccess}
                                        disabled={requestingAccess}
                                        style={{
                                            padding: '8px 16px', borderRadius: '8px', border: 'none',
                                            backgroundColor: '#ea580c', color: 'white', cursor: requestingAccess ? 'wait' : 'pointer', fontWeight: 600
                                        }}
                                    >
                                        {requestingAccess ? 'Sending Request...' : 'Submit Request'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }
                {/* Access Review Modal (Manager) */}
                {
                    showAccessReviewModal && accessReviewTask && (
                        <div style={{
                            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                            backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, backdropFilter: 'blur(4px)'
                        }}>
                            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', width: '500px', maxWidth: '90%', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
                                <h3 style={{ marginTop: 0, marginBottom: '4px', fontSize: '1.25rem', color: '#111827' }}>Review Access Request</h3>
                                <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '20px' }}>Task: <span style={{ fontWeight: 600, color: '#374151' }}>{accessReviewTask.title}</span></p>

                                <div style={{ backgroundColor: '#fff7ed', padding: '12px', borderRadius: '8px', border: '1px solid #ffedd5', marginBottom: '20px' }}>
                                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#c2410c', fontWeight: 600 }}>Request Reason:</p>
                                    <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem', color: '#9a3412' }}>{accessReviewTask.access_reason}</p>
                                </div>

                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>Action</label>
                                <div style={{ display: 'flex', gap: '4px', padding: '4px', backgroundColor: '#f3f4f6', borderRadius: '8px', marginBottom: '20px' }}>
                                    {['approve', 'reassign', 'close'].map(action => (
                                        <button
                                            key={action}
                                            onClick={() => setReviewAction(action)}
                                            style={{
                                                flex: 1,
                                                padding: '8px',
                                                borderRadius: '6px',
                                                border: 'none',
                                                cursor: 'pointer',
                                                backgroundColor: reviewAction === action ? 'white' : 'transparent',
                                                color: reviewAction === action ? '#0f172a' : '#6b7280',
                                                fontWeight: reviewAction === action ? 700 : 500,
                                                boxShadow: reviewAction === action ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                                textTransform: 'capitalize',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {action}
                                        </button>
                                    ))}
                                </div>

                                {reviewAction === 'reassign' && (
                                    <div style={{ marginBottom: '20px' }}>
                                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>Reassign To</label>
                                        <select
                                            value={reassignTarget}
                                            onChange={(e) => setReassignTarget(e.target.value)}
                                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', outline: 'none' }}
                                        >
                                            <option value="">Select Employee</option>
                                            {employees.filter(e => e.id !== accessReviewTask.assigned_to).map(emp => (
                                                <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {reviewAction === 'close' && (
                                    <div style={{ marginBottom: '20px' }}>
                                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>Closure Reason *</label>
                                        <textarea
                                            value={closureReason}
                                            onChange={(e) => setClosureReason(e.target.value)}
                                            placeholder="Explain why the task is being closed..."
                                            style={{ width: '100%', minHeight: '80px', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', outline: 'none', fontSize: '0.9rem' }}
                                        />
                                    </div>
                                )}

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #f3f4f6', paddingTop: '20px' }}>
                                    <button
                                        onClick={() => { setShowAccessReviewModal(false); setAccessReviewTask(null); }}
                                        style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: 'white', color: '#374151', cursor: 'pointer', fontWeight: 500 }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleProcessAccessReview}
                                        disabled={processingReview}
                                        style={{
                                            padding: '10px 20px', borderRadius: '8px', border: 'none',
                                            backgroundColor: reviewAction === 'close' ? '#ef4444' : '#0f172a',
                                            color: 'white', cursor: processingReview ? 'wait' : 'pointer', fontWeight: 600
                                        }}
                                    >
                                        {processingReview ? 'Processing...' : 'Confirm Action'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }
            </div >

            {/* Task Notes Modal */}
            <TaskNotesModal
                isOpen={showNotesModal}
                onClose={() => { setShowNotesModal(false); setTaskForNotes(null); }}
                task={taskForNotes}
                userId={userId}
                userRole={userRole}
                orgId={orgId}
                addToast={addToast}
                canAddNote={
                    // Managers/executives can add notes to any task
                    ['manager', 'team_lead', 'executive', 'org_admin'].includes(userRole) ||
                    // Assigned employee can add notes to their own task
                    (taskForNotes?.assigned_to === userId)
                }
            />
        </>
    );
};

export default AllTasksView;
