import React, { useState, useEffect } from 'react';
import { Search, Plus, Eye, Calendar, ChevronDown, X, Clock, ExternalLink, ThumbsUp, ThumbsDown, AlertTriangle, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { supabaseRequest } from '../../lib/supabaseRequest';
import { useProject } from '../employee/context/ProjectContext';

const AllTasksView = ({ userRole = 'employee', projectRole = 'employee', userId, addToast }) => {
    const { currentProject } = useProject();
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [employees, setEmployees] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [showAddTaskModal, setShowAddTaskModal] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [processingApproval, setProcessingApproval] = useState(false);

    // Issue Resolution State
    const [showIssueModal, setShowIssueModal] = useState(false);
    const [taskWithIssue, setTaskWithIssue] = useState(null);
    const [resolvingIssue, setResolvingIssue] = useState(false);
    const [allocatedHoursError, setAllocatedHoursError] = useState('');

    const handleAllocatedHoursChange = (e) => {
        const value = e.target.value;
        if (value && (!/^\d+(\.\d+)?$/.test(value) || Number(value) <= 0)) {
            setAllocatedHoursError('Please enter a valid positive number');
        } else {
            setAllocatedHoursError('');
        }
        setNewTask({ ...newTask, allocatedHours: value });
    };

    // New Task Form State
    const [newTask, setNewTask] = useState({
        title: '',
        description: '',
        assignType: 'individual',
        assignedTo: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        dueTime: '',
        priority: 'Medium',
        allocatedHours: ''
    });

    useEffect(() => {
        if (currentProject?.id || userRole === 'executive') {
            fetchData();
            if (userRole === 'manager' || userRole === 'executive') {
                fetchEmployees();
            }
        } else {
            setLoading(false);
        }
    }, [userId, currentProject?.id, userRole]);

    const fetchEmployees = async () => {
        try {
            let formattedEmployees = [];

            if (userRole === 'executive') {
                // Fetch ALL employees for executives
                formattedEmployees = await supabaseRequest(
                    supabase.from('profiles').select('id, full_name').neq('id', userId),
                    addToast
                ) || [];
            } else if (currentProject?.id) {
                // Fetch only members of the current project
                const data = await supabaseRequest(
                    supabase.from('project_members').select('user_id, profiles!inner(id, full_name)').eq('project_id', currentProject.id),
                    addToast
                );

                // Map to flat structure expected by the UI
                formattedEmployees = data?.map(item => ({
                    id: item.profiles.id,
                    full_name: item.profiles.full_name
                })) || [];
            }

            setEmployees(formattedEmployees);
        } catch (error) {
            console.error('Error fetching employees:', error);
        }
    };

    const handleUpdateTask = async (taskId, column, value) => {
        try {
            const { error } = await supabase
                .from('tasks')
                .update({ [column]: value })
                .eq('id', taskId);

            if (error) throw error;
            addToast?.('Task updated successfully', 'success');
            fetchData();
        } catch (error) {
            console.error('Error updating task:', error);
            addToast?.('Failed to update task', 'error');
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            let tasksData = [];
            let taskError = null;

            if (userRole === 'executive') {
                // Fetch ALL tasks for executives without JOIN to avoid 400 errors
                tasksData = await supabaseRequest(
                    supabase.from('tasks').select('*').order('id', { ascending: false }),
                    addToast
                );
            } else {
                if (!currentProject?.id) {
                    setLoading(false);
                    return;
                }

                // 1. Fetch simplified tasks for the current project
                tasksData = await supabaseRequest(
                    supabase.from('tasks').select('*').eq('project_id', currentProject.id).order('id', { ascending: false }),
                    addToast
                );
            }

            // 2. Fetch profiles for name mapping
            const assigneeIds = [...new Set(tasksData.map(t => t.assigned_to).filter(Boolean))];
            let profileMap = {};
            if (assigneeIds.length > 0) {
                const profilesData = await supabaseRequest(
                    supabase.from('profiles').select('id, full_name').in('id', assigneeIds),
                    addToast
                );
                if (profilesData) {
                    profilesData.forEach(p => profileMap[p.id] = p.full_name);
                }
            }

            // 3. For Executives: Fetch project names manually (since we didn't JOIN)
            let projectMap = {};
            if (userRole === 'executive') {
                const projectIds = [...new Set(tasksData.map(t => t.project_id).filter(Boolean))];
                if (projectIds.length > 0) {
                    const projectsData = await supabaseRequest(
                        supabase.from('projects').select('id, name').in('id', projectIds),
                        addToast
                    );

                    if (projectsData) {
                        projectsData.forEach(p => projectMap[p.id] = p.name);
                    }
                }
            }

            // 4. Build enhanced tasks
            const enhancedTasks = (tasksData || []).map(task => {
                return {
                    ...task,
                    assignee_name: profileMap[task.assigned_to] || 'Unassigned',
                    project_name: (userRole === 'executive' ? projectMap[task.project_id] : currentProject?.name) || 'Unknown Project'
                };
            });

            setTasks(enhancedTasks);
        } catch (error) {
            console.error('AllTasksView Error:', error?.message || error);
            addToast?.('Failed to load tasks', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleAddTask = async (e) => {
        e.preventDefault();
        if (!newTask.title) {
            addToast?.('Please enter a task title', 'error');
            return;
        }
        if (allocatedHoursError) {
            addToast?.(allocatedHoursError, 'error');
            return;
        }
        if (!newTask.allocatedHours || Number(newTask.allocatedHours) <= 0) {
            addToast?.('Please enter allocated hours (e.g., 8, 20, 40)', 'error');
            return;
        }

        setSubmitting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const taskToInsert = {
                title: newTask.title,
                description: newTask.description,
                assigned_to: newTask.assignType === 'individual' ? newTask.assignedTo : null,
                assigned_by: user.id,
                project_id: currentProject?.id,
                start_date: newTask.startDate,
                due_date: newTask.endDate,
                due_time: newTask.dueTime || null,
                priority: newTask.priority.toLowerCase(),
                status: 'pending',
                allocated_hours: parseFloat(newTask.allocatedHours)
            };

            await supabaseRequest(supabase.from('tasks').insert([taskToInsert]), addToast);

            // Send Notification (Only for Team tasks if not covered by triggers)
            try {
                if (newTask.assignType === 'team' && employees.length > 0) {
                    const senderName = userRole === 'manager' ? 'Management' : (userRole === 'team_lead' ? 'Team Lead' : 'Task Manager');
                    const notifications = employees.map(emp => ({
                        receiver_id: emp.id,
                        sender_id: user.id,
                        sender_name: senderName,
                        message: `New team task created: ${newTask.title}`,
                        type: 'task_assignment',
                        is_read: false,
                        created_at: new Date().toISOString()
                    }));
                    await supabase.from('notifications').insert(notifications);
                }
            } catch (notifyError) {
                console.error('Error sending notification:', notifyError);
            }

            addToast?.('Task assigned successfully!', 'success');
            setShowAddTaskModal(false);
            setNewTask({
                title: '',
                description: '',
                assignType: 'individual',
                assignedTo: '',
                startDate: new Date().toISOString().split('T')[0],
                endDate: new Date().toISOString().split('T')[0],
                dueTime: '',
                priority: 'Medium',
                allocatedHours: ''
            });
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
            // If we are in legacy mode, we might need to advance.
            if (selectedTask.sub_state === 'pending_validation') {
                // Advance logic for legacy blocking tasks
                const phases = ['requirement_refiner', 'design_guidance', 'build_guidance', 'acceptance_criteria', 'deployment', 'closed'];
                const currentIdx = phases.indexOf(selectedTask.lifecycle_state || 'requirement_refiner');
                const nextPhase = phases[currentIdx + 1] || 'closed';

                updates.sub_state = 'in_progress';
                updates.lifecycle_state = nextPhase;

                if (nextPhase === 'closed') {
                    updates.status = 'completed';
                    updates.sub_state = 'approved';
                }
            }

            const { error } = await supabase
                .from('tasks')
                .update(updates)
                .eq('id', selectedTask.id);

            if (error) throw error;

            addToast?.('Task validations approved!', 'success');
            setSelectedTask(null);
            fetchData();
        } catch (error) {
            console.error('Error approving task:', error);
            addToast?.('Failed to approve task', 'error');
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

    const openIssueModal = (task) => {
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
                .eq('id', taskWithIssue.id);

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
        { key: 'design_guidance', label: 'Design', short: 'D' },
        { key: 'build_guidance', label: 'Build', short: 'B' },
        { key: 'acceptance_criteria', label: 'Acceptance', short: 'A' },
        { key: 'deployment', label: 'Deployment', short: 'P' }
    ];

    const getPhaseIndex = (phase) => LIFECYCLE_PHASES.findIndex(p => p.key === phase);

    const LifecycleProgress = ({ currentPhase, subState, validations }) => {
        const currentIndex = getPhaseIndex(currentPhase || 'requirement_refiner');
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {LIFECYCLE_PHASES.map((phase, idx) => {
                    const validation = validations?.[phase.key];
                    const status = validation?.status;
                    let color = '#e5e7eb'; // Default Grey
                    let isYellow = false;

                    if (idx < currentIndex) {
                        // Past Phase
                        if (status === 'pending') { color = '#f59e0b'; isYellow = true; }
                        else if (status === 'rejected') color = '#fee2e2';
                        else color = '#10b981';
                    } else if (idx === currentIndex) {
                        // Current Phase
                        if (status === 'pending' || subState === 'pending_validation') { color = '#f59e0b'; isYellow = true; }
                        else color = '#3b82f6';
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
                            {idx < LIFECYCLE_PHASES.length - 1 && (
                                <div style={{ width: '12px', height: '2px', backgroundColor: idx < currentIndex && !isYellow ? '#10b981' : '#e5e7eb' }} />
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        );
    };

    const filteredTasks = tasks.filter(task => {
        const matchesSearch = task.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            task.assignee_name?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || task.status?.toLowerCase() === statusFilter.toLowerCase();
        return matchesSearch && matchesStatus;
    });

    if (loading) {
        return <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading tasks...</div>;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>
                        {userRole === 'manager' || userRole === 'team_lead' ? 'Team Tasks' : 'Your Tasks'}
                    </h1>
                    <p style={{ color: '#64748b', marginTop: '4px', fontSize: '0.95rem' }}>
                        {userRole === 'manager' || userRole === 'team_lead'
                            ? 'Manage and track all team tasks in one place'
                            : 'Track your tasks through the lifecycle'}
                    </p>
                </div>
                <button
                    onClick={downloadCSV}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '12px 24px',
                        backgroundColor: 'white',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        color: '#475569',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontSize: '0.95rem',
                        marginRight: '12px'
                    }}
                >
                    <ExternalLink size={18} /> Export CSV
                </button>
                {(userRole === 'manager' || userRole === 'executive') && (
                    <button
                        onClick={() => setShowAddTaskModal(true)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '12px 24px',
                            backgroundColor: '#0f172a',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontSize: '0.95rem',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                        }}
                    >
                        <Plus size={18} />
                        New Task
                    </button>
                )}
            </div>

            {/* Filters */}
            <div style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
                flexWrap: 'wrap',
                padding: '20px',
                backgroundColor: 'white',
                borderRadius: '12px',
                border: '1px solid #e2e8f0'
            }}>
                {/* Search */}
                <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
                    <Search size={18} style={{
                        position: 'absolute',
                        left: '12px',
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
                            padding: '10px 12px 10px 40px',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            fontSize: '0.95rem',
                            outline: 'none'
                        }}
                        onFocus={e => e.target.style.borderColor = '#3b82f6'}
                        onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                    />
                </div>



                {/* Status Filter */}
                <div style={{ position: 'relative' }}>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        style={{
                            padding: '10px 36px 10px 16px',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            fontSize: '0.95rem',
                            fontWeight: 500,
                            backgroundColor: 'white',
                            cursor: 'pointer',
                            outline: 'none',
                            appearance: 'none'
                        }}
                    >
                        <option value="all">All Statuses</option>
                        <option value="pending">Pending</option>
                        <option value="in progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="on hold">On Hold</option>
                    </select>
                    <ChevronDown size={16} style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        pointerEvents: 'none',
                        color: '#64748b'
                    }} />
                </div>
            </div>

            {/* Tasks Table */}
            <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                overflow: 'hidden'
            }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                <th style={{ padding: '16px', textAlign: 'left', fontWeight: 600, fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Task</th>
                                <th style={{ padding: '16px', textAlign: 'left', fontWeight: 600, fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assignee</th>
                                <th style={{ padding: '16px', textAlign: 'left', fontWeight: 600, fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lifecycle</th>
                                <th style={{ padding: '16px', textAlign: 'left', fontWeight: 600, fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Due Date</th>
                                <th style={{ padding: '16px', textAlign: 'left', fontWeight: 600, fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Est. Hours</th>
                                <th style={{ padding: '16px', textAlign: 'left', fontWeight: 600, fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Priority</th>
                                <th style={{ padding: '16px', textAlign: 'center', fontWeight: 600, fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: '160px' }}>Actions</th>
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
                                    return (
                                        <tr key={task.id} style={{
                                            borderBottom: index < filteredTasks.length - 1 ? '1px solid #f1f5f9' : 'none',
                                            transition: 'background-color 0.15s'
                                        }}
                                            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}
                                        >
                                            <td style={{ padding: '16px', verticalAlign: 'middle', maxWidth: '250px' }}>
                                                <div style={{
                                                    fontWeight: 600,
                                                    color: '#0f172a',
                                                    lineHeight: '1.4',
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: 'vertical',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis'
                                                }}>
                                                    {task.title}
                                                </div>
                                            </td>
                                            <td style={{ padding: '16px', verticalAlign: 'middle' }}>
                                                <span style={{ fontWeight: 500, color: '#0f172a', whiteSpace: 'nowrap' }}>{task.assignee_name}</span>
                                            </td>
                                            <td style={{ padding: '16px', verticalAlign: 'middle' }}>
                                                <LifecycleProgress currentPhase={task.lifecycle_state} subState={task.sub_state} validations={task.phase_validations} />
                                            </td>
                                            <td style={{ padding: '16px', verticalAlign: 'middle' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', whiteSpace: 'nowrap' }}>
                                                    <Calendar size={14} />
                                                    <span style={{ fontSize: '0.9rem' }}>
                                                        {task.due_date ? new Date(task.due_date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : 'No Date'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '16px', verticalAlign: 'middle' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', whiteSpace: 'nowrap' }}>
                                                    <Clock size={14} />
                                                    <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>
                                                        {task.allocated_hours ? `${task.allocated_hours} hrs` : '-'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '16px', verticalAlign: 'middle' }}>
                                                <div style={{ position: 'relative', display: 'inline-block' }}>
                                                    <select
                                                        value={task.priority || 'medium'}
                                                        onChange={(e) => handleUpdateTask(task.id, 'priority', e.target.value.toLowerCase())}
                                                        style={{
                                                            padding: '6px 28px 6px 12px',
                                                            backgroundColor: priorityStyle.bg,
                                                            color: priorityStyle.text,
                                                            border: 'none',
                                                            borderRadius: '6px',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 700,
                                                            textTransform: 'uppercase',
                                                            cursor: 'pointer',
                                                            outline: 'none',
                                                            appearance: 'none'
                                                        }}
                                                    >
                                                        <option value="high">HIGH</option>
                                                        <option value="medium">MEDIUM</option>
                                                        <option value="low">LOW</option>
                                                    </select>
                                                    <ChevronDown size={12} style={{
                                                        position: 'absolute',
                                                        right: '8px',
                                                        top: '50%',
                                                        transform: 'translateY(-50%)',
                                                        pointerEvents: 'none',
                                                        color: priorityStyle.text
                                                    }} />
                                                </div>
                                            </td>

                                            <td style={{ padding: '16px', verticalAlign: 'middle', textAlign: 'center' }}>
                                                <button
                                                    onClick={() => setSelectedTask(task)}
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        padding: '8px 12px',
                                                        backgroundColor: '#f1f5f9',
                                                        color: '#0f172a',
                                                        border: 'none',
                                                        borderRadius: '6px',
                                                        fontSize: '0.85rem',
                                                        fontWeight: 600,
                                                        cursor: 'pointer',
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#e2e8f0'}
                                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                                                >
                                                    <Eye size={14} />
                                                    View
                                                </button>
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
                                                            marginLeft: '8px',
                                                            whiteSpace: 'nowrap'
                                                        }}
                                                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#d97706'}
                                                        onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f59e0b'}
                                                    >
                                                        <AlertTriangle size={14} />
                                                        Resolve
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {/* Add Task Modal */}
            {showAddTaskModal && (
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
                                    placeholder="Enter task description"
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
                                </div>

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
                                            employees.map(emp => (
                                                <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                                            ))
                                        )}
                                    </select>
                                    <ChevronDown size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b' }} />
                                </div>
                            </div>

                            {/* Dates */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                                        Start Date
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type="date"
                                            value={newTask.startDate}
                                            onChange={(e) => setNewTask({ ...newTask, startDate: e.target.value })}
                                            style={{
                                                width: '100%',
                                                padding: '10px 12px',
                                                border: '1px solid #e2e8f0',
                                                borderRadius: '8px',
                                                fontSize: '0.9rem',
                                                outline: 'none'
                                            }}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                                        Due Date
                                    </label>
                                    <div style={{ position: 'relative' }}>
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
                                                outline: 'none'
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Due Time */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                                    Due Time
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="time"
                                        value={newTask.dueTime}
                                        onChange={(e) => setNewTask({ ...newTask, dueTime: e.target.value })}
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
                            </div>

                            {/* Priority */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                                    Priority
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <select
                                        value={newTask.priority}
                                        onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '10px 12px',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: '8px',
                                            fontSize: '0.95rem',
                                            backgroundColor: 'white',
                                            appearance: 'none',
                                            outline: 'none'
                                        }}
                                    >
                                        <option value="Low">Low</option>
                                        <option value="Medium">Medium</option>
                                        <option value="High">High</option>
                                    </select>
                                    <ChevronDown size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b' }} />
                                </div>
                            </div>

                            {/* Allocated Hours - Restricted to Managers/Leads */}
                            {(userRole === 'manager' || userRole === 'team_lead' || userRole === 'executive') && (
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                                        Allocated Hours <span style={{ color: '#ef4444' }}>*</span>
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type="number"
                                            min="1"
                                            placeholder="e.g., 8, 20, 40"
                                            value={newTask.allocatedHours}
                                            onChange={handleAllocatedHoursChange}
                                            required
                                            style={{
                                                width: '100%',
                                                padding: '10px 12px',
                                                border: allocatedHoursError ? '1px solid #ef4444' : '1px solid #e2e8f0',
                                                borderRadius: '8px',
                                                fontSize: '0.95rem',
                                                outline: 'none'
                                            }}
                                        />
                                        <Clock size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b' }} />
                                    </div>
                                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                                        Estimated time to complete this task (in hours)
                                    </p>
                                    {allocatedHoursError && (
                                        <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '4px' }}>
                                            {allocatedHoursError}
                                        </p>
                                    )}
                                </div>
                            )}

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
                </div>
            )}
            {/* Task Details Modal */}
            {selectedTask && (
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
                        maxWidth: '600px',
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
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>Task Details</h2>
                            <button
                                onClick={() => setSelectedTask(null)}
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
                        <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>{selectedTask.title}</h3>
                                <p style={{ color: '#64748b', fontSize: '0.95rem', lineHeight: '1.5', margin: 0 }}>
                                    {selectedTask.description || 'No description provided.'}
                                </p>
                            </div>

                            {/* Lifecycle Progress */}
                            <div style={{
                                padding: '20px',
                                backgroundColor: '#f8fafc',
                                borderRadius: '12px',
                                border: '1px solid #e2e8f0'
                            }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    color: '#64748b',
                                    textTransform: 'uppercase',
                                    marginBottom: '16px',
                                    letterSpacing: '0.05em'
                                }}>Task Lifecycle Progress</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    {LIFECYCLE_PHASES.map((phase, idx) => {
                                        const currentIndex = getPhaseIndex(selectedTask.lifecycle_state || 'requirement_refiner');
                                        const validation = selectedTask.phase_validations?.[phase.key];
                                        const status = validation?.status;

                                        // Color Logic
                                        let color = '#e5e7eb'; // Default Grey
                                        let isYellow = false;

                                        if (idx < currentIndex) {
                                            // Past Phase
                                            if (status === 'pending') { color = '#f59e0b'; isYellow = true; } // Yellow
                                            else if (status === 'rejected') color = '#fee2e2'; // Red
                                            else color = '#10b981'; // Green
                                        } else if (idx === currentIndex) {
                                            // Current Phase
                                            if (status === 'pending' || selectedTask.sub_state === 'pending_validation') { color = '#f59e0b'; isYellow = true; } // Yellow
                                            else color = '#3b82f6'; // Blue
                                        }

                                        const isCompleted = color === '#10b981';
                                        const isCurrent = idx === currentIndex;

                                        return (
                                            <React.Fragment key={phase.key}>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{
                                                        width: '36px',
                                                        height: '36px',
                                                        borderRadius: '50%',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 700,
                                                        backgroundColor: color,
                                                        color: color === '#e5e7eb' ? '#9ca3af' : color === '#fee2e2' ? '#991b1b' : 'white',
                                                        transition: 'all 0.3s',
                                                        boxShadow: isCurrent ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none'
                                                    }}>
                                                        {isCompleted ? '✓' : phase.short}
                                                    </div>
                                                    <span style={{
                                                        fontSize: '0.7rem',
                                                        fontWeight: isCurrent ? 600 : 500,
                                                        color: isCompleted || isCurrent || isYellow ? '#0f172a' : '#94a3b8',
                                                        textAlign: 'center',
                                                        maxWidth: '70px'
                                                    }}>
                                                        {phase.label}
                                                    </span>
                                                </div>
                                                {idx < LIFECYCLE_PHASES.length - 1 && (
                                                    <div style={{
                                                        width: '24px',
                                                        height: '3px',
                                                        backgroundColor: idx < currentIndex && !isYellow ? '#10b981' : '#e5e7eb',
                                                        borderRadius: '2px',
                                                        marginBottom: '28px'
                                                    }} />
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </div>
                                {selectedTask.sub_state === 'pending_validation' && (
                                    <div style={{
                                        marginTop: '12px',
                                        padding: '12px',
                                        backgroundColor: '#fef3c7',
                                        borderRadius: '8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}>
                                        <div style={{
                                            width: '6px',
                                            height: '6px',
                                            borderRadius: '50%',
                                            backgroundColor: '#f59e0b'
                                        }} />
                                        <span style={{ fontSize: '0.85rem', color: '#92400e', fontWeight: 500 }}>
                                            Awaiting validation for current phase
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Assignee</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#0f172a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 600 }}>
                                            {selectedTask.assignee_name?.charAt(0) || 'U'}
                                        </div>
                                        <span style={{ fontWeight: 500, color: '#0f172a' }}>{selectedTask.assignee_name}</span>
                                    </div>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Team / Project</label>
                                    <span style={{ fontWeight: 500, color: '#0f172a' }}>{selectedTask.project_name}</span>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Due Date</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a' }}>
                                        <Calendar size={16} />
                                        <span>{selectedTask.due_date ? new Date(selectedTask.due_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'No Date'}</span>
                                    </div>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Due Time</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a' }}>
                                        <Clock size={16} />
                                        <span>{selectedTask.due_time || 'No Time'}</span>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Priority</label>
                                    <div style={{
                                        display: 'inline-block',
                                        padding: '6px 12px',
                                        backgroundColor: getPriorityStyle(selectedTask.priority).bg,
                                        color: getPriorityStyle(selectedTask.priority).text,
                                        borderRadius: '6px',
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        textTransform: 'uppercase'
                                    }}>
                                        {selectedTask.priority}
                                    </div>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Status</label>
                                    <div style={{
                                        display: 'inline-block',
                                        padding: '6px 12px',
                                        backgroundColor: getStatusStyle(selectedTask.status).bg,
                                        color: getStatusStyle(selectedTask.status).text,
                                        borderRadius: '6px',
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        textTransform: 'capitalize'
                                    }}>
                                        {selectedTask.status}
                                    </div>
                                </div>
                            </div>

                            {/* Validations History */}
                            {(selectedTask.phase_validations || selectedTask.proof_url) && (
                                <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>
                                        <CheckCircle2 size={16} /> Submitted Proofs
                                    </label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {/* New System */}
                                        {selectedTask.phase_validations && Object.entries(selectedTask.phase_validations).map(([phaseKey, data]) => {
                                            if (!data.proof_url) return null;
                                            const phaseLabel = LIFECYCLE_PHASES.find(p => p.key === phaseKey)?.label || phaseKey;
                                            return (
                                                <div key={phaseKey} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: 'white', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                                                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>{phaseLabel}:</span>
                                                        <span style={{ fontSize: '0.9rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                                                            {data.proof_url.split('/').pop()}
                                                        </span>
                                                    </div>
                                                    <a href={data.proof_url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#3b82f6', fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none' }}>
                                                        View <ExternalLink size={12} />
                                                    </a>
                                                </div>
                                            );
                                        })}

                                        {/* Legacy Support - ONLY if no validations entries found */}
                                        {(!selectedTask.phase_validations || Object.keys(selectedTask.phase_validations).length === 0) && selectedTask.proof_url && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: 'white', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>[Legacy]</span>
                                                    <span style={{ fontSize: '0.9rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                                                        {selectedTask.proof_url.split('/').pop()}
                                                    </span>
                                                </div>
                                                <a href={selectedTask.proof_url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#3b82f6', fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none' }}>
                                                    View <ExternalLink size={12} />
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div style={{ padding: '20px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button
                                onClick={() => setSelectedTask(null)}
                                style={{
                                    padding: '10px 24px',
                                    borderRadius: '8px',
                                    backgroundColor: 'white',
                                    color: '#64748b',
                                    border: '1px solid #e2e8f0',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Close
                            </button>

                            {(userRole === 'manager' || userRole === 'team_lead') && (selectedTask.sub_state === 'pending_validation' || (selectedTask.phase_validations && Object.values(selectedTask.phase_validations).some(v => v.status === 'pending'))) && (
                                <>
                                    <button
                                        onClick={handleRejectTask}
                                        disabled={processingApproval}
                                        style={{
                                            padding: '10px 24px',
                                            borderRadius: '8px',
                                            backgroundColor: processingApproval ? '#fecaca' : '#fee2e2',
                                            color: '#991b1b',
                                            border: 'none',
                                            fontWeight: 600,
                                            cursor: processingApproval ? 'not-allowed' : 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            opacity: processingApproval ? 0.6 : 1
                                        }}
                                    >
                                        <ThumbsDown size={16} /> {processingApproval ? 'Processing...' : 'Reject'}
                                    </button>
                                    <button
                                        onClick={handleApproveTask}
                                        disabled={processingApproval}
                                        style={{
                                            padding: '10px 24px',
                                            borderRadius: '8px',
                                            backgroundColor: processingApproval ? '#6ee7b7' : '#10b981',
                                            color: 'white',
                                            border: 'none',
                                            fontWeight: 600,
                                            cursor: processingApproval ? 'not-allowed' : 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            opacity: processingApproval ? 0.6 : 1
                                        }}
                                    >
                                        <ThumbsUp size={16} /> {processingApproval ? 'Processing...' : 'Approve'}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Issue Resolution Modal */}
            {showIssueModal && taskWithIssue && (
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
            )}
        </div>
    );
};

export default AllTasksView;


