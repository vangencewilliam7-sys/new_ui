import React, { useState } from 'react';
import { Plus, X, Eye, Mail, Phone, MapPin, Calendar, Briefcase, Download } from 'lucide-react';
import DataTable from '../components/UI/DataTable';
import { useToast } from '../context/ToastContext';
import AnalyticsDemo from '../components/Demo/AnalyticsDemo';
import KanbanDemo from '../components/Demo/KanbanDemo';
import TaskLifecyclePage from '../../shared/TaskLifecyclePage';
import AllTasksView from '../../shared/AllTasksView';
import HierarchyDemo from '../components/Demo/HierarchyDemo';
import SettingsDemo from '../components/Demo/SettingsDemo';
import AuditLogsDemo from '../components/Demo/AuditLogsDemo';
import ProjectHierarchyDemo from '../../shared/ProjectHierarchyDemo';
import { AddEmployeeModal } from '../../shared/AddEmployeeModal';
import { supabase } from '../../../lib/supabaseClient';
import PayslipsPage from '../../shared/PayslipsPage';
import PayrollPage from '../../shared/PayrollPage';
import AnnouncementsPage from '../../shared/AnnouncementsPage';
import { AddPolicyModal } from '../../shared/AddPolicyModal';
import { useUser } from '../context/UserContext';
import { useProject } from '../../employee/context/ProjectContext';
import ProjectDocuments from '../../employee/pages/ProjectDocuments';

const ModulePage = ({ title, type }) => {
    const { addToast } = useToast();
    const { userId, userRole } = useUser();
    const { currentProject, projectRole } = useProject();

    // State for leave requests
    // State for leave requests
    const [leaveRequests, setLeaveRequests] = useState([]);

    // ... (rest of states remain same)

    // State for Leave Details modal
    const [selectedLeaveRequest, setSelectedLeaveRequest] = useState(null);
    const [showLeaveDetailsModal, setShowLeaveDetailsModal] = useState(false);
    const [employeeTasks, setEmployeeTasks] = useState([]);

    // ... (rest of states)

    const [remainingLeaves, setRemainingLeaves] = useState(0);

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

    // Data State
    const [employees, setEmployees] = useState([]);
    const [employeeStatus, setEmployeeStatus] = useState([]);
    const [dbLeaves, setDbLeaves] = useState([]);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // State for Policies
    const [policies, setPolicies] = useState([]);
    const [showAddPolicyModal, setShowAddPolicyModal] = useState(false);


    React.useEffect(() => {
        const fetchData = async () => {
            try {
                if (type === 'workforce') {
                    let userIdsToFetch = null;

                    // Filter by Project if selected
                    if (currentProject?.id) {
                        const { data: members } = await supabase
                            .from('project_members')
                            .select('user_id')
                            .eq('project_id', currentProject.id);

                        if (members) {
                            userIdsToFetch = members.map(m => m.user_id);
                        }
                    }

                    // 1. Fetch profiles
                    let query = supabase
                        .from('profiles')
                        .select(`
                            id, 
                            full_name, 
                            email, 
                            role, 
                            created_at
                        `);

                    if (userIdsToFetch) {
                        query = query.in('id', userIdsToFetch);
                    }

                    const { data: profilesData, error: profileError } = await query;

                    if (profileError) throw profileError;

                    // 2. Fetch project assignments from project_members
                    const { data: assignments } = await supabase
                        .from('project_members')
                        .select('user_id, projects:project_id(name)');

                    const projectMap = {};
                    if (assignments) {
                        assignments.forEach(a => {
                            if (!projectMap[a.user_id]) {
                                projectMap[a.user_id] = [];
                            }
                            if (a.projects?.name) {
                                projectMap[a.user_id].push(a.projects.name);
                            }
                        });
                    }

                    if (profilesData) {
                        setEmployees(profilesData.map(emp => ({
                            id: emp.id,
                            name: emp.full_name || 'N/A',
                            email: emp.email || 'N/A',
                            role: emp.role || 'N/A',
                            dept: (projectMap[emp.id] && projectMap[emp.id].length > 0) ? projectMap[emp.id].join(', ') : 'Unassigned',
                            status: 'Active',
                            joinDate: emp.created_at ? new Date(emp.created_at).toLocaleDateString() : 'N/A'
                        })));
                    }
                } else if (type === 'status') {
                    // Fetch profiles
                    const { data: profiles, error: profileError } = await supabase
                        .from('profiles')
                        .select('id, full_name');

                    if (profileError) throw profileError;

                    // Fetch project assignments from project_members
                    const { data: assignments } = await supabase
                        .from('project_members')
                        .select('user_id, projects:project_id(name)');

                    const projectMap = {};
                    if (assignments) {
                        assignments.forEach(a => {
                            if (!projectMap[a.user_id]) {
                                projectMap[a.user_id] = [];
                            }
                            if (a.projects?.name) {
                                projectMap[a.user_id].push(a.projects.name);
                            }
                        });
                    }

                    // Fetch TODAY'S attendance for "Availability", "Last Active", and "Current Task"
                    const today = new Date().toISOString().split('T')[0];
                    console.log('🔍 Team Status - Fetching attendance for date:', today);

                    const { data: attendanceData, error: attendanceError } = await supabase
                        .from('attendance')
                        .select('employee_id, clock_in, clock_out, date, current_task')
                        .eq('date', today);

                    console.log('📊 Team Status - Attendance Data:', attendanceData);
                    console.log('📊 Team Status - Profiles Count:', profiles?.length);

                    // Fetch TODAY'S leaves for "On Leave" status
                    const { data: leavesData } = await supabase
                        .from('leaves')
                        .select('employee_id')
                        .eq('status', 'approved')
                        .lte('from_date', today)
                        .gte('to_date', today);

                    const leaveSet = new Set(leavesData?.map(l => l.employee_id));

                    if (profiles) {
                        const attendanceMap = {};
                        if (attendanceData) {
                            attendanceData.forEach(record => {
                                attendanceMap[record.employee_id] = record;
                            });
                        }

                        console.log('🗺️ Team Status - Attendance Map:', attendanceMap);

                        setEmployeeStatus(profiles.map(emp => {
                            // Determine Availability from Attendance
                            const attendance = attendanceMap[emp.id];
                            let availability = 'Offline';
                            let lastActive = 'N/A';

                            console.log(`👤 Processing ${emp.full_name}:`, {
                                id: emp.id,
                                hasAttendance: !!attendance,
                                attendance: attendance
                            });

                            if (attendance) {
                                if (attendance.clock_in && !attendance.clock_out) {
                                    availability = 'Online';
                                    lastActive = `Clocked in at ${attendance.clock_in.slice(0, 5)}`;
                                } else if (attendance.clock_out) {
                                    availability = 'Offline';
                                    lastActive = `Left at ${attendance.clock_out.slice(0, 5)}`;
                                }
                            }

                            // Check Leave Status (Override Offline if on leave)
                            if (availability === 'Offline' && leaveSet.has(emp.id)) {
                                availability = 'On Leave';
                            }

                            // Determine Current Task from Attendance (User Input)
                            const currentTask = (availability === 'Online' && attendance?.current_task) ? attendance.current_task :
                                (availability === 'Online') ? 'No active task' : '-';

                            console.log(`✅ Final status for ${emp.full_name}:`, availability);

                            return {
                                id: emp.id,
                                name: emp.full_name || 'Unknown',
                                dept: (projectMap[emp.id] && projectMap[emp.id].length > 0) ? projectMap[emp.id].join(', ') : 'Talent Ops',
                                availability: availability,
                                task: currentTask,
                                lastActive: lastActive
                            };
                        }));
                    }
                } else if (type === 'leaves') {
                    console.log('Fetching leaves for Manager...');

                    // Get current user ID to filter out their own requests
                    const { data: { user } } = await supabase.auth.getUser();
                    const currentUserId = user?.id;

                    // Fetch leaves and profiles separately to avoid join issues
                    const { data: leavesData, error: leavesError } = await supabase
                        .from('leaves')
                        .select('*');

                    if (leavesError) console.error('Error fetching leaves:', leavesError);
                    console.log('Manager Leaves Data RAW:', leavesData);

                    const { data: profilesData, error: profilesError } = await supabase
                        .from('profiles')
                        .select('id, full_name');

                    if (profilesError) console.error('Error fetching profiles:', profilesError);
                    console.log('Manager Profiles Data RAW:', profilesData);

                    if (leavesData) {
                        // Create a map of id -> name for quick lookup
                        const profileMap = {};
                        if (profilesData) {
                            profilesData.forEach(p => {
                                profileMap[p.id] = p.full_name;
                            });
                        }

                        // Filter out manager's own leaves and map the rest
                        const filteredLeaves = leavesData
                            .filter(leave => leave.employee_id !== currentUserId)
                            .map(leave => {
                                const start = new Date(leave.from_date);
                                const end = new Date(leave.to_date);
                                const diffTime = Math.abs(end - start);
                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

                                let type = 'Leave';
                                let reason = leave.reason || '';
                                if (reason.includes(':')) {
                                    type = reason.split(':')[0];
                                } else if (leave.leave_type) {
                                    type = leave.leave_type;
                                }

                                // Use map to find name, or fallback
                                const name = profileMap[leave.employee_id] || 'Unknown';

                                return {
                                    id: leave.id,
                                    employee_id: leave.employee_id, // Added for refund logic
                                    name: name,
                                    type: type,
                                    reason: leave.reason || 'No reason provided', // Include full reason from DB
                                    startDate: leave.from_date, // Added for calculation
                                    endDate: leave.to_date, // Added for calculation
                                    duration: `${diffDays} Days`,
                                    dates: `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`,
                                    status: leave.status ? leave.status.charAt(0).toUpperCase() + leave.status.slice(1).toLowerCase() : 'Pending'
                                };
                            });

                        setDbLeaves(filteredLeaves);
                    }
                } else if (type === 'my-leaves') {
                    console.log('Fetching my leaves...');
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user) {
                        console.log('No user found');
                        return;
                    }

                    const { data, error } = await supabase
                        .from('leaves')
                        .select('*')
                        .eq('employee_id', user.id);

                    if (error) {
                        console.error('Error fetching my leaves:', error);
                        return;
                    }

                    console.log('My leaves data:', data);

                    if (data) {
                        setDbLeaves(data.map(leave => {
                            const start = new Date(leave.from_date);
                            const end = new Date(leave.to_date);
                            const diffTime = Math.abs(end - start);
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

                            let type = 'Leave';
                            let reason = leave.reason || '';
                            if (reason.includes(':')) {
                                type = reason.split(':')[0];
                            } else if (leave.leave_type) {
                                type = leave.leave_type;
                            }

                            return {
                                id: leave.id,
                                name: 'You',
                                type: type,
                                duration: `${diffDays} Days`,
                                dates: `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`,
                                status: leave.status ? leave.status.charAt(0).toUpperCase() + leave.status.slice(1).toLowerCase() : 'Pending'
                            };
                        }));
                    }
                }
            } catch (error) {
                console.error('Error fetching data:', error);
            }
        };

        const fetchRemainingLeaves = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase
                .from('profiles')
                .select('leaves_remaining')
                .eq('id', user.id)
                .single();

            if (data) {
                setRemainingLeaves(data.leaves_remaining || 0);
            }
        };

        fetchData();
        if (type === 'leaves' || type === 'my-leaves') {
            fetchRemainingLeaves();
        }
    }, [type, refreshTrigger, currentProject?.id]);

    // Fetch Policies from Supabase
    React.useEffect(() => {
        const fetchPolicies = async () => {
            if (type === 'policies') {
                try {
                    console.log('Fetching policies from Supabase...');
                    const { data, error } = await supabase
                        .from('policies')
                        .select('*')
                        .eq('status', 'Active')
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


    // Real-time Subscription for Live Status & Data
    React.useEffect(() => {
        const sub = supabase
            .channel('manager-module-complete-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => {
                setRefreshTrigger(prev => prev + 1);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leaves' }, () => {
                setRefreshTrigger(prev => prev + 1);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
                setRefreshTrigger(prev => prev + 1);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
                setRefreshTrigger(prev => prev + 1);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'payroll' }, () => {
                setRefreshTrigger(prev => prev + 1);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(sub);
        };
    }, []);

    const fetchEmployeeTasks = async (employeeId, startDate, endDate) => {
        try {
            const { data, error } = await supabase
                .from('tasks')
                .select('*')
                .eq('assigned_to', employeeId)
                .gte('due_date', startDate)
                .lte('due_date', endDate);

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching tasks:', error);
            return [];
        }
    };

    const handleViewLeave = async (leaveRequest) => {
        setSelectedLeaveRequest(leaveRequest);

        // Fetch tasks for the employee during leave dates
        const tasks = await fetchEmployeeTasks(
            leaveRequest.employee_id,
            leaveRequest.startDate, // Use standardized camelCase keys from transformation
            leaveRequest.endDate
        );
        setEmployeeTasks(tasks);
        setShowLeaveDetailsModal(true);
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

            // Extract file path from the storage URL
            let filePath;
            if (policy.file_url.includes('/policies/')) {
                filePath = policy.file_url.split('/policies/')[1];
            } else {
                filePath = policy.file_url.split('/').pop();
            }

            console.log('Downloading from path:', filePath);

            // Download from policies bucket
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

    const handlePolicySuccess = (newPolicy) => {
        // Refresh the policies list
        setRefreshTrigger(prev => prev + 1);
        addToast(`Policy "${newPolicy.title}" created successfully!`, 'success');
    };

    const handleAction = async (action, item) => {
        if ((type === 'leaves' || type === 'my-leaves') && action === 'Apply for Leave') {
            setLeaveFormData(prev => ({
                ...prev,
                leaveType: remainingLeaves <= 0 ? 'Loss of Pay' : 'Casual Leave'
            }));
            setShowApplyLeaveModal(true);
        } else if (type === 'leaves' && (action === 'Approve' || action === 'Reject')) {
            const newStatus = action === 'Approve' ? 'Approved' : 'Rejected';

            // Optimistic update (Uppercase for UI)
            setDbLeaves(prevRequests =>
                prevRequests.map(request =>
                    request.id === item.id
                        ? { ...request, status: newStatus }
                        : request
                )
            );

            try {
                // Database update (Lowercase for DB)
                const dbStatus = action === 'Approve' ? 'approved' : 'rejected';

                const { error } = await supabase
                    .from('leaves')
                    .update({ status: dbStatus })
                    .eq('id', item.id);

                if (error) throw error;

                // Refund logic: If Rejected AND NOT 'Loss of Pay', decrement leaves_taken_this_month
                if (action === 'Reject' && item.type !== 'Loss of Pay' && item.employee_id) {
                    const start = new Date(item.startDate);
                    const end = new Date(item.endDate);
                    const diffTime = Math.abs(end - start);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

                    // Fetch current profile stats
                    const { data: profileData, error: profileFetchError } = await supabase
                        .from('profiles')
                        .select('leaves_taken_this_month')
                        .eq('id', item.employee_id)
                        .single();

                    if (profileData) {
                        const currentTaken = profileData.leaves_taken_this_month || 0;
                        const newTaken = Math.max(0, currentTaken - diffDays); // Prevent negative

                        const { error: refundError } = await supabase
                            .from('profiles')
                            .update({ leaves_taken_this_month: newTaken })
                            .eq('id', item.employee_id);

                        if (refundError) console.error('Error refunding leave balance:', refundError);
                        else console.log(`Refunded ${diffDays} days to employee ${item.employee_id}`);
                    }
                }

                // Send Notification to the Employee
                const { data: { user } } = await supabase.auth.getUser();
                if (user && item.employee_id) {
                    const notificationMessage = `Your leave request for ${item.dates} has been ${action === 'Approve' ? 'Approved' : 'Rejected'}.`;

                    await supabase.from('notifications').insert({
                        receiver_id: item.employee_id,
                        sender_id: user.id,
                        sender_name: 'Management',
                        message: notificationMessage,
                        type: 'leave_status',
                        is_read: false,
                        created_at: new Date().toISOString()
                    });
                }

                addToast(`Leave request ${action.toLowerCase()}d for ${item.name}`, 'success');
            } catch (error) {
                console.error('Error updating leave request:', error);
                addToast(`Failed to ${action.toLowerCase()} leave request`, 'error');
                // Revert optimistic update if needed
            }
        } else if (action === 'View Employee') {
            setSelectedEmployee(item);
            setShowEmployeeModal(true);
        } else if (action === 'View Candidate') {
            setSelectedCandidate(item);
            setShowCandidateModal(true);
        } else if (type === 'policies' && action === 'Add Policy') {
            setShowAddPolicyModal(true);
        } else {
            addToast(`${action} clicked${item ? ` for ${item.name || item.id}` : ''}`, 'info');
        }
    };

    const handleApplyLeave = async (e) => {
        e.preventDefault();

        // Calculate duration (days)
        const start = new Date(leaveFormData.startDate);
        const end = new Date(leaveFormData.endDate);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        const duration = diffDays === 1 ? '1 Day' : `${diffDays} Days`;

        // Format dates for display
        const formatDate = (dateStr) => {
            const date = new Date(dateStr);
            return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
        };
        const datesDisplay = leaveFormData.startDate === leaveFormData.endDate
            ? formatDate(leaveFormData.startDate)
            : `${formatDate(leaveFormData.startDate)} - ${formatDate(leaveFormData.endDate)}`;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not authenticated');

            // Insert into DB
            const { data, error } = await supabase
                .from('leaves')
                .insert([{
                    employee_id: user.id,
                    // team_id: user.team_id, // If we had team_id in context or fetched it
                    from_date: leaveFormData.startDate,
                    to_date: leaveFormData.endDate,
                    reason: `${leaveFormData.leaveType}: ${leaveFormData.reason}`,
                    status: 'pending'
                }])
                .select();

            if (error) throw error;

            // Update remaining leaves if NOT loss of pay
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

            // Update local state
            if (data) {
                const newRequest = {
                    id: data[0].id,
                    name: 'Manager (You)',
                    type: leaveFormData.leaveType,
                    duration: duration,
                    dates: datesDisplay,
                    status: 'Pending'
                };
                setDbLeaves([newRequest, ...dbLeaves]);
            }

            setShowApplyLeaveModal(false);
            setLeaveFormData({
                leaveType: 'Casual Leave',
                startDate: '',
                endDate: '',
                reason: ''
            });
            addToast('Leave application submitted successfully', 'success');
        } catch (error) {
            console.error('Error applying for leave:', error);
            addToast('Failed to submit leave request: ' + error.message, 'error');
        }
    };

    // Render specific demos for certain types
    if (type === 'analytics') return <AnalyticsDemo currentProject={currentProject} projectRole={projectRole} userId={userId} />;
    if (type === 'tasks') return <AllTasksView key="team-tasks" userRole={userRole} projectRole={projectRole} userId={userId} addToast={addToast} viewMode="team_tasks" />;
    if (type === 'global-tasks') return <AllTasksView key="global-tasks" userRole={userRole} projectRole={projectRole} userId={userId} addToast={addToast} viewMode="global_tasks" />;
    if (type === 'personal-tasks') return <AllTasksView key="personal-tasks" userRole={userRole} projectRole={projectRole} userId={userId} addToast={addToast} viewMode="my_tasks" />;
    if (title === 'Team Hierarchy' || title === 'Organizational Hierarchy') return <HierarchyDemo />;
    if (title === 'Project Hierarchy') return <ProjectHierarchyDemo />;
    if (title === 'Settings') return <SettingsDemo />;
    if (title === 'Announcements') return <AnnouncementsPage userRole={userRole} userId={userId} />;
    if (type === 'payroll') return <PayslipsPage userRole={userRole} userId={userId} addToast={addToast} />;
    if (type === 'payroll-generation') return <PayrollPage userRole={userRole} userId={userId} addToast={addToast} />;
    if (type === 'documents') return <ProjectDocuments />;

    // Mock Data Configurations
    const configs = {
        workforce: {
            columns: [
                {
                    header: 'Employee Name', accessor: 'name', render: (row) => (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                {row.name.charAt(0)}
                            </div>
                            <div>
                                <p style={{ fontWeight: 500 }}>{row.name}</p>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{row.email}</p>
                            </div>
                        </div>
                    )
                },
                { header: 'Role', accessor: 'role' },
                { header: 'Project', accessor: 'dept' },
                { header: 'Join Date', accessor: 'joinDate' },
                {
                    header: 'Actions', accessor: 'actions', render: (row) => (
                        <button
                            onClick={() => handleAction('View Employee', row)}
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
            data: employees
        },
        status: {
            columns: [
                { header: 'Employee', accessor: 'name' },
                { header: 'Project', accessor: 'dept' },
                {
                    header: 'Availability', accessor: 'availability', render: (row) => (
                        <span style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            color: row.availability === 'Online' ? 'var(--success)' : row.availability === 'On Leave' ? '#d97706' : row.availability === 'Away' ? 'var(--warning)' : 'var(--text-secondary)',
                            fontWeight: 600
                        }}>
                            <span style={{
                                width: '8px', height: '8px', borderRadius: '50%',
                                backgroundColor: row.availability === 'Online' ? 'var(--success)' : row.availability === 'On Leave' ? '#d97706' : row.availability === 'Away' ? 'var(--warning)' : 'var(--text-secondary)'
                            }}></span>
                            {row.availability}
                        </span>
                    )
                },
                { header: 'Current Task', accessor: 'task' },
                { header: 'Last Active', accessor: 'lastActive' },
            ],
            data: employeeStatus
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
                { header: 'Employee', accessor: 'name' },
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
                                <button
                                    onClick={() => handleAction('Approve', row)}
                                    style={{
                                        padding: '6px 12px',
                                        borderRadius: '6px',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        backgroundColor: '#dcfce7',
                                        color: '#166534',
                                        border: '1px solid #86efac',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#bbf7d0'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#dcfce7'}
                                >
                                    Approve
                                </button>
                                <button
                                    onClick={() => handleAction('Reject', row)}
                                    style={{
                                        padding: '6px 12px',
                                        borderRadius: '6px',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        backgroundColor: '#fee2e2',
                                        color: '#991b1b',
                                        border: '1px solid #fca5a5',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fecaca'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}
                                >
                                    Reject
                                </button>
                            </div>
                        ) : (
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
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', alignSelf: 'center' }}>-</span>
                            </div>
                        )
                    )
                },
            ],
            data: dbLeaves.length > 0 ? dbLeaves : leaveRequests
        },
        'my-leaves': {
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
                }
            ],
            data: dbLeaves
        },
        payroll: {
            columns: [
                { header: 'Employee', accessor: 'name' },
                { header: 'Month', accessor: 'month' },
                { header: 'Net Salary', accessor: 'salary' },
                {
                    header: 'Status', accessor: 'status', render: (row) => (
                        <span style={{ color: 'var(--success)', fontWeight: 600 }}>{row.status}</span>
                    )
                },
                { header: 'Payslip', accessor: 'action', render: () => <span style={{ color: 'var(--accent)', cursor: 'pointer' }}>Download</span> }
            ],
            data: []
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

    console.log('Current type:', type);
    console.log('Available configs:', Object.keys(configs));
    const config = configs[type] || configs.default;
    console.log('Selected config:', config);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
            {/* Header with Breadcrumb-like feel */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '4px' }}>
                        <span>Dashboard</span>
                        <span>/</span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{title}</span>
                    </div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{title}</h2>
                </div>
                {type === 'my-leaves' && (
                    <button
                        onClick={() => handleAction('Apply for Leave')}
                        style={{
                            backgroundColor: 'var(--primary)',
                            color: 'white',
                            padding: '10px 16px',
                            borderRadius: '8px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: 'var(--shadow-md)'
                        }}
                    >
                        <Plus size={20} />
                        Apply for Leave
                    </button>
                )}
            </div>

            {/* Pending Requests Card (For Approval View) */}
            {type === 'leaves' && (
                <div style={{
                    backgroundColor: 'var(--surface)',
                    padding: '20px',
                    borderRadius: '12px',
                    boxShadow: 'var(--shadow-sm)',
                    marginBottom: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    border: '1px solid var(--border)'
                }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        backgroundColor: '#fef3c7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#b45309'
                    }}>
                        <Briefcase size={24} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Pending Requests</p>
                        <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                            {/* Filter dbLeaves for 'pending' (case-insensitive) status */}
                            {dbLeaves.filter(leave => leave.status && leave.status.toLowerCase() === 'pending').length}
                        </p>
                    </div>
                </div>
            )}

            {/* Remaining Leaves Card (For Personal View) */}
            {type === 'my-leaves' && (
                <div style={{
                    backgroundColor: 'var(--surface)',
                    padding: '20px',
                    borderRadius: '12px',
                    boxShadow: 'var(--shadow-sm)',
                    marginBottom: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    border: '1px solid var(--border)'
                }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        backgroundColor: '#e0f2fe',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#0284c7'
                    }}>
                        <Briefcase size={24} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Remaining Leaves</p>
                        <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{remainingLeaves}</p>
                    </div>
                </div>
            )}

            <DataTable
                title={`${title} List`}
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
                                        min={leaveFormData.startDate}
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
                                    placeholder="Enter reason for leave..."
                                    rows="4"
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '1rem', backgroundColor: 'var(--background)', color: 'var(--text-primary)', resize: 'vertical' }}
                                    required
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowApplyLeaveModal(false)}
                                    style={{ flex: 1, padding: '12px', borderRadius: '8px', fontWeight: 600, border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--text-primary)', cursor: 'pointer' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    style={{ flex: 1, padding: '12px', borderRadius: '8px', fontWeight: 600, backgroundColor: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer', boxShadow: 'var(--shadow-md)' }}
                                >
                                    Submit Leave Request
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Employee Details Modal */}
            {showEmployeeModal && selectedEmployee && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ backgroundColor: 'var(--surface)', borderRadius: '16px', width: '600px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>
                        {/* Header */}
                        <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Employee Details</h3>
                            <button onClick={() => setShowEmployeeModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                <X size={24} />
                            </button>
                        </div>

                        {/* Employee Info */}
                        <div style={{ padding: '32px' }}>
                            {/* Profile Section */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '32px' }}>
                                <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 'bold', color: '#075985' }}>
                                    {selectedEmployee.name.charAt(0)}
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
                                        <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>{selectedEmployee.dept}</p>
                                    </div>
                                    <div style={{ padding: '16px', backgroundColor: 'var(--background)', borderRadius: '12px' }}>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Manager</p>
                                        <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>{selectedEmployee.manager || 'N/A'}</p>
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
            )}

            {/* Candidate Details Modal */}
            {showCandidateModal && selectedCandidate && (
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
            )}

            {/* Leave Details Modal */}
            {showLeaveDetailsModal && selectedLeaveRequest && (
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

                        {/* Action Buttons */}
                        {selectedLeaveRequest.status === 'Pending' && (
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => {
                                        handleAction('Approve', selectedLeaveRequest);
                                        setShowLeaveDetailsModal(false);
                                    }}
                                    style={{
                                        padding: '10px 20px',
                                        borderRadius: '8px',
                                        fontSize: '0.875rem',
                                        fontWeight: 600,
                                        backgroundColor: '#dcfce7',
                                        color: '#166534',
                                        border: '1px solid #bbf7d0',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Approve Leave
                                </button>
                                <button
                                    onClick={() => {
                                        handleAction('Reject', selectedLeaveRequest);
                                        setShowLeaveDetailsModal(false);
                                    }}
                                    style={{
                                        padding: '10px 20px',
                                        borderRadius: '8px',
                                        fontSize: '0.875rem',
                                        fontWeight: 600,
                                        backgroundColor: '#fee2e2',
                                        color: '#991b1b',
                                        border: '1px solid #fecaca',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Reject Leave
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Add Policy Modal */}
            <AddPolicyModal
                isOpen={showAddPolicyModal}
                onClose={() => setShowAddPolicyModal(false)}
                onSuccess={handlePolicySuccess}
            />
        </div>
    );
};

export default ModulePage;
