import React, { useState, useEffect } from 'react';
import { Search, Plus, Eye, Calendar, ChevronDown, X, Clock, ExternalLink, ThumbsUp, ThumbsDown } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useProject } from '../employee/context/ProjectContext';

const AllTasksView = ({ userRole = 'employee', projectRole = 'employee', userId, addToast }) => {
    const { currentProject } = useProject();
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [showAddTaskModal, setShowAddTaskModal] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [processingApproval, setProcessingApproval] = useState(false);

    // New Task Form State
    const [newTask, setNewTask] = useState({
        title: '',
        description: '',
        assignType: 'individual',
        assignedTo: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        dueTime: '',
        priority: 'Medium'
    });

    useEffect(() => {
        if (currentProject?.id || userRole === 'executive') {
            fetchData();
            if (userRole === 'manager') {
                fetchEmployees();
            }
        } else {
            setLoading(false);
        }
    }, [userId, currentProject?.id, userRole]);

    const fetchEmployees = async () => {
        try {
            // Fetch only members of the current project
            const { data, error } = await supabase
                .from('project_members')
                .select('user_id, profiles!inner(id, full_name)')
                .eq('project_id', currentProject.id);

            if (error) throw error;

            // Map to flat structure expected by the UI
            const formattedEmployees = data?.map(item => ({
                id: item.profiles.id,
                full_name: item.profiles.full_name
            })) || [];

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
                const { data, error } = await supabase
                    .from('tasks')
                    .select('*')
                    .order('id', { ascending: false });

                tasksData = data;
                taskError = error;
            } else {
                if (!currentProject?.id) {
                    setLoading(false);
                    return;
                }

                // 1. Fetch simplified tasks for the current project
                const { data, error } = await supabase
                    .from('tasks')
                    .select('*')
                    .eq('project_id', currentProject.id)
                    .order('id', { ascending: false });

                tasksData = data;
                taskError = error;
            }

            if (taskError) throw taskError;

            // 2. Fetch profiles for name mapping
            const assigneeIds = [...new Set(tasksData.map(t => t.assigned_to).filter(Boolean))];
            let profileMap = {};
            if (assigneeIds.length > 0) {
                const { data: profilesData } = await supabase
                    .from('profiles')
                    .select('id, full_name')
                    .in('id', assigneeIds);
                if (profilesData) {
                    profilesData.forEach(p => profileMap[p.id] = p.full_name);
                }
            }

            // 3. For Executives: Fetch project names manually (since we didn't JOIN)
            let projectMap = {};
            if (userRole === 'executive') {
                const projectIds = [...new Set(tasksData.map(t => t.project_id).filter(Boolean))];
                if (projectIds.length > 0) {
                    const { data: projectsData } = await supabase
                        .from('projects')
                        .select('id, name')
                        .in('id', projectIds);

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
                status: 'pending'
            };

            const { error } = await supabase.from('tasks').insert([taskToInsert]);
            if (error) throw error;

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
                priority: 'Medium'
            });
            fetchData();
        } catch (error) {
            console.error('Error adding task:', error);
            addToast?.('Failed to assign task', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleApproveTask = async () => {
        if (!selectedTask) return;

        // Validate that task is in pending_validation state
        if (selectedTask.sub_state !== 'pending_validation') {
            addToast?.('Task is not pending validation', 'error');
            return;
        }

        if (processingApproval) return; // Prevent double-clicks

        setProcessingApproval(true);
        try {
            const phases = ['requirement_refiner', 'design_guidance', 'build_guidance', 'acceptance_criteria', 'deployment', 'closed'];
            const currentIdx = phases.indexOf(selectedTask.lifecycle_state || 'requirement_refiner');
            const nextPhase = phases[currentIdx + 1] || 'closed';

            const updates = {
                sub_state: 'in_progress', // Reset to in_progress for next phase
                lifecycle_state: nextPhase,
                updated_at: new Date().toISOString()
            };

            if (nextPhase === 'closed') {
                updates.status = 'completed';
                updates.sub_state = 'approved';
            }

            const { error } = await supabase
                .from('tasks')
                .update(updates)
                .eq('id', selectedTask.id)
                .eq('sub_state', 'pending_validation'); // Double-check in DB query

            if (error) throw error;

            addToast?.('Task approved and moved to next phase!', 'success');
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

    const LifecycleProgress = ({ currentPhase, subState }) => {
        const currentIndex = getPhaseIndex(currentPhase || 'requirement_refiner');
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {LIFECYCLE_PHASES.map((phase, idx) => (
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
                            backgroundColor: idx < currentIndex ? '#10b981' : idx === currentIndex ? (subState === 'pending_validation' ? '#f59e0b' : '#3b82f6') : '#e5e7eb',
                            color: idx <= currentIndex ? 'white' : '#9ca3af',
                            transition: 'all 0.3s'
                        }} title={phase.label}>
                            {idx < currentIndex ? '✓' : phase.short}
                        </div>
                        {idx < LIFECYCLE_PHASES.length - 1 && (
                            <div style={{ width: '12px', height: '2px', backgroundColor: idx < currentIndex ? '#10b981' : '#e5e7eb' }} />
                        )}
                    </React.Fragment>
                ))}
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
                {userRole === 'manager' && (
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
                                <th style={{ padding: '16px', textAlign: 'left', fontWeight: 600, fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Priority</th>
                                <th style={{ padding: '16px', textAlign: 'center', fontWeight: 600, fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTasks.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
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
                                                }}>{task.title}</div>
                                            </td>
                                            <td style={{ padding: '16px', verticalAlign: 'middle' }}>
                                                <span style={{ fontWeight: 500, color: '#0f172a', whiteSpace: 'nowrap' }}>{task.assignee_name}</span>
                                            </td>
                                            <td style={{ padding: '16px', verticalAlign: 'middle' }}>
                                                <LifecycleProgress currentPhase={task.lifecycle_state} subState={task.sub_state} />
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
                                                        padding: '8px 16px',
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
                                            style={{ cursor: 'pointer' }}
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
                                        const isCompleted = idx < currentIndex;
                                        const isCurrent = idx === currentIndex;
                                        const isPending = idx > currentIndex;

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
                                                        backgroundColor: isCompleted ? '#10b981' : isCurrent ? (selectedTask.sub_state === 'pending_validation' ? '#f59e0b' : '#3b82f6') : '#e5e7eb',
                                                        color: isCompleted || isCurrent ? 'white' : '#9ca3af',
                                                        transition: 'all 0.3s',
                                                        boxShadow: isCurrent ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none'
                                                    }}>
                                                        {isCompleted ? '✓' : phase.short}
                                                    </div>
                                                    <span style={{
                                                        fontSize: '0.7rem',
                                                        fontWeight: isCurrent ? 600 : 500,
                                                        color: isCompleted || isCurrent ? '#0f172a' : '#94a3b8',
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
                                                        backgroundColor: isCompleted ? '#10b981' : '#e5e7eb',
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

                            {/* Proof Selection Section */}
                            {selectedTask.proof_url && (
                                <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>
                                        Submitted Proof
                                    </label>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                                            <ExternalLink size={16} color="#3b82f6" />
                                            <span style={{ fontSize: '0.9rem', color: '#3b82f6', textDecoration: 'underline', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                                onClick={() => window.open(selectedTask.proof_url, '_blank')}
                                            >
                                                View Submitted Document
                                            </span>
                                        </div>
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

                            {(userRole === 'manager' || userRole === 'team_lead') && selectedTask.sub_state === 'pending_validation' && (
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
        </div>
    );
};

export default AllTasksView;


