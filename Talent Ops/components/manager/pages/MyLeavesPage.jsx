import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { Plus, X, Briefcase, Trash2, Calendar } from 'lucide-react';
import DataTable from '../components/UI/DataTable';
import { useToast } from '../context/ToastContext';

const MyLeavesPage = () => {
    const { addToast } = useToast();

    const [leaveRequests, setLeaveRequests] = useState([]);
    const [remainingLeaves, setRemainingLeaves] = useState(0);
    const [orgId, setOrgId] = useState(null);
    const [showApplyLeaveModal, setShowApplyLeaveModal] = useState(false);
    const [leaveFormData, setLeaveFormData] = useState({
        leaveType: 'Casual Leave',
        startDate: '',
        endDate: '',
        reason: ''
    });

    // Fetch leaves from Supabase
    useEffect(() => {
        const fetchLeaves = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                console.log('No user found');
                return;
            }

            console.log('Fetching leaves for manager:', user.id);

            const { data, error } = await supabase
                .from('leaves')
                .select('*')
                .eq('employee_id', user.id);

            if (error) {
                console.error('Error fetching leaves:', error);
                addToast('Error fetching leaves: ' + error.message, 'error');
            } else {
                console.log('Leaves fetched:', data);
                const mappedLeaves = data.map(leave => {
                    const start = new Date(leave.from_date);
                    const end = new Date(leave.to_date);
                    const diffTime = Math.abs(end - start);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

                    let type = 'Leave';
                    let reason = leave.reason || '';
                    if (reason.includes(':')) {
                        const parts = reason.split(':');
                        type = parts[0];
                    }

                    const status = leave.status ? leave.status.charAt(0).toUpperCase() + leave.status.slice(1).toLowerCase() : 'Pending';

                    return {
                        id: leave.id,
                        name: 'You',
                        type: type,
                        startDate: leave.from_date,
                        endDate: leave.to_date,
                        duration: diffDays === 1 ? '1 Day' : `${diffDays} Days`,
                        dates: start.toDateString() === end.toDateString()
                            ? start.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })
                            : `${start.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}`,
                        status: status,
                        created_at: leave.created_at
                    };
                });
                mappedLeaves.sort((a, b) => b.id - a.id);
                setLeaveRequests(mappedLeaves);
            }
        };

        const fetchRemainingLeaves = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('profiles')
                .select('leaves_remaining, org_id')
                .eq('id', user.id)
                .single();

            if (data) {
                setRemainingLeaves(data.leaves_remaining || 0);
                setOrgId(data.org_id);
            }
        };

        fetchLeaves();
        fetchRemainingLeaves();
    }, [addToast]);

    const handleAction = (action) => {
        if (action === 'Apply for Leave') {
            setLeaveFormData(prev => ({
                ...prev,
                leaveType: remainingLeaves <= 0 ? 'Loss of Pay' : 'Casual Leave'
            }));
            setShowApplyLeaveModal(true);
        }
    };

    const handleApplyLeave = async (e) => {
        e.preventDefault();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            addToast('User not found', 'error');
            return;
        }

        const start = new Date(leaveFormData.startDate);
        const end = new Date(leaveFormData.endDate);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

        try {
            // 1. Insert leave request into DB
            const { data, error } = await supabase
                .from('leaves')
                .insert([{
                    employee_id: user.id,
                    org_id: orgId,
                    from_date: leaveFormData.startDate,
                    to_date: leaveFormData.endDate,
                    reason: `${leaveFormData.leaveType}: ${leaveFormData.reason}`,
                    status: 'pending'
                }])
                .select();

            if (error) throw error;

            // 2. Only update quota/balance if NOT 'Loss of Pay'
            if (leaveFormData.leaveType !== 'Loss of Pay') {
                const { data: userData, error: userError } = await supabase
                    .from('profiles')
                    .select('monthly_leave_quota, leaves_taken_this_month')
                    .eq('id', user.id)
                    .single();

                if (userError) throw userError;

                const newTaken = (userData.leaves_taken_this_month || 0) + diffDays;

                const { error: updateError } = await supabase
                    .from('profiles')
                    .update({ leaves_taken_this_month: newTaken })
                    .eq('id', user.id);

                if (updateError) throw updateError;

                setRemainingLeaves((userData.monthly_leave_quota || 0) - newTaken);
            }

            // 3. Update local state
            if (data && data[0]) {
                const newLeave = data[0];
                const newRequest = {
                    id: newLeave.id,
                    name: 'You',
                    type: leaveFormData.leaveType,
                    duration: diffDays === 1 ? '1 Day' : `${diffDays} Days`,
                    dates: start.toDateString() === end.toDateString()
                        ? start.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })
                        : `${start.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}`,
                    status: 'Pending'
                };
                setLeaveRequests([newRequest, ...leaveRequests]);
            }

            addToast('Leave application submitted successfully', 'success');
            setShowApplyLeaveModal(false);
            setLeaveFormData({ leaveType: 'Casual Leave', startDate: '', endDate: '', reason: '' });
        } catch (error) {
            console.error('Error applying leave:', error);
            addToast('Failed to apply: ' + error.message, 'error');
        }
    };

    // Helper to check if leave was created within the last 12 hours
    const isWithin12Hours = (createdAt) => {
        if (!createdAt) return false;
        const createdTime = new Date(createdAt).getTime();
        const now = Date.now();
        const twelveHoursMs = 12 * 60 * 60 * 1000;
        return (now - createdTime) < twelveHoursMs;
    };

    // Delete leave handler with balance refund
    const handleDeleteLeave = async (leaveRequest) => {
        if (!window.confirm('Are you sure you want to delete this leave request?')) {
            return;
        }

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                addToast('User not found', 'error');
                return;
            }

            // Calculate duration for refund
            const start = new Date(leaveRequest.startDate);
            const end = new Date(leaveRequest.endDate);
            const diffTime = Math.abs(end - start);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

            // Check if it was NOT Loss of Pay
            const isLossOfPay = leaveRequest.type === 'Loss of Pay';

            // Delete the leave request
            const { error: deleteError } = await supabase
                .from('leaves')
                .delete()
                .eq('id', leaveRequest.id);

            if (deleteError) throw deleteError;

            // Refund leave balance if it wasn't Loss of Pay and status was pending
            if (!isLossOfPay && leaveRequest.status === 'Pending') {
                const { data: userData, error: userError } = await supabase
                    .from('profiles')
                    .select('leaves_taken_this_month, monthly_leave_quota')
                    .eq('id', user.id)
                    .single();

                if (!userError && userData) {
                    const newTaken = Math.max(0, (userData.leaves_taken_this_month || 0) - diffDays);
                    await supabase
                        .from('profiles')
                        .update({ leaves_taken_this_month: newTaken })
                        .eq('id', user.id);

                    setRemainingLeaves((userData.monthly_leave_quota || 0) - newTaken);
                }
            }

            // Update local state
            setLeaveRequests(prev => prev.filter(l => l.id !== leaveRequest.id));
            addToast('Leave request deleted successfully', 'success');

        } catch (error) {
            console.error('Error deleting leave:', error);
            addToast('Failed to delete leave request: ' + error.message, 'error');
        }
    };

    const config = {
        columns: [
            { header: 'Type', accessor: 'type' },
            { header: 'Duration', accessor: 'duration' },
            { header: 'Dates', accessor: 'dates' },
            {
                header: 'Status', accessor: 'status', render: (row) => (
                    <span style={{
                        padding: '4px 8px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: row.status === 'Approved' ? '#dcfce7' : row.status === 'Pending' ? '#fef3c7' : '#fee2e2',
                        color: row.status === 'Approved' ? '#166534' : row.status === 'Pending' ? '#b45309' : '#991b1b'
                    }}>
                        {row.status}
                    </span>
                )
            },
            {
                header: 'Actions', accessor: 'actions', render: (row) => (
                    row.status === 'Pending' ? (
                        <button
                            onClick={() => handleDeleteLeave(row)}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                backgroundColor: '#fee2e2',
                                color: '#991b1b',
                                border: '1px solid #fca5a5',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fecaca'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}
                        >
                            <Trash2 size={14} />
                            Delete
                        </button>
                    ) : null
                )
            }
        ],
        data: leaveRequests
    };

    console.log('MyLeavesPage: About to render. Leave requests:', leaveRequests.length, 'Remaining:', remainingLeaves);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Premium Header with Mesh Background */}
            <div style={{
                position: 'relative',
                padding: '24px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                marginBottom: '16px',
                overflow: 'hidden',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}>
                {/* Decorative Mesh Grid */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)',
                    backgroundSize: '24px 24px',
                    opacity: 0.5
                }}></div>

                <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                            <Calendar size={14} />
                            <span>Management</span>
                            <span>/</span>
                            <span style={{ color: '#38bdf8' }}>My Leave History</span>
                        </div>
                        <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'white', letterSpacing: '-0.02em', marginBottom: '8px' }}>
                            Personal Leave History
                        </h1>
                        <p style={{ color: '#94a3b8', fontSize: '0.9rem', maxWidth: '600px' }}>
                            Track your personal leave requests, view history, and manage your available balance.
                        </p>
                    </div>

                    <button
                        onClick={() => handleAction('Apply for Leave')}
                        style={{
                            background: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)',
                            color: 'white',
                            padding: '14px 28px',
                            borderRadius: '16px',
                            fontWeight: '700',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            border: 'none',
                            cursor: 'pointer',
                            boxShadow: '0 10px 15px -3px rgba(56, 189, 248, 0.4)',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
                            e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(56, 189, 248, 0.5)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0) scale(1)';
                            e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(56, 189, 248, 0.4)';
                        }}
                    >
                        <Plus size={22} />
                        Apply for Leave
                    </button>
                </div>
            </div>

            {/* Remaining Leaves Card */}
            <div style={{
                background: 'white',
                padding: '16px',
                borderRadius: '16px',
                border: '1px solid #f1f5f9',
                boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '24px',
                position: 'relative',
                overflow: 'hidden'
            }}>
                <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '20px',
                    background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#0284c7',
                    border: '1px solid #bae6fd'
                }}>
                    <Briefcase size={32} />
                </div>
                <div>
                    <p style={{ fontSize: '0.9rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                        Your Balance
                    </p>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                        <span style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a' }}>{remainingLeaves}</span>
                        <span style={{ fontSize: '1rem', fontWeight: '600', color: '#94a3b8' }}>Days Remaining</span>
                    </div>
                </div>
            </div>

            <DataTable
                title="My Leave History"
                columns={config.columns}
                data={config.data}
                onAction={handleAction}
            />

            {/* Apply Leave Modal */}
            {showApplyLeaveModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ backgroundColor: 'var(--surface)', padding: '32px', borderRadius: '16px', width: '500px', maxWidth: '90%', boxShadow: 'var(--shadow-lg)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Apply for Leave</h3>
                            <button onClick={() => setShowApplyLeaveModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleApplyLeave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '8px', color: 'var(--text-primary)' }}>Leave Type</label>
                                <select
                                    value={leaveFormData.leaveType}
                                    onChange={(e) => setLeaveFormData({ ...leaveFormData, leaveType: e.target.value })}
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '1rem', backgroundColor: 'var(--background)', color: 'var(--text-primary)' }}
                                    required
                                    disabled={remainingLeaves <= 0}
                                >
                                    <option value="Casual Leave">Casual Leave</option>
                                    <option value="Sick Leave">Sick Leave</option>
                                    <option value="Vacation">Vacation</option>
                                    <option value="Personal Leave">Personal Leave</option>
                                    <option value="Loss of Pay">Loss of Pay</option>
                                </select>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '8px', color: 'var(--text-primary)' }}>Start Date</label>
                                    <input
                                        type="date"
                                        value={leaveFormData.startDate}
                                        onChange={(e) => setLeaveFormData({ ...leaveFormData, startDate: e.target.value })}
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '1rem', backgroundColor: 'var(--background)', color: 'var(--text-primary)' }}
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '8px', color: 'var(--text-primary)' }}>End Date</label>
                                    <input
                                        type="date"
                                        value={leaveFormData.endDate}
                                        onChange={(e) => setLeaveFormData({ ...leaveFormData, endDate: e.target.value })}
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '1rem', backgroundColor: 'var(--background)', color: 'var(--text-primary)' }}
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '8px', color: 'var(--text-primary)' }}>Reason</label>
                                <textarea
                                    value={leaveFormData.reason}
                                    onChange={(e) => setLeaveFormData({ ...leaveFormData, reason: e.target.value })}
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '1rem', minHeight: '100px', resize: 'vertical', backgroundColor: 'var(--background)', color: 'var(--text-primary)' }}
                                    placeholder="Enter reason for leave..."
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                style={{
                                    backgroundColor: 'var(--primary)',
                                    color: 'white',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    fontWeight: 600,
                                    fontSize: '1rem',
                                    border: 'none',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                Submit Leave Request
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyLeavesPage;
