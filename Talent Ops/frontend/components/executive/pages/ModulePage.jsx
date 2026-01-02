import React, { useState, useEffect } from 'react';
import { Plus, X, Eye, Mail, Phone, MapPin, Calendar, Briefcase, Download, Edit } from 'lucide-react';
import DataTable from '../components/UI/DataTable';
import { useToast } from '../context/ToastContext';
import AnalyticsDemo from '../components/Demo/AnalyticsDemo';
import KanbanDemo from '../components/Demo/KanbanDemo';
import TaskLifecyclePage from '../../shared/TaskLifecyclePage';
import AllTasksView from '../../shared/AllTasksView';
import HierarchyDemo from '../components/Demo/HierarchyDemo';
import SettingsDemo from '../components/Demo/SettingsDemo';
import AuditLogsDemo from '../components/Demo/AuditLogsDemo';
import { AddEmployeeModal } from '../../shared/AddEmployeeModal';
import { EditEmployeeModal } from '../../shared/EditEmployeeModal';
import { supabase } from '../../../lib/supabaseClient';
import PayslipsPage from '../../shared/PayslipsPage';
import PayrollPage from '../../shared/PayrollPage';
import AnnouncementsPage from '../../shared/AnnouncementsPage';
import ProjectHierarchyDemo from '../../shared/ProjectHierarchyDemo';
import InvoiceGenerator from '../components/Invoice/InvoiceGenerator';
import { AddPolicyModal } from '../../shared/AddPolicyModal';
import { EditPolicyModal } from '../../shared/EditPolicyModal';
import { useUser } from '../context/UserContext';
import ProjectAnalytics from '../../shared/ProjectAnalytics/ProjectAnalytics';


const ModulePage = ({ title, type }) => {
    const { addToast } = useToast();
    const { userId, userRole } = useUser();

    // State for leave requests
    const [leaveRequests, setLeaveRequests] = useState([]);

    // State for Leave Details modal
    const [selectedLeaveRequest, setSelectedLeaveRequest] = useState(null);
    const [showLeaveDetailsModal, setShowLeaveDetailsModal] = useState(false);
    const [employeeTasks, setEmployeeTasks] = useState([]);

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
    const [employeeSalary, setEmployeeSalary] = useState(null);

    // State for Candidate Details modal
    const [selectedCandidate, setSelectedCandidate] = useState(null);
    const [showCandidateModal, setShowCandidateModal] = useState(false);

    // State for Candidates
    const [candidates, setCandidates] = useState([]);

    const [showCandidateFormModal, setShowCandidateFormModal] = useState(false);
    const [isEditingCandidate, setIsEditingCandidate] = useState(false);
    const [candidateFormData, setCandidateFormData] = useState({
        name: '',
        email: '',
        phone: '',
        role: '',
        stage: 'Screening',
        score: 0,
        source: '',
        appliedDate: new Date().toISOString().split('T')[0],
        experience: '',
        education: '',
        location: '',
        expectedSalary: '',
        availability: '',
        skills: '',
        notes: ''
    });

    // State for Employees
    const [employees, setEmployees] = useState([]);
    const [teamOptions, setTeamOptions] = useState([]); // Store fetched teams
    const [projects, setProjects] = useState([]); // Store fetched projects
    const [departments, setDepartments] = useState([]); // Store fetched departments
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [showEditEmployeeModal, setShowEditEmployeeModal] = useState(false);
    const [selectedEmployeeForEdit, setSelectedEmployeeForEdit] = useState(null);

    const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
    const [selectedProjectsForAdd, setSelectedProjectsForAdd] = useState([]); // For multi-project selection
    const [addEmployeeFormData, setAddEmployeeFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: '',
        department_id: '',
        phone: '',
        location: '',
        joinDate: new Date().toISOString().split('T')[0],
        basic_salary: '',
        hra: '',
        allowances: '',
    });

    // State for Policies
    const [policies, setPolicies] = useState([]);
    const [showAddPolicyModal, setShowAddPolicyModal] = useState(false);
    const [showEditPolicyModal, setShowEditPolicyModal] = useState(false);
    const [selectedPolicy, setSelectedPolicy] = useState(null);



    // Fetch projects and departments from Supabase
    useEffect(() => {
        const fetchMetadata = async () => {
            try {
                // Fetch Projects
                const { data: projData } = await supabase.from('projects').select('id, name').order('name');
                setProjects(projData || []);

                // Fetch Departments
                const { data: deptData } = await supabase.from('departments').select('id, department_name');
                setDepartments(deptData || []);
            } catch (err) {
                console.error('Error fetching metadata:', err);
            }
        };

        fetchMetadata();
    }, []);

    // Fetch employees from Supabase
    useEffect(() => {
        const fetchEmployees = async () => {
            if (type === 'workforce' || type === 'status') {
                try {
                    console.log(`Fetching employees for ${type} from Supabase...`);

                    // 1. Fetch employees with team details
                    const { data: profilesData, error: profilesError } = await supabase
                        .from('profiles')
                        .select(`
                            id, 
                            full_name, 
                            email, 
                            role, 
                            department,
                            department,
                            created_at,
                            join_date
                        `);

                    if (profilesError) {
                        console.error('Error fetching employees:', profilesError);
                        addToast('Failed to load employees', 'error');
                        return;
                    }

                    // 2. Fetch project assignments from project_members table
                    const { data: teamMembersData, error: teamMembersError } = await supabase
                        .from('project_members')
                        .select(`
                            user_id,
                            project_id,
                            role,
                            projects:project_id (
                                name
                            )
                        `);

                    if (teamMembersError) {
                        console.error('Error fetching team members:', teamMembersError);
                    }

                    const projectMap = {};
                    if (teamMembersData) {
                        teamMembersData.forEach(member => {
                            if (!projectMap[member.user_id]) projectMap[member.user_id] = [];
                            if (member.projects?.name) {
                                // Format role for display
                                let roleDisplay = member.role || 'Member';
                                if (roleDisplay === 'team_lead') roleDisplay = 'Team Lead';
                                else if (roleDisplay === 'employee') roleDisplay = 'Employee';
                                else roleDisplay = roleDisplay.charAt(0).toUpperCase() + roleDisplay.slice(1);

                                projectMap[member.user_id].push({
                                    name: member.projects.name,
                                    role: roleDisplay
                                });
                            }
                        });
                    }

                    // 3. Fetch TODAY'S attendance records
                    const today = new Date().toISOString().split('T')[0];
                    const { data: attendanceData, error: attendanceError } = await supabase
                        .from('attendance')
                        .select('employee_id, clock_in, clock_out, date, current_task')
                        .eq('date', today);

                    // Fetch TODAY'S leaves for "On Leave" status
                    const { data: leavesData } = await supabase
                        .from('leaves')
                        .select('employee_id')
                        .eq('status', 'approved')
                        .lte('from_date', today)
                        .gte('to_date', today);

                    const leaveSet = new Set(leavesData?.map(l => l.employee_id));

                    if (attendanceError) {
                        console.error('Error fetching attendance:', attendanceError);
                        // We continue even if attendance fails, considering everyone offline as fallback
                    }

                    // Create a map of employee_id -> attendance record for quick lookup
                    const attendanceMap = {};
                    if (attendanceData) {
                        attendanceData.forEach(record => {
                            attendanceMap[record.employee_id] = record;
                        });
                    }

                    // 4. Fetch Teams for Dropdown
                    const { data: teamsData, error: teamsError } = await supabase.from('teams').select('id, team_name');
                    if (teamsData) {
                        setTeamOptions(teamsData);
                    } else if (teamsError) {
                        console.error("Error fetching teams:", teamsError);
                    }

                    if (profilesData) {
                        console.log('Fetched profiles:', profilesData);
                        console.log('Fetched attendance for today:', attendanceData);
                        console.log('Project assignments:', projectMap);

                        // Transform data to match the expected format
                        const transformedEmployees = profilesData.map(emp => {
                            // Determine real status from attendance
                            const attendance = attendanceMap[emp.id];
                            let availability = 'Offline';
                            let lastActive = 'N/A';

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

                            // Determine Current Task from Attendance (from user input)
                            const currentTask = (availability === 'Online' && attendance?.current_task) ? attendance.current_task :
                                (availability === 'Online') ? 'Available' : '-';

                            let teamName;
                            if (Array.isArray(projectMap[emp.id]) && projectMap[emp.id].length > 0) {
                                // Multiple projects - render each on a new line with role
                                teamName = (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        {projectMap[emp.id].map((proj, index) => (
                                            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span>{proj.name}</span>
                                                <span style={{
                                                    fontSize: '0.7rem',
                                                    color: '#94a3b8',
                                                    background: 'rgba(255,255,255,0.05)',
                                                    padding: '1px 6px',
                                                    borderRadius: '4px',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    {proj.role}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                );
                            } else {
                                teamName = 'Unassigned';
                            }

                            // Determine Department Display (Name matched by ID or the ID itself/legacy name)
                            const matchedDept = departments.find(d => d.id === emp.department);
                            const departmentNameDisplay = matchedDept ? matchedDept.department_name : (emp.department || 'N/A');

                            return {
                                id: emp.id,
                                name: emp.full_name || 'N/A',
                                email: emp.email || 'N/A',
                                role: emp.role || 'N/A',
                                team_id: emp.team_id,
                                dept: teamName, // Shows Project/Team
                                department_display: departmentNameDisplay,
                                status: 'Active',
                                availability: availability, // Real status from DB
                                task: currentTask, // Real task from DB

                                lastActive: lastActive, // Real clock time
                                joinDate: emp.join_date ? new Date(emp.join_date).toLocaleDateString() : (emp.created_at ? new Date(emp.created_at).toLocaleDateString() : 'N/A'),
                                performance: 'N/A',
                                projects: projectMap[emp.id]?.length || 0,
                                tasksCompleted: 0
                            };
                        });

                        console.log('Transformed employees with real attendance:', transformedEmployees);
                        setEmployees(transformedEmployees);

                        if (transformedEmployees.length === 0) {
                            addToast('No employees found in database', 'info');
                        }
                    }
                } catch (err) {
                    console.error('Unexpected error fetching employees:', err);
                    addToast('An unexpected error occurred while loading employees', 'error');
                }
            } else if (type === 'leaves') {
                try {
                    console.log('Fetching leave requests for Executive...');

                    // Get current user ID to filter out their own requests
                    const { data: { user } } = await supabase.auth.getUser();
                    const currentUserId = user?.id;

                    // Fetch all leaves
                    const { data: leavesData, error: leavesError } = await supabase
                        .from('leaves')
                        .select('*');

                    if (leavesError) {
                        console.error('Error fetching leaves:', leavesError);
                        return;
                    }

                    console.log('Executive Leaves Data RAW:', leavesData);

                    // Fetch profiles for name mapping
                    const { data: profilesData, error: profilesError } = await supabase
                        .from('profiles')
                        .select('id, full_name');

                    if (profilesError) console.error('Error fetching profiles:', profilesError);

                    if (leavesData) {
                        // Create a map of id -> name for quick lookup
                        const profileMap = {};
                        if (profilesData) {
                            profilesData.forEach(p => {
                                profileMap[p.id] = p.full_name;
                            });
                        }

                        // Filter out executive's own leaves and map the rest
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
                                    employee_id: leave.employee_id,
                                    name: name,
                                    type: type,
                                    reason: leave.reason || 'No reason provided', // Include full reason from DB
                                    startDate: leave.from_date,
                                    endDate: leave.to_date,
                                    duration: `${diffDays} Days`,
                                    dates: `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`,
                                    status: leave.status ? leave.status.charAt(0).toUpperCase() + leave.status.slice(1).toLowerCase() : 'Pending'
                                };
                            });

                        // Sort by status (Pending first) then by ID
                        filteredLeaves.sort((a, b) => {
                            if (a.status === 'Pending' && b.status !== 'Pending') return -1;
                            if (a.status !== 'Pending' && b.status === 'Pending') return 1;
                            return b.id - a.id; // Then by ID descending
                        });

                        setLeaveRequests(filteredLeaves);
                    }
                } catch (err) {
                    console.error('Error fetching leave requests:', err);
                }
            }
        };

        fetchEmployees();
    }, [type, refreshTrigger, departments]);

    // Fetch Policies from Supabase
    useEffect(() => {
        const fetchPolicies = async () => {
            if (type === 'policies') {
                try {
                    console.log('Fetching policies from Supabase...');
                    const { data, error } = await supabase
                        .from('policies')
                        .select('*')
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


    // Real-time Subscription for Live Status
    React.useEffect(() => {
        if (type !== 'status' && type !== 'workforce') return;

        const sub = supabase
            .channel('executive_attendance_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, (payload) => {
                setRefreshTrigger(prev => prev + 1);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(sub);
        };
    }, [type]);

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

    const fetchEmployeeSalary = async (employeeId) => {
        try {
            const { data, error } = await supabase
                .from('employee_finance')
                .select('*')
                .eq('employee_id', employeeId)
                .eq('is_active', true)
                .single();

            if (error) {
                console.log('No active salary record found:', error);
                setEmployeeSalary(null);
                return;
            }

            setEmployeeSalary(data);
        } catch (error) {
            console.error('Error fetching employee salary:', error);
            setEmployeeSalary(null);
        }
    };

    const handleAddEmployee = async (e) => {
        e.preventDefault();

        try {
            // Get the current session token
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                addToast('You must be logged in to add employees', 'error');
                return;
            }

            console.log('Adding employee with data:', addEmployeeFormData);

            // Call the Supabase Edge Function to add employee
            const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/add-employee`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({
                        full_name: addEmployeeFormData.name,
                        email: addEmployeeFormData.email,
                        password: addEmployeeFormData.password,
                        role: addEmployeeFormData.role.toLowerCase(),
                        project_id: selectedProjectsForAdd[0] || null,
                        department_id: addEmployeeFormData.department_id || null,
                        monthly_leave_quota: 3,
                        basic_salary: parseFloat(addEmployeeFormData.basic_salary),
                        hra: parseFloat(addEmployeeFormData.hra),
                        allowances: parseFloat(addEmployeeFormData.allowances) || 0,
                    }),
                }
            );

            let result;
            try {
                result = await response.json();
            } catch (jsonError) {
                throw new Error(`Server error: ${response.status} ${response.statusText}`);
            }

            console.log('Edge Function response:', result);

            if (!response.ok) {
                console.error('Edge Function error:', result);
                throw new Error(result.error || result.message || `Server error: ${response.status}`);
            }

            // Get the user_id - either from the response or by querying
            let userId = result.user_id;

            if (!userId) {
                // Query for the newly created user by email
                const { data: profileData, error: profileError } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('email', addEmployeeFormData.email)
                    .single();

                if (profileError) {
                    console.error('Error fetching user profile:', profileError);
                } else {
                    userId = profileData?.id;
                }
            }

            if (userId) {
                // Update profile with department if selected
                if (addEmployeeFormData.department_id) {
                    console.log('Updating profile with department ID:', addEmployeeFormData.department_id);
                    await supabase
                        .from('profiles')
                        .update({ department: addEmployeeFormData.department_id })
                        .eq('id', userId);
                }

                // If a project was selected, add the user to project_members
                if (addEmployeeFormData.project_id) {
                    // Insert into project_members table
                    const { error: projectMemberError } = await supabase
                        .from('project_members')
                        .insert({
                            project_id: selectedProjectsForAdd[0],
                            user_id: userId,
                            role: addEmployeeFormData.role.toLowerCase()
                        });

                    if (projectMemberError) {
                        console.error('Error adding to project_members:', projectMemberError);
                    } else {
                        console.log('Successfully added to project_members');
                    }

                    // Insert into team_members table (using project_id as team_id)
                    const { error: teamMemberError } = await supabase
                        .from('team_members')
                        .insert({
                            team_id: addEmployeeFormData.project_id,
                            profile_id: userId,
                            role_in_project: addEmployeeFormData.role.toLowerCase()
                        });

                    if (teamMemberError) {
                        console.error('Error adding to team_members:', teamMemberError);
                    } else {
                        console.log('Successfully added to team_members');
                    }
                }
            } else {
                console.error('Could not determine user_id for project mapping');
            }

            // Reset form
            setAddEmployeeFormData({
                name: '',
                email: '',
                password: '',
                role: '',
                project_id: '',
                department_id: '',
                phone: '',
                location: '',
                joinDate: new Date().toISOString().split('T')[0],
                basic_salary: '',
                hra: '',
                allowances: '',
            });

            setShowAddEmployeeModal(false);
            addToast('Employee added successfully!', 'success');
            setRefreshTrigger(prev => prev + 1); // Refresh the employee list
        } catch (err) {
            console.error('Error adding employee:', err);
            addToast(err.message || 'Failed to add employee', 'error');
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
            // URL format: https://...supabase.co/storage/v1/object/public/policies/filename.pdf
            let filePath;
            if (policy.file_url.includes('/policies/')) {
                filePath = policy.file_url.split('/policies/')[1];
            } else {
                // Fallback: use just the filename
                filePath = policy.file_url.split('/').pop();
            }

            console.log('Downloading from path:', filePath);

            // Download from policies bucket using Supabase storage.download()
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

            // Ensure the blob is typed as PDF
            const pdfBlob = new Blob([data], { type: 'application/pdf' });

            // Create blob URL and force download
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

    const handleEditPolicy = (policy) => {
        setSelectedPolicy(policy);
        setShowEditPolicyModal(true);
    };

    const handleAction = async (action, item) => {
        if (type === 'leaves' && action === 'Apply for Leave') {
            setShowApplyLeaveModal(true);
        } else if (type === 'workforce' && action === 'Add Employee') {
            setShowAddEmployeeModal(true);
        } else if (type === 'recruitment' && action === 'Add Candidate') {
            setIsEditingCandidate(false);
            setCandidateFormData({
                name: '',
                email: '',
                phone: '',
                role: '',
                stage: 'Screening',
                score: 0,
                source: '',
                appliedDate: new Date().toISOString().split('T')[0],
                experience: '',
                education: '',
                location: '',
                expectedSalary: '',
                availability: '',
                skills: '',
                notes: ''
            });
            setShowCandidateFormModal(true);
        } else if (type === 'policies' && action === 'Add Policy') {
            setShowAddPolicyModal(true);
        } else if (type === 'recruitment' && action === 'Edit Candidate') {
            setIsEditingCandidate(true);
            setCandidateFormData({
                ...item,
                skills: item.skills ? item.skills.join(', ') : ''
            });
            setShowCandidateFormModal(true);
        } else if (type === 'leaves' && (action === 'Approve' || action === 'Reject')) {
            const newStatus = action === 'Approve' ? 'Approved' : 'Rejected';

            // Optimistic update
            setLeaveRequests(prevRequests =>
                prevRequests.map(request =>
                    request.id === item.id
                        ? { ...request, status: newStatus }
                        : request
                )
            );

            try {
                // Database update (lowercase for DB)
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

                addToast(`Leave request ${action.toLowerCase()}d for ${item.name}`, 'success');
            } catch (error) {
                console.error('Error updating leave request:', error);
                addToast(`Failed to ${action.toLowerCase()} leave request`, 'error');
            }
        } else if (action === 'View Employee') {
            setSelectedEmployee(item);
            setShowEmployeeModal(true);
            // Fetch employee salary
            fetchEmployeeSalary(item.id);
        } else if (action === 'Edit Employee') {
            setSelectedEmployeeForEdit(item);
            setShowEditEmployeeModal(true);
        } else if (action === 'View Candidate') {
            setSelectedCandidate(item);
            setShowCandidateModal(true);
        } else {
            addToast(`${action} clicked${item ? ` for ${item.name || item.id}` : ''}`, 'info');
        }
    };

    const handleApplyLeave = (e) => {
        e.preventDefault();

        // Calculate duration
        const start = new Date(leaveFormData.startDate);
        const end = new Date(leaveFormData.endDate);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        const duration = diffDays === 1 ? '1 Day' : `${diffDays} Days`;

        // Format dates
        const formatDate = (dateStr) => {
            const date = new Date(dateStr);
            return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
        };
        const dates = leaveFormData.startDate === leaveFormData.endDate
            ? formatDate(leaveFormData.startDate)
            : `${formatDate(leaveFormData.startDate)} - ${formatDate(leaveFormData.endDate)}`;

        // Add new leave request
        const newRequest = {
            id: leaveRequests.length + 1,
            name: 'Executive (You)',
            type: leaveFormData.leaveType,
            duration: duration,
            dates: dates,
            status: 'Pending'
        };

        setLeaveRequests([...leaveRequests, newRequest]);
        setShowApplyLeaveModal(false);
        setLeaveFormData({
            leaveType: 'Casual Leave',
            startDate: '',
            endDate: '',
            reason: ''
        });
        addToast('Leave application submitted successfully', 'success');
    };

    const handleSaveCandidate = (e) => {
        e.preventDefault();
        const skillsArray = candidateFormData.skills.split(',').map(skill => skill.trim()).filter(skill => skill !== '');

        if (isEditingCandidate) {
            setCandidates(prevCandidates => prevCandidates.map(cand =>
                cand.id === candidateFormData.id
                    ? { ...candidateFormData, skills: skillsArray }
                    : cand
            ));
            addToast('Candidate updated successfully', 'success');
        } else {
            const newCandidate = {
                id: candidates.length + 1,
                ...candidateFormData,
                skills: skillsArray
            };
            setCandidates([...candidates, newCandidate]);
            addToast('Candidate added successfully', 'success');
        }
        setShowCandidateFormModal(false);
    };

    // Render specific demos for certain types
    if (type === 'analytics') return <AnalyticsDemo />;
    if (type === 'tasks') return <AllTasksView userRole={userRole} userId={userId} addToast={addToast} />;
    if (title === 'Team Hierarchy' || title === 'Organizational Hierarchy') return <HierarchyDemo />;
    if (title === 'Project Hierarchy') return <ProjectHierarchyDemo isEditingEnabled={true} />;
    if (title === 'Settings') return <SettingsDemo />;
    if (title === 'Announcements') return <AnnouncementsPage userRole={userRole} userId={userId} />;
    if (type === 'payroll') return <PayslipsPage userRole={userRole} userId={userId} addToast={addToast} />;
    if (type === 'payroll-generation') return <PayrollPage userRole={userRole} userId={userId} addToast={addToast} />;
    if (type === 'invoice') return <InvoiceGenerator />;
    if (type === 'project-analytics') return <ProjectAnalytics userRole="executive" dashboardPrefix="/executive-dashboard" />;

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
                { header: 'Department', accessor: 'department_display' },
                { header: 'Project', accessor: 'dept' },
                { header: 'Join Date', accessor: 'joinDate' },
                {
                    header: 'Actions', accessor: 'actions', render: (row) => (
                        <div style={{ display: 'flex', gap: '8px' }}>
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
                            <button
                                onClick={() => handleAction('Edit Employee', row)}
                                style={{
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    backgroundColor: '#fef3c7',
                                    color: '#b45309',
                                    border: '1px solid #fcd34d',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fde68a'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fef3c7'}
                            >
                                Edit
                            </button>
                        </div>
                    )
                },
            ],
            data: employees
        },
        status: {
            columns: [
                { header: 'Employee', accessor: 'name' },
                { header: 'Department', accessor: 'department_display' },
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
            data: employees
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
                        <div style={{ display: 'flex', gap: '8px' }}>
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
                            <button
                                onClick={() => handleAction('Edit Candidate', row)}
                                style={{
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    backgroundColor: '#fef3c7',
                                    color: '#b45309',
                                    border: '1px solid #fcd34d',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fde68a'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fef3c7'}
                            >
                                Edit
                            </button>
                        </div>
                    )
                },
            ],
            data: candidates
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
            data: leaveRequests
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
                },
                {
                    header: 'Edit',
                    accessor: 'edit',
                    render: (row) => (
                        <button
                            onClick={() => handleEditPolicy(row)}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                backgroundColor: '#fef3c7',
                                color: '#b45309',
                                border: '1px solid #fde68a',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#fde68a';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#fef3c7';
                            }}
                        >
                            <Edit size={14} />
                            Edit
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
                {(type === 'workforce' || type === 'recruitment' || type === 'policies') && (
                    <button
                        onClick={() => handleAction(type === 'workforce' ? 'Add Employee' : type === 'recruitment' ? 'Add Candidate' : 'Add Policy')}
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
                        {type === 'workforce' ? 'Add Employee' : type === 'recruitment' ? 'Add Candidate' : 'Add Policy'}
                    </button>
                )}
            </div>

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
                                >
                                    <option value="Casual Leave">Casual Leave</option>
                                    <option value="Sick Leave">Sick Leave</option>
                                    <option value="Vacation">Vacation</option>
                                    <option value="Personal Leave">Personal Leave</option>
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
                                        <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>{selectedEmployee.department_display || 'N/A'}</p>
                                    </div>
                                    <div style={{ padding: '16px', backgroundColor: 'var(--background)', borderRadius: '12px' }}>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Project</p>
                                        <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>{selectedEmployee.dept}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Compensation Details - Role-based visibility */}
                            {(userRole === 'executive' || userRole === 'manager') && employeeSalary && (
                                <div style={{ marginTop: '32px', paddingTop: '32px', borderTop: '2px solid var(--border)' }}>
                                    <h5 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '20px', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Compensation Details</h5>

                                    {/* Salary Breakdown */}
                                    <div style={{ backgroundColor: '#fafafa', border: '1px solid #e5e7eb', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #e5e7eb' }}>
                                            <span style={{ fontSize: '0.95rem', color: '#6b7280', fontWeight: 500 }}>Basic Salary</span>
                                            <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#111827' }}>₹{employeeSalary.basic_salary?.toLocaleString()}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #e5e7eb' }}>
                                            <span style={{ fontSize: '0.95rem', color: '#6b7280', fontWeight: 500 }}>House Rent Allowance</span>
                                            <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#111827' }}>₹{employeeSalary.hra?.toLocaleString()}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '2px solid #e5e7eb' }}>
                                            <span style={{ fontSize: '0.95rem', color: '#6b7280', fontWeight: 500 }}>Other Allowances</span>
                                            <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#111827' }}>₹{employeeSalary.allowances?.toLocaleString() || '0'}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px', backgroundColor: '#f9fafb' }}>
                                            <span style={{ fontSize: '1.05rem', color: '#111827', fontWeight: 700 }}>Total Monthly Compensation</span>
                                            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)' }}>
                                                ₹{((employeeSalary.basic_salary || 0) + (employeeSalary.hra || 0) + (employeeSalary.allowances || 0)).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Effective Dates */}
                                    <div style={{ marginTop: '16px', padding: '12px 16px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '2px' }}>Effective From</p>
                                                <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#111827' }}>
                                                    {employeeSalary.effective_from ? new Date(employeeSalary.effective_from).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
                                                </p>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '2px' }}>Effective To</p>
                                                <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#111827' }}>
                                                    {employeeSalary.effective_to ? new Date(employeeSalary.effective_to).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Present'}
                                                </p>
                                            </div>
                                        </div>
                                        {employeeSalary.change_reason && (
                                            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
                                                <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '2px' }}>Reason for Change</p>
                                                <p style={{ fontSize: '0.85rem', fontWeight: 500, color: '#111827' }}>{employeeSalary.change_reason}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Performance Metrics */}
                            <div style={{ marginTop: '48px' }}>
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
            {/* Add Employee Modal */}
            <AddEmployeeModal
                isOpen={showAddEmployeeModal}
                onClose={() => setShowAddEmployeeModal(false)}
                onSuccess={async () => {
                    addToast('Employee added successfully', 'success');
                    setShowAddEmployeeModal(false);
                    // Refresh employees list
                    if (type === 'workforce' || type === 'status') {
                        window.location.reload();
                    }
                }}
            />

            {/* Add/Edit Candidate Modal */}
            {
                showCandidateFormModal && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                        <div style={{ backgroundColor: 'var(--surface)', padding: '32px', borderRadius: '16px', width: '700px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{isEditingCandidate ? 'Edit Candidate' : 'Add New Candidate'}</h3>
                                <button onClick={() => setShowCandidateFormModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                    <X size={24} />
                                </button>
                            </div>

                            <form onSubmit={handleSaveCandidate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '8px', color: 'var(--text-primary)' }}>Full Name</label>
                                        <input
                                            type="text"
                                            value={candidateFormData.name}
                                            onChange={(e) => setCandidateFormData({ ...candidateFormData, name: e.target.value })}
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '1rem', backgroundColor: 'var(--background)', color: 'var(--text-primary)' }}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '8px', color: 'var(--text-primary)' }}>Email</label>
                                        <input
                                            type="email"
                                            value={candidateFormData.email}
                                            onChange={(e) => setCandidateFormData({ ...candidateFormData, email: e.target.value })}
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '1rem', backgroundColor: 'var(--background)', color: 'var(--text-primary)' }}
                                            required
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '8px', color: 'var(--text-primary)' }}>Role Applied For</label>
                                        <input
                                            type="text"
                                            value={candidateFormData.role}
                                            onChange={(e) => setCandidateFormData({ ...candidateFormData, role: e.target.value })}
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '1rem', backgroundColor: 'var(--background)', color: 'var(--text-primary)' }}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '8px', color: 'var(--text-primary)' }}>Phone</label>
                                        <input
                                            type="tel"
                                            value={candidateFormData.phone}
                                            onChange={(e) => setCandidateFormData({ ...candidateFormData, phone: e.target.value })}
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '1rem', backgroundColor: 'var(--background)', color: 'var(--text-primary)' }}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '8px', color: 'var(--text-primary)' }}>Stage</label>
                                        <select
                                            value={candidateFormData.stage}
                                            onChange={(e) => setCandidateFormData({ ...candidateFormData, stage: e.target.value })}
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '1rem', backgroundColor: 'var(--background)', color: 'var(--text-primary)' }}
                                        >
                                            <option value="Screening">Screening</option>
                                            <option value="Interview">Interview</option>
                                            <option value="Offer">Offer</option>
                                            <option value="Rejected">Rejected</option>
                                            <option value="Hired">Hired</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '8px', color: 'var(--text-primary)' }}>Score (%)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={candidateFormData.score}
                                            onChange={(e) => setCandidateFormData({ ...candidateFormData, score: parseInt(e.target.value) || 0 })}
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '1rem', backgroundColor: 'var(--background)', color: 'var(--text-primary)' }}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '8px', color: 'var(--text-primary)' }}>Source</label>
                                        <input
                                            type="text"
                                            value={candidateFormData.source}
                                            onChange={(e) => setCandidateFormData({ ...candidateFormData, source: e.target.value })}
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '1rem', backgroundColor: 'var(--background)', color: 'var(--text-primary)' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '8px', color: 'var(--text-primary)' }}>Applied Date</label>
                                        <input
                                            type="date"
                                            value={candidateFormData.appliedDate}
                                            onChange={(e) => setCandidateFormData({ ...candidateFormData, appliedDate: e.target.value })}
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '1rem', backgroundColor: 'var(--background)', color: 'var(--text-primary)' }}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '8px', color: 'var(--text-primary)' }}>Experience</label>
                                        <input
                                            type="text"
                                            value={candidateFormData.experience}
                                            onChange={(e) => setCandidateFormData({ ...candidateFormData, experience: e.target.value })}
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '1rem', backgroundColor: 'var(--background)', color: 'var(--text-primary)' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '8px', color: 'var(--text-primary)' }}>Education</label>
                                        <input
                                            type="text"
                                            value={candidateFormData.education}
                                            onChange={(e) => setCandidateFormData({ ...candidateFormData, education: e.target.value })}
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '1rem', backgroundColor: 'var(--background)', color: 'var(--text-primary)' }}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '8px', color: 'var(--text-primary)' }}>Location</label>
                                        <input
                                            type="text"
                                            value={candidateFormData.location}
                                            onChange={(e) => setCandidateFormData({ ...candidateFormData, location: e.target.value })}
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '1rem', backgroundColor: 'var(--background)', color: 'var(--text-primary)' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '8px', color: 'var(--text-primary)' }}>Expected Salary</label>
                                        <input
                                            type="text"
                                            value={candidateFormData.expectedSalary}
                                            onChange={(e) => setCandidateFormData({ ...candidateFormData, expectedSalary: e.target.value })}
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '1rem', backgroundColor: 'var(--background)', color: 'var(--text-primary)' }}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '8px', color: 'var(--text-primary)' }}>Skills (comma separated)</label>
                                    <input
                                        type="text"
                                        value={candidateFormData.skills}
                                        onChange={(e) => setCandidateFormData({ ...candidateFormData, skills: e.target.value })}
                                        placeholder="React, Node.js, Python..."
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '1rem', backgroundColor: 'var(--background)', color: 'var(--text-primary)' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '8px', color: 'var(--text-primary)' }}>Notes</label>
                                    <textarea
                                        value={candidateFormData.notes}
                                        onChange={(e) => setCandidateFormData({ ...candidateFormData, notes: e.target.value })}
                                        rows="3"
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '1rem', backgroundColor: 'var(--background)', color: 'var(--text-primary)', resize: 'vertical' }}
                                    />
                                </div>

                                <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setShowCandidateFormModal(false)}
                                        style={{ flex: 1, padding: '12px', borderRadius: '8px', fontWeight: 600, border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--text-primary)', cursor: 'pointer' }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        style={{ flex: 1, padding: '12px', borderRadius: '8px', fontWeight: 600, backgroundColor: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer', boxShadow: 'var(--shadow-md)' }}
                                    >
                                        {isEditingCandidate ? 'Update Candidate' : 'Add Candidate'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }



            {/* Edit Employee Modal */}
            <EditEmployeeModal
                isOpen={showEditEmployeeModal}
                onClose={() => {
                    setShowEditEmployeeModal(false);
                    setSelectedEmployeeForEdit(null);
                }}
                employee={selectedEmployeeForEdit}
                onSuccess={async () => {
                    addToast('Employee updated successfully', 'success');
                    // Refresh employees list
                    if (type === 'workforce' || type === 'status') {
                        try {
                            const { data, error } = await supabase
                                .from('profiles')
                                .select(`
                                    id, 
                                    full_name, 
                                    email, 
                                    role, 
                                    team_id, 
                                    department,
                                    created_at,
                                    teams!team_id (
                                        team_name
                                    )
                                `);

                            if (error) {
                                console.error('Error refreshing employees:', error);
                                return;
                            }

                            // Also fetch project assignments
                            const { data: teamMembersData } = await supabase
                                .from('project_members')
                                .select(`
                                    user_id,
                                    project_id,
                                    projects:project_id (
                                        name
                                    )
                                `);

                            const projectMap = {};
                            if (teamMembersData) {
                                teamMembersData.forEach(member => {
                                    if (!projectMap[member.user_id]) projectMap[member.user_id] = []; if (member.projects?.name) projectMap[member.user_id].push(member.projects.name);
                                });
                            }

                            if (data) {
                                const transformedEmployees = data.map(emp => {
                                    // Match department name from ID
                                    const matchedDept = departments.find(d => d.id === emp.department);
                                    const departmentNameDisplay = matchedDept ? matchedDept.department_name : (emp.department || 'N/A');

                                    return {
                                        id: emp.id,
                                        name: emp.full_name || 'N/A',
                                        email: emp.email || 'N/A',
                                        role: emp.role || 'N/A',
                                        team_id: emp.team_id,
                                        dept: (Array.isArray(projectMap[emp.id]) && projectMap[emp.id].length > 0) ? (<>{projectMap[emp.id].map((pn, i) => <div key={i}>{pn}</div>)}</>) : (emp.teams?.team_name || 'Unassigned'),
                                        department_display: departmentNameDisplay,
                                        status: 'Active',
                                        joinDate: emp.created_at ? new Date(emp.created_at).toLocaleDateString() : 'N/A',
                                        performance: 'N/A',
                                        projects: 0,
                                        tasksCompleted: 0
                                    };
                                });
                                setEmployees(transformedEmployees);
                            }
                        } catch (err) {
                            console.error('Error refreshing after edit:', err);
                        }
                    }
                }}
            />
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

            {/* Edit Policy Modal */}
            <EditPolicyModal
                isOpen={showEditPolicyModal}
                onClose={() => setShowEditPolicyModal(false)}
                onSuccess={handlePolicySuccess}
                policy={selectedPolicy}
            />
        </div >
    );
};

export default ModulePage;




