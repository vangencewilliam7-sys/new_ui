import React, { useState } from 'react';
import {
    LayoutDashboard,
    BarChart2,
    Users,
    ListTodo,
    CalendarOff,
    Receipt,
    DollarSign,
    FileText,
    FileCheck,
    Briefcase,
    Network,
    Settings,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    LogOut,
    UserCheck,
    Megaphone,
    MessageCircle,
    FolderOpen,
    TrendingUp,
    Building2,
    FolderKanban
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const Sidebar = ({ isCollapsed, toggleSidebar }) => {
    const navigate = useNavigate();
    const location = useLocation();

    const [expandedMenus, setExpandedMenus] = useState({
        organization: true,
        project: true
    });

    const toggleMenu = (label) => {
        if (isCollapsed) return;
        setExpandedMenus(prev => ({
            ...prev,
            [label]: !prev[label]
        }));
    };

    // Organization-level menu items (Org Manager stuff)
    const orgMenuItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/executive-dashboard/dashboard' },
        { icon: Users, label: 'Employees', path: '/executive-dashboard/employees' },
        { icon: UserCheck, label: 'Employee Status', path: '/executive-dashboard/employee-status' },
        { icon: CalendarOff, label: 'Leave Requests', path: '/executive-dashboard/leaves' },
        { icon: Receipt, label: 'Payslips', path: '/executive-dashboard/payslips' },
        { icon: FileCheck, label: 'Policies', path: '/executive-dashboard/policies' },
        { icon: DollarSign, label: 'Payroll', path: '/executive-dashboard/payroll' },
        { icon: FileText, label: 'Invoice', path: '/executive-dashboard/invoice' },
        { icon: Briefcase, label: 'Hiring Portal', path: '/executive-dashboard/hiring' },
        { icon: Network, label: 'Org Hierarchy', path: '/executive-dashboard/hierarchy' },
        { icon: Megaphone, label: 'Announcements', path: '/executive-dashboard/announcements' },
        { icon: MessageCircle, label: 'Messages', path: '/executive-dashboard/messages' },
        { icon: Settings, label: 'Profile', path: '/executive-dashboard/settings' },
    ];

    // Project-level menu items (Project Manager stuff)
    const projectMenuItems = [
        { icon: FolderOpen, label: 'Projects', path: '/executive-dashboard/projects' },
        { icon: ListTodo, label: 'Tasks', path: '/executive-dashboard/tasks' },
        { icon: BarChart2, label: 'Analytics', path: '/executive-dashboard/analytics' },
        { icon: TrendingUp, label: 'Project Analytics', path: '/executive-dashboard/project-analytics' },
        { icon: Network, label: 'Project Hierarchy', path: '/executive-dashboard/project-hierarchy' },
        { icon: FileText, label: 'Documents', path: '/executive-dashboard/documents' },
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
                {renderSectionHeader(FolderKanban, 'Project', 'project')}
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
        </aside >
    );
};

export default Sidebar;
