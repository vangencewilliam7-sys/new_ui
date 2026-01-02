import React, { useState, useEffect } from 'react';
import { Search, Calendar, CheckCircle, Upload, FileText, Send, AlertCircle, Paperclip, ClipboardList } from 'lucide-react';
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

            // Fetch tasks assigned to the current user AND belonging to the current project
            const { data, error } = await supabase
                .from('tasks')
                .select('*')
                .eq('assigned_to', user.id)
                .eq('project_id', currentProject.id); // Filter by project // Removing .order() as it might be causing 400 errors

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

            if (taskForProof.sub_state === 'pending_validation') {
                // If already pending validation, just update the proof file URL directly
                // allowing the user to update their submission without triggering the RPC checks
                const { data, error } = await supabase
                    .from('tasks')
                    .update({
                        proof_url: proofUrl,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', taskForProof.id)
                    .select();

                responseError = error;
                // Mock a success response similar to the RPC
                responseData = { success: true, message: 'Proof updated successfully' };
            } else {
                // First time submission, use the RPC which handles state transitions
                const { data, error } = await supabase.rpc('request_task_validation', {
                    p_task_id: taskForProof.id,
                    p_user_id: user.id,
                    p_proof_url: proofUrl
                });
                responseError = error;
                responseData = data;
            }

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

    const LifecycleProgress = ({ currentPhase, subState }) => {
        const currentIndex = getPhaseIndex(currentPhase || 'requirement_refiner');
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {LIFECYCLE_PHASES.slice(0, -1).map((phase, idx) => (
                    <React.Fragment key={phase.key}>
                        <div style={{
                            width: '24px', height: '24px', borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.6rem', fontWeight: 600,
                            backgroundColor: idx < currentIndex ? '#10b981' : idx === currentIndex ? (subState === 'pending_validation' ? '#f59e0b' : '#3b82f6') : '#e5e7eb',
                            color: idx <= currentIndex ? 'white' : '#9ca3af'
                        }} title={phase.label}>
                            {idx < currentIndex ? '✓' : phase.short.charAt(0)}
                        </div>
                        {idx < LIFECYCLE_PHASES.length - 2 && (
                            <div style={{ width: '12px', height: '2px', backgroundColor: idx < currentIndex ? '#10b981' : '#e5e7eb' }} />
                        )}
                    </React.Fragment>
                ))}
            </div>
        );
    };

    const filteredTasks = tasks.filter(t =>
        t.title?.toLowerCase().includes(searchQuery.toLowerCase())
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
                            <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>PRIORITY</th>
                            <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>LIFECYCLE</th>
                            <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>STATUS</th>
                            <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>DUE DATE</th>
                            <th style={{ padding: '16px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>ACTIONS</th>
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
                                                    {task.proof_url && (
                                                        <span style={{ marginLeft: '8px', color: '#10b981', display: 'inline-block', verticalAlign: 'middle' }} title="Proof submitted">
                                                            <Paperclip size={14} />
                                                        </span>
                                                    )}
                                                </div>
                                                {task.description && (
                                                    <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '250px' }}>
                                                        {task.description}
                                                    </div>
                                                )}
                                            </div>
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
                                            <LifecycleProgress currentPhase={task.lifecycle_state} subState={task.sub_state} />
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            <span style={{
                                                fontSize: '0.75rem', padding: '4px 10px', borderRadius: '20px',
                                                backgroundColor: subStateColor.bg, color: subStateColor.text, fontWeight: 600
                                            }}>
                                                {task.sub_state?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Pending'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#64748b' }}>
                                                <Calendar size={14} />
                                                {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date'}
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px', textAlign: 'center' }}>
                                            {(task.sub_state === 'in_progress' || task.sub_state === 'pending_validation') && (
                                                <button
                                                    onClick={() => openProofModal(task)}
                                                    disabled={uploading}
                                                    style={{
                                                        padding: '8px 12px',
                                                        borderRadius: '8px',
                                                        backgroundColor: task.sub_state === 'pending_validation' ? '#f59e0b' : '#8b5cf6',
                                                        color: 'white',
                                                        border: 'none',
                                                        fontWeight: 500,
                                                        cursor: 'pointer',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        fontSize: '0.8rem',
                                                        transition: 'background-color 0.2s'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = task.sub_state === 'pending_validation' ? '#d97706' : '#7c3aed'}
                                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = task.sub_state === 'pending_validation' ? '#f59e0b' : '#8b5cf6'}
                                                >
                                                    <Upload size={14} />
                                                    {task.sub_state === 'pending_validation' ? 'Update Proof' : 'Submit'}
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
        </div>
    );
};

export default MyTasksPage;
