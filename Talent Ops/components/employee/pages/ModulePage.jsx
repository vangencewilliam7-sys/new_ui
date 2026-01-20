import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { Plus, X, Eye, Mail, Phone, MapPin, Calendar, Briefcase, Download, Trash2 } from 'lucide-react';
import DataTable from '../components/UI/DataTable';
import { useToast } from '../context/ToastContext';
import { useUser } from '../context/UserContext';
import { useProject } from '../context/ProjectContext';
import AnalyticsDemo from '../components/Demo/AnalyticsDemo';
import KanbanDemo from '../components/Demo/KanbanDemo';
import TaskLifecyclePage from '../../shared/TaskLifecyclePage';
import HierarchyDemo from '../components/Demo/HierarchyDemo';
import SettingsDemo from '../components/Demo/SettingsDemo';
import AuditLogsDemo from '../components/Demo/AuditLogsDemo';
import StatusDemo from '../components/Demo/StatusDemo';
import PayslipsPage from '../../shared/PayslipsPage';
import AnnouncementsPage from '../../shared/AnnouncementsPage';
import ProjectHierarchyDemo from '../../shared/ProjectHierarchyDemo';
import ProjectDocuments from './ProjectDocuments';

const ModulePage = ({ title, type }) => {
    const { addToast } = useToast();
    const { currentTeam, userName, userId, teamId, orgId, userRole } = useUser();
    const { projectRole, currentProject } = useProject();

    // State for leave requests
    const [leaveRequests, setLeaveRequests] = useState([]);
    const [remainingLeaves, setRemainingLeaves] = useState(0);

    // State for Leave Details modal
    const [selectedLeaveRequest, setSelectedLeaveRequest] = useState(null);
    const [showLeaveDetailsModal, setShowLeaveDetailsModal] = useState(false);
    const [employeeTasks, setEmployeeTasks] = useState([]);

    // State for team members
    const [teamMembers, setTeamMembers] = useState([]);

    // State for Realtime Updates
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // State for Policies
    const [policies, setPolicies] = useState([]);


    // Fetch leaves from Supabase
    useEffect(() => {
        if (!userId) return;

        const fetchLeaves = async () => {
            console.log('fetchLeaves called. User ID from context:', userId);

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                console.log('No user found in supabase.auth.getUser()');
                return;
            }

            console.log('Fetching leaves for user:', user.id);

            // Attempt fetch without ordering first to be safe
            const { data, error } = await supabase
                .from('leaves')
                .select('*')
                .eq('employee_id', user.id)
                .eq('org_id', orgId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching leaves:', error);
                addToast('Error fetching leaves: ' + error.message, 'error');
            } else {
                console.log('Leaves fetched from DB:', data);
                console.log('First leave created_at:', data?.[0]?.created_at);
                // Map Supabase data to table format
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

                    // Normalize status for display (capitalized)
                    const status = leave.status ? leave.status.charAt(0).toUpperCase() + leave.status.slice(1).toLowerCase() : 'Pending';

                    return {
                        id: leave.id,
                        employee_id: leave.employee_id,
                        name: userName, // Use context userName or fallback
                        type: type,
                        reason: leave.reason || 'No reason provided', // Include full reason from DB
                        startDate: leave.from_date,
                        endDate: leave.to_date,
                        duration: diffDays === 1 ? '1 Day' : `${diffDays} Days`,
                        dates: start.toDateString() === end.toDateString()
                            ? start.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })
                            : `${start.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}`,
                        status: status,
                        appliedOn: leave.created_at ? new Date(leave.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : 'N/A',
                        created_at: leave.created_at // For sorting
                    };
                });
                // Sort by status (Pending first) then by created_at descending
                mappedLeaves.sort((a, b) => {
                    if (a.status === 'Pending' && b.status !== 'Pending') return -1;
                    if (a.status !== 'Pending' && b.status === 'Pending') return 1;
                    return new Date(b.created_at) - new Date(a.created_at);
                });
                setLeaveRequests(mappedLeaves);
            }
        };

        const fetchRemainingLeaves = async () => {
            // Fetch directly using auth user to ensure latest data
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('profiles')
                .select('leaves_remaining, monthly_leave_quota, leaves_taken_this_month')
                .eq('id', user.id)
                .eq('org_id', orgId)
                .single();

            if (data) {
                // Calculate dynamically to ensure consistency
                const quota = data.monthly_leave_quota || 0;
                const taken = data.leaves_taken_this_month || 0;
                // If quota is present, trust the calculation. Otherwise fallback to stored remaining.
                const calculatedRemaining = quota > 0 ? (quota - taken) : (data.leaves_remaining || 0);
                setRemainingLeaves(calculatedRemaining);
            }
        };

        fetchLeaves();
        fetchRemainingLeaves();
    }, [userId, userName, addToast, refreshTrigger]);

    // Fetch team members based on Current Project
    useEffect(() => {
        if (!currentProject?.id) {
            setTeamMembers([]);
            return;
        }

        const fetchTeamMembers = async () => {
            try {
                // 1. Fetch project members IDs AND Roles
                const { data: projectMembersData, error: memberError } = await supabase
                    .from('project_members')
                    .select('user_id, role')
                    .eq('project_id', currentProject.id)
                    .eq('org_id', orgId);

                if (memberError) throw memberError;

                if (!projectMembersData || projectMembersData.length === 0) {
                    setTeamMembers([]);
                    return;
                }

                const userIds = projectMembersData.map(m => m.user_id);
                const projectRoleMap = {};
                projectMembersData.forEach(pm => {
                    projectRoleMap[pm.user_id] = pm.role;
                });

                // 2. Fetch profiles for these users
                const { data: profiles, error: profileError } = await supabase
                    .from('profiles')
                    .select('*')
                    .in('id', userIds)
                    .eq('org_id', orgId);

                if (profileError) throw profileError;

                // 2.1 Fetch Departments for mapping
                const { data: deptData } = await supabase.from('departments').select('id, department_name').eq('org_id', orgId);
                const deptMap = {};
                if (deptData) {
                    deptData.forEach(d => deptMap[d.id] = d.department_name);
                }

                // 3. Use Current Project Name
                const teamName = currentProject.name || 'Unassigned';

                const today = new Date().toISOString().split('T')[0];

                // 4. Fetch today's attendance for status
                const { data: attendance } = await supabase
                    .from('attendance')
                    .select('employee_id, clock_in, clock_out')
                    .in('employee_id', userIds)
                    .eq('org_id', orgId)
                    .eq('date', today);

                const activeSet = new Set();
                if (attendance) {
                    attendance.forEach(a => {
                        if (a.clock_in && !a.clock_out) {
                            activeSet.add(a.employee_id);
                        }
                    });
                }

                // 5. Fetch today's leaves for status
                const { data: leaves } = await supabase
                    .from('leaves')
                    .select('employee_id')
                    .eq('status', 'approved')
                    .eq('org_id', orgId)
                    .in('employee_id', userIds)
                    .lte('from_date', today)
                    .gte('to_date', today);

                const leaveSet = new Set(leaves?.map(l => l.employee_id));

                const mappedMembers = profiles.map(member => {
                    let status = 'Offline';
                    if (activeSet.has(member.id)) {
                        status = 'Active';
                    } else if (leaveSet.has(member.id)) {
                        status = 'On Leave';
                    }

                    const projectRole = projectRoleMap[member.id];
                    const isProjectManager = projectRole === 'manager';

                    return {
                        id: member.id,
                        name: member.full_name || 'Unknown',
                        email: member.email || 'N/A',
                        role: member.role || 'N/A',
                        projectRole: projectRole,
                        isProjectManager: isProjectManager,
                        dept: teamName,
                        department: member.department, // Keep original department ID for internal logic
                        departmentName: deptMap[member.department] || 'Unassigned',
                        phone: member.phone || 'N/A',
                        location: member.location || 'N/A',
                        status: status,
                        joinDate: member.join_date ? new Date(member.join_date).toLocaleDateString() : (member.created_at ? new Date(member.created_at).toLocaleDateString() : 'N/A'),
                        avatar_url: member.avatar_url
                    };
                });
                setTeamMembers(mappedMembers);

            } catch (err) {
                console.error('Error fetching team members:', err);
                setTeamMembers([]);
            }
        };

        fetchTeamMembers();
    }, [currentProject?.id, refreshTrigger]);

    // Realtime Subscription
    useEffect(() => {
        const channel = supabase
            .channel('employee-module-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leaves' }, () => {
                setRefreshTrigger(prev => prev + 1);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => {
                setRefreshTrigger(prev => prev + 1); // For team status updates
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'project_members' }, () => {
                console.log('Project members updated, refreshing...');
                setRefreshTrigger(prev => prev + 1);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Fetch Policies from Supabase
    useEffect(() => {
        const fetchPolicies = async () => {
            if (type === 'policies') {
                try {
                    console.log('Fetching policies from Supabase...');
                    const { data, error } = await supabase
                        .from('policies')
                        .select('*')
                        .eq('status', 'Active')
                        .eq('org_id', orgId)
                        .order('created_at', { ascending: false });

                    if (error) {
                        console.error('Error fetching policies:', error);
                        addToast('Failed to load policies', 'error');
                        return;
                    }

                    if (data) {
                        const transformedPolicies = data.map(policy => ({
                            id: policy.id,
                            name: policy.title || 'Untitled Policy',
                            category: policy.category || 'General',
                            effectiveDate: policy.effective_date ? new Date(policy.effective_date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : 'N/A',
                            status: policy.status || 'Active',
                            file_url: policy.file_url
                        }));
                        setPolicies(transformedPolicies);
                    }
                } catch (err) {
                    console.error('Unexpected error fetching policies:', err);
                    addToast('An unexpected error occurred while loading policies', 'error');
                }
            }
        };

        fetchPolicies();
    }, [type, refreshTrigger]);


    // State for Apply Leave modal
    const [showApplyLeaveModal, setShowApplyLeaveModal] = useState(false);
    const [leaveFormData, setLeaveFormData] = useState({
        leaveType: 'Casual Leave',
        startDate: '',
        endDate: '',
        reason: ''
    });

    // State for Employee Details modal
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [showEmployeeModal, setShowEmployeeModal] = useState(false);

    // State for Candidate Details modal
    const [selectedCandidate, setSelectedCandidate] = useState(null);
    const [showCandidateModal, setShowCandidateModal] = useState(false);

    const fetchEmployeeTasks = async (employeeId, startDate, endDate) => {
        // Log parameters for debugging
        console.log('fetchEmployeeTasks params:', { employeeId, startDate, endDate });

        try {
            const { data, error } = await supabase
                .from('tasks')
                .select('*')
                .eq('assigned_to', employeeId)
                .eq('org_id', orgId)
                .gte('due_date', startDate)
                .lte('due_date', endDate);

            if (error) throw error;
            console.log('fetchEmployeeTasks result:', data);
            return data || [];
        } catch (error) {
            console.error('Error fetching tasks:', error);
            return [];
        }
    };

    const handleViewLeave = async (leaveRequest) => {
        setSelectedLeaveRequest(leaveRequest);

        // Fetch tasks for the employee during leave dates
        // Note: For employees, they are viewing their own leaves, so we use their ID (userId)
        // unless the leaveRequest object has employee_id (which it should from fetch)
        const employeeId = leaveRequest.employee_id || userId;

        const tasks = await fetchEmployeeTasks(
            employeeId,
            leaveRequest.startDate, // Use standardized camelCase keys from transformation
            leaveRequest.endDate
        );
        setEmployeeTasks(tasks);
        setShowLeaveDetailsModal(true);
    };

    // Helper to check if leave was created within the last 12 hours
    const isWithin12Hours = (createdAt) => {
        console.log('isWithin12Hours check:', { createdAt, type: typeof createdAt });
        if (!createdAt) {
            console.log('createdAt is null/undefined, returning false');
            return false;
        }
        const createdTime = new Date(createdAt).getTime();
        const now = Date.now();
        const twelveHoursMs = 12 * 60 * 60 * 1000;
        const diff = now - createdTime;
        const result = diff < twelveHoursMs;
        console.log('isWithin12Hours result:', { createdTime, now, diff, twelveHoursMs, result });
        return result;
    };

    // Delete leave handler with balance refund
    const handleDeleteLeave = async (leaveRequest) => {
        if (!window.confirm('Are you sure you want to delete this leave request?')) {
            return;
        }

        try {
            // Calculate duration for refund
            const start = new Date(leaveRequest.startDate);
            const end = new Date(leaveRequest.endDate);
            const diffTime = Math.abs(end - start);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

            // Check if it was NOT Loss of Pay (we need to refund the balance)
            const isLossOfPay = leaveRequest.type === 'Loss of Pay';

            // Delete the leave request
            const { error: deleteError } = await supabase
                .from('leaves')
                .delete()
                .eq('id', leaveRequest.id)
                .eq('org_id', orgId);

            if (deleteError) throw deleteError;

            // Refund leave balance if it wasn't Loss of Pay and status was pending
            if (!isLossOfPay && leaveRequest.status === 'Pending') {
                const { data: userData, error: userError } = await supabase
                    .from('profiles')
                    .select('leaves_taken_this_month, monthly_leave_quota')
                    .eq('id', userId)
                    .eq('org_id', orgId)
                    .single();

                if (!userError && userData) {
                    const newTaken = Math.max(0, (userData.leaves_taken_this_month || 0) - diffDays);
                    await supabase
                        .from('profiles')
                        .update({ leaves_taken_this_month: newTaken })
                        .eq('id', userId)
                        .eq('org_id', orgId);

                    // Update local remaining leaves state
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

    const handlePolicyView = async (policy) => {
        try {
            console.log('Attempting to view policy:', policy);

            if (!policy.file_url) {
                console.error('No file_url found in policy object');
                addToast('No document available to view', 'error');
                return;
            }

            addToast('Opening document...', 'info');

            // Extract file path from the storage URL
            let filePath;
            if (policy.file_url.includes('/policies/')) {
                filePath = policy.file_url.split('/policies/')[1];
            } else {
                filePath = policy.file_url.split('/').pop();
            }

            console.log('Viewing path:', filePath);

            // Create a signed URL valid for 60 seconds
            const { data, error } = await supabase.storage
                .from('policies')
                .createSignedUrl(filePath, 60);

            if (error) {
                console.error('Error creating signed URL:', error);
                throw error;
            }

            if (data?.signedUrl) {
                window.open(data.signedUrl, '_blank');
            } else {
                throw new Error('No signed URL returned');
            }

        } catch (error) {
            console.error('View error:', error);
            addToast(`Could not view document: ${error.message}`, 'error');
        }
    };

    const handlePolicyDownload = async (policy) => {
        try {
            console.log('Attempting to download policy:', policy);
            console.log('File URL:', policy.file_url);

            if (!policy.file_url) {
                console.error('No file_url found in policy object');
                addToast('No document available for this policy', 'error');
                return;
            }

            addToast('Downloading policy...', 'info');

            let filePath;
            if (policy.file_url.includes('/policies/')) {
                filePath = policy.file_url.split('/policies/')[1];
            } else {
                filePath = policy.file_url.split('/').pop();
            }

            console.log('Downloading from path:', filePath);

            const { data, error } = await supabase.storage
                .from('policies')
                .download(filePath);

            if (error) {
                console.error('Download error:', error);
                throw error;
            }

            if (!data) {
                throw new Error('No data returned from download');
            }

            console.log('Download successful, creating blob URL...');

            const pdfBlob = new Blob([data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(pdfBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${policy.name}.pdf`;
            document.body.appendChild(link);
            link.click();

            setTimeout(() => {
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
            }, 100);

            addToast(`${policy.name} downloaded successfully`, 'success');

        } catch (error) {
            console.error('Download error:', error);
            addToast(`Could not download: ${error.message || 'File missing'}`, 'error');
        }
    };

    const handleAction = (action, item) => {
        if (type === 'leaves' && action === 'Apply for Leave') {
            setLeaveFormData(prev => ({
                ...prev,
                leaveType: remainingLeaves <= 0 ? 'Loss of Pay' : 'Casual Leave'
            }));
            setShowApplyLeaveModal(true);
        } else if (type === 'leaves' && (action === 'Approve' || action === 'Reject')) {
            // Update local state first for immediate UI feedback
            setLeaveRequests(prevRequests =>
                prevRequests.map(request =>
                    request.id === item.id
                        ? { ...request, status: action === 'Approve' ? 'Approved' : 'Rejected' }
                        : request
                )
            );

            // Notify the employee about the status update
            const notifyEmployee = async () => {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                const notification = {
                    receiver_id: item.employee_id, // The employee who requested leave
                    sender_id: user.id,            // The manager (current user)
                    sender_name: userName || 'Manager',
                    message: `Your leave request has been ${action} by ${userName || 'Manager'}`,
                    type: 'leave_status_update',
                    is_read: false,
                    created_at: new Date().toISOString()
                };

                const { error } = await supabase.from('notifications').insert([{ ...notification, org_id: orgId }]);
                if (error) console.error('Error sending approval notification:', error);
            };
            notifyEmployee();

            addToast(`Leave request ${action.toLowerCase()}d for ${item.name}`, 'success');
        } else if (action === 'View Team Member') {
            setSelectedEmployee(item);
            setShowEmployeeModal(true);
        } else if (action === 'View Candidate') {
            setSelectedCandidate(item);
            setShowCandidateModal(true);
        } else {
            addToast(`${action} clicked${item ? ` for ${item.name || item.id}` : ''}`, 'info');
        }
    };

    const handleApplyLeave = async (e) => {
        e.preventDefault();

        if (!userId) {
            addToast('User ID not found. Please log in again.', 'error');
            return;
        }

        try {
            // Fetch the latest team_id from profile to ensure validity
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('team_id')
                .eq('id', userId)
                .eq('org_id', orgId)
                .single();

            if (profileError) {
                console.warn('Could not fetch latest team_id, using context fallback', profileError);
            }

            const currentTeamId = profileData?.team_id || null;
            console.log('Submitting leave with team_id:', currentTeamId);

            let insertError = null;

            // Attempt 1: Try with the fetched team_id
            const { error: attempt1Error } = await supabase
                .from('leaves')
                .insert([
                    {
                        employee_id: userId,
                        org_id: orgId,
                        team_id: currentTeamId,
                        from_date: leaveFormData.startDate,
                        to_date: leaveFormData.endDate,
                        reason: `${leaveFormData.leaveType}: ${leaveFormData.reason}`,
                        status: 'pending'
                    }
                ]);

            if (attempt1Error) {
                console.warn('Attempt 1 with team_id failed:', attempt1Error);

                // Check if it looks like an FK violation (409 or explicit FK message)
                if (attempt1Error.code === '23503' || attempt1Error.code === '409' || attempt1Error.message?.includes('violates foreign key constraint')) {
                    console.log('Retrying with team_id: null due to FK violation...');

                    // Attempt 2: Retry with team_id = null
                    const { error: attempt2Error } = await supabase
                        .from('leaves')
                        .insert([
                            {
                                employee_id: userId,
                                org_id: orgId,
                                team_id: null,
                                from_date: leaveFormData.startDate,
                                to_date: leaveFormData.endDate,
                                reason: `${leaveFormData.leaveType}: ${leaveFormData.reason}`,
                                status: 'pending'
                            }
                        ]);

                    if (attempt2Error) {
                        insertError = attempt2Error; // Both failed
                    }
                } else {
                    insertError = attempt1Error; // Not an FK error, so just fail
                }
            }

            if (insertError) throw insertError;

            // if (error) throw error; // Removed undefined variable reference

            // Calculate duration for update
            const start = new Date(leaveFormData.startDate);
            const end = new Date(leaveFormData.endDate);
            const diffTime = Math.abs(end - start);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

            // 2. Only update quota/balance if NOT 'Loss of Pay'
            if (leaveFormData.leaveType !== 'Loss of Pay') {
                // Fetch current user data to get leave balance and quota
                const { data: userData, error: userError } = await supabase
                    .from('profiles')
                    .select('monthly_leave_quota, leaves_taken_this_month')
                    .eq('id', userId)
                    .eq('org_id', orgId)
                    .single();

                if (userError) throw userError;

                // 3. Update 'leaves_taken_this_month' in profiles
                // Note: 'leaves_remaining' is a GENERATED COLUMN in the DB, so we cannot update it manually.
                // It will auto-calculate based on quota - taken.
                const newTaken = (userData.leaves_taken_this_month || 0) + diffDays;

                // Calculate newRemaining locally for UI update
                const quota = userData.monthly_leave_quota || 0;
                const newRemaining = Math.max(0, quota - newTaken);

                const { error: updateError } = await supabase
                    .from('profiles')
                    .update({
                        leaves_taken_this_month: newTaken
                    })
                    .eq('id', userId)
                    .eq('org_id', orgId);

                if (updateError) throw updateError;

                // Update local state for remaining leaves instantly
                setRemainingLeaves(newRemaining);
            }

            // --- NOTIFICATION LOGIC START ---
            try {
                // Explicitly get current user to ensure we have the correct ID for sender_id
                const { data: { user: currentUser } } = await supabase.auth.getUser();
                const senderId = currentUser?.id || userId; // Fallback to context ID if fetch fails (unlikely)

                // 1. Find Managers/Team Leads of this team
                const { data: managers } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('team_id', teamId)
                    .eq('org_id', orgId)
                    .in('role', ['manager', 'team_lead']);

                // 2. Find All Executives
                const { data: executives } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('org_id', orgId)
                    .eq('role', 'executive');

                // 3. Combine recipients (Manager + Executives), excluding current user
                const recipientIds = new Set();

                managers?.forEach(m => recipientIds.add(m.id));
                executives?.forEach(e => recipientIds.add(e.id));
                recipientIds.delete(senderId); // Don't notify self

                if (recipientIds.size > 0) {
                    const notificationRecords = Array.from(recipientIds).map(receiverId => ({
                        receiver_id: receiverId,
                        sender_id: senderId, // <--- Now using the explicitly fetched ID
                        org_id: orgId,
                        sender_name: userName || 'Employee',
                        message: `${userName || 'Employee'} has applied for ${leaveFormData.leaveType}`,
                        type: 'leave_request',
                        is_read: false,
                        created_at: new Date().toISOString()
                    }));

                    const { error: notifError } = await supabase
                        .from('notifications')
                        .insert(notificationRecords);

                    if (notifError) console.error('Error sending notifications:', notifError);
                    else console.log('Notifications sent to:', Array.from(recipientIds));
                }
            } catch (notifErr) {
                console.error('Notification logic failed:', notifErr);
                // Don't block the main success flow
            }
            // --- NOTIFICATION LOGIC END ---

            addToast('Leave application submitted successfully', 'success');
            setShowApplyLeaveModal(false);
            setLeaveFormData({
                leaveType: 'Casual Leave',
                startDate: '',
                endDate: '',
                reason: ''
            });

            // Refresh leaves list
            const { data: newLeaves, error: fetchError } = await supabase
                .from('leaves')
                .select('*')
                .eq('employee_id', userId)
                .eq('org_id', orgId)
                .order('created_at', { ascending: false });

            if (!fetchError && newLeaves) {
                const mappedLeaves = newLeaves.map(leave => {
                    const start = new Date(leave.from_date);
                    const end = new Date(leave.to_date);
                    const diffTime = Math.abs(end - start);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

                    let type = 'Leave';
                    let reason = leave.reason || '';
                    if (reason.includes(':')) {
                        type = reason.split(':')[0];
                    }

                    // Normalize status for display (capitalized)
                    const status = leave.status ? leave.status.charAt(0).toUpperCase() + leave.status.slice(1).toLowerCase() : 'Pending';

                    return {
                        id: leave.id,
                        employee_id: leave.employee_id,
                        name: userName,
                        type: type,
                        reason: leave.reason || 'No reason provided', // Include full reason from DB
                        startDate: leave.from_date,
                        endDate: leave.to_date,
                        duration: diffDays === 1 ? '1 Day' : `${diffDays} Days`,
                        dates: start.toDateString() === end.toDateString()
                            ? start.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })
                            : `${start.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}`,
                        status: status,
                        appliedOn: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
                        created_at: new Date().toISOString()
                    };
                });
                // Sort by status (Pending first) then by created_at
                mappedLeaves.sort((a, b) => {
                    if (a.status === 'Pending' && b.status !== 'Pending') return -1;
                    if (a.status !== 'Pending' && b.status === 'Pending') return 1;
                    return new Date(b.created_at) - new Date(a.created_at);
                });
                setLeaveRequests(mappedLeaves);
            }

        } catch (error) {
            console.error('Error submitting leave:', error);
            addToast('Failed to submit leave request: ' + error.message, 'error');
        }
    };

    // Render specific demos for certain types
    if (type === 'analytics') return <AnalyticsDemo />;
    if (type === 'tasks') return <TaskLifecyclePage userRole={userRole} userId={userId} addToast={addToast} projectRole={projectRole} currentProjectId={currentProject?.id} teamId={teamId} orgId={orgId} />;
    if (title === 'Team Hierarchy' || title === 'Organizational Hierarchy' || title === 'Hierarchy') return <HierarchyDemo />;
    if (title === 'Project Hierarchy') return <ProjectHierarchyDemo />;
    if (title === 'Settings') return <SettingsDemo />;
    if (title === 'Announcements') return <AnnouncementsPage userRole={userRole} userId={userId} orgId={orgId} />;
    if (type === 'status') return <StatusDemo />;
    if (type === 'project-documents') return <ProjectDocuments />;
    if (type === 'payroll') return <PayslipsPage userRole={userRole} userId={userId} addToast={addToast} orgId={orgId} />;

    // Helper to filter data by team
    const filterData = (data) => {
        // For leaves, we want to show all the user's leaves, not filter by team
        if (type === 'leaves') return data;

        if (!currentTeam || currentTeam === 'All') return data;
        return data.filter(item => item.dept === currentTeam || item.department === currentTeam);
    };

    // Mock Data Configurations
    const configs = {
        workforce: {
            columns: [
                {
                    header: 'Team Member Name', accessor: 'name', render: (row) => (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                {row.name.charAt(0)}
                            </div>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <p style={{ fontWeight: 500 }}>{row.name}</p>
                                    {row.isProjectManager && (
                                        <span style={{
                                            fontSize: '0.65rem',
                                            fontWeight: '700',
                                            color: '#fff',
                                            backgroundColor: '#8b5cf6',
                                            padding: '2px 8px',
                                            borderRadius: '12px',
                                            boxShadow: '0 2px 4px rgba(139,92,246,0.2)'
                                        }}>
                                            Project Manager
                                        </span>
                                    )}
                                </div>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{row.email}</p>
                            </div>
                        </div>
                    )
                },
                { header: 'Role', accessor: 'role' },
                { header: 'Department', accessor: 'dept' },
                {
                    header: 'Status', accessor: 'status', render: (row) => {
                        let bgColor, textColor;
                        if (row.status === 'Active') {
                            bgColor = '#dcfce7'; textColor = '#166534';
                        } else if (row.status === 'On Leave') {
                            bgColor = '#fef3c7'; textColor = '#b45309';
                        } else {
                            bgColor = '#f1f5f9'; textColor = '#64748b';
                        }
                        return (
                            <span style={{
                                padding: '4px 8px',
                                borderRadius: '12px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                backgroundColor: bgColor,
                                color: textColor
                            }}>
                                {row.status}
                            </span>
                        );
                    }
                },
                { header: 'Join Date', accessor: 'joinDate' },
                {
                    header: 'Actions', accessor: 'actions', render: (row) => (
                        <button
                            onClick={() => handleAction('View Team Member', row)}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                backgroundColor: '#e0f2fe',
                                color: '#075985',
                                border: '1px solid #7dd3fc',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#bae6fd'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#e0f2fe'}
                        >
                            <Eye size={14} />
                            View
                        </button>
                    )
                },
            ],

            data: teamMembers
        },
        status: {
            columns: [
                { header: 'Team Member', accessor: 'name' },
                { header: 'Department', accessor: 'dept' },
                {
                    header: 'Availability', accessor: 'availability', render: (row) => (
                        <span style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            color: row.availability === 'Online' ? 'var(--success)' : row.availability === 'Away' ? 'var(--warning)' : 'var(--text-secondary)',
                            fontWeight: 600
                        }}>
                            <span style={{
                                width: '8px', height: '8px', borderRadius: '50%',
                                backgroundColor: row.availability === 'Online' ? 'var(--success)' : row.availability === 'Away' ? 'var(--warning)' : 'var(--text-secondary)'
                            }}></span>
                            {row.availability}
                        </span>
                    )
                },
                { header: 'Current Task', accessor: 'task' },
                { header: 'Last Active', accessor: 'lastActive' },
            ],

            data: filterData([]).filter(item => item.name === userName)
        },
        recruitment: {
            columns: [
                { header: 'Candidate', accessor: 'name' },
                { header: 'Applied For', accessor: 'role' },
                {
                    header: 'Stage', accessor: 'stage', render: (row) => (
                        <span style={{
                            padding: '4px 8px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            backgroundColor: '#e0f2fe',
                            color: '#075985'
                        }}>
                            {row.stage}
                        </span>
                    )
                },
                {
                    header: 'Score', accessor: 'score', render: (row) => (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ flex: 1, height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', width: '60px' }}>
                                <div style={{ width: `${row.score}%`, height: '100%', backgroundColor: row.score > 80 ? 'var(--success)' : 'var(--warning)', borderRadius: '3px' }}></div>
                            </div>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{row.score}%</span>
                        </div>
                    )
                },
                { header: 'Source', accessor: 'source' },
                {
                    header: 'Actions', accessor: 'actions', render: (row) => (
                        <button
                            onClick={() => handleAction('View Candidate', row)}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                backgroundColor: '#e0f2fe',
                                color: '#075985',
                                border: '1px solid #7dd3fc',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#bae6fd'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#e0f2fe'}
                        >
                            <Eye size={14} />
                            View
                        </button>
                    )
                },
            ],
            data: []
        },
        leaves: {
            columns: [
                { header: 'Team Member', accessor: 'name' },
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
                { header: 'Applied On', accessor: 'appliedOn' },
                {
                    header: 'Actions', accessor: 'actions', render: (row) => (
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={() => handleViewLeave(row)}
                                style={{
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    backgroundColor: '#e0f2fe',
                                    color: '#075985',
                                    border: '1px solid #7dd3fc',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#bae6fd'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#e0f2fe'}
                            >
                                <Eye size={14} />
                                View
                            </button>
                            {row.status === 'Pending' && (
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
                            )}
                        </div>
                    )
                },

            ],
            data: leaveRequests // Now we use the state directly which is already filtered by userId in fetch
        },
        payroll: {
            columns: [
                { header: 'Team Member', accessor: 'name' },
                { header: 'Month', accessor: 'month' },
                { header: 'Net Salary', accessor: 'salary' },
                {
                    header: 'Status', accessor: 'status', render: (row) => (
                        <span style={{ color: 'var(--success)', fontWeight: 600 }}>{row.status}</span>
                    )
                },
                { header: 'Payslip', accessor: 'action', render: () => <span style={{ color: 'var(--accent)', cursor: 'pointer' }}>Download</span> }
            ],
            data: [].filter(item => item.name === userName)
        },
        policies: {
            columns: [
                { header: 'Policy Name', accessor: 'name' },
                { header: 'Category', accessor: 'category' },
                { header: 'Effective Date', accessor: 'effectiveDate' },
                {
                    header: 'Status', accessor: 'status', render: (row) => (
                        <span style={{ color: row.status === 'Active' ? 'var(--success)' : 'var(--text-secondary)', fontWeight: 600 }}>{row.status}</span>
                    )
                },
                {
                    header: 'View',
                    accessor: 'view',
                    render: (row) => (
                        <button
                            onClick={() => handlePolicyView(row)}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '8px',
                                fontSize: '0.875rem',
                                fontWeight: 600,
                                backgroundColor: '#e0f2fe',
                                color: '#0369a1',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'all 0.2s',
                                boxShadow: 'var(--shadow-sm)'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#bae6fd';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#e0f2fe';
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                            }}
                        >
                            <Eye size={16} />
                            View
                        </button>
                    )
                },
                {
                    header: 'Download',
                    accessor: 'download',
                    render: (row) => (
                        <button
                            onClick={() => handlePolicyDownload(row)}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '8px',
                                fontSize: '0.875rem',
                                fontWeight: 600,
                                backgroundColor: '#7c3aed',
                                color: 'white',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'all 0.2s',
                                boxShadow: 'var(--shadow-sm)'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#6d28d9';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#7c3aed';
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                            }}
                        >
                            <Download size={16} />
                            Download
                        </button>
                    )
                }
            ],
            data: policies
        },
        // Default fallback for other modules
        default: {
            columns: [
                { header: 'Item Name', accessor: 'name' },
                { header: 'Description', accessor: 'desc' },
                { header: 'Date', accessor: 'date' },
                { header: 'Status', accessor: 'status' },
            ],
            data: []
        }
    };

    const config = configs[type] || configs.default;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Premium Header with Mesh Background */}
            <div style={{
                position: 'relative',
                padding: '20px 24px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                marginBottom: '16px',
                overflow: 'hidden',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'
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
                            <span>Dashboard</span>
                            <span>/</span>
                            <span style={{ color: '#38bdf8' }}>{title}</span>
                        </div>
                        <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'white', letterSpacing: '-0.02em', marginBottom: '4px' }}>
                            {title}
                        </h1>
                        <p style={{ color: '#94a3b8', fontSize: '0.9rem', maxWidth: '600px' }}>
                            {type === 'leaves' ? 'Manage your time off and track your leave allowance.' : `Management portal for your organizational ${title.toLowerCase()}`}
                        </p>
                    </div>

                    {type === 'leaves' && (
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
                    )}
                </div>
            </div>

            {
                type === 'leaves' && (
                    <div style={{
                        background: 'white',
                        padding: '16px',
                        borderRadius: '16px',
                        border: '1px solid #f1f5f9',
                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                        marginBottom: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
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
                                Available Allowance
                            </p>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                <span style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a' }}>{remainingLeaves}</span>
                                <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#94a3b8' }}>Days Remaining</span>
                            </div>
                        </div>
                        <div style={{ position: 'absolute', right: '-20px', top: '-20px', zIndex: 0, opacity: 0.03 }}>
                            <Briefcase size={180} />
                        </div>
                    </div>
                )
            }

            {/* Render KanbanDemo for tasks, DataTable for others */}
            {
                type === 'tasks' ? (
                    <KanbanDemo />
                ) : (
                    <>
                        {/* ProjectDocuments removed from workforce view */}
                        <DataTable
                            title={`${title} List`}
                            columns={config.columns}
                            data={config.data}
                            onAction={handleAction}
                        />
                    </>
                )
            }

            {/* Apply Leave Modal - Redesigned */}
            {
                showApplyLeaveModal && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.6)',
                        backdropFilter: 'blur(4px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 1000,
                        animation: 'fadeIn 0.2s ease-out'
                    }}>
                        <div style={{
                            backgroundColor: 'var(--surface)',
                            padding: '24px',
                            borderRadius: '24px',
                            width: '500px',
                            maxWidth: '90%',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                            border: '1px solid var(--border)'
                        }}>
                            {/* Current Apply Leave Modal Content... Keeping it intact but ensuring structure is correct */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '4px' }}>Request Leave</h3>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Fill in the details below to submit your request.</p>
                                </div>
                                <button
                                    onClick={() => setShowApplyLeaveModal(false)}
                                    style={{
                                        background: 'var(--background)',
                                        border: 'none',
                                        borderRadius: '50%',
                                        width: '40px',
                                        height: '40px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        color: 'var(--text-secondary)',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fee2e2'; e.currentTarget.style.color = '#ef4444'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--background)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleApplyLeave} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                                {/* Leave Type */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Leave Type</label>
                                    <div style={{ position: 'relative' }}>
                                        <select
                                            value={leaveFormData.leaveType}
                                            onChange={(e) => setLeaveFormData({ ...leaveFormData, leaveType: e.target.value })}
                                            style={{
                                                width: '100%',
                                                padding: '14px 16px',
                                                borderRadius: '12px',
                                                border: '2px solid var(--border)',
                                                fontSize: '1rem',
                                                backgroundColor: 'var(--background)',
                                                color: 'var(--text-primary)',
                                                appearance: 'none',
                                                cursor: 'pointer',
                                                transition: 'border-color 0.2s'
                                            }}
                                            onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                                            onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                                            required
                                            disabled={remainingLeaves <= 0}
                                        >
                                            <option value="Casual Leave">Casual Leave</option>
                                            <option value="Sick Leave">Sick Leave</option>
                                            <option value="Vacation">Vacation</option>
                                            <option value="Personal Leave">Personal Leave</option>
                                            <option value="Loss of Pay">Loss of Pay</option>
                                        </select>
                                        <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }}>
                                            <Briefcase size={18} />
                                        </div>
                                    </div>
                                </div>

                                {/* Dates Grid */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Start Date</label>
                                        <input
                                            type="date"
                                            value={leaveFormData.startDate}
                                            onChange={(e) => setLeaveFormData({ ...leaveFormData, startDate: e.target.value })}
                                            style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '2px solid var(--border)', fontSize: '1rem', backgroundColor: 'var(--background)', color: 'var(--text-primary)', outline: 'none', transition: 'border-color 0.2s' }}
                                            onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                                            onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>End Date</label>
                                        <input
                                            type="date"
                                            value={leaveFormData.endDate}
                                            onChange={(e) => setLeaveFormData({ ...leaveFormData, endDate: e.target.value })}
                                            min={leaveFormData.startDate}
                                            style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '2px solid var(--border)', fontSize: '1rem', backgroundColor: 'var(--background)', color: 'var(--text-primary)', outline: 'none', transition: 'border-color 0.2s' }}
                                            onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                                            onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Reason */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Reason</label>
                                    <textarea
                                        value={leaveFormData.reason}
                                        onChange={(e) => setLeaveFormData({ ...leaveFormData, reason: e.target.value })}
                                        placeholder="Please provide a valid reason for your leave request..."
                                        rows="4"
                                        style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '2px solid var(--border)', fontSize: '1rem', backgroundColor: 'var(--background)', color: 'var(--text-primary)', resize: 'vertical', outline: 'none', transition: 'border-color 0.2s' }}
                                        onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                                        onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                                        required
                                    />
                                </div>

                                {/* Actions */}
                                <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setShowApplyLeaveModal(false)}
                                        style={{
                                            flex: 1,
                                            padding: '14px',
                                            borderRadius: '12px',
                                            fontWeight: 600,
                                            border: 'none',
                                            backgroundColor: 'var(--background)',
                                            color: 'var(--text-secondary)',
                                            cursor: 'pointer',
                                            transition: 'background-color 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.target.style.backgroundColor = '#e2e8f0'}
                                        onMouseLeave={(e) => e.target.style.backgroundColor = 'var(--background)'}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        style={{
                                            flex: 1,
                                            padding: '14px',
                                            borderRadius: '12px',
                                            fontWeight: 600,
                                            backgroundColor: 'var(--primary)',
                                            color: 'white',
                                            border: 'none',
                                            cursor: 'pointer',
                                            boxShadow: 'var(--shadow-md)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            transition: 'transform 0.1s'
                                        }}
                                        onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
                                        onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                    >
                                        Submit Request <Calendar size={18} />
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Leave Details Modal (Read Only) */}
            {
                showLeaveDetailsModal && selectedLeaveRequest && (
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
                        zIndex: 1000
                    }}>
                        <div style={{
                            backgroundColor: 'white',
                            borderRadius: '16px',
                            padding: '32px',
                            maxWidth: '800px',
                            width: '90%',
                            maxHeight: '90vh',
                            overflowY: 'auto',
                            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
                        }}>
                            {/* Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                                    Leave Request Details
                                </h3>
                                <button
                                    onClick={() => setShowLeaveDetailsModal(false)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        padding: '8px',
                                        borderRadius: '8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Employee Info */}
                            <div style={{ marginBottom: '32px', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '12px' }}>
                                <h4 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '16px', color: 'var(--text-primary)' }}>
                                    Employee Information
                                </h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Name</p>
                                        <p style={{ fontSize: '1rem', fontWeight: 600 }}>{selectedLeaveRequest.name}</p>
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Leave Type</p>
                                        <p style={{ fontSize: '1rem', fontWeight: 600 }}>{selectedLeaveRequest.type}</p>
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Duration</p>
                                        <p style={{ fontSize: '1rem', fontWeight: 600 }}>{selectedLeaveRequest.duration}</p>
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Dates</p>
                                        <p style={{ fontSize: '1rem', fontWeight: 600 }}>{selectedLeaveRequest.dates}</p>
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Status</p>
                                        <span style={{
                                            padding: '4px 12px',
                                            borderRadius: '12px',
                                            fontSize: '0.875rem',
                                            fontWeight: 600,
                                            backgroundColor: selectedLeaveRequest.status === 'Approved' ? '#dcfce7' :
                                                selectedLeaveRequest.status === 'Pending' ? '#fef3c7' : '#fee2e2',
                                            color: selectedLeaveRequest.status === 'Approved' ? '#166534' :
                                                selectedLeaveRequest.status === 'Pending' ? '#b45309' : '#991b1b'
                                        }}>
                                            {selectedLeaveRequest.status}
                                        </span>
                                    </div>
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Reason</p>
                                        <p style={{ fontSize: '1rem', fontWeight: 600, lineHeight: '1.5' }}>{selectedLeaveRequest.reason}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Tasks During Leave */}
                            <div style={{ marginBottom: '24px' }}>
                                <h4 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '16px', color: 'var(--text-primary)' }}>
                                    Tasks During Leave Period
                                </h4>
                                {employeeTasks.length > 0 ? (
                                    <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead style={{ backgroundColor: '#f8fafc' }}>
                                                <tr>
                                                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600 }}>Task</th>
                                                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600 }}>Due Date</th>
                                                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600 }}>Priority</th>
                                                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600 }}>Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {employeeTasks.map((task, index) => (
                                                    <tr key={task.id} style={{ borderTop: '1px solid var(--border)' }}>
                                                        <td style={{ padding: '12px', fontSize: '0.875rem' }}>{task.title}</td>
                                                        <td style={{ padding: '12px', fontSize: '0.875rem' }}>
                                                            {new Date(task.due_date).toLocaleDateString()}
                                                        </td>
                                                        <td style={{ padding: '12px' }}>
                                                            <span style={{
                                                                padding: '2px 8px',
                                                                borderRadius: '6px',
                                                                fontSize: '0.75rem',
                                                                fontWeight: 600,
                                                                backgroundColor: task.priority === 'High' ? '#fee2e2' :
                                                                    task.priority === 'Medium' ? '#fef3c7' : '#e0f2fe',
                                                                color: task.priority === 'High' ? '#991b1b' :
                                                                    task.priority === 'Medium' ? '#b45309' : '#075985'
                                                            }}>
                                                                {task.priority}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '12px', fontSize: '0.875rem' }}>{task.status}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div style={{
                                        padding: '32px',
                                        textAlign: 'center',
                                        backgroundColor: '#f8fafc',
                                        borderRadius: '12px',
                                        color: 'var(--text-secondary)'
                                    }}>
                                        No tasks scheduled during this leave period
                                    </div>
                                )}
                            </div>

                            {/* Action Buttons - Close Only */}
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => setShowLeaveDetailsModal(false)}
                                    style={{
                                        padding: '10px 20px',
                                        borderRadius: '8px',
                                        fontSize: '0.875rem',
                                        fontWeight: 600,
                                        backgroundColor: '#f1f5f9',
                                        color: '#64748b',
                                        border: '1px solid #e2e8f0',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Employee Details Modal */}
            {
                showEmployeeModal && selectedEmployee && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                        <div style={{ backgroundColor: 'var(--surface)', borderRadius: '16px', width: '600px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>
                            {/* Header */}
                            <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Team Member Details</h3>
                                <button onClick={() => setShowEmployeeModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Employee Info */}
                            <div style={{ padding: '32px' }}>
                                {/* Profile Section */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '32px' }}>
                                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 'bold', color: '#075985', overflow: 'hidden' }}>
                                        {selectedEmployee.avatar_url ? (
                                            <img src={selectedEmployee.avatar_url} alt={selectedEmployee.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            selectedEmployee.name.charAt(0)
                                        )}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <h4 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '4px' }}>{selectedEmployee.name}</h4>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '8px' }}>{selectedEmployee.role}</p>
                                        <span style={{
                                            padding: '4px 12px',
                                            borderRadius: '12px',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            backgroundColor: selectedEmployee.status === 'Active' ? '#dcfce7' : '#fee2e2',
                                            color: selectedEmployee.status === 'Active' ? '#166534' : '#991b1b'
                                        }}>
                                            {selectedEmployee.status}
                                        </span>
                                    </div>
                                </div>

                                {/* Contact Information */}
                                <div style={{ marginBottom: '32px' }}>
                                    <h5 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '16px', color: 'var(--text-primary)' }}>Contact Information</h5>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Mail size={18} color="#075985" />
                                            </div>
                                            <div>
                                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>Email</p>
                                                <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>{selectedEmployee.email}</p>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Phone size={18} color="#075985" />
                                            </div>
                                            <div>
                                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>Phone</p>
                                                <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>{selectedEmployee.phone || 'N/A'}</p>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <MapPin size={18} color="#075985" />
                                            </div>
                                            <div>
                                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>Location</p>
                                                <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>{selectedEmployee.location || 'N/A'}</p>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Calendar size={18} color="#075985" />
                                            </div>
                                            <div>
                                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>Join Date</p>
                                                <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>{selectedEmployee.joinDate}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Work Information */}
                                <div style={{ marginBottom: '32px' }}>
                                    <h5 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '16px', color: 'var(--text-primary)' }}>Work Information</h5>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                        <div style={{ padding: '16px', backgroundColor: 'var(--background)', borderRadius: '12px' }}>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Department</p>
                                            <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>{selectedEmployee.departmentName}</p>
                                        </div>
                                        <div style={{ padding: '16px', backgroundColor: 'var(--background)', borderRadius: '12px' }}>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Project</p>
                                            <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>{selectedEmployee.dept}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Performance Metrics */}
                                <div>
                                    <h5 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '16px', color: 'var(--text-primary)' }}>Performance Metrics</h5>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                                        <div style={{ padding: '16px', backgroundColor: '#dcfce7', borderRadius: '12px', textAlign: 'center' }}>
                                            <p style={{ fontSize: '0.75rem', color: '#166534', marginBottom: '4px', fontWeight: 600 }}>PERFORMANCE</p>
                                            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#166534' }}>{selectedEmployee.performance || 'N/A'}</p>
                                        </div>
                                        <div style={{ padding: '16px', backgroundColor: '#e0f2fe', borderRadius: '12px', textAlign: 'center' }}>
                                            <p style={{ fontSize: '0.75rem', color: '#075985', marginBottom: '4px', fontWeight: 600 }}>PROJECTS</p>
                                            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#075985' }}>{selectedEmployee.projects || 0}</p>
                                        </div>
                                        <div style={{ padding: '16px', backgroundColor: '#fef3c7', borderRadius: '12px', textAlign: 'center' }}>
                                            <p style={{ fontSize: '0.75rem', color: '#b45309', marginBottom: '4px', fontWeight: 600 }}>TASKS DONE</p>
                                            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#b45309' }}>{selectedEmployee.tasksCompleted || 0}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => setShowEmployeeModal(false)}
                                    style={{ padding: '10px 20px', borderRadius: '8px', fontWeight: 600, backgroundColor: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer' }}
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Candidate Details Modal */}
            {
                showCandidateModal && selectedCandidate && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                        <div style={{ backgroundColor: 'var(--surface)', borderRadius: '16px', width: '650px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>
                            {/* Header */}
                            <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Candidate Details</h3>
                                <button onClick={() => setShowCandidateModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Candidate Info */}
                            <div style={{ padding: '32px' }}>
                                {/* Profile Section */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '32px' }}>
                                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 'bold', color: '#b45309' }}>
                                        {selectedCandidate.name.charAt(0)}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <h4 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '4px' }}>{selectedCandidate.name}</h4>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '8px' }}>Applied for: {selectedCandidate.role}</p>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <span style={{
                                                padding: '4px 12px',
                                                borderRadius: '12px',
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                backgroundColor: '#e0f2fe',
                                                color: '#075985'
                                            }}>
                                                {selectedCandidate.stage}
                                            </span>
                                            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                                Score: <strong style={{ color: selectedCandidate.score > 80 ? 'var(--success)' : 'var(--warning)' }}>{selectedCandidate.score}%</strong>
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Contact Information */}
                                <div style={{ marginBottom: '32px' }}>
                                    <h5 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '16px', color: 'var(--text-primary)' }}>Contact Information</h5>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Mail size={18} color="#b45309" />
                                            </div>
                                            <div>
                                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>Email</p>
                                                <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>{selectedCandidate.email}</p>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Phone size={18} color="#b45309" />
                                            </div>
                                            <div>
                                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>Phone</p>
                                                <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>{selectedCandidate.phone}</p>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <MapPin size={18} color="#b45309" />
                                            </div>
                                            <div>
                                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>Location</p>
                                                <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>{selectedCandidate.location}</p>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Calendar size={18} color="#b45309" />
                                            </div>
                                            <div>
                                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>Applied Date</p>
                                                <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>{selectedCandidate.appliedDate}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Qualifications */}
                                <div style={{ marginBottom: '32px' }}>
                                    <h5 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '16px', color: 'var(--text-primary)' }}>Qualifications</h5>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                        <div style={{ padding: '16px', backgroundColor: 'var(--background)', borderRadius: '12px' }}>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Experience</p>
                                            <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>{selectedCandidate.experience}</p>
                                        </div>
                                        <div style={{ padding: '16px', backgroundColor: 'var(--background)', borderRadius: '12px' }}>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Education</p>
                                            <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>{selectedCandidate.education}</p>
                                        </div>
                                        <div style={{ padding: '16px', backgroundColor: 'var(--background)', borderRadius: '12px' }}>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Expected Salary</p>
                                            <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>{selectedCandidate.expectedSalary}</p>
                                        </div>
                                        <div style={{ padding: '16px', backgroundColor: 'var(--background)', borderRadius: '12px' }}>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Availability</p>
                                            <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>{selectedCandidate.availability}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Skills */}
                                {selectedCandidate.skills && (
                                    <div style={{ marginBottom: '32px' }}>
                                        <h5 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '12px', color: 'var(--text-primary)' }}>Skills</h5>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                            {selectedCandidate.skills.map((skill, index) => (
                                                <span key={index} style={{ padding: '6px 16px', borderRadius: '8px', backgroundColor: '#fef3c7', color: '#b45309', fontSize: '0.875rem', fontWeight: 500 }}>
                                                    {skill}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Application Details */}
                                <div style={{ marginBottom: '24px' }}>
                                    <h5 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '16px', color: 'var(--text-primary)' }}>Application Details</h5>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                                        <div style={{ padding: '16px', backgroundColor: '#e0f2fe', borderRadius: '12px', textAlign: 'center' }}>
                                            <p style={{ fontSize: '0.75rem', color: '#075985', marginBottom: '4px', fontWeight: 600 }}>SOURCE</p>
                                            <p style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#075985' }}>{selectedCandidate.source}</p>
                                        </div>
                                        <div style={{ padding: '16px', backgroundColor: '#dcfce7', borderRadius: '12px', textAlign: 'center' }}>
                                            <p style={{ fontSize: '0.75rem', color: '#166534', marginBottom: '4px', fontWeight: 600 }}>INTERVIEW SCORE</p>
                                            <p style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#166534' }}>{selectedCandidate.score}%</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Notes */}
                                {selectedCandidate.notes && (
                                    <div>
                                        <h5 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '12px', color: 'var(--text-primary)' }}>Interview Notes</h5>
                                        <div style={{ padding: '16px', backgroundColor: 'var(--background)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                            <p style={{ fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-primary)' }}>{selectedCandidate.notes}</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                <button
                                    onClick={() => setShowCandidateModal(false)}
                                    style={{ padding: '10px 20px', borderRadius: '8px', fontWeight: 600, border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--text-primary)', cursor: 'pointer' }}
                                >
                                    Close
                                </button>
                                <button
                                    onClick={() => {
                                        addToast(`Action for ${selectedCandidate.name}`, 'info');
                                        setShowCandidateModal(false);
                                    }}
                                    style={{ padding: '10px 20px', borderRadius: '8px', fontWeight: 600, backgroundColor: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer' }}
                                >
                                    Schedule Interview
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default ModulePage;
