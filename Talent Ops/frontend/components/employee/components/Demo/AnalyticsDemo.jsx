import React, { useState, useEffect } from 'react';
import { useUser } from '../../context/UserContext';
import { TrendingUp, Award, Briefcase, Star } from 'lucide-react';
import { supabase } from '../../../../lib/supabaseClient';
import { useToast } from '../../context/ToastContext';

const AnalyticsDemo = () => {
    const { userName } = useUser();
    const { addToast } = useToast();
    const [loading, setLoading] = useState(true);

    const [myStats, setMyStats] = useState({
        performance: 0,
        tasksCompleted: 0,
        activeTasks: 0,
        attendance: '0%'
    });

    const [performanceHistory, setPerformanceHistory] = useState([]);

    useEffect(() => {
        fetchAnalytics();
    }, []);

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // 1. Fetch Tasks
            const { data: tasks, error: tasksError } = await supabase
                .from('tasks')
                .select('*')
                .eq('assigned_to', user.id);

            if (tasksError) throw tasksError;

            // 2. Fetch Attendance
            const { data: attendance, error: attendanceError } = await supabase
                .from('attendance')
                .select('*')
                .eq('employee_id', user.id);

            if (attendanceError) throw attendanceError;

            // --- Calculate Stats ---

            // Tasks Stats
            const totalTasks = tasks.length;
            const completedTasks = tasks.filter(t => t.status === 'done' || t.status === 'Completed').length;
            const activeTasks = tasks.filter(t => t.status === 'in_progress' || t.status === 'In Progress' || t.status === 'pending' || t.status === 'Pending').length;

            const performanceRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

            // Attendance Stats
            const totalAttendanceDays = attendance.length;
            const presentDays = attendance.filter(a => a.status === 'Present').length;
            const attendanceRate = totalAttendanceDays > 0 ? Math.round((presentDays / totalAttendanceDays) * 100) : 0;

            setMyStats({
                performance: performanceRate,
                tasksCompleted: completedTasks,
                activeTasks: activeTasks,
                attendance: `${attendanceRate}%`
            });

            // --- Calculate History (Last 6 Months) ---
            // Group completed tasks by month
            const last6Months = [];
            for (let i = 5; i >= 0; i--) {
                const d = new Date();
                d.setMonth(d.getMonth() - i);
                const monthName = d.toLocaleString('default', { month: 'short' });
                const monthNum = d.getMonth();
                const year = d.getFullYear();

                // Count completed tasks for this month
                const count = tasks.filter(t => {
                    const tDate = new Date(t.created_at || t.due_date); // Use created_at or due_date as proxy
                    return (t.status === 'done' || t.status === 'Completed') &&
                        tDate.getMonth() === monthNum &&
                        tDate.getFullYear() === year;
                }).length;

                // For demo purposes, if count is 0, generate a random realistic number based on performance or keep 0
                // Let's keep it real: 0 if no data.
                // Actually, to make the chart look good if empty, maybe show "Tasks Due" vs "Completed"?
                // Let's just show completed count.

                last6Months.push({ month: monthName, score: count });
            }
            setPerformanceHistory(last6Months);

        } catch (error) {
            console.error('Error fetching analytics:', error);
            addToast('Failed to load analytics', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                    My Analytics
                </h2>
            </div>

            {/* Top Stats Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--spacing-lg)' }}>
                {[
                    { label: 'Task Completion Rate', value: `${myStats.performance}%`, change: '+2.5%', icon: Award, color: '#f59e0b' },
                    { label: 'Tasks Completed', value: myStats.tasksCompleted, change: '+5', icon: Briefcase, color: '#3b82f6' },
                    { label: 'Active Tasks', value: myStats.activeTasks, change: '-1', icon: Star, color: '#8b5cf6' },
                    { label: 'Attendance Rate', value: myStats.attendance, change: 'Stable', icon: TrendingUp, color: '#10b981' },
                ].map((stat, i) => (
                    <div key={i} style={{ backgroundColor: 'var(--surface)', padding: 'var(--spacing-lg)', borderRadius: '16px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 'var(--spacing-md)' }}>
                            <div style={{ padding: '10px', borderRadius: '12px', backgroundColor: stat.color + '20', color: stat.color }}>
                                <stat.icon size={20} />
                            </div>
                            {/* <span style={{ fontSize: '0.875rem', color: 'var(--success)', fontWeight: 600 }}>
                                {stat.change}
                            </span> */}
                        </div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 500 }}>{stat.label}</p>
                        <h3 style={{
                            fontSize: '1.8rem',
                            fontWeight: '700',
                            marginTop: '8px',
                            color: 'var(--text-primary)',
                            fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                            letterSpacing: '-0.02em'
                        }}>
                            {stat.value}
                        </h3>
                    </div>
                ))}
            </div>

            {/* Performance History Chart */}
            <div style={{ backgroundColor: 'var(--surface)', borderRadius: '16px', boxShadow: 'var(--shadow-sm)', padding: 'var(--spacing-lg)', border: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '24px', color: 'var(--text-primary)' }}>Tasks Completed (Last 6 Months)</h3>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '200px', paddingBottom: '20px', borderBottom: '1px solid var(--border)' }}>
                    {performanceHistory.map((item, i) => (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flex: 1 }}>
                            <div
                                title={`${item.score} tasks`}
                                style={{
                                    width: '40px',
                                    height: `${Math.max(item.score * 10, 4)}px`, // Scale height, min 4px
                                    maxHeight: '150px',
                                    backgroundColor: '#3b82f6',
                                    borderRadius: '8px 8px 0 0',
                                    opacity: 0.8,
                                    transition: 'height 0.3s'
                                }}></div>
                            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{item.month}</span>
                        </div>
                    ))}
                </div>
            </div>



        </div>
    );
};

export default AnalyticsDemo;
