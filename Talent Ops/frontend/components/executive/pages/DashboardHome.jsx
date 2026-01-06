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


const DashboardHome = () => {
    const { addToast } = useToast();
    const { userName } = useUser();
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
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(today);

    const [timeline, setTimeline] = useState([]);
    const [employeeStats, setEmployeeStats] = useState({ active: 0, away: 0, offline: 0, total: 0 });
    const [teamAnalytics, setTeamAnalytics] = useState([]);
    const [taskStats, setTaskStats] = useState({ pending: 0, inProgress: 0, completed: 0 });
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Data for Modal
    const [allEmployees, setAllEmployees] = useState([]);
    const [allTeams, setAllTeams] = useState([]);
    const [eventScope, setEventScope] = useState('all'); // 'all', 'team', 'employee'
    const [selectedTeams, setSelectedTeams] = useState([]);
    const [selectedEmployees, setSelectedEmployees] = useState([]);

    // Fetch data from Supabase
    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                // Fetch employees for stats
                const { data: employees } = await supabase
                    .from('profiles')
                    .select('id, full_name, role, team_id');

                // Fetch real attendance data
                const todayStr = new Date().toISOString().split('T')[0];
                const { data: attendanceData } = await supabase
                    .from('attendance')
                    .select('employee_id, clock_in, clock_out')
                    .eq('date', todayStr);

                // Fetch approved leaves for today (Absent)
                const { data: leavesData } = await supabase
                    .from('leaves')
                    .select('id')
                    .eq('status', 'approved')
                    .lte('from_date', todayStr)
                    .gte('to_date', todayStr);

                if (employees) {
                    setAllEmployees(employees);

                    let activeCount = 0;
                    if (attendanceData) {
                        activeCount = attendanceData.filter(a => a.clock_in && !a.clock_out).length;
                    }

                    const absentCount = leavesData ? leavesData.length : 0;

                    setEmployeeStats({
                        total: employees.length,
                        active: activeCount,
                        absent: absentCount,
                        away: 0,
                        offline: Math.max(0, employees.length - activeCount - absentCount)
                    });
                }

                // Fetch teams for analytics
                // Fetch tasks for stats and analytics
                // Fetch tasks for stats and analytics AND timeline
                const { data: tasks } = await supabase
                    .from('tasks')
                    .select('id, status, assigned_to, title, due_date, priority');

                if (tasks) {
                    setTaskStats({
                        pending: tasks.filter(t => ['pending', 'to_do', 'to do'].includes(t.status?.toLowerCase())).length,
                        inProgress: tasks.filter(t => ['in_progress', 'in progress'].includes(t.status?.toLowerCase())).length,
                        completed: tasks.filter(t => ['completed', 'done'].includes(t.status?.toLowerCase())).length
                    });
                }

                // Fetch announcements
                const { data: eventsData } = await supabase
                    .from('announcements')
                    .select('*')
                    .order('event_time', { ascending: true });

                let combinedEvents = [];

                if (tasks) {
                    const taskEvents = tasks
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
                    const formattedEvents = eventsData.map(event => ({
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

                // Fetch projects for analytics
                const { data: projectsData } = await supabase
                    .from('projects')
                    .select('id, name');

                const projects = projectsData ? projectsData.map(p => ({ id: p.id, name: p.name })) : [];

                if (projects.length > 0) setAllTeams(projects);

                if (projects && employees && tasks) {
                    const analytics = projects.map(project => {
                        const projectEmployees = employees.filter(e => e.team_id === project.id);
                        const projectEmployeeIds = projectEmployees.map(e => e.id);

                        // Calculate Project Performance
                        const projectTasks = tasks.filter(t => projectEmployeeIds.includes(t.assigned_to));
                        const completedTasks = projectTasks.filter(t => ['completed', 'done'].includes(t.status?.toLowerCase())).length;
                        const totalTasks = projectTasks.length;

                        const performance = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

                        let status = 'Steady';
                        let color = '#3b82f6'; // blue

                        if (performance >= 80) {
                            status = 'Excellent';
                            color = '#15803d'; // green
                        } else if (performance >= 50) {
                            status = 'Good';
                            color = '#0ea5e9'; // light blue
                        } else if (performance > 0 && performance < 50) {
                            status = 'Needs Improvement';
                            color = '#dc2626'; // red
                        } else {
                            status = 'No Activity';
                            color = '#94a3b8'; // gray
                        }

                        return {
                            id: project.id,
                            name: project.name,
                            count: projectEmployees.length,
                            performance: performance,
                            projects: Math.floor(Math.random() * 10) + 5, // Placeholder
                            status: status,
                            color: color
                        };
                    });
                    setTeamAnalytics(analytics);
                }
            } catch (error) {
                console.error('Error fetching dashboard data:', error);
            }
        };

        fetchDashboardData();
    }, [refreshTrigger]);

    // Real-time Subscription
    useEffect(() => {
        const sub = supabase
            .channel('dashboard_home_attendance_exec')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, (payload) => {
                setRefreshTrigger(prev => prev + 1);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(sub);
        };
    }, []);

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

    const handleAddEvent = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        const title = formData.get('title');
        const date = formData.get('date');
        const time = formData.get('time');
        const location = formData.get('location');

        try {
            const { error } = await supabase
                .from('announcements')
                .insert({
                    title: title,
                    event_date: date,
                    event_time: time,
                    location: location,
                    event_for: eventScope,
                    teams: selectedTeams,
                    employees: selectedEmployees,
                });

            if (error) throw error;

            addToast('Event added successfully', 'success');
            setShowAddEventModal(false);

            // Reset form state
            setEventScope('team');
            setSelectedTeams([]);
            setSelectedEmployees([]);

            // Trigger refresh
            setRefreshTrigger(prev => prev + 1);

        } catch (error) {
            console.error('Error adding event:', error);
            addToast('Failed to add event: ' + error.message, 'error');
        }
    };

    const handleAddEmployee = (e) => {
        e.preventDefault();
        setShowAddEmployeeModal(false);
        addToast('Employee added successfully', 'success');
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
                    Talent Ops wishes you a good and productive day. {employeeStats.active} employees active today. You have {filteredTimeline.length} events on {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.
                </p>
            </div>

            {/* Main Content Grid */}
            <div className="flex flex-col lg:grid lg:grid-cols-[2.5fr_1fr] gap-8">

                {/* Left Column: Cards Grid */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

                    {/* Top Row Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* Employees Card (Yellow) */}
                        <div
                            onClick={() => navigate('/executive-dashboard/employee-status')}
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

                        {/* Task Status Card (Blue) - Moved Here */}
                        <div
                            onClick={() => navigate('/executive-dashboard/tasks')}
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

                    {/* Team Analytics Card (Green) - Moved to Bottom, Full Width */}
                    <div style={{ backgroundColor: '#bbf7d0', borderRadius: '24px', padding: '24px', display: 'flex', flexDirection: 'column', minHeight: '200px' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#14532d', marginBottom: '16px' }}>Project Wise Status:</h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {teamAnalytics.map((team) => (
                                <div
                                    key={team.id}
                                    onClick={() => navigate('/executive-dashboard/analytics', { state: { teamId: team.id } })}
                                    style={{
                                        cursor: 'pointer',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '12px 16px',
                                        backgroundColor: 'rgba(255,255,255,0.4)',
                                        borderRadius: '12px',
                                        transition: 'transform 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateX(4px)'}
                                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateX(0)'}
                                >
                                    <span style={{ fontWeight: 'bold', color: '#14532d' }}>{team.name}</span>
                                    <span style={{
                                        fontSize: '0.75rem',
                                        fontWeight: 'bold',
                                        color: team.color,
                                        backgroundColor: '#fff',
                                        padding: '4px 8px',
                                        borderRadius: '12px',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                    }}>
                                        {team.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Notes Tile */}
                    <div style={{ marginTop: '32px' }}>
                        <NotesTile />
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
                                                    navigate('/executive-dashboard/tasks');
                                                } else if (event.type === 'announcement') {
                                                    navigate('/executive-dashboard/announcements');
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
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Add Employee</h3>
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
                            <button type="submit" style={{ backgroundColor: '#000', color: '#fff', padding: '12px', borderRadius: '12px', fontWeight: 'bold', border: 'none', cursor: 'pointer', marginTop: '8px' }}>Add Employee</button>
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
                                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                        <input
                                            type="radio"
                                            name="scope"
                                            value="all"
                                            checked={eventScope === 'all'}
                                            onChange={() => setEventScope('all')}
                                        />
                                        All Employees
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                        <input
                                            type="radio"
                                            name="scope"
                                            value="team"
                                            checked={eventScope === 'team'}
                                            onChange={() => setEventScope('team')}
                                        />
                                        Entire Project(s)
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                        <input
                                            type="radio"
                                            name="scope"
                                            value="employee"
                                            checked={eventScope === 'employee'}
                                            onChange={() => setEventScope('employee')}
                                        />
                                        Specific Employee(s)
                                    </label>
                                </div>
                            </div>

                            {/* Multi-select Lists */}
                            {eventScope === 'team' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '150px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '8px' }}>
                                    {allTeams.length > 0 ? allTeams.map(team => (
                                        <label key={team.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '4px' }}>
                                            <input
                                                type="checkbox"
                                                checked={selectedTeams.includes(team.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedTeams([...selectedTeams, team.id]);
                                                    } else {
                                                        setSelectedTeams(selectedTeams.filter(id => id !== team.id));
                                                    }
                                                }}
                                            />
                                            {team.name}
                                        </label>
                                    )) : <p style={{ color: '#94a3b8', fontSize: '0.9rem', padding: '4px' }}>No teams available</p>}
                                </div>
                            )}

                            {eventScope === 'employee' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '150px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '8px' }}>
                                    {allEmployees.length > 0 ? allEmployees.map(emp => (
                                        <label key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '4px' }}>
                                            <input
                                                type="checkbox"
                                                checked={selectedEmployees.includes(emp.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedEmployees([...selectedEmployees, emp.id]);
                                                    } else {
                                                        setSelectedEmployees(selectedEmployees.filter(id => id !== emp.id));
                                                    }
                                                }}
                                            />
                                            {emp.full_name}
                                        </label>
                                    )) : <p style={{ color: '#94a3b8', fontSize: '0.9rem', padding: '4px' }}>No employees available</p>}
                                </div>
                            )}

                            <input
                                name="date"
                                type="date"
                                required
                                defaultValue={formatDate(selectedDate)}
                                style={{ padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '1rem' }}
                            />
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
