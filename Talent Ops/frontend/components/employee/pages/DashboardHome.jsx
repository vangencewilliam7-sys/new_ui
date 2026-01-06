import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users, Clock, Calendar, ChevronRight, MoreHorizontal,
    CheckCircle2, AlertCircle, Timer, Plus, Star, X
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useUser } from '../context/UserContext';
import AttendanceTracker from '../components/Dashboard/AttendanceTracker';
import NotesTile from '../../shared/NotesTile';
import { supabase } from '../../../lib/supabaseClient';

const DashboardHome = () => {
    const { addToast } = useToast();
    const { userName, currentTeam } = useUser();
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
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(today);

    const [timeline, setTimeline] = useState([]);
    const [attendanceData, setAttendanceData] = useState([]);
    const [loading, setLoading] = useState(true);

    // State for leave balance from profile
    const [leaveBalance, setLeaveBalance] = useState(0);

    // Add Event State
    const [showAddEventModal, setShowAddEventModal] = useState(false);
    const [eventScope, setEventScope] = useState('team');
    const [selectedEventMembers, setSelectedEventMembers] = useState([]);
    const [allOrgEmployees, setAllOrgEmployees] = useState([]);
    const [teamMembers, setTeamMembers] = useState([]);

    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Fetch Data from Supabase
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();

                if (user) {
                    // 1. Fetch Attendance (count present/absent days)
                    const { data: attendance } = await supabase
                        .from('attendance')
                        .select('*')
                        .eq('employee_id', user.id);

                    if (attendance) setAttendanceData(attendance);

                    // 3. Fetch Leave Balance from profiles table
                    const { data: profileData } = await supabase
                        .from('profiles')
                        .select('leaves_remaining, monthly_leave_quota, team_id')
                        .eq('id', user.id)
                        .single();

                    if (profileData) {
                        // Use leaves_remaining (even if 0), only fall back if null/undefined
                        setLeaveBalance(profileData.leaves_remaining !== null && profileData.leaves_remaining !== undefined
                            ? profileData.leaves_remaining
                            : (profileData.monthly_leave_quota || 0));
                    }

                    // 4. Fetch All Employees & Team Members
                    const { data: allEmps, error: empError } = await supabase.from('profiles').select('id, full_name, team_id');

                    if (empError) console.error("Error fetching employees:", empError);

                    if (allEmps) {
                        setAllOrgEmployees(allEmps);
                        if (profileData && profileData.team_id) {
                            setTeamMembers(allEmps.filter(e => e.team_id === profileData.team_id && e.id !== user.id));
                        }
                    }

                    // 5. Fetch Timeline/Events
                    let combinedEvents = [];

                    // Tasks were removed from consultant view, so no task events

                    const { data: announcements } = await supabase
                        .from('announcements')
                        .select('*');

                    if (announcements && profileData) {
                        const filteredAnnouncements = announcements.filter(a => {
                            let targetTeams = [];
                            let targetEmployees = [];
                            try {
                                targetTeams = typeof a.teams === 'string' ? JSON.parse(a.teams) : (a.teams || []);
                                targetEmployees = typeof a.employees === 'string' ? JSON.parse(a.employees) : (a.employees || []);
                            } catch (e) {
                                console.error("Error parsing announcement targets", e);
                            }

                            if (a.event_for === 'team') {
                                return targetTeams.includes(profileData.team_id);
                            } else if (a.event_for === 'employee' || a.event_for === 'specific') {
                                return targetEmployees.includes(user.id);
                            }
                            return false;
                        });

                        const announcementEvents = filteredAnnouncements.map(a => ({
                            id: a.id,
                            time: a.event_time ? a.event_time.slice(0, 5) : '',
                            title: a.title,
                            location: a.location,
                            color: '#e0f2fe',
                            date: a.event_date,
                            status: a.status, // Pass status
                            type: 'announcement'
                        }));
                        combinedEvents = [...combinedEvents, ...announcementEvents];
                    }

                    // Sort by priority: Active > Future > Completed, then by time within each group
                    combinedEvents.sort((a, b) => {
                        // Determine status priority (Active=1, Future=2, Completed=3)
                        const getStatusPriority = (event) => {
                            if (event.type !== 'announcement') return 0; // Non-announcements first
                            const status = event.status || ((event.date === formatDate(new Date())) ? 'active' : (new Date(event.date) < new Date().setHours(0, 0, 0, 0) ? 'completed' : 'future'));
                            if (status === 'active') return 1;
                            if (status === 'future') return 2;
                            return 3; // completed
                        };

                        const priorityA = getStatusPriority(a);
                        const priorityB = getStatusPriority(b);

                        if (priorityA !== priorityB) return priorityA - priorityB;
                        return (a.time || '').localeCompare(b.time || '');
                    });
                    setTimeline(combinedEvents);
                }
            } catch (error) {
                console.error('Error fetching dashboard data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [refreshTrigger]);

    // REAL-TIME SUBSCRIPTION
    useEffect(() => {
        const channel = supabase
            .channel('employee-dashboard-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, (payload) => {
                console.log('Realtime Attendance Update:', payload);
                setRefreshTrigger(prev => prev + 1);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, (payload) => {
                console.log('Realtime Announcement:', payload);
                setRefreshTrigger(prev => prev + 1);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leaves' }, (payload) => {
                console.log('Realtime Leave Update:', payload);
                setRefreshTrigger(prev => prev + 1);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'timesheets' }, (payload) => {
                console.log('Realtime Timesheet Update:', payload);
                setRefreshTrigger(prev => prev + 1);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'payroll' }, (payload) => {
                console.log('Realtime Payroll Update:', payload);
                setRefreshTrigger(prev => prev + 1);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Calculate attendance stats from actual data
    const attendanceStats = {
        present: attendanceData.filter(a => {
            // Count records where clock_in exists (employee came to work)
            return a.clock_in !== null;
        }).length,
        absent: attendanceData.filter(a => {
            // You might want to calculate absent days differently
            // For now, counting records explicitly marked as absent
            return a.clock_in === null && a.date;
        }).length,
        leaveBalance: leaveBalance // From profiles table
    };

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
        const time = formData.get('time');
        const location = formData.get('location');
        const dateStr = formatDate(selectedDate);

        try {
            const { error } = await supabase.from('announcements').insert({
                title,
                event_date: dateStr,
                event_time: time,
                location,
                message: '', // Default as dashboard modal has no message field
                event_for: 'employee',
                employees: selectedEventMembers,
                teams: []
            });

            if (error) throw error;

            // Optimistic Update
            const newEvent = {
                id: `temp-${Date.now()}`,
                time: time,
                title: title,
                location: location,
                color: '#e0f2fe',
                date: dateStr
            };

            setTimeline([...timeline, newEvent].sort((a, b) => (a.time || '').localeCompare(b.time || '')));
            setShowAddEventModal(false);
            addToast('Event added successfully', 'success');
            setEventScope('team');
            setSelectedEventMembers([]);

        } catch (err) {
            console.error("Error adding event:", err);
            addToast('Failed to add event', 'error');
        }
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
                    Talent Ops wishes you a good and productive day. You have {filteredTimeline.length} events on {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.
                </p>
            </div>


            {/* Main Content Grid */}
            <div className="flex flex-col lg:grid lg:grid-cols-[2.5fr_1fr] gap-8">

                {/* Left Column: Cards Grid */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

                    {/* Attendance Tracker - Moved Here */}
                    <AttendanceTracker />

                    {/* Top Row Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">

                        {/* Attendance Report Card (Yellow) */}
                        <div style={{ backgroundColor: '#fef08a', borderRadius: '24px', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '240px', position: 'relative', overflow: 'hidden' }}>
                            <div>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#854d0e' }}>Attendance Report:</h3>
                            </div>

                            <div className="flex flex-wrap gap-6 mt-4">
                                <div>
                                    <span style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#000', textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>{attendanceStats.present}</span>
                                    <p style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#000' }}>Present</p>
                                    <p style={{ fontSize: '0.8rem', color: '#854d0e' }}>Days</p>
                                </div>
                                <div style={{ paddingTop: '12px' }}>
                                    <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#854d0e' }}>{attendanceStats.absent}</span>
                                    <p style={{ fontSize: '0.9rem', fontWeight: '600', color: '#854d0e' }}>Absent</p>
                                    <p style={{ fontSize: '0.75rem', color: '#a16207' }}>Days</p>
                                </div>
                                <div style={{ paddingTop: '12px' }}>
                                    <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#854d0e' }}>{attendanceStats.leaveBalance}</span>
                                    <p style={{ fontSize: '0.9rem', fontWeight: '600', color: '#854d0e' }}>Leave Balance</p>
                                    <p style={{ fontSize: '0.75rem', color: '#a16207' }}>Days</p>
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
                        {/* Notes Tile */}
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
                        <div style={{ marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e293b' }}>
                                {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </h3>
                        </div>

                        {/* Column Headers */}
                        <div style={{ display: 'flex', gap: '32px', marginBottom: '16px', paddingLeft: '4px' }}>
                            <span style={{ width: '70px', textAlign: 'right', fontWeight: 'bold', color: '#94a3b8', fontSize: '0.75rem', letterSpacing: '0.05em' }}>TIME</span>
                            <span style={{ fontWeight: 'bold', color: '#94a3b8', fontSize: '0.75rem', letterSpacing: '0.05em' }}>EVENT</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', position: 'relative', minHeight: '200px' }}>
                            {/* Vertical Line */}
                            <div style={{ position: 'absolute', left: '91px', top: '8px', bottom: '8px', width: '2px', backgroundColor: '#f1f5f9' }}></div>

                            {filteredTimeline.length > 0 ? (
                                filteredTimeline.map((event) => (
                                    <div
                                        key={event.id}
                                        onClick={() => {
                                            if (event.title?.startsWith('Task:')) {
                                                navigate('/employee-dashboard/tasks');
                                            } else if (event.type === 'announcement') {
                                                navigate('/employee-dashboard/announcements');
                                            } else {
                                                navigate('/employee-dashboard/tasks');
                                            }
                                        }}
                                        style={{
                                            display: 'flex',
                                            gap: '32px',
                                            cursor: 'pointer',
                                            position: 'relative',
                                            alignItems: 'flex-start'
                                        }}
                                    >
                                        {/* Time */}
                                        <span style={{ width: '70px', fontSize: '0.9rem', fontWeight: '600', color: '#64748b', textAlign: 'right', paddingTop: '14px' }}>{event.time}</span>

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
                                            boxShadow: '0 0 0 1px #e2e8f0',
                                            zIndex: 10
                                        }}></div>

                                        {/* Event Card */}
                                        <div
                                            style={{
                                                flex: 1,
                                                backgroundColor: '#fff',
                                                padding: '16px 20px',
                                                borderRadius: '16px',
                                                border: '1px solid #e2e8f0',
                                                boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.transform = 'translateY(-2px)';
                                                e.currentTarget.style.boxShadow = '0 8px 12px -2px rgba(0,0,0,0.05)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.transform = 'translateY(0)';
                                                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)';
                                            }}
                                        >
                                            <div>
                                                <p style={{ fontWeight: 'bold', color: '#1e293b', fontSize: '1rem', marginBottom: '4px' }}>{event.title}</p>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: event.color === '#dbeafe' ? '#3b82f6' : '#10b981' }}></div>
                                                    <p style={{ fontSize: '0.85rem', color: '#64748b' }}>{event.location}</p>
                                                </div>
                                                {event.type === 'announcement' && (
                                                    <span style={{
                                                        fontSize: '0.65rem',
                                                        fontWeight: 'bold',
                                                        textTransform: 'uppercase',
                                                        padding: '2px 6px',
                                                        borderRadius: '8px',
                                                        marginLeft: '8px',
                                                        backgroundColor: (event.status === 'completed' || new Date(event.date) < new Date().setHours(0, 0, 0, 0)) ? '#f1f5f9' : (event.status === 'active' || event.date === formatDate(new Date())) ? '#dcfce7' : '#e0f2fe',
                                                        color: (event.status === 'completed' || new Date(event.date) < new Date().setHours(0, 0, 0, 0)) ? '#64748b' : (event.status === 'active' || event.date === formatDate(new Date())) ? '#166534' : '#0369a1'
                                                    }}>
                                                        {(event.status === 'completed' || new Date(event.date) < new Date().setHours(0, 0, 0, 0)) ? 'Completed' : (event.status === 'active' || event.date === formatDate(new Date())) ? 'Active' : 'Future'}
                                                    </span>
                                                )}
                                            </div>
                                            <ChevronRight size={18} color="#cbd5e1" />
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100px', color: '#94a3b8', fontStyle: 'italic', paddingLeft: '80px' }}>
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
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Add Project Member</h3>
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
                            <button type="submit" style={{ backgroundColor: '#000', color: '#fff', padding: '12px', borderRadius: '12px', fontWeight: 'bold', border: 'none', cursor: 'pointer', marginTop: '8px' }}>Add Project Member</button>
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
                                        My Project
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
                                                {/* Select All Option - Only for My Project */}
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

                                                {currentList.length === 0 && (
                                                    <p style={{ padding: '4px', color: '#94a3b8', fontStyle: 'italic', fontSize: '0.9rem' }}>
                                                        No employees found
                                                    </p>
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
