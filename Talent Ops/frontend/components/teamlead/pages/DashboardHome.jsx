import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users, Clock, Calendar, ChevronRight, MoreHorizontal,
    CheckCircle2, AlertCircle, Timer, Plus, Star, X
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useUser } from '../context/UserContext';
import { supabase } from '../../../lib/supabaseClient';
import NotesTile from '../../shared/NotesTile';

import AttendanceTracker from '../components/Dashboard/AttendanceTracker';


const DashboardHome = () => {
    const { addToast } = useToast();
    const { userName, currentTeam, teamId } = useUser();
    const navigate = useNavigate();

    // Helper to format date as YYYY-MM-DD for comparison (Local Time)
    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // State
    const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
    const [showAddEventModal, setShowAddEventModal] = useState(false);
    const [eventScope, setEventScope] = useState('team'); // 'team' or 'specific'
    const [selectedEventMembers, setSelectedEventMembers] = useState([]);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(today);

    // State for real data
    const [teamMembers, setTeamMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [teamLeadProfile, setTeamLeadProfile] = useState(null);

    const [employeeStats, setEmployeeStats] = useState({
        active: 0,
        away: 0,
        offline: 0,
        total: 0
    });

    const [attendanceStats, setAttendanceStats] = useState({
        present: 0,
        absent: 0,
        leaveBalance: 0
    });

    const [taskStats, setTaskStats] = useState({
        inProgress: 0,
        inReview: 0,
        completed: 0
    });

    const [timeline, setTimeline] = useState([]);
    const [error, setError] = useState(null);

    const [allOrgEmployees, setAllOrgEmployees] = useState([]);

    // Fetch team lead's profile and team members
    useEffect(() => {
        const fetchTeamData = async () => {
            try {
                setLoading(true);
                console.log('=== Fetching Team Lead Data ===');

                // Get current user
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    console.error('No authenticated user');
                    return;
                }

                console.log('Current user ID:', user.id);

                // Get team lead's profile
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                if (profileError) {
                    console.error('Error fetching profile:', profileError);
                    return;
                }

                setTeamLeadProfile(profile);

                // Fetch All Employees for Event Selection
                const { data: allEmps } = await supabase
                    .from('profiles')
                    .select('id, full_name, team_id');

                if (allEmps) {
                    setAllOrgEmployees(allEmps);
                }

                // Get team members (employees with the same team_id)
                if (profile && teamId) profile.team_id = teamId; // Override with selected project

                if (profile?.team_id) {
                    console.log('Fetching team members for team_id:', profile.team_id);

                    const { data: members, error: membersError } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('team_id', profile.team_id)
                        .neq('id', user.id); // Exclude the team lead themselves

                    if (membersError) {
                        console.error('Error fetching team members:', membersError);
                    } else {
                        console.log('Team Members:', members);

                        // Get today's date for attendance/leave checks
                        const today = new Date().toISOString().split('T')[0];

                        // Fetch attendance for today
                        const { data: attendance } = await supabase
                            .from('attendance')
                            .select('*')
                            .eq('date', today);

                        const attendanceMap = {};
                        if (attendance) {
                            attendance.forEach(a => {
                                attendanceMap[a.employee_id] = a;
                            });
                        }

                        // Fetch approved leaves for today
                        const { data: leaves } = await supabase
                            .from('leaves')
                            .select('employee_id')
                            .eq('status', 'approved')
                            .lte('from_date', today)
                            .gte('to_date', today);

                        const leaveSet = new Set(leaves?.map(l => l.employee_id));

                        // Fetch tasks and availability for each team member
                        const membersWithStatus = await Promise.all(
                            members.map(async (member) => {
                                const { data: tasks } = await supabase
                                    .from('tasks')
                                    .select('*')
                                    .eq('assigned_to', member.id)
                                    .eq('status', 'in_progress')
                                    .limit(1);

                                const latestTask = tasks && tasks.length > 0 ? tasks[0] : null;

                                // Determine availability
                                let availability = 'Offline';
                                const att = attendanceMap[member.id];

                                if (leaveSet.has(member.id)) {
                                    availability = 'On Leave';
                                } else if (att && att.clock_in && !att.clock_out) {
                                    availability = 'Online';
                                }

                                return {
                                    id: member.id,
                                    name: member.full_name || member.email,
                                    team: currentTeam,
                                    task: latestTask ? latestTask.title : 'No active task',
                                    status: availability
                                };
                            })
                        );

                        setTeamMembers(membersWithStatus);
                        setEmployeeStats({
                            total: membersWithStatus.length,
                            active: membersWithStatus.filter(m => m.status === 'Online').length,
                            away: membersWithStatus.filter(m => m.status === 'On Leave').length,
                            offline: membersWithStatus.filter(m => m.status === 'Offline').length
                        });

                        // Calculate task stats
                        const allTasks = await Promise.all(
                            members.map(async (member) => {
                                const { data: tasks } = await supabase
                                    .from('tasks')
                                    .select('*')
                                    .eq('assigned_to', member.id);
                                return tasks || [];
                            })
                        );

                        const flatTasks = allTasks.flat();
                        setTaskStats({
                            inProgress: flatTasks.filter(t => t.status === 'in_progress').length,
                            inReview: flatTasks.filter(t => t.status === 'pending').length,
                            completed: flatTasks.filter(t => t.status === 'done' || t.status === 'completed').length
                        });

                        // Fetch Announcements & Update Timeline
                        const { data: eventsData } = await supabase
                            .from('announcements')
                            .select('*')
                            .order('event_time', { ascending: true });

                        let combinedEvents = [];

                        if (flatTasks) {
                            const taskEvents = flatTasks
                                .filter(t => t.due_date)
                                .map(t => ({
                                    id: `task-${t.id}`,
                                    date: t.due_date,
                                    time: '09:00',
                                    title: `Task: ${t.title}`,
                                    location: `${t.priority} Priority`,
                                    color: '#fef3c7',
                                    scope: 'task',
                                    participants: []
                                }));
                            combinedEvents = [...combinedEvents, ...taskEvents];
                        }

                        if (eventsData) {
                            const filteredEvents = eventsData.filter(e => {
                                let targetTeams = [];
                                let targetEmployees = [];
                                try {
                                    targetTeams = typeof e.teams === 'string' ? JSON.parse(e.teams) : (e.teams || []);
                                    targetEmployees = typeof e.employees === 'string' ? JSON.parse(e.employees) : (e.employees || []);
                                } catch (err) {
                                    console.error("Error parsing event targets", err);
                                }

                                if (e.event_for === 'team') {
                                    // Team Lead sees events for their team
                                    return targetTeams.includes(profile.team_id);
                                } else if (e.event_for === 'specific' || e.event_for === 'employee') {
                                    // Team Lead sees events for themselves
                                    return targetEmployees.includes(user.id);
                                }
                                return false;
                            });

                            const formattedEvents = filteredEvents.map(event => ({
                                id: event.id,
                                date: event.event_date,
                                time: event.event_time ? event.event_time.slice(0, 5) : '',
                                title: event.title,
                                location: event.location,
                                color: '#e0f2fe',
                                scope: event.event_for,
                                participants: [],
                                status: event.status,
                                type: 'announcement'
                            }));
                            combinedEvents = [...combinedEvents, ...formattedEvents];
                        }

                        // Sort by priority: Active > Future > Completed, then by time within each group
                        combinedEvents.sort((a, b) => {
                            const getStatusPriority = (event) => {
                                if (event.type !== 'announcement') return 0;
                                const status = event.status || ((event.date === formatDate(new Date())) ? 'active' : (new Date(event.date) < new Date().setHours(0, 0, 0, 0) ? 'completed' : 'future'));
                                if (status === 'active') return 1;
                                if (status === 'future') return 2;
                                return 3;
                            };

                            const priorityA = getStatusPriority(a);
                            const priorityB = getStatusPriority(b);

                            if (priorityA !== priorityB) return priorityA - priorityB;
                            return a.time.localeCompare(b.time);
                        });
                        setTimeline(combinedEvents);
                    }
                }

                // Fetch team lead's own attendance stats
                const currentMonth = new Date().getMonth() + 1;
                const currentYear = new Date().getFullYear();

                // Get attendance records for current month
                const { data: attendanceData } = await supabase
                    .from('attendance')
                    .select('*')
                    .eq('employee_id', user.id)
                    .gte('date', `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`)
                    .lte('date', `${currentYear}-${String(currentMonth).padStart(2, '0')}-31`);

                const presentDays = attendanceData ? attendanceData.filter(a => a.clock_in).length : 0;

                // Calculate total working days in current month (excluding weekends)
                const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
                const today = new Date().getDate();
                let workingDays = 0;
                for (let day = 1; day <= Math.min(today, daysInMonth); day++) {
                    const date = new Date(currentYear, currentMonth - 1, day);
                    const dayOfWeek = date.getDay();
                    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday or Saturday
                        workingDays++;
                    }
                }

                const absentDays = Math.max(0, workingDays - presentDays);

                // Get leave balance
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('leaves_remaining')
                    .eq('id', user.id)
                    .single();

                setAttendanceStats({
                    present: presentDays,
                    absent: absentDays,
                    leaveBalance: profileData?.leaves_remaining || 0
                });

            } catch (error) {
                console.error('Error fetching team data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchTeamData();
    }, [currentTeam, teamId]);

    const filteredTeamMembers = currentTeam === 'All'
        ? teamMembers
        : teamMembers.filter(m => m.team === currentTeam);

    const teamAnalytics = [];
    const filteredTeamAnalytics = currentTeam === 'All'
        ? teamAnalytics
        : teamAnalytics.filter(t => t.name === currentTeam);

    const activeTeamStats = filteredTeamAnalytics.length === 1 ? filteredTeamAnalytics[0] : null;

    const displayStats = activeTeamStats ? {
        total: activeTeamStats.count,
        active: Math.floor(activeTeamStats.count * 0.7),
        away: Math.floor(activeTeamStats.count * 0.2),
        offline: Math.ceil(activeTeamStats.count * 0.1)
    } : employeeStats;

    // Handlers
    const handleMonthChange = (direction) => {
        const newDate = new Date(currentMonth);
        newDate.setMonth(currentMonth.getMonth() + direction);
        setCurrentMonth(newDate);
    };

    const handleDateClick = (day) => {
        const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        setSelectedDate(newDate);
    };

    const handleAddEvent = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const newEvent = {
            id: Date.now(),
            date: formatDate(selectedDate), // Add to currently selected date
            time: formData.get('time'),
            title: formData.get('title'),
            location: formData.get('location'),
            color: '#e0f2fe',
            scope: eventScope,
            members: eventScope === 'specific' ? selectedEventMembers : 'All'
        };
        setTimeline([...timeline, newEvent].sort((a, b) => a.time.localeCompare(b.time)));
        setShowAddEventModal(false);
        setEventScope('team');
        setSelectedEventMembers([]);
        addToast('Event added successfully', 'success');
    };

    const handleAddEmployee = (e) => {
        e.preventDefault();
        setShowAddEmployeeModal(false);
        addToast('Team Member added successfully', 'success');
    };

    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
    const startDayOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

    const filteredTimeline = timeline.filter(event => event.date === formatDate(selectedDate));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '32px' }}>

            {/* Header */}
            <div>
                <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '8px' }}>
                    Good morning, <span style={{ color: 'var(--accent)' }}>{userName}</span>
                </h1>
                <p style={{ color: '#64748b', fontSize: '1rem' }}>
                    Talent Ops wishes you a good and productive day. {displayStats.active} team members active today. You have {filteredTimeline.length} events on {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.
                </p>
            </div>

            {/* Main Content Grid */}
            <div className="flex flex-col lg:grid lg:grid-cols-[2.5fr_1fr] gap-8">

                {/* Left Column: Cards Grid */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

                    {/* Attendance Tracker */}
                    <AttendanceTracker />

                    {/* Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* Employees Card (Yellow) */}
                        <div
                            onClick={() => navigate('/teamlead-dashboard/employee-status')}
                            style={{
                                backgroundColor: '#fef08a',
                                borderRadius: '24px',
                                padding: '24px',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                minHeight: '240px',
                                position: 'relative',
                                overflow: 'hidden',
                                cursor: 'pointer',
                                transition: 'transform 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            <div>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#854d0e' }}>Employees:</h3>
                            </div>

                            <div style={{ display: 'flex', gap: '32px', marginTop: '16px' }}>
                                <div>
                                    <span style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#000', textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>{employeeStats.active}</span>
                                    <p style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#000' }}>Active</p>
                                </div>
                                <div style={{ paddingTop: '12px' }}>
                                    <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#854d0e' }}>{employeeStats.absent}</span>
                                    <p style={{ fontSize: '0.9rem', fontWeight: '600', color: '#854d0e' }}>Absent</p>
                                </div>
                                <div style={{ paddingTop: '12px' }}>
                                    <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#854d0e' }}>{employeeStats.offline}</span>
                                    <p style={{ fontSize: '0.9rem', fontWeight: '600', color: '#854d0e' }}>Offline</p>
                                </div>
                            </div>

                            {/* Decorative Bottom Shapes */}
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', marginTop: 'auto', height: '40px' }}>
                                <div style={{ width: '30px', height: '20px', backgroundColor: '#422006', borderRadius: '15px 15px 0 0', opacity: 0.8 }}></div>
                                <div style={{ width: '30px', height: '35px', backgroundColor: '#a16207', borderRadius: '15px 15px 0 0', opacity: 0.6 }}></div>
                                <div style={{ width: '30px', height: '15px', backgroundColor: '#422006', borderRadius: '15px 15px 0 0', opacity: 0.8 }}></div>
                                <div style={{ width: '30px', height: '40px', backgroundColor: '#a16207', borderRadius: '15px 15px 0 0', opacity: 0.6 }}></div>
                                <div style={{ width: '30px', height: '25px', backgroundColor: '#422006', borderRadius: '15px 15px 0 0', opacity: 0.8 }}></div>
                                <div style={{ width: '30px', height: '40px', backgroundColor: '#a16207', borderRadius: '15px 15px 0 0', opacity: 0.6 }}></div>
                                <div style={{ width: '30px', height: '20px', backgroundColor: '#422006', borderRadius: '15px 15px 0 0', opacity: 0.8 }}></div>
                            </div>
                        </div>

                        {/* Task Status Card (Blue) */}
                        <div
                            onClick={() => navigate('/teamlead-dashboard/tasks')}
                            style={{
                                backgroundColor: '#bfdbfe', borderRadius: '24px', padding: '24px',
                                display: 'flex', flexDirection: 'column', minHeight: '240px',
                                position: 'relative', overflow: 'hidden', cursor: 'pointer',
                                transition: 'transform 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#1e3a8a', marginBottom: '24px' }}>Task Status:</h3>

                            <div className="flex flex-wrap gap-4 justify-between">
                                <div>
                                    <span style={{ fontSize: '2rem', fontWeight: 'bold', color: '#000' }}>{taskStats.pending}</span>
                                    <p style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#1e3a8a', marginTop: '4px' }}>PENDING</p>
                                </div>
                                <div>
                                    <span style={{ fontSize: '2rem', fontWeight: 'bold', color: '#000' }}>{taskStats.inProgress}</span>
                                    <p style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#1e3a8a', marginTop: '4px' }}>IN PROGRESS</p>
                                </div>
                                <div>
                                    <span style={{ fontSize: '2rem', fontWeight: 'bold', color: '#000' }}>{taskStats.completed}</span>
                                    <p style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#1e3a8a', marginTop: '4px' }}>COMPLETED</p>
                                </div>
                            </div>

                            {/* Decorative Triangle */}
                            <div style={{ position: 'absolute', bottom: 0, right: 0, width: '0', height: '0', borderStyle: 'solid', borderWidth: '0 0 100px 100px', borderColor: 'transparent transparent rgba(255,255,255,0.3) transparent' }}></div>
                        </div>
                    </div>

                </div>

                {/* Right Column: Timeline */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

                    {/* Calendar Widget */}
                    <div style={{ backgroundColor: '#fff', borderRadius: '24px', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <span style={{ fontWeight: 'bold', color: '#1e293b' }}>{monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}</span>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => handleMonthChange(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: '#64748b' }}>&lt;</button>
                                <button onClick={() => handleMonthChange(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: '#64748b' }}>&gt;</button>
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', textAlign: 'center', fontSize: '0.8rem', color: '#64748b' }}>
                            <span>MO</span><span>TU</span><span>WE</span><span>TH</span><span>FR</span><span>SA</span><span>SU</span>

                            {/* Empty cells for offset */}
                            {Array.from({ length: startDayOffset }).map((_, i) => (
                                <span key={`empty-${i}`}></span>
                            ))}

                            {/* Calendar Days */}
                            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
                                const isSelected = selectedDate.getDate() === d && selectedDate.getMonth() === currentMonth.getMonth() && selectedDate.getFullYear() === currentMonth.getFullYear();
                                const isToday = today.getDate() === d && today.getMonth() === currentMonth.getMonth() && today.getFullYear() === currentMonth.getFullYear();

                                return (
                                    <span
                                        key={d}
                                        onClick={() => handleDateClick(d)}
                                        style={{
                                            padding: '6px',
                                            borderRadius: '50%',
                                            backgroundColor: isSelected ? '#000' : isToday ? '#e2e8f0' : 'transparent',
                                            color: isSelected ? '#fff' : 'inherit',
                                            cursor: 'pointer',
                                            fontWeight: isSelected || isToday ? 'bold' : 'normal'
                                        }}
                                    >
                                        {d}
                                    </span>
                                );
                            })}
                        </div>
                    </div>

                    {/* Add Event Button */}
                    <button
                        onClick={() => setShowAddEventModal(true)}
                        style={{ backgroundColor: '#000', color: '#fff', padding: '16px', borderRadius: '32px', fontWeight: 'bold', fontSize: '1rem', border: 'none', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                    >
                        Add event
                    </button>

                    {/* Timeline */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e293b' }}>
                                {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </h3>
                        </div>

                        {/* Column Headers */}
                        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '32px', marginBottom: '16px', paddingLeft: '8px' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#94a3b8', letterSpacing: '0.05em' }}>TIME</span>
                            <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#94a3b8', letterSpacing: '0.05em' }}>EVENT</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0px', position: 'relative', minHeight: '200px' }}>
                            {/* Vertical Line */}
                            <div style={{
                                position: 'absolute',
                                left: '91px',
                                top: '10px',
                                bottom: '10px',
                                width: '2px',
                                backgroundColor: '#f1f5f9',
                                zIndex: 0
                            }}></div>

                            {filteredTimeline.length > 0 ? (
                                filteredTimeline.map((event) => (
                                    <div key={event.id} style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '32px', position: 'relative', zIndex: 1, marginBottom: '24px' }}>
                                        {/* Time */}
                                        <span style={{
                                            fontSize: '0.9rem',
                                            fontWeight: '600',
                                            color: '#64748b',
                                            paddingTop: '14px',
                                            textAlign: 'right'
                                        }}>
                                            {event.time}
                                        </span>

                                        {/* Timeline Dot */}
                                        <div style={{
                                            position: 'absolute',
                                            left: '86px',
                                            top: '20px',
                                            width: '12px',
                                            height: '12px',
                                            borderRadius: '50%',
                                            backgroundColor: '#3b82f6',
                                            border: '2px solid #fff',
                                            boxShadow: '0 0 0 2px #e0f2fe',
                                            zIndex: 2
                                        }}></div>

                                        {/* Event Card */}
                                        <div style={{
                                            backgroundColor: event.color,
                                            padding: '16px',
                                            borderRadius: '16px',
                                            transition: 'all 0.2s ease',
                                            cursor: 'pointer',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                                        }}
                                            onClick={() => {
                                                if (event.scope === 'task') {
                                                    navigate('/teamlead-dashboard/team-tasks');
                                                } else if (event.type === 'announcement') {
                                                    navigate('/teamlead-dashboard/announcements');
                                                }
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.transform = 'translateY(-2px)';
                                                e.currentTarget.style.boxShadow = '0 8px 16px -4px rgba(0,0,0,0.1)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.transform = 'translateY(0)';
                                                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)';
                                            }}
                                        >
                                            <p style={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '4px' }}>{event.title}</p>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.85rem' }}>
                                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#94a3b8' }}></div>
                                                {event.location}
                                            </div>
                                            {event.type === 'announcement' && (
                                                <span style={{
                                                    fontSize: '0.65rem',
                                                    fontWeight: 'bold',
                                                    textTransform: 'uppercase',
                                                    padding: '2px 6px',
                                                    borderRadius: '8px',
                                                    marginTop: '4px',
                                                    display: 'inline-block',
                                                    backgroundColor: (event.status === 'completed' || new Date(event.date) < new Date().setHours(0, 0, 0, 0)) ? '#f1f5f9' : (event.status === 'active' || event.date === formatDate(new Date())) ? '#dcfce7' : '#e0f2fe',
                                                    color: (event.status === 'completed' || new Date(event.date) < new Date().setHours(0, 0, 0, 0)) ? '#64748b' : (event.status === 'active' || event.date === formatDate(new Date())) ? '#166534' : '#0369a1'
                                                }}>
                                                    {(event.status === 'completed' || new Date(event.date) < new Date().setHours(0, 0, 0, 0)) ? 'Completed' : (event.status === 'active' || event.date === formatDate(new Date())) ? 'Active' : 'Future'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div style={{ paddingLeft: '112px', paddingTop: '24px', color: '#94a3b8', fontStyle: 'italic' }}>
                                    No events for this day
                                </div>
                            )}
                        </div>
                    </div>



                </div>
            </div>

            {/* Modals */}
            {showAddEmployeeModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ backgroundColor: '#fff', padding: '32px', borderRadius: '24px', width: '400px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Add Team Member</h3>
                            <button onClick={() => setShowAddEmployeeModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
                        </div>
                        <form onSubmit={handleAddEmployee} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <input type="text" placeholder="Full Name" required style={{ padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '1rem' }} />
                            <input type="text" placeholder="Role" required style={{ padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '1rem' }} />
                            <select style={{ padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '1rem' }}>
                                <option>Engineering</option>
                                <option>Design</option>
                                <option>Product</option>
                            </select>
                            <button type="submit" style={{ backgroundColor: '#000', color: '#fff', padding: '12px', borderRadius: '12px', fontWeight: 'bold', border: 'none', cursor: 'pointer', marginTop: '8px' }}>Add Team Member</button>
                        </form>
                    </div>
                </div>
            )}

            {showAddEventModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ backgroundColor: '#fff', padding: '32px', borderRadius: '24px', width: '400px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Add Event</h3>
                            <button onClick={() => setShowAddEventModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
                        </div>
                        <form onSubmit={handleAddEvent} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <input name="title" type="text" placeholder="Event Title" required style={{ padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '1rem' }} />

                            {/* Scope Selection */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#1e293b' }}>Who is this event for?</label>
                                <div style={{ display: 'flex', gap: '16px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                        <input
                                            type="radio"
                                            name="scope"
                                            value="team"
                                            checked={eventScope === 'team'}
                                            onChange={() => { setEventScope('team'); setSelectedEventMembers([]); }}
                                        />
                                        My Team
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                        <input
                                            type="radio"
                                            name="scope"
                                            value="specific"
                                            checked={eventScope === 'specific'}
                                            onChange={() => { setEventScope('specific'); setSelectedEventMembers([]); }}
                                        />
                                        All Employees
                                    </label>
                                </div>
                            </div>

                            {/* Member Selection */}
                            {(eventScope === 'specific' || eventScope === 'team') && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '150px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '8px' }}>
                                    {/* Determine List Source */}
                                    {(() => {
                                        const currentList = eventScope === 'team' ? teamMembers : allOrgEmployees;
                                        return (
                                            <>
                                                {/* Select All Option - Only for My Team */}
                                                {eventScope === 'team' && (
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '4px', fontWeight: 'bold', borderBottom: '1px solid #f1f5f9' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedEventMembers.length === currentList.length && currentList.length > 0}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setSelectedEventMembers(currentList.map(m => m.id));
                                                                } else {
                                                                    setSelectedEventMembers([]);
                                                                }
                                                            }}
                                                        />
                                                        Select All
                                                    </label>
                                                )}

                                                {currentList.map(member => (
                                                    <label key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '4px' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedEventMembers.includes(member.id)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setSelectedEventMembers([...selectedEventMembers, member.id]);
                                                                } else {
                                                                    setSelectedEventMembers(selectedEventMembers.filter(id => id !== member.id));
                                                                }
                                                            }}
                                                        />
                                                        {member.full_name || member.name}
                                                    </label>
                                                ))}
                                            </>
                                        );
                                    })()}
                                </div>
                            )}

                            <input name="time" type="time" required style={{ padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '1rem' }} />
                            <input name="location" type="text" placeholder="Location" required style={{ padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '1rem' }} />
                            <button type="submit" style={{ backgroundColor: '#000', color: '#fff', padding: '12px', borderRadius: '12px', fontWeight: 'bold', border: 'none', cursor: 'pointer', marginTop: '8px' }}>Save Event</button>
                        </form>
                    </div>
                </div>
            )}



        </div>
    );
};

export default DashboardHome;
