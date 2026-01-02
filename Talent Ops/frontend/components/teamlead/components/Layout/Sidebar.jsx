import React, { useState, useEffect } from 'react';
import {
    LayoutDashboard,
    BarChart2,
    Users,
    ListTodo,
    CalendarOff,
    Receipt,
    FileText,
    Network,
    ClipboardList,
    Settings,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    LogOut,
    UserCheck,
    Megaphone,
    MessageCircle,
    Building2,
    FolderKanban,
    ChevronsUpDown,
    Check
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import { supabase } from '../../../../lib/supabaseClient';

const Sidebar = ({ isCollapsed, toggleSidebar }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { teamId, setTeamId, userId } = useUser();
    const [projectName, setProjectName] = useState('Talent Ops');
    const [userProjects, setUserProjects] = useState([]);
    const [showProjectSelect, setShowProjectSelect] = useState(false);

    const [expandedMenus, setExpandedMenus] = useState({
        organization: true,
        project: true
    });

    // Fetch User's Projects
    useEffect(() => {
        const fetchProjects = async () => {
            if (!userId) return;
            try {
                // 1. Get Project IDs
                const { data: members } = await supabase
                    .from('project_members')
                    .select('project_id')
                    .eq('user_id', userId);

                if (members && members.length > 0) {
                    const ids = members.map(m => m.project_id);
                    // 2. Get Project Details
                    const { data: projectsData } = await supabase
                        .from('projects')
                        .select('id, name')
                        .in('id', ids);

                    if (projectsData) {
                        setUserProjects(projectsData);
                        // Update current project name logic
                        const current = projectsData.find(p => p.id === teamId);
                        if (current) setProjectName(current.name);
                        else if (projectsData.length > 0 && !teamId) {
                            // Auto-select first if none selected
                            setTeamId(projectsData[0].id);
                            setProjectName(projectsData[0].name);
                        }
                    }
                } else {
                    // Fallback to profile check if project_members is empty
                    const { data: profile } = await supabase.from('profiles').select('team_id').eq('id', userId).single();
                    if (profile && profile.team_id) {
                        const { data: pData } = await supabase.from('projects').select('id, name').eq('id', profile.team_id).single();
                        if (pData) {
                            setUserProjects([pData]);
                            setProjectName(pData.name);
                            if (!teamId) setTeamId(pData.id);
                        }
                    }
                }
            } catch (e) { console.error('Error fetching projects', e); }
        };
        fetchProjects();
    }, [userId, teamId, setTeamId]);

    const handleProjectSwitch = (newProjectId, newProjectName) => {
        setTeamId(newProjectId);
        setProjectName(newProjectName);
        setShowProjectSelect(false);
        navigate('/teamlead-dashboard/dashboard');
    };

    const toggleMenu = (label) => {
        if (isCollapsed) return;
        setExpandedMenus(prev => ({
            ...prev,
            [label]: !prev[label]
        }));
    };

    // Organization-level menu items
    const orgMenuItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/teamlead-dashboard/dashboard' },
        { icon: UserCheck, label: 'Team Status', path: '/teamlead-dashboard/team-status' },
        { icon: CalendarOff, label: 'Leave Requests', path: '/teamlead-dashboard/leaves' },
        { icon: Receipt, label: 'Payslips', path: '/teamlead-dashboard/payslips' },
        { icon: FileText, label: 'Policies', path: '/teamlead-dashboard/policies' },
        { icon: Network, label: 'Org Hierarchy', path: '/teamlead-dashboard/hierarchy' },
        { icon: Megaphone, label: 'Announcements', path: '/teamlead-dashboard/announcements' },
        { icon: MessageCircle, label: 'Messages', path: '/teamlead-dashboard/messages' },
        { icon: Settings, label: 'Profile', path: '/teamlead-dashboard/settings' },
    ];

    // Project-level menu items
    const projectMenuItems = [
        { icon: Users, label: 'Team Members', path: '/teamlead-dashboard/employees' },
        { icon: ListTodo, label: 'Tasks', path: '/teamlead-dashboard/tasks' },
        { icon: ClipboardList, label: 'Team Tasks', path: '/teamlead-dashboard/team-tasks' },
        { icon: BarChart2, label: 'Analytics', path: '/teamlead-dashboard/analytics' },
        { icon: Network, label: 'Project Hierarchy', path: '/teamlead-dashboard/project-hierarchy' },
        { icon: FileText, label: 'Documents', path: '/teamlead-dashboard/documents' },
    ];

    // Menu item renderer
    const renderMenuItem = (item, index, keyPrefix) => {
        const isActive = location.pathname === item.path;
        return (
            <button
                key={`${keyPrefix}-${index}`}
                onClick={() => navigate(item.path)}
                title={isCollapsed ? item.label : ''}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                    gap: '10px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    backgroundColor: isActive ? 'var(--accent)' : 'transparent',
                    color: isActive ? 'white' : 'rgba(255,255,255,0.7)',
                    transition: 'all 0.2s ease',
                    width: '100%',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                }}
                onMouseEnter={(e) => {
                    if (!isActive) {
                        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
                        e.currentTarget.style.color = 'white';
                    }
                }}
                onMouseLeave={(e) => {
                    if (!isActive) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
                    }
                }}
            >
                <item.icon size={18} style={{ flexShrink: 0 }} />
                {!isCollapsed && <span>{item.label}</span>}
            </button>
        );
    };

    // Section header (collapsible) - Emojis Removed
    const renderSectionHeader = (icon, label, sectionKey) => (
        <button
            onClick={() => toggleMenu(sectionKey)}
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: isCollapsed ? 'center' : 'space-between',
                width: '100%',
                padding: '8px 12px',
                marginBottom: '4px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: 'rgba(255,255,255,0.9)',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {React.createElement(icon, { size: 14 })}
                {!isCollapsed && <span>{label}</span>}
            </div>
            {!isCollapsed && (
                <ChevronDown
                    size={14}
                    style={{
                        transform: expandedMenus[sectionKey] ? 'rotate(0deg)' : 'rotate(-90deg)',
                        transition: 'transform 0.2s'
                    }}
                />
            )}
        </button>
    );

    return (
        <aside style={{
            width: isCollapsed ? '80px' : '280px',
            backgroundColor: '#1a1a2e',
            color: 'white',
            height: '100vh',
            position: 'fixed',
            left: 0,
            top: 0,
            display: 'flex',
            flexDirection: 'column',
            padding: '16px',
            zIndex: 1000,
            transition: 'width 0.3s ease'
        }}>
            {/* Logo */}
            <div style={{
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: isCollapsed ? 'center' : 'space-between',
                height: '40px'
            }}>
                {!isCollapsed && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', borderRadius: '8px' }} />
                        <h1 style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Talent Ops</h1>
                    </div>
                )}
                <button
                    onClick={toggleSidebar}
                    style={{
                        background: 'rgba(255,255,255,0.1)',
                        border: 'none',
                        color: 'white',
                        cursor: 'pointer',
                        padding: '6px',
                        borderRadius: '6px',
                        display: 'flex'
                    }}
                >
                    {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                </button>
            </div>

            {/* Scrollable Nav */}
            <nav style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                overflowY: 'auto',
                overflowX: 'hidden',
                paddingRight: '4px'
            }}>
                {/* Organization Section */}
                {renderSectionHeader(Building2, 'Organization', 'organization')}
                {expandedMenus.organization && !isCollapsed && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '8px' }}>
                        {orgMenuItems.map((item, idx) => renderMenuItem(item, idx, 'org'))}
                    </div>
                )}
                {isCollapsed && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '8px' }}>
                        {orgMenuItems.slice(0, 4).map((item, idx) => renderMenuItem(item, idx, 'org'))}
                    </div>
                )}

                {/* CURRENT PROJECT SECTION - Functional */}
                {!isCollapsed && (
                    <div style={{ padding: '0 4px', marginTop: '16px', marginBottom: '8px' }}>
                        <h3 style={{ fontSize: '0.65rem', fontWeight: 'bold', color: '#94a3b8', marginBottom: '8px', paddingLeft: '8px', letterSpacing: '0.05em' }}>CURRENT PROJECT</h3>
                        <div
                            onClick={() => setShowProjectSelect(!showProjectSelect)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '10px 12px',
                                backgroundColor: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                marginBottom: '8px',
                                position: 'relative'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }}></div>
                                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{projectName}</span>
                            </div>
                            <ChevronDown size={16} color="rgba(255,255,255,0.5)" />
                        </div>

                        {/* Dropdown Menu */}
                        {showProjectSelect && userProjects.length > 0 && (
                            <div style={{
                                backgroundColor: '#272740',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '8px',
                                padding: '4px',
                                marginBottom: '8px',
                                overflow: 'hidden',
                                animation: 'fadeIn 0.2s ease'
                            }}>
                                {userProjects.map(proj => (
                                    <div
                                        key={proj.id}
                                        onClick={() => handleProjectSwitch(proj.id, proj.name)}
                                        style={{
                                            padding: '8px 12px',
                                            fontSize: '0.85rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            backgroundColor: teamId === proj.id ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                                            color: teamId === proj.id ? 'white' : 'rgba(255,255,255,0.7)',
                                            borderRadius: '6px',
                                            cursor: 'pointer'
                                        }}
                                        onMouseEnter={(e) => { if (teamId !== proj.id) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'; }}
                                        onMouseLeave={(e) => { if (teamId !== proj.id) e.currentTarget.style.backgroundColor = 'transparent'; }}
                                    >
                                        <span style={{ fontWeight: teamId === proj.id ? '600' : '400' }}>{proj.name}</span>
                                        {teamId === proj.id && <Check size={14} />}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Project Section */}
                {renderSectionHeader(FolderKanban, projectName.toUpperCase() || 'PROJECT', 'project')}

                {expandedMenus.project && !isCollapsed && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {projectMenuItems.map((item, idx) => renderMenuItem(item, idx, 'proj'))}
                    </div>
                )}
                {isCollapsed && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {projectMenuItems.map((item, idx) => renderMenuItem(item, idx, 'proj'))}
                    </div>
                )}
            </nav>

            {/* Logout */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '12px', marginTop: '12px' }}>
                <button
                    onClick={() => navigate('/login')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: isCollapsed ? 'center' : 'flex-start',
                        gap: '10px',
                        padding: '12px',
                        borderRadius: '8px',
                        width: '100%',
                        border: 'none',
                        cursor: 'pointer',
                        background: 'rgba(239, 68, 68, 0.15)',
                        color: '#f87171',
                        fontWeight: 600,
                        fontSize: '0.9rem'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = 'white'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'; e.currentTarget.style.color = '#f87171'; }}
                >
                    <LogOut size={18} />
                    {!isCollapsed && <span>Logout</span>}
                </button>
            </div>
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-5px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </aside>
    );
};

export default Sidebar;
