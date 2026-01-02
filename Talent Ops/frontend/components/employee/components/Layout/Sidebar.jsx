import React, { useState } from 'react';
import {
    LayoutDashboard,
    BarChart2,
    Users,
    ListTodo,
    CalendarOff,
    Receipt,
    FileText,
    Network,
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
    Check,
    ClipboardCheck,
    TrendingUp
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useProject } from '../../context/ProjectContext';

const Sidebar = ({ isCollapsed, toggleSidebar }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { currentProject, setCurrentProject, userProjects, projectRole } = useProject();

    const [expandedMenus, setExpandedMenus] = useState({
        organization: true,
        project: true
    });
    const [showProjectPicker, setShowProjectPicker] = useState(false);

    const toggleMenu = (label) => {
        if (isCollapsed) return;
        setExpandedMenus(prev => ({
            ...prev,
            [label]: !prev[label]
        }));
    };

    // Organization-level menu items (same for all roles)
    const orgMenuItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/employee-dashboard/dashboard' },
        { icon: UserCheck, label: 'My Attendance', path: '/employee-dashboard/team-status' },
        { icon: CalendarOff, label: 'Leaves', path: '/employee-dashboard/leaves' },
        { icon: Receipt, label: 'Payslip', path: '/employee-dashboard/payslips' },
        { icon: FileText, label: 'Policies', path: '/employee-dashboard/policies' },
        { icon: Megaphone, label: 'Announcements', path: '/employee-dashboard/announcements' },
        { icon: MessageCircle, label: 'Messages', path: '/employee-dashboard/messages' },
        { icon: Network, label: 'Org Hierarchy', path: '/employee-dashboard/org-hierarchy' },
        { icon: Settings, label: 'Profile', path: '/employee-dashboard/settings' },
    ];

    // Role-based project menu configurations
    const projectMenusByRole = {
        consultant: [
            { icon: Users, label: 'Project', path: '/employee-dashboard/employees' },
            { icon: Users, label: 'Team Members', path: '/employee-dashboard/team-members' },
            { icon: ListTodo, label: 'My Tasks', path: '/employee-dashboard/my-tasks' },
            { icon: BarChart2, label: 'Analytics', path: '/employee-dashboard/analytics' },
            { icon: Network, label: 'Hierarchy', path: '/employee-dashboard/project-hierarchy' },
        ],
        employee: [
            { icon: Users, label: 'Project', path: '/employee-dashboard/employees' },
            { icon: Users, label: 'Team Members', path: '/employee-dashboard/team-members' },
            { icon: ListTodo, label: 'My Tasks', path: '/employee-dashboard/my-tasks' },
            { icon: BarChart2, label: 'Analytics', path: '/employee-dashboard/analytics' },
            { icon: Network, label: 'Hierarchy', path: '/employee-dashboard/project-hierarchy' },
        ],
        team_lead: [
            { icon: Users, label: 'My Project', path: '/employee-dashboard/employees' },
            { icon: Users, label: 'Team Members', path: '/employee-dashboard/team-members' },
            { icon: ClipboardCheck, label: 'My Tasks', path: '/employee-dashboard/my-tasks' },
            { icon: ListTodo, label: 'Team Tasks', path: '/employee-dashboard/team-tasks' },
            { icon: TrendingUp, label: 'Performance', path: '/employee-dashboard/performance' },
            { icon: BarChart2, label: 'Analytics', path: '/employee-dashboard/analytics' },
            { icon: Network, label: 'Hierarchy', path: '/employee-dashboard/project-hierarchy' },
        ],
        manager: [
            { icon: Users, label: 'Project', path: '/employee-dashboard/employees' },
            { icon: Users, label: 'Team Members', path: '/employee-dashboard/team-members' },
            { icon: ClipboardCheck, label: 'My Tasks', path: '/employee-dashboard/my-tasks' },
            { icon: ListTodo, label: 'Team Tasks', path: '/employee-dashboard/team-tasks' },
            { icon: TrendingUp, label: 'Performance', path: '/employee-dashboard/performance' },
            { icon: BarChart2, label: 'Analytics', path: '/employee-dashboard/analytics' },
            { icon: Network, label: 'Hierarchy', path: '/employee-dashboard/project-hierarchy' },
        ]
    };

    // Get menu items based on current project role
    const projectMenuItems = projectMenusByRole[projectRole] || projectMenusByRole.consultant;

    // Role badge colors
    const getRoleBadge = (role) => {
        switch (role) {
            case 'manager': return { color: '#ef4444', label: 'Manager' };
            case 'team_lead': return { color: '#eab308', label: 'Team Lead' };
            default: return { color: '#22c55e', label: 'Consultant' };
        }
    };

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
                    backgroundColor: isActive ? '#7C3AED' : 'transparent',
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

    // Section header (collapsible)
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
            <style>
                {`
                    .no-scrollbar::-webkit-scrollbar {
                        display: none;
                    }
                    .no-scrollbar {
                        -ms-overflow-style: none;
                        scrollbar-width: none;
                    }
                `}
            </style>
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
            }} className="no-scrollbar">
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

                {/* Project Section */}
                {userProjects.length > 0 && (
                    <>
                        {/* Project Switcher Card */}
                        {!isCollapsed && (
                            <div style={{
                                marginBottom: '12px',
                                position: 'relative'
                            }}>
                                <div style={{
                                    fontSize: '0.7rem',
                                    color: '#94a3b8',
                                    marginBottom: '8px',
                                    fontWeight: 600,
                                    paddingLeft: '4px'
                                }}>
                                    CURRENT PROJECT
                                </div>
                                <button
                                    onClick={() => setShowProjectPicker(!showProjectPicker)}
                                    style={{
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        background: 'rgba(255,255,255,0.03)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '8px',
                                        padding: '10px 12px',
                                        color: 'white',
                                        cursor: 'pointer',
                                        fontSize: '0.9rem',
                                        fontWeight: 500,
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{
                                            width: '8px',
                                            height: '8px',
                                            borderRadius: '50%',
                                            background: getRoleBadge(projectRole).color
                                        }} />
                                        <span>{currentProject?.name || 'Select...'}</span>
                                    </div>
                                    <ChevronDown size={16} style={{ transform: showProjectPicker ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                                </button>

                                {/* Dropdown */}
                                {showProjectPicker && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: 0,
                                        right: 0,
                                        background: '#2a2a4a',
                                        borderRadius: '8px',
                                        marginTop: '4px',
                                        boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
                                        zIndex: 100,
                                        overflow: 'hidden'
                                    }}>
                                        {userProjects.map((project) => (
                                            <button
                                                key={project.id}
                                                onClick={() => {
                                                    setCurrentProject(project.id);
                                                    setShowProjectPicker(false);
                                                }}
                                                style={{
                                                    width: '100%',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    padding: '12px 14px',
                                                    border: 'none',
                                                    background: currentProject?.id === project.id ? 'rgba(139,92,246,0.3)' : 'transparent',
                                                    color: 'white',
                                                    cursor: 'pointer',
                                                    textAlign: 'left',
                                                    borderBottom: '1px solid rgba(255,255,255,0.1)'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                                onMouseLeave={(e) => e.currentTarget.style.background = currentProject?.id === project.id ? 'rgba(139,92,246,0.3)' : 'transparent'}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <span style={{
                                                        width: '10px',
                                                        height: '10px',
                                                        borderRadius: '50%',
                                                        background: getRoleBadge(project.role).color,
                                                        flexShrink: 0
                                                    }} />
                                                    <div>
                                                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{project.name}</div>
                                                        <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>{getRoleBadge(project.role).label}</div>
                                                    </div>
                                                </div>
                                                {currentProject?.id === project.id && <Check size={16} style={{ color: '#8b5cf6' }} />}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Project Menu Items */}
                        {renderSectionHeader(FolderKanban, currentProject?.name || 'Project', 'project')}
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
                    </>
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
        </aside>
    );
};

export default Sidebar;
