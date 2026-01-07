import React, { useState, useEffect } from 'react';
import { Search, Calendar, CheckCircle, Upload, FileText, Send, AlertCircle, Paperclip, ClipboardList, AlertTriangle, Eye } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import { useProject } from '../context/ProjectContext';
import { useToast } from '../context/ToastContext';

const MyTasksPage = () => {
    // We don't need projectRole, but we use useProject context for consistency (or future use)
    const { currentProject } = useProject();
    const { addToast } = useToast();
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Proof upload states
    const [showProofModal, setShowProofModal] = useState(false);
    const [taskForProof, setTaskForProof] = useState(null);
    const [proofFile, setProofFile] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploading, setUploading] = useState(false);

    // Issue logging states
    const [showIssueModal, setShowIssueModal] = useState(false);
    const [taskForIssue, setTaskForIssue] = useState(null);
    const [issueText, setIssueText] = useState('');
    const [submittingIssue, setSubmittingIssue] = useState(false);

    // View Task state
    const [showViewModal, setShowViewModal] = useState(false);
    const [taskForView, setTaskForView] = useState(null);

    useEffect(() => {
        if (currentProject?.id) {
            fetchTasks();
        }
    }, [currentProject?.id]); // Refetch when project changes

    const fetchTasks = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                console.error('No user logged in');
                setTasks([]);
                setLoading(false);
                return;
            }

            if (!currentProject?.id) {
                // If no project selected, maybe show empty or all? 
                // Let's assume we wait for a project.
                setLoading(false);
                return;
            }

            // Fetch ALL tasks assigned to the current user, regardless of project
            // This ensures orphan tasks (assigned by Executive without project) are visible
            const { data, error } = await supabase
                .from('tasks')
                .select('*, projects(name)')
                .eq('assigned_to', user.id)
                .order('id', { ascending: false });

            // Removed .eq('project_id', currentProject.id) to show all assigned tasks

            if (error) throw error;
            console.log('Fetched Tasks:', data);
            setTasks(data || []);
        } catch (err) {
            console.error('Error fetching tasks:', err.message, err.details, err.hint);
            addToast?.(`Failed to fetch tasks: ${err.message}`, 'error');
            setTasks([]);
        } finally {
            setLoading(false);
        }
    };

    const openProofModal = (task) => {
        setTaskForProof(task);
        setProofFile(null);
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

    const uploadProofAndRequestValidation = async () => {
        if (!proofFile || !taskForProof) {
            addToast?.('Please select a file to upload', 'error');
            return;
        }

        setUploading(true);
        setUploadProgress(10);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const fileExt = proofFile.name.split('.').pop();
            const fileName = `${taskForProof.id}_${Date.now()}.${fileExt}`;
            const filePath = `${user.id}/${fileName}`;

            setUploadProgress(30);

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('task-proofs')
                .upload(filePath, proofFile, { cacheControl: '3600', upsert: false });

            if (uploadError) throw uploadError;

            setUploadProgress(70);

            const { data: urlData } = supabase.storage.from('task-proofs').getPublicUrl(filePath);
            const proofUrl = urlData?.publicUrl || filePath;

            setUploadProgress(85);

            setUploadProgress(85);

            let responseData;
            let responseError;

            // Updated Layout: Non-blocking validation
            // 1. Update phase_validations JSON
            // 2. Advance lifecycle_state to next phase

            const currentPhase = taskForProof.lifecycle_state;
            const currentIndex = getPhaseIndex(currentPhase);
            const nextPhase = currentIndex < LIFECYCLE_PHASES.length - 2 ? LIFECYCLE_PHASES[currentIndex + 1].key : currentPhase;

            // Prepare updated validations object
            const currentValidations = taskForProof.phase_validations || {};
            const updatedValidations = {
                ...currentValidations,
                [currentPhase]: {
                    status: 'pending',
                    proof_url: proofUrl,
                    submitted_at: new Date().toISOString()
                }
            };

            const updates = {
                phase_validations: updatedValidations,
                proof_url: proofUrl, // Keep latest proof in main column for compatibility
                updated_at: new Date().toISOString()
            };

            // Only advance phase if we aren't already pending validation (prevent double skip if user re-uploads)
            // But user said "every new proof updated" -> implies updating the proof.
            // And "complete tasks without waiting" implies advancing.
            // If already advanced (idx > current), we shouldn't advance again? 
            // Wait, taskForProof.lifecycle_state IS the one displayed. If we advance, it changes.
            // So we assume taskForProof is at the phase being submitted.

            if (currentIndex < LIFECYCLE_PHASES.length - 2) {
                updates.lifecycle_state = nextPhase;
                updates.sub_state = 'in_progress'; // Reset substate for new phase
            }

            const { data, error } = await supabase
                .from('tasks')
                .update(updates)
                .eq('id', taskForProof.id)
                .select();

            responseError = error;
            responseData = { success: !error, message: 'Proof submitted and task advanced' };

            if (responseError) throw responseError;

            setUploadProgress(100);

            if (responseData?.success) {
                addToast?.(taskForProof.sub_state === 'pending_validation' ? 'Proof updated successfully!' : 'Validation requested with proof!', 'success');
                setShowProofModal(false);
                setTaskForProof(null);
                setProofFile(null);
                fetchTasks(); // Refresh tasks to show updated status
            } else {
                addToast?.(responseData?.message || 'Failed to request validation', 'error');
            }
        } catch (error) {
            console.error('Upload error:', error);
            addToast?.('Failed to upload proof: ' + error.message, 'error');
        } finally {
            setUploading(false);
            setUploadProgress(0);
        }
    };

    const openIssueModal = (task) => {
        setTaskForIssue(task);
        setIssueText('');
        setShowIssueModal(true);
    };

    const submitIssue = async () => {
        if (!issueText.trim() || !taskForIssue) {
            addToast?.('Please enter an issue description', 'error');
            return;
        }

        setSubmittingIssue(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            // Get user profile for name
            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name, email')
                .eq('id', user.id)
                .single();

            const userName = profile?.full_name || profile?.email || 'Unknown User';
            const timestamp = new Date().toISOString();

            // Create issue log entry
            const issueEntry = `[${new Date(timestamp).toLocaleString()}] ${userName}: ${issueText.trim()}`;

            // Append to existing issues or create new
            const currentIssues = taskForIssue.issues || '';
            const updatedIssues = currentIssues
                ? `${currentIssues}\n\n${issueEntry}`
                : issueEntry;

            const { error } = await supabase
                .from('tasks')
                .update({
                    issues: updatedIssues,
                    updated_at: timestamp
                })
                .eq('id', taskForIssue.id);

            if (error) throw error;

            addToast?.('Issue logged successfully!', 'success');
            setShowIssueModal(false);
            setTaskForIssue(null);
            setIssueText('');
            fetchTasks(); // Refresh tasks to show updated issue status
        } catch (error) {
            console.error('Error logging issue:', error);
            addToast?.('Failed to log issue: ' + error.message, 'error');
        } finally {
            setSubmittingIssue(false);
        }
    };

    const openViewModal = (task) => {
        setTaskForView(task);
        setShowViewModal(true);
    };

    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'high': return { bg: '#fee2e2', text: '#991b1b' };
            case 'medium': return { bg: '#fef3c7', text: '#b45309' };
            case 'low': return { bg: '#dcfce7', text: '#166534' };
            default: return { bg: '#f3f4f6', text: '#6b7280' };
        }
    };

    const getSubStateColor = (subState) => {
        switch (subState) {
            case 'in_progress': return { bg: '#dbeafe', text: '#1d4ed8' };
            case 'pending_validation': return { bg: '#fef3c7', text: '#b45309' };
            case 'approved': return { bg: '#dcfce7', text: '#166534' };
            case 'rejected': return { bg: '#fee2e2', text: '#991b1b' };
            default: return { bg: '#f3f4f6', text: '#6b7280' };
        }
    };

    // Lifecycle phases (copied for visual consistency)
    const LIFECYCLE_PHASES = [
        { key: 'requirement_refiner', label: 'Requirements', short: 'REQ' },
        { key: 'design_guidance', label: 'Design', short: 'DES' },
        { key: 'build_guidance', label: 'Build', short: 'BLD' },
        { key: 'acceptance_criteria', label: 'Acceptance', short: 'ACC' },
        { key: 'deployment', label: 'Deployment', short: 'DEP' },
        { key: 'closed', label: 'Closed', short: 'DONE' }
    ];
    const getPhaseIndex = (phase) => LIFECYCLE_PHASES.findIndex(p => p.key === phase);

    const LifecycleProgress = ({ currentPhase, subState, validations }) => {
        let parsedValidations = validations;
        if (typeof validations === 'string') {
            try {
                parsedValidations = JSON.parse(validations);
            } catch (e) {
                console.error("Error parsing validations JSON", e);
            }
        }

        const activePhases = parsedValidations?.active_phases || LIFECYCLE_PHASES.map(p => p.key);
        // Exclude 'closed' from the active phases for display generally, or handle it? 
        // Original logic was LIFECYCLE_PHASES.slice(0, -1). 
        // If activePhases includes 'closed', we should probably filter it out if we don't want to show it as a circle?
        // But usually activePhases are just the 5 Steps.
        // Let's filter LIFECYCLE_PHASES based on p.key being in activePhases.

        const filteredPhases = LIFECYCLE_PHASES.filter(p => activePhases.includes(p.key) && p.key !== 'closed');
        // Note: The original code sliced off 'closed'. We should maintain that behavior.

        const currentPhaseObj = LIFECYCLE_PHASES.find(p => p.key === currentPhase); // find in FULL list to get index logic?
        // No, we need index in the FILTERED list.

        const currentIndex = filteredPhases.findIndex(p => p.key === (currentPhase || filteredPhases[0]?.key));

        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {filteredPhases.map((phase, idx) => {
                    const validation = parsedValidations?.[phase.key];
                    const status = validation?.status;
                    let color = '#e5e7eb'; // Default Grey

                    if (idx < currentIndex) {
                        // Past Phase
                        if (status === 'pending') color = '#f59e0b'; // Yellow (Still Pending)
                        else if (status === 'rejected') color = '#fee2e2'; // Red
                        else color = '#10b981'; // Green (Approved/Default)
                    } else if (idx === currentIndex) {
                        // Current Phase
                        if (status === 'pending' || subState === 'pending_validation') color = '#f59e0b'; // Yellow
                        else color = '#3b82f6'; // Blue
                    }
                    // Future phases stay grey

                    return (
                        <React.Fragment key={phase.key}>
                            <div style={{
                                width: '24px', height: '24px', borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.6rem', fontWeight: 600,
                                backgroundColor: color,
                                color: color === '#e5e7eb' ? '#9ca3af' : color === '#fee2e2' ? '#991b1b' : 'white'
                            }} title={`${phase.label} ${status ? `(${status})` : ''}`}>
                                {color === '#10b981' ? '✓' : phase.short.charAt(0)}
                            </div>
                            {idx < filteredPhases.length - 1 && (
                                <div style={{ width: '12px', height: '2px', backgroundColor: idx < currentIndex ? '#10b981' : '#e5e7eb' }} />
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        );
    };

    const filteredTasks = tasks.filter(t =>
        t.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.projects?.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Header */}
            <div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ClipboardList size={28} color="#10b981" /> My Tasks
                </h1>
                <p style={{ color: '#64748b', marginTop: '4px' }}>
                    Track your tasks through the lifecycle
                </p>
            </div>

            {/* Toolbar */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', backgroundColor: 'var(--surface)', padding: '16px', borderRadius: '16px', border: '1px solid var(--border)' }}>
                <div style={{ position: 'relative', minWidth: '300px' }}>
                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                    <input
                        type="text"
                        placeholder="Search tasks..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ width: '100%', padding: '10px 12px 10px 40px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.95rem', outline: 'none' }}
                    />
                </div>
            </div>

            {/* Tasks Table */}
            <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>TASK</th>
                            <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>PROJECT</th>
                            <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>PRIORITY</th>
                            <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>LIFECYCLE</th>
                            <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>DUE DATE</th>
                            <th style={{ padding: '16px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 600, color: '#64748b', minWidth: '180px' }}>ACTIONS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading tasks...</td></tr>
                        ) : filteredTasks.length === 0 ? (
                            <tr>
                                <td colSpan="6" style={{ padding: '60px', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: '#94a3b8' }}>
                                        <CheckCircle size={40} style={{ opacity: 0.5 }} />
                                        <p style={{ fontSize: '1rem', fontWeight: 500 }}>No tasks found</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            filteredTasks.map(task => {
                                const priorityColor = getPriorityColor(task.priority);
                                const subStateColor = getSubStateColor(task.sub_state);

                                return (
                                    <tr key={task.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.2s' }}>
                                        <td style={{ padding: '16px' }}>
                                            <div>
                                                <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.95rem' }}>
                                                    {task.title}
                                                </div>
                                                {task.description && (
                                                    <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '250px' }}>
                                                        {task.description}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
                                                {task.projects?.name || 'General'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            <span style={{
                                                fontSize: '0.75rem', padding: '4px 10px', borderRadius: '20px',
                                                backgroundColor: priorityColor.bg, color: priorityColor.text, fontWeight: 600,
                                                textTransform: 'capitalize'
                                            }}>
                                                {task.priority || 'Medium'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            <LifecycleProgress
                                                currentPhase={task.lifecycle_state}
                                                subState={task.sub_state}
                                                validations={task.phase_validations}
                                            />
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#64748b' }}>
                                                <Calendar size={14} />
                                                {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date'}
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', whiteSpace: 'nowrap' }}>
                                                <button
                                                    onClick={() => openViewModal(task)}
                                                    style={{
                                                        padding: '6px 10px',
                                                        borderRadius: '6px',
                                                        backgroundColor: '#eff6ff',
                                                        color: '#1d4ed8',
                                                        border: '1px solid #bfdbfe',
                                                        fontWeight: 500,
                                                        cursor: 'pointer',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        fontSize: '0.75rem',
                                                        transition: 'background-color 0.2s',
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#dbeafe'}
                                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#eff6ff'}
                                                >
                                                    <Eye size={12} />
                                                    View
                                                </button>
                                                {(task.sub_state === 'in_progress' || task.sub_state === 'pending_validation') && (
                                                    <button
                                                        onClick={() => openProofModal(task)}
                                                        disabled={uploading}
                                                        style={{
                                                            padding: '6px 10px',
                                                            borderRadius: '6px',
                                                            backgroundColor: task.sub_state === 'pending_validation' ? '#f59e0b' : '#8b5cf6',
                                                            color: 'white',
                                                            border: 'none',
                                                            fontWeight: 500,
                                                            cursor: 'pointer',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                            fontSize: '0.75rem',
                                                            transition: 'background-color 0.2s',
                                                            whiteSpace: 'nowrap'
                                                        }}
                                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = task.sub_state === 'pending_validation' ? '#d97706' : '#7c3aed'}
                                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = task.sub_state === 'pending_validation' ? '#f59e0b' : '#8b5cf6'}
                                                    >
                                                        <Upload size={12} />
                                                        {task.sub_state === 'pending_validation' ? 'Update Proof' : 'Submit'}
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => openIssueModal(task)}
                                                    disabled={submittingIssue}
                                                    style={{
                                                        padding: '6px 10px',
                                                        borderRadius: '6px',
                                                        backgroundColor: task.issues ? '#dc2626' : '#ef4444',
                                                        color: 'white',
                                                        border: 'none',
                                                        fontWeight: 500,
                                                        cursor: 'pointer',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        fontSize: '0.75rem',
                                                        transition: 'background-color 0.2s',
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#b91c1c'}
                                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = task.issues ? '#dc2626' : '#ef4444'}
                                                >
                                                    <AlertTriangle size={12} />
                                                    Add Issue
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Proof Upload Modal */}
            {showProofModal && taskForProof && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001, backdropFilter: 'blur(4px)' }}>
                    <div style={{ backgroundColor: 'var(--surface)', padding: '32px', borderRadius: '20px', width: '500px', maxWidth: '90%', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                            <div style={{ backgroundColor: '#ede9fe', borderRadius: '12px', padding: '12px' }}>
                                <Upload size={24} color="#8b5cf6" />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Submit Proof for Validation</h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{taskForProof.title}</p>
                            </div>
                        </div>

                        <div style={{ marginBottom: '24px', padding: '20px', backgroundColor: '#fef3c7', borderRadius: '12px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                            <AlertCircle size={20} color="#b45309" style={{ flexShrink: 0, marginTop: '2px' }} />
                            <div style={{ fontSize: '0.9rem', color: '#92400e' }}>
                                <strong>Proof Required:</strong> Upload documentation showing your completed work before requesting validation.
                            </div>
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '0.9rem' }}>
                                Upload Proof Document
                            </label>
                            <div style={{
                                border: '2px dashed var(--border)',
                                borderRadius: '12px',
                                padding: '32px',
                                textAlign: 'center',
                                backgroundColor: proofFile ? '#f0fdf4' : 'var(--background)',
                                cursor: 'pointer'
                            }}
                                onClick={() => document.getElementById('proof-file-input').click()}
                            >
                                <input id="proof-file-input" type="file" onChange={handleFileChange} style={{ display: 'none' }}
                                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.gif,.zip,.txt" />
                                {proofFile ? (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                                        <FileText size={32} color="#10b981" />
                                        <div>
                                            <div style={{ fontWeight: 600, color: '#166534' }}>{proofFile.name}</div>
                                            <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>{(proofFile.size / 1024).toFixed(1)} KB</div>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <Upload size={32} color="#9ca3af" style={{ marginBottom: '12px' }} />
                                        <div style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Click to upload</div>
                                        <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>PDF, DOC, PNG, JPG, ZIP (max 10MB)</div>
                                    </>
                                )}
                            </div>
                        </div>

                        {uploading && (
                            <div style={{ marginBottom: '24px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
                                    <span>Uploading...</span>
                                    <span>{uploadProgress}%</span>
                                </div>
                                <div style={{ height: '8px', backgroundColor: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${uploadProgress}%`, backgroundColor: '#8b5cf6', transition: 'width 0.3s', borderRadius: '4px' }} />
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button onClick={() => { setShowProofModal(false); setTaskForProof(null); setProofFile(null); }} disabled={uploading}
                                style={{ padding: '12px 24px', borderRadius: '10px', backgroundColor: 'var(--background)', border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 600 }}>
                                Cancel
                            </button>
                            <button onClick={uploadProofAndRequestValidation} disabled={!proofFile || uploading}
                                style={{
                                    padding: '12px 24px', borderRadius: '10px',
                                    background: proofFile ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)' : '#e5e7eb',
                                    color: proofFile ? 'white' : '#9ca3af', border: 'none', fontWeight: 600,
                                    cursor: proofFile ? 'pointer' : 'not-allowed',
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    boxShadow: proofFile ? '0 4px 15px rgba(139, 92, 246, 0.3)' : 'none'
                                }}>
                                <Send size={16} />
                                {uploading ? 'Uploading...' : 'Submit for Validation'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Issue Logging Modal */}
            {showIssueModal && taskForIssue && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001, backdropFilter: 'blur(4px)' }}>
                    <div style={{ backgroundColor: 'var(--surface)', padding: '32px', borderRadius: '20px', width: '600px', maxWidth: '90%', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                            <div style={{ backgroundColor: '#fef2f2', borderRadius: '12px', padding: '12px' }}>
                                <AlertTriangle size={24} color="#ef4444" />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Report Issue</h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{taskForIssue.title}</p>
                            </div>
                        </div>

                        {taskForIssue.issues && (
                            <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#fef2f2', borderRadius: '12px', border: '1px solid #fecaca' }}>
                                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#991b1b', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <AlertCircle size={16} /> Existing Issues
                                </h4>
                                <div style={{ fontSize: '0.85rem', color: '#7f1d1d', whiteSpace: 'pre-wrap', maxHeight: '150px', overflowY: 'auto', lineHeight: '1.6' }}>
                                    {taskForIssue.issues}
                                </div>
                            </div>
                        )}

                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '0.9rem' }}>
                                Describe the Issue *
                            </label>
                            <textarea
                                value={issueText}
                                onChange={(e) => setIssueText(e.target.value)}
                                placeholder="Describe the issue you're facing with this task..."
                                rows="5"
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    borderRadius: '12px',
                                    border: '2px solid var(--border)',
                                    fontSize: '0.9rem',
                                    resize: 'vertical',
                                    outline: 'none',
                                    fontFamily: 'inherit'
                                }}
                                onFocus={(e) => e.target.style.borderColor = '#ef4444'}
                                onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button
                                onClick={() => { setShowIssueModal(false); setTaskForIssue(null); setIssueText(''); }}
                                disabled={submittingIssue}
                                style={{ padding: '12px 24px', borderRadius: '10px', backgroundColor: 'var(--background)', border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 600 }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitIssue}
                                disabled={!issueText.trim() || submittingIssue}
                                style={{
                                    padding: '12px 24px',
                                    borderRadius: '10px',
                                    background: issueText.trim() ? 'linear-gradient(135deg, #ef4444, #dc2626)' : '#e5e7eb',
                                    color: issueText.trim() ? 'white' : '#9ca3af',
                                    border: 'none',
                                    fontWeight: 600,
                                    cursor: issueText.trim() ? 'pointer' : 'not-allowed',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    boxShadow: issueText.trim() ? '0 4px 15px rgba(239, 68, 68, 0.3)' : 'none'
                                }}
                            >
                                <Send size={16} />
                                {submittingIssue ? 'Submitting...' : 'Submit Issue'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* View Task Modal */}
            {showViewModal && taskForView && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001, backdropFilter: 'blur(4px)' }}>
                    <div style={{ backgroundColor: 'var(--surface)', padding: '32px', borderRadius: '20px', width: '600px', maxWidth: '90%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                            <div>
                                <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>Task Details</h3>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <span style={{
                                        fontSize: '0.75rem', padding: '4px 10px', borderRadius: '20px',
                                        backgroundColor: getPriorityColor(taskForView.priority).bg,
                                        color: getPriorityColor(taskForView.priority).text, fontWeight: 600,
                                        textTransform: 'capitalize'
                                    }}>
                                        {taskForView.priority || 'Medium'} Priority
                                    </span>
                                    <span style={{
                                        fontSize: '0.75rem', padding: '4px 10px', borderRadius: '20px',
                                        backgroundColor: getSubStateColor(taskForView.sub_state).bg,
                                        color: getSubStateColor(taskForView.sub_state).text, fontWeight: 600,
                                        textTransform: 'capitalize'
                                    }}>
                                        {taskForView.sub_state?.replace(/_/g, ' ') || 'Pending'}
                                    </span>
                                </div>
                            </div>
                            <button onClick={() => { setShowViewModal(false); setTaskForView(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
                                <AlertCircle size={24} style={{ transform: 'rotate(45deg)' }} /> {/* Using AlertCircle as close icon fallback if X not imported, essentially creates an X shape roughly */}
                            </button>
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>TITLE</label>
                            <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1e293b' }}>{taskForView.title}</div>
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>DESCRIPTION</label>
                            <div style={{ fontSize: '1rem', color: '#334155', lineHeight: '1.6', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                {taskForView.description || 'No description provided.'}
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>DUE DATE</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', color: '#334155' }}>
                                    <Calendar size={18} color="#64748b" />
                                    {taskForView.due_date ? new Date(taskForView.due_date).toLocaleDateString() : 'No due date'}
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>PHASE</label>
                                <div style={{ fontSize: '1rem', color: '#334155', textTransform: 'capitalize' }}>
                                    {taskForView.lifecycle_state?.replace(/_/g, ' ') || 'Requirement Refiner'}
                                </div>
                            </div>
                        </div>

                        {taskForView.issues && (
                            <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#fef2f2', borderRadius: '12px', border: '1px solid #fecaca' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#991b1b', marginBottom: '8px' }}>
                                    <AlertTriangle size={16} /> ISSUES LOGGED
                                </label>
                                <div style={{ fontSize: '0.9rem', color: '#7f1d1d', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                                    {taskForView.issues}
                                </div>
                            </div>
                        )}

                        {/* Validations History */}
                        {(taskForView.phase_validations || taskForView.proof_url) && (
                            <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#166534', marginBottom: '8px' }}>
                                    <CheckCircle size={16} /> VALIDATION PROOFS
                                </label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {/* New System: Phase Validations */}
                                    {taskForView.phase_validations && Object.entries(taskForView.phase_validations).map(([phaseKey, data]) => {
                                        if (!data.proof_url) return null;
                                        const phaseLabel = LIFECYCLE_PHASES.find(p => p.key === phaseKey)?.label || phaseKey;
                                        return (
                                            <div key={phaseKey} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #dcfce7' }}>
                                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '10px' }}>
                                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#166534', marginRight: '8px' }}>{phaseLabel}:</span>
                                                    <span style={{ fontSize: '0.85rem', color: '#15803d' }}>{data.proof_url.split('/').pop()}</span>
                                                </div>
                                                <a href={data.proof_url} target="_blank" rel="noopener noreferrer"
                                                    style={{ fontSize: '0.8rem', fontWeight: 600, color: '#166534', textDecoration: 'underline', whiteSpace: 'nowrap' }}>
                                                    View
                                                </a>
                                            </div>
                                        );
                                    })}

                                    {/* Legacy Support (if no validations but proof_url exists) */}
                                    {(!taskForView.phase_validations || Object.keys(taskForView.phase_validations).length === 0) && taskForView.proof_url && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #dcfce7' }}>
                                            <span style={{ fontSize: '0.85rem', color: '#15803d' }}>{taskForView.proof_url.split('/').pop()}</span>
                                            <a href={taskForView.proof_url} target="_blank" rel="noopener noreferrer"
                                                style={{ fontSize: '0.8rem', fontWeight: 600, color: '#166534', textDecoration: 'underline' }}>
                                                View
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => { setShowViewModal(false); setTaskForView(null); }}
                                style={{ padding: '10px 24px', borderRadius: '8px', backgroundColor: '#e2e8f0', color: '#475569', border: 'none', fontWeight: 600, cursor: 'pointer' }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Issue Logging Modal */}
        </div>
    );
};

export default MyTasksPage;
