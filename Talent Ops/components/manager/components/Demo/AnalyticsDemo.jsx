import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { BarChart2, TrendingUp, Users, DollarSign, ChevronLeft, Award, Briefcase, Star } from 'lucide-react';
import { supabase } from '../../../../lib/supabaseClient';

const AnalyticsDemo = ({ currentProject, projectRole, userId }) => {
    const [selectedTeam, setSelectedTeam] = useState(null);
    const location = useLocation();

    const [teams, setTeams] = useState([]);
    const [employees, setEmployees] = useState({});
    const [totalHeadcount, setTotalHeadcount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAnalyticsData = async () => {
            try {
                setLoading(true);

                if (currentProject?.id) {
                    // --- PROJECT MODE ---
                    console.log('Analytics: Fetching for Project', currentProject.name);

                    // 1. Fetch Project Members
                    let query = supabase
                        .from('project_members')
                        .select('user_id, role')
                        .eq('project_id', currentProject.id);

                    // If not manager/team_lead, show ONLY self
                    if (!['manager', 'team_lead'].includes(projectRole)) {
                        query = query.eq('user_id', userId);
                    }

                    const { data: members, error: membersError } = await query;

                    if (membersError) throw membersError;

                    if (!members || members.length === 0) {
                        setTeams([]);
                        setEmployees({});
                        setTotalHeadcount(0);
                        return;
                    }

                    const memberIds = members.map(m => m.user_id);
                    setTotalHeadcount(memberIds.length);

                    // 2. Fetch Profiles
                    const { data: profiles, error: profilesError } = await supabase
                        .from('profiles')
                        .select('id, full_name, role, team_id')
                        .in('id', memberIds);

                    if (profilesError) throw profilesError;

                    // 3. Fetch Tasks (Scoped to Project)
                    const { data: tasksData, error: tasksError } = await supabase
                        .from('tasks')
                        .select('id, status, assigned_to, updated_at')
                        .eq('project_id', currentProject.id);

                    if (tasksError) throw tasksError;

                    // 4. Process Data
                    let projectActiveTasks = 0;
                    let projectCompletedTasks = 0;

                    // Map profiles to analytics format
                    const empList = profiles.map(emp => {
                        // Find this user's project role if available, else profile role
                        const pMember = members.find(m => m.user_id === emp.id);
                        const displayRole = pMember?.role || emp.role;

                        const empTasks = tasksData.filter(t => t.assigned_to === emp.id);
                        const completedTasks = empTasks.filter(t => ['completed', 'done'].includes(t.status?.toLowerCase())).length;
                        const activeEmpTasks = empTasks.filter(t => !['completed', 'done'].includes(t.status?.toLowerCase())).length;

                        projectActiveTasks += activeEmpTasks;
                        projectCompletedTasks += completedTasks;

                        const totalTasks = empTasks.length;
                        const performance = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

                        return {
                            id: emp.id,
                            name: emp.full_name,
                            role: displayRole, // Show their project role
                            performance: performance,
                            tasks: completedTasks,
                            status: performance > 80 ? 'Top Performer' : performance < 50 ? 'Needs Improvement' : 'Steady'
                        };
                    });

                    // Chart Data Calculation for Member View
                    let last6MonthsData = [];
                    if (!['manager', 'team_lead'].includes(projectRole) && empList.length > 0) {
                        const today = new Date();
                        const months = [];
                        for (let i = 5; i >= 0; i--) {
                            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
                            months.push(d);
                        }

                        last6MonthsData = months.map(monthDate => {
                            const monthName = monthDate.toLocaleString('default', { month: 'short' });
                            const year = monthDate.getFullYear();
                            const monthIdx = monthDate.getMonth();

                            const count = tasksData.filter(t => {
                                if (t.assigned_to !== userId) return false;
                                if (!['completed', 'done'].includes(t.status?.toLowerCase())) return false;
                                if (!t.updated_at) return false;
                                const tDate = new Date(t.updated_at);
                                return tDate.getMonth() === monthIdx && tDate.getFullYear() === year;
                            }).length;

                            return { name: monthName, value: count };
                        });
                    }


                    const avgPerformance = empList.length > 0
                        ? Math.round(empList.reduce((acc, curr) => acc + curr.performance, 0) / empList.length)
                        : 0;

                    const projectStats = {
                        id: currentProject.id,
                        name: currentProject.name,
                        lead: 'N/A', // Could fetch project lead
                        count: empList.length,
                        activeTasks: projectActiveTasks,
                        completedTasks: projectCompletedTasks, // Store total completed too
                        performance: avgPerformance,
                        color: '#8b5cf6',
                        chartData: last6MonthsData // Attach chart data
                    };

                    setTeams([projectStats]);
                    setEmployees({ [currentProject.id]: empList });
                    setSelectedTeam(projectStats); // Auto-select the project

                } else {
                    // --- ORGANIZATION MODE (Legacy) ---
                    // Fetch Total Headcount
                    const { count, error: countError } = await supabase
                        .from('profiles')
                        .select('*', { count: 'exact', head: true });

                    if (!countError) setTotalHeadcount(count || 0);

                    // Fetch Teams
                    const { data: teamsData, error: teamsError } = await supabase
                        .from('teams')
                        .select('id, team_name');

                    if (teamsError) throw teamsError;

                    // Fetch Employees
                    const { data: employeesData, error: employeesError } = await supabase
                        .from('profiles')
                        .select('id, full_name, role, team_id');

                    if (employeesError) throw employeesError;

                    // Fetch Tasks (Global)
                    const { data: tasksData, error: tasksError } = await supabase
                        .from('tasks')
                        .select('id, status, assigned_to');

                    if (tasksError) throw tasksError;

                    // Process Data
                    const employeesByTeam = {};
                    const teamStats = [];

                    if (teamsData) {
                        teamsData.forEach(team => {
                            const teamEmployees = employeesData.filter(e => e.team_id === team.id);
                            let teamActiveTasks = 0;

                            const empList = teamEmployees.map(emp => {
                                const empTasks = tasksData.filter(t => t.assigned_to === emp.id);
                                const completedTasks = empTasks.filter(t => ['completed', 'done'].includes(t.status?.toLowerCase())).length;
                                const activeEmpTasks = empTasks.filter(t => !['completed', 'done'].includes(t.status?.toLowerCase())).length;

                                teamActiveTasks += activeEmpTasks;

                                const totalTasks = empTasks.length;
                                const performance = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

                                return {
                                    id: emp.id,
                                    name: emp.full_name,
                                    role: emp.role,
                                    performance: performance,
                                    tasks: completedTasks,
                                    status: performance > 80 ? 'Top Performer' : performance < 50 ? 'Needs Improvement' : 'Steady'
                                };
                            });

                            employeesByTeam[team.id] = empList;

                            const avgPerformance = empList.length > 0
                                ? Math.round(empList.reduce((acc, curr) => acc + curr.performance, 0) / empList.length)
                                : 0;

                            teamStats.push({
                                id: team.id,
                                name: team.team_name,
                                lead: 'N/A',
                                count: teamEmployees.length,
                                activeTasks: teamActiveTasks,
                                performance: avgPerformance,
                                color: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'][Math.floor(Math.random() * 4)]
                            });
                        });
                    }
                    setTeams(teamStats);
                    setEmployees(employeesByTeam);
                }

            } catch (error) {
                console.error('Error fetching analytics:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchAnalyticsData();
    }, [currentProject?.id]); // Re-run when project changes

    // Auto-select team from router state if not in project mode
    useEffect(() => {
        if (!currentProject && location.state?.teamId && teams.length > 0) {
            const team = teams.find(t => t.id === location.state.teamId);
            if (team) setSelectedTeam(team);
        }
    }, [location.state, teams, currentProject]);

    const currentEmployees = selectedTeam ? (employees[selectedTeam.id] || []) : [];

    if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading analytics...</div>;

    // Calculate Global Stats
    const allEmployees = Object.values(employees).flat();
    const globalHeadcountVal = totalHeadcount;

    const globalPerformance = allEmployees.length > 0
        ? Math.round(allEmployees.reduce((acc, emp) => acc + emp.performance, 0) / allEmployees.length)
        : 0;

    // --- RENDER LOGIC ---
    const isMemberView = selectedTeam && currentProject && !['manager', 'team_lead'].includes(projectRole);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>

            {/* Header / Navigation */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                {/* Only show back button if NOT in project constrained mode */}
                {selectedTeam && !currentProject && (
                    <button
                        onClick={() => setSelectedTeam(null)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '4px',
                            color: 'var(--text-secondary)', fontWeight: 600,
                            padding: '8px 12px', borderRadius: '8px',
                            backgroundColor: 'var(--surface)', border: '1px solid var(--border)'
                        }}
                    >
                        <ChevronLeft size={16} /> Back to Overview
                    </button>
                )}
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                    {isMemberView ? 'My Analytics' : (selectedTeam ? `${selectedTeam.name} Analytics` : 'Organization Overview')}
                </h2>
            </div>

            {/* View Switching: Member vs Manager/Admin */}
            {isMemberView ? (
                // --- MEMBER VIEW (My Analytics) ---
                <>
                    {/* Member Stats Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--spacing-lg)' }}>
                        {[
                            { label: 'Task Completion Rate', value: `${selectedTeam.performance}%`, icon: Award, color: '#f59e0b' },
                            { label: 'Tasks Completed', value: selectedTeam.completedTasks || 0, icon: Briefcase, color: '#3b82f6' },
                            { label: 'Active Tasks', value: selectedTeam.activeTasks, icon: Star, color: '#8b5cf6' },
                            { label: 'Attendance Rate', value: '0%', icon: TrendingUp, color: '#10b981' },
                        ].map((stat, i) => (
                            <div key={i} style={{ backgroundColor: 'var(--surface)', padding: 'var(--spacing-lg)', borderRadius: '16px', boxShadow: 'var(--shadow-sm)', border: '1px solid #e2e8f0' }}>
                                <div style={{ marginBottom: '16px' }}>
                                    <div style={{ display: 'inline-flex', padding: '10px', borderRadius: '12px', backgroundColor: stat.color + '20', color: stat.color }}>
                                        <stat.icon size={20} />
                                    </div>
                                </div>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '4px' }}>{stat.label}</p>
                                <h3 style={{ fontSize: '1.75rem', fontWeight: 'bold' }}>{stat.value}</h3>
                            </div>
                        ))}
                    </div>

                    {/* Member Chart (Last 6 Months) */}
                    <div style={{ backgroundColor: 'var(--surface)', padding: '24px', borderRadius: '16px', boxShadow: 'var(--shadow-sm)', border: '1px solid #e2e8f0' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '24px' }}>Tasks Completed (Last 6 Months)</h3>

                        <div style={{ height: '300px', display: 'flex', alignItems: 'flex-end', gap: '32px', paddingBottom: '20px', paddingLeft: '20px' }}>
                            {selectedTeam.chartData && selectedTeam.chartData.map((data, index) => {
                                // Find max value for scaling (min 10 to avoid huge bars for small numbers)
                                const maxVal = Math.max(...selectedTeam.chartData.map(d => d.value), 5);
                                const heightPercentage = (data.value / maxVal) * 100;

                                return (
                                    <div key={index} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                        <div style={{
                                            position: 'relative',
                                            width: '40px',
                                            height: '100%',
                                            display: 'flex',
                                            alignItems: 'flex-end',
                                            justifyContent: 'center'
                                        }}>
                                            <div style={{
                                                width: '100%',
                                                height: `${Math.max(heightPercentage, 2)}%`, // Min height 2% for visibility
                                                backgroundColor: '#3b82f6',
                                                borderRadius: '8px 8px 0 0',
                                                transition: 'height 0.3s ease'
                                            }} title={`${data.value} tasks`}>
                                            </div>
                                            {/* Tooltip-like number above bar */}
                                            {data.value > 0 && (
                                                <span style={{ position: 'absolute', bottom: `${Math.max(heightPercentage, 2) + 5}%`, fontSize: '0.85rem', fontWeight: 600, color: '#3b82f6' }}>
                                                    {data.value}
                                                </span>
                                            )}
                                        </div>
                                        <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>{data.name}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            ) : (
                // --- MANAGER / ORG VIEW (Existing) ---
                <>
                    {/* Top Stats Row (Context Aware) */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--spacing-lg)' }}>
                        {[
                            { label: 'Avg Performance', value: selectedTeam ? `${selectedTeam.performance}%` : `${globalPerformance}%`, change: '0%', icon: Award, color: '#f59e0b' },
                            { label: 'Total Headcount', value: selectedTeam ? selectedTeam.count : globalHeadcountVal, change: '0', icon: Users, color: '#3b82f6' },
                            { label: selectedTeam ? 'Active Tasks' : 'Active Projects', value: selectedTeam ? selectedTeam.activeTasks : teams.length, change: '0', icon: Briefcase, color: '#8b5cf6' },
                            { label: 'Retention Rate', value: '0%', change: '0%', icon: TrendingUp, color: '#10b981' },
                        ].map((stat, i) => (
                            <div key={i} style={{ backgroundColor: 'var(--surface)', padding: 'var(--spacing-lg)', borderRadius: '16px', boxShadow: 'var(--shadow-sm)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 'var(--spacing-md)' }}>
                                    <div style={{ padding: '10px', borderRadius: '12px', backgroundColor: stat.color + '20', color: stat.color }}>
                                        <stat.icon size={20} />
                                    </div>
                                    <span style={{ fontSize: '0.875rem', color: 'var(--success)', fontWeight: 600 }}>
                                        {stat.change}
                                    </span>
                                </div>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{stat.label}</p>
                                <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '4px' }}>{stat.value}</h3>
                            </div>
                        ))}
                    </div>

                    {/* Main Content Area */}
                    {!selectedTeam ? (
                        // Teams Grid View (Org Mode)
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--spacing-lg)' }}>
                            {teams.length > 0 ? teams.map((team) => (
                                <div
                                    key={team.id}
                                    onClick={() => setSelectedTeam(team)}
                                    style={{
                                        backgroundColor: 'var(--surface)', padding: 'var(--spacing-xl)', borderRadius: '16px',
                                        boxShadow: 'var(--shadow-sm)', cursor: 'pointer', border: '1px solid transparent',
                                        transition: 'all 0.2s ease'
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.transform = 'translateY(0)'; }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: team.color + '20', color: team.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Briefcase size={24} />
                                            </div>
                                            <div>
                                                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{team.name}</h3>
                                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Lead: {team.lead}</p>
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: team.color }}>{team.performance}%</p>
                                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Avg Score</p>
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
                                        <div style={{ backgroundColor: 'var(--background)', padding: '12px', borderRadius: '8px' }}>
                                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Employees</p>
                                            <p style={{ fontWeight: 600, fontSize: '1.1rem' }}>{team.count}</p>
                                        </div>
                                        <div style={{ backgroundColor: 'var(--background)', padding: '12px', borderRadius: '8px' }}>
                                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Active Tasks</p>
                                            <p style={{ fontWeight: 600, fontSize: '1.1rem' }}>{team.activeTasks}</p>
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                                    No active projects (teams) found.
                                </div>
                            )}
                        </div>
                    ) : (
                        // Employee List View (Project/Team Detail)
                        <div style={{ backgroundColor: 'var(--surface)', borderRadius: '16px', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
                            <div style={{ padding: 'var(--spacing-lg)', borderBottom: '1px solid var(--border)' }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>Team Members</h3>
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                                        <th style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 600 }}>Employee</th>
                                        <th style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 600 }}>Role</th>
                                        <th style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 600 }}>Performance</th>
                                        <th style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 600 }}>Tasks Completed</th>
                                        <th style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 600 }}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentEmployees.map((emp, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                            <td style={{ padding: '16px', fontWeight: 500 }}>{emp.name}</td>
                                            <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>
                                                {emp.role}
                                            </td>
                                            <td style={{ padding: '16px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{ flex: 1, height: '6px', width: '80px', backgroundColor: 'var(--background)', borderRadius: '3px' }}>
                                                        <div style={{ width: `${emp.performance}%`, height: '100%', backgroundColor: emp.performance > 90 ? 'var(--success)' : emp.performance > 80 ? 'var(--warning)' : 'var(--danger)', borderRadius: '3px' }}></div>
                                                    </div>
                                                    <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{emp.performance}%</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '16px' }}>{emp.tasks}</td>
                                            <td style={{ padding: '16px' }}>
                                                <span style={{
                                                    padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600,
                                                    backgroundColor: emp.status === 'Top Performer' ? '#dcfce7' : emp.status === 'Needs Improvement' ? '#fee2e2' : '#e0f2fe',
                                                    color: emp.status === 'Top Performer' ? '#166534' : emp.status === 'Needs Improvement' ? '#991b1b' : '#075985'
                                                }}>
                                                    {emp.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {currentEmployees.length === 0 && (
                                        <tr>
                                            <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                                No team members found in this project.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}

        </div>
    );
};

export default AnalyticsDemo;
