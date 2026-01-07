import React, { useState, useEffect } from 'react';
import { X, Mail, Phone, MapPin, Folder, ChevronRight, User, Plus, Trash2, Edit2, Search, Check } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

import { useProject } from '../employee/context/ProjectContext';

const ProjectHierarchyDemo = ({ isEditingEnabled = false }) => {
    const { currentProject } = useProject(); // Get current project from context
    const [selectedProject, setSelectedProject] = useState(null);
    const [viewMode, setViewMode] = useState('overview'); // 'overview', 'project-detail'
    const [hierarchyData, setHierarchyData] = useState({
        executives: [],
        managers: [],
        projects: [] // { id, name, manager_id, team_leads: [], employees: [] }
    });
    const [allProfiles, setAllProfiles] = useState([]); // Store all profiles for "Add Member"
    const [loading, setLoading] = useState(true);
    const [scale, setScale] = useState(0.8);

    // Modal States
    const [selectedEmployee, setSelectedEmployee] = useState(null); // For viewing details
    const [showAddMemberModal, setShowAddMemberModal] = useState(false);

    // Synch with Current Project Context
    useEffect(() => {
        if (currentProject && hierarchyData.projects.length > 0) {
            const matched = hierarchyData.projects.find(p => p.id === currentProject.id);
            if (matched) {
                console.log("Auto-selecting project from context:", matched.name);
                setSelectedProject(matched);
                setViewMode('project-detail');
            }
        }
    }, [currentProject, hierarchyData.projects]);

    const handleZoomIn = () => setScale(prev => Math.min(prev + 0.1, 2));
    const handleZoomOut = () => setScale(prev => Math.max(prev - 0.1, 0.25));
    const handleReset = () => setScale(0.8);

    useEffect(() => {
        fetchHierarchy();
    }, []);

    const fetchHierarchy = async () => {
        try {
            // Fetch profiles
            const { data: profiles, error: profilesError } = await supabase
                .from('profiles')
                .select('*')
                .order('full_name');

            if (profilesError) throw profilesError;
            setAllProfiles(profiles);

            // Fetch projects (instead of teams)
            const { data: projects, error: projectsError } = await supabase
                .from('projects')
                .select('*');

            // Fetch project_members to get project assignments
            const { data: teamMembers, error: teamMembersError } = await supabase
                .from('project_members')
                .select('*');

            if (profiles) {
                const getRole = (p) => p.role ? p.role.toLowerCase().trim() : '';

                const executives = profiles.filter(p => getRole(p) === 'executive');
                const managers = profiles.filter(p => getRole(p) === 'manager');

                let projectsMap = [];

                if (projects && projects.length > 0) {
                    projects.forEach(project => {
                        // Get members for this project from project_members table
                        // AND merge with profile data, prioritizing project_members.role
                        const projectTeamMembers = teamMembers
                            ?.filter(tm => tm.project_id === project.id)
                            .map(tm => {
                                const profile = profiles.find(p => p.id === tm.user_id);
                                if (!profile) return null;
                                return {
                                    ...profile,
                                    role: tm.role || profile.role // Use project-specific role if available
                                };
                            })
                            .filter(Boolean) || [];

                        const getProjectRole = (p) => p.role ? p.role.toLowerCase().trim() : '';

                        const projectManagers = projectTeamMembers.filter(p => getProjectRole(p) === 'manager');

                        const leads = projectTeamMembers.filter(p => getProjectRole(p) === 'team_lead');
                        const staff = projectTeamMembers.filter(p => getProjectRole(p) === 'employee');

                        projectsMap.push({
                            id: project.id,
                            name: project.name || 'Unnamed Project',
                            managers: projectManagers, // Store all managers
                            leads: leads,
                            staff: staff
                        });
                    });
                }

                setHierarchyData({
                    executives,
                    managers,
                    projects: projectsMap
                });

                // If viewing a project, refresh its data to keep UI in sync
                if (selectedProject) {
                    const updatedProject = projectsMap.find(p => p.id === selectedProject.id);
                    if (updatedProject) setSelectedProject(updatedProject);
                }
            }
        } catch (error) {
            console.error("Error fetching hierarchy:", error);
        } finally {
            setLoading(false);
        }
    };

    // --- Actions ---
    const handleRemoveMember = async (e, member) => {
        e.stopPropagation();
        if (window.confirm(`Are you sure you want to remove ${member.full_name} from this project?`)) {
            try {
                // Remove from project_members table
                const { error } = await supabase
                    .from('project_members')
                    .delete()
                    .eq('project_id', selectedProject.id)
                    .eq('user_id', member.id);

                if (error) throw error;
                fetchHierarchy();
            } catch (err) {
                console.error("Error removing member:", err);
                alert("Failed to remove member");
            }
        }
    };

    // Add Member Handlers
    const handleAddMember = async (userId, role) => {
        if (!selectedProject) return;
        try {
            // ONLY add to project_members table with project-specific role
            // Do NOT update the organizational role in profiles table
            const { error: teamMemberError } = await supabase
                .from('project_members')
                .insert({
                    project_id: selectedProject.id,
                    user_id: userId,
                    role: role.toLowerCase()
                });

            if (teamMemberError) throw teamMemberError;

            // NEW: Set team_id in profiles to project_id for manager dashboard compatibility
            // This allows the manager dashboard to work with projects as "teams"
            const { error: profileError } = await supabase
                .from('profiles')
                .update({ team_id: selectedProject.id })
                .eq('id', userId);

            if (profileError) {
                console.error('Error updating team_id:', profileError);
                // Don't throw - project member was added successfully
            }

            fetchHierarchy();
            setShowAddMemberModal(false);
        } catch (err) {
            console.error("Error adding member:", err);
            alert("Failed to add member");
        }
    };

    // Node Card Component with Action Buttons
    const NodeCard = ({ title, subtitle, color, icon: Icon, onClick, active, member, showActions }) => (
        <div
            onClick={onClick}
            style={{
                backgroundColor: 'white',
                border: `2px solid ${active ? color : '#e2e8f0'}`,
                borderRadius: '12px',
                padding: '16px',
                width: '200px',
                boxShadow: active ? `0 4px 12px ${color}40` : '0 2px 4px rgba(0,0,0,0.05)',
                cursor: onClick ? 'pointer' : 'default',
                transition: 'all 0.2s',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                zIndex: 10
            }}
            onMouseEnter={e => {
                if (onClick) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.borderColor = color;
                }
            }}
            onMouseLeave={e => {
                if (onClick) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.borderColor = active ? color : '#e2e8f0';
                }
            }}
        >
            {showActions && member && (
                <div style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 20 }}>
                    <button
                        onClick={(e) => handleRemoveMember(e, member)}
                        style={{ border: 'none', background: '#fee2e2', color: '#ef4444', borderRadius: '4px', padding: '4px', cursor: 'pointer' }}
                        title="Remove from Project"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            )}

            <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '10px',
                color: 'white'
            }}>
                {Icon ? <Icon size={20} /> : <User size={20} />}
            </div>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>{title}</h4>
            <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>{subtitle}</span>
        </div>
    );

    // Employee Detail Modal
    const EmployeeModal = ({ employee, onClose }) => {
        if (!employee) return null;
        return (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
                <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '400px', padding: '32px', position: 'relative' }} onClick={e => e.stopPropagation()}>
                    <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', border: 'none', background: 'none', cursor: 'pointer' }}><X size={20} /></button>
                    <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                        <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#7c3aed', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', margin: '0 auto 16px' }}>
                            {employee.full_name?.charAt(0)}
                        </div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{employee.full_name}</h3>
                        <p style={{ color: '#64748b' }}>{employee.role}</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px' }}><Mail size={16} /><span style={{ fontSize: '0.9rem' }}>{employee.email || 'N/A'}</span></div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px' }}><Phone size={16} /><span style={{ fontSize: '0.9rem' }}>{employee.phone || 'N/A'}</span></div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px' }}><MapPin size={16} /><span style={{ fontSize: '0.9rem' }}>{employee.location || 'N/A'}</span></div>
                    </div>
                </div>
            </div>
        );
    };

    // Add Member Modal Component
    const AddMemberModal = ({ onClose, onAdd, existingMembers }) => {
        const [searchTerm, setSearchTerm] = useState('');
        const [selectedUser, setSelectedUser] = useState(null);
        const [role, setRole] = useState('employee');

        // Filter out users already in this project
        const existingIds = existingMembers.map(m => m.id);
        const availableUsers = allProfiles.filter(p => !existingIds.includes(p.id) && p.full_name.toLowerCase().includes(searchTerm.toLowerCase()));

        return (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
                <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '500px', padding: '24px', position: 'relative', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Add Member to Project</h3>
                        <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={20} /></button>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Select Role</label>
                        <select
                            value={role}
                            onChange={e => setRole(e.target.value)}
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                        >
                            <option value="manager">Project Manager</option>
                            <option value="team_lead">Team Lead</option>
                            <option value="employee">Employee</option>
                        </select>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
                            <input
                                type="text"
                                placeholder="Search users to add..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                style={{ width: '100%', padding: '10px 10px 10px 40px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                            />
                        </div>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '16px', maxHeight: '300px' }}>
                        {availableUsers.map(user => (
                            <div
                                key={user.id}
                                onClick={() => setSelectedUser(user)}
                                style={{
                                    padding: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    cursor: 'pointer',
                                    backgroundColor: selectedUser?.id === user.id ? '#eff6ff' : 'transparent',
                                    borderBottom: '1px solid #f1f5f9'
                                }}
                            >
                                <div>
                                    <div style={{ fontWeight: 600 }}>{user.full_name}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                        {user.role} • {user.email}
                                    </div>
                                </div>
                                {selectedUser?.id === user.id && <Check size={16} color="#2563eb" />}
                            </div>
                        ))}
                        {availableUsers.length === 0 && <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>No users found</div>}
                    </div>

                    <button
                        onClick={() => selectedUser && onAdd(selectedUser.id, role)}
                        disabled={!selectedUser}
                        style={{
                            width: '100%',
                            padding: '12px',
                            backgroundColor: selectedUser ? '#2563eb' : '#cbd5e1',
                            color: 'white',
                            borderRadius: '8px',
                            border: 'none',
                            fontWeight: 600,
                            cursor: selectedUser ? 'pointer' : 'not-allowed'
                        }}
                    >
                        Add Member
                    </button>
                </div>
            </div>
        )
    };

    if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading project structure...</div>;

    // View 1: Executive -> Projects (Managers hidden in overview)
    const OverviewTree = () => {
        const allProjects = hierarchyData.projects;
        const cardWidth = 200;
        const gapSize = 60; // The flex gap
        const halfGap = gapSize / 2; // 30px
        const gap = 40; // Horizontal gap between cards

        if (hierarchyData.executives.length === 0 && allProjects.length === 0) {
            return <div style={{ color: '#94a3b8', marginTop: '40px' }}>No hierarchy data available. Please check database connection.</div>;
        }

        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: `${gapSize}px` }}>
                {/* Level 1: Executives */}
                {hierarchyData.executives.length > 0 && (
                    <div style={{ display: 'flex', gap: `${gap}px`, position: 'relative' }}>
                        {hierarchyData.executives.map(exec => (
                            <div key={exec.id} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <NodeCard
                                    title={exec.full_name}
                                    subtitle="Executive"
                                    color="#7c3aed"
                                    onClick={() => setSelectedEmployee(exec)}
                                />
                                {/* Down Line */}
                                <div style={{
                                    position: 'absolute',
                                    bottom: `-${halfGap}px`,
                                    left: '50%',
                                    width: '2px',
                                    height: `${halfGap}px`,
                                    backgroundColor: '#cbd5e1',
                                    transform: 'translateX(-1px)'
                                }}></div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Level 2: Projects */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>

                    {/* Horizontal bar connecting branches */}
                    {allProjects.length > 1 && hierarchyData.executives.length > 0 && (
                        <div style={{
                            position: 'absolute',
                            top: `-${halfGap}px`,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: `${(allProjects.length - 1) * (cardWidth + gap)}px`,
                            height: '2px',
                            backgroundColor: '#cbd5e1'
                        }} />
                    )}

                    <div style={{ display: 'flex', gap: `${gap}px`, justifyContent: 'center', flexWrap: 'nowrap' }}>
                        {allProjects.map((project) => (
                            <div key={project.id} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                {/* Up Line to Horizontal Bar */}
                                {hierarchyData.executives.length > 0 && (
                                    <div style={{
                                        position: 'absolute',
                                        top: `-${halfGap}px`,
                                        left: '50%',
                                        width: '2px',
                                        height: `${halfGap}px`,
                                        backgroundColor: '#cbd5e1',
                                        transform: 'translateX(-1px)'
                                    }}></div>
                                )}

                                <NodeCard
                                    title={project.name}
                                    subtitle="Project"
                                    color="#f59e0b"
                                    icon={Folder}
                                    onClick={() => {
                                        setSelectedProject(project);
                                        setViewMode('project-detail');
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    // View 2: Project Drill Down (Manager -> Lead -> Staff)
    const ProjectDetailTree = () => {
        if (!selectedProject) return null;

        const cardWidth = 200;
        const gapSize = 60; // Vertical flex gap
        const halfGap = gapSize / 2; // 30px
        const gap = 40; // Horizontal gap

        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: `${gapSize}px` }}>
                <div style={{ textAlign: 'center', marginBottom: '-20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <h2 style={{ color: '#1e293b', fontWeight: 'bold' }}>{selectedProject.name}</h2>
                    <p style={{ color: '#64748b' }}>Project Hierarchy</p>
                    {isEditingEnabled && (
                        <button
                            onClick={() => setShowAddMemberModal(true)}
                            style={{
                                marginTop: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '8px 16px',
                                backgroundColor: '#2563eb',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                zIndex: 50,
                                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
                            }}
                        >
                            <Plus size={16} /> Add Member
                        </button>
                    )}
                </div>

                {/* Level 1: Project Managers */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 2 }}>
                    {selectedProject.managers && selectedProject.managers.length > 0 ? (
                        <>
                            {/* Horizontal Bar for multiple managers */}
                            {selectedProject.managers.length > 1 && (
                                <div style={{
                                    position: 'absolute',
                                    bottom: `-${halfGap}px`,
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    width: `${(selectedProject.managers.length - 1) * (cardWidth + gap)}px`,
                                    height: '2px',
                                    backgroundColor: '#cbd5e1'
                                }} />
                            )}

                            <div style={{ display: 'flex', gap: `${gap}px`, position: 'relative' }}>
                                {selectedProject.managers.map((mgr) => (
                                    <div key={mgr.id} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        <NodeCard
                                            title={mgr.full_name}
                                            subtitle="Project Manager"
                                            color="#2563eb"
                                            onClick={() => setSelectedEmployee(mgr)}
                                            showActions={isEditingEnabled}
                                            member={mgr}
                                        />
                                        {/* Down Line to Bus */}
                                        <div style={{
                                            position: 'absolute',
                                            bottom: `-${halfGap}px`,
                                            left: '50%',
                                            width: '2px',
                                            height: `${halfGap}px`,
                                            backgroundColor: '#cbd5e1',
                                            transform: 'translateX(-1px)'
                                        }}></div>
                                    </div>
                                ))}
                            </div>

                            {/* Single Line from Bus Center Down to next level (Leads) */}
                            <div style={{
                                position: 'absolute',
                                bottom: `-${gapSize}px`, // Extend fully to next level top
                                left: '50%',
                                width: '2px',
                                height: `${halfGap}px`, // Only need half gap from the bar downwards? 
                                // Actually, visual gap is gapSize (60). 
                                // Managers use bottom 30px to reach Bus. 
                                // We need 30px more to reach Leads top.
                                // BUT Leads Top Bar is at line 529: `top: -halfGap`.
                                // So connection is continuous.
                                // Bottom Bus is at -30px.
                                // We need a line from -30px to -60px (which is relative to what?)
                                // Wait, the parent container has `gap: 60px`.
                                // So visual distance is 60px.
                                // Code above draws line at bottom -30px.
                                // Leads draws line at top -30px.
                                // They meet perfectly in the DOM flow.
                                backgroundColor: 'transparent' // No extra line needed if visual gap handles it? 
                                // Wait. Managers Bar is at -30px relative to Manager Card bottom.
                                // Leads Bar is at -30px relative to Leads Card top.
                                // Total distance between Cards is 60px.
                                // So Bar-to-Bar distance is 0px. They touch/overlap.
                                // So we effectively have ONE line?
                                // No, we have Two horizontal bars touching? That looks weird.
                                // Ideally:
                                // Manager Bar ... Down Line ... Leads Bar.
                                // If they touch, it's just a cross.
                            }} ></div>
                        </>
                    ) : (
                        <div style={{ padding: '10px', border: '1px dashed #cbd5e1', borderRadius: '8px', color: '#94a3b8', marginBottom: `${halfGap}px` }}>
                            No Manager Assigned
                            {/* Placeholder Down Line */}
                            <div style={{
                                position: 'absolute',
                                bottom: `-${halfGap}px`,
                                left: '50%',
                                width: '2px',
                                height: `${halfGap}px`,
                                backgroundColor: '#cbd5e1',
                                transform: 'translateX(-1px)'
                            }}></div>
                        </div>
                    )}
                </div>

                {/* Level 2: Project Leads */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                    {selectedProject.leads.length > 0 ? (
                        <>
                            {/* Horizontal Bar */}
                            {selectedProject.leads.length > 1 && (
                                <div style={{
                                    position: 'absolute',
                                    top: `-${halfGap}px`,
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    width: `${(selectedProject.leads.length - 1) * (cardWidth + gap)}px`,
                                    height: '2px',
                                    backgroundColor: '#cbd5e1'
                                }} />
                            )}

                            <div style={{ display: 'flex', gap: `${gap}px`, position: 'relative', zIndex: 2 }}>
                                {selectedProject.leads.map(lead => (
                                    <div key={lead.id} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        {/* Up Line to Bar */}
                                        <div style={{ position: 'absolute', top: `-${halfGap}px`, left: '50%', width: '2px', height: `${halfGap}px`, backgroundColor: '#cbd5e1', transform: 'translateX(-1px)' }}></div>

                                        <NodeCard
                                            title={lead.full_name}
                                            subtitle="Team Lead"
                                            color="#f97316"
                                            onClick={() => setSelectedEmployee(lead)}
                                            showActions={isEditingEnabled}
                                            member={lead}
                                        />

                                        {/* Down Line to Employees */}
                                        {selectedProject.staff.length > 0 && (
                                            <div style={{
                                                position: 'absolute',
                                                bottom: `-${halfGap}px`,
                                                left: '50%',
                                                width: '2px',
                                                height: `${halfGap}px`,
                                                backgroundColor: '#cbd5e1',
                                                transform: 'translateX(-1px)'
                                            }}></div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div style={{ padding: '10px', border: '1px dashed #cbd5e1', borderRadius: '8px', color: '#94a3b8' }}>No Project Lead</div>
                    )}
                </div>

                {/* Level 3: Employees */}
                {selectedProject.staff.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>

                        {/* Horizontal Bar for Users */}
                        {selectedProject.staff.length > 1 && (
                            <div style={{
                                position: 'absolute',
                                top: `-${halfGap}px`,
                                left: '50%',
                                transform: 'translateX(-50%)',
                                width: `${(selectedProject.staff.length - 1) * (cardWidth + gap)}px`,
                                height: '2px',
                                backgroundColor: '#cbd5e1'
                            }} />
                        )}

                        <div style={{ display: 'flex', gap: `${gap}px`, flexWrap: 'wrap', justifyContent: 'center' }}>
                            {selectedProject.staff.map(emp => (
                                <div key={emp.id} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    {/* Stick Up */}
                                    <div style={{ position: 'absolute', top: `-${halfGap}px`, left: '50%', width: '2px', height: `${halfGap}px`, backgroundColor: '#cbd5e1', transform: 'translateX(-1px)' }}></div>

                                    <NodeCard
                                        title={emp.full_name}
                                        subtitle="Employee"
                                        color="#10b981"
                                        onClick={() => setSelectedEmployee(emp)}
                                        showActions={isEditingEnabled}
                                        member={emp}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // View 3: Full Overview (Executive -> Projects -> Managers -> Leads -> Staff) - All visible
    const FullOverviewTree = () => {
        const allProjects = hierarchyData.projects;
        const gapSize = 80; // Larger vertical gap for deep tree
        const halfGap = gapSize / 2;

        if (allProjects.length === 0) return <div style={{ color: '#94a3b8' }}>No projects found.</div>;

        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: `${gapSize}px` }}>
                {/* Level 1: Executives */}
                {hierarchyData.executives.length > 0 && (
                    <div style={{ display: 'flex', gap: '40px', justifyContent: 'center', position: 'relative' }}>
                        {hierarchyData.executives.map(exec => (
                            <div key={exec.id} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <NodeCard
                                    title={exec.full_name}
                                    subtitle="Executive"
                                    color="#7c3aed"
                                    onClick={() => setSelectedEmployee(exec)}
                                />
                                {/* Down Line */}
                                <div style={{
                                    position: 'absolute',
                                    bottom: `-${halfGap}px`,
                                    left: '50%',
                                    width: '2px',
                                    height: `${halfGap}px`,
                                    backgroundColor: '#cbd5e1',
                                    transform: 'translateX(-1px)'
                                }}></div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Level 2: Projects Container */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                    <div style={{ display: 'flex', gap: '100px', alignItems: 'flex-start', justifyContent: 'center' }}>
                        {allProjects.map((project, index) => (
                            <div key={project.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                                {/* Connector Lines */}
                                <div style={{ position: 'absolute', top: `-${halfGap}px`, left: 0, right: 0, height: '2px' }}>
                                    {/* Left Segment */}
                                    {index > 0 && (
                                        <div style={{
                                            position: 'absolute',
                                            left: '-50px', // Span half the gap (100px/2)
                                            width: 'calc(50% + 50px)',
                                            height: '100%',
                                            backgroundColor: '#cbd5e1'
                                        }}></div>
                                    )}
                                    {/* Right Segment */}
                                    {index < allProjects.length - 1 && (
                                        <div style={{
                                            position: 'absolute',
                                            right: '-50px', // Span half the gap
                                            width: 'calc(50% + 50px)',
                                            height: '100%',
                                            backgroundColor: '#cbd5e1'
                                        }}></div>
                                    )}
                                </div>

                                {/* Up Line (Vertical from Connector to Node) */}
                                <div style={{ position: 'absolute', top: `-${halfGap}px`, left: '50%', width: '2px', height: `${halfGap}px`, backgroundColor: '#cbd5e1', transform: 'translateX(-1px)' }}></div>

                                {/* Project Node */}
                                <NodeCard
                                    title={project.name}
                                    subtitle="Project"
                                    color="#f59e0b"
                                    icon={Folder}
                                    onClick={() => {
                                        setSelectedProject(project);
                                    }}
                                />
                                {/* Down Line from Project */}
                                <div style={{ width: '2px', height: '40px', backgroundColor: '#cbd5e1' }}></div>

                                {/* Manager(s) */}
                                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    {project.managers && project.managers.length > 0 ? (
                                        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                            {/* Top Horizontal Bar (Split from Project) */}
                                            {project.managers.length > 1 && (
                                                <div style={{ position: 'absolute', top: '-20px', left: '50%', transform: 'translateX(-50%)', width: `${(project.managers.length - 1) * 240}px`, height: '2px', backgroundColor: '#cbd5e1' }}></div>
                                            )}

                                            <div style={{ display: 'flex', gap: '40px', paddingTop: '0px' }}>
                                                {project.managers.map(mgr => (
                                                    <div key={mgr.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                                                        {/* Up Line to Top Bar */}
                                                        <div style={{ position: 'absolute', top: '-20px', left: '50%', height: '20px', width: '2px', backgroundColor: '#cbd5e1', transform: 'translateX(-50%)' }}></div>

                                                        <NodeCard
                                                            title={mgr.full_name}
                                                            subtitle="Project Manager"
                                                            color="#2563eb"
                                                            onClick={() => setSelectedEmployee(mgr)}
                                                        />

                                                        {/* Down Line to Bottom Bar (if Leads exist) */}
                                                        {project.leads.length > 0 && <div style={{ width: '2px', height: '20px', backgroundColor: '#cbd5e1' }}></div>}
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Bottom Horizontal Bar (Recombine for Leads) */}
                                            {project.managers.length > 1 && project.leads.length > 0 && (
                                                <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', width: `${(project.managers.length - 1) * 240}px`, height: '2px', backgroundColor: '#cbd5e1' }}></div>
                                            )}

                                            {/* Final connection line to Leads is handled by Leads block or Project container? */}
                                            {/* Current Project container has: Project -> Line(40) -> Manager -> [HERE] -> Leads */}
                                            {/* The previous logic had: Manager -> Line(40) -> Leads (Lines 709) */}
                                            {/* My logic above adds 20px down line for each manager. */}
                                            {/* If we have Bottom Bar at 'bottom: 20px*? No. */}
                                            {/* Unlike ProjectDetailTree where we use absolute positioning, here we are in Flex stack. */}
                                            {/* We need a single vertical line from the Bottom Bar Center to the Leads? */}
                                            {/* If multiple managers, we have Bottom Bar. */}
                                            {/* We need a line from that Bar Downwards. */}
                                            {project.leads.length > 0 && (
                                                <div style={{ width: '2px', height: '20px', backgroundColor: '#cbd5e1' }}></div>
                                            )}
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                            <div style={{ padding: '10px', border: '1px dashed #cbd5e1', borderRadius: '8px', color: '#94a3b8' }}>No Manager</div>
                                            {/* Connector to Leads */}
                                            {project.leads.length > 0 && <div style={{ width: '2px', height: '40px', backgroundColor: '#cbd5e1' }}></div>}
                                        </div>
                                    )}
                                </div>

                                {/* Team Leads */}
                                {project.leads.length > 0 && (
                                    <div style={{ marginTop: '0px', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                                        {/* Leads Horizontal Bar */}
                                        {project.leads.length > 1 && (
                                            <div style={{ position: 'absolute', top: '-20px', left: '50%', transform: 'translateX(-50%)', width: `${(project.leads.length - 1) * 240}px`, height: '2px', backgroundColor: '#cbd5e1' }}></div>
                                        )}
                                        <div style={{ display: 'flex', gap: '40px', paddingTop: '0px' }}>
                                            {project.leads.map(lead => (
                                                <div key={lead.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                                                    <div style={{ position: 'absolute', top: '-20px', left: '50%', height: '20px', width: '2px', backgroundColor: '#cbd5e1', transform: 'translateX(-50%)' }}></div>
                                                    <NodeCard
                                                        title={lead.full_name}
                                                        subtitle="Team Lead"
                                                        color="#f97316"
                                                        onClick={() => setSelectedEmployee(lead)}
                                                    />
                                                    {/* Down to Staff */}
                                                    {project.staff.length > 0 && <div style={{ width: '2px', height: '40px', backgroundColor: '#cbd5e1' }}></div>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {project.staff.length > 0 && (
                                    <div style={{ marginTop: '0px', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                                        {/* Staff Horizontal Bar */}
                                        {project.staff.length > 1 && (
                                            <div style={{ position: 'absolute', top: '-20px', left: '50%', transform: 'translateX(-50%)', width: `${(project.staff.length - 1) * 240}px`, height: '2px', backgroundColor: '#cbd5e1' }}></div>
                                        )}
                                        <div style={{ display: 'flex', gap: '40px', paddingTop: '0px' }}>
                                            {project.staff.map(emp => (
                                                <div key={emp.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                                                    <div style={{ position: 'absolute', top: '-20px', left: '50%', height: '20px', width: '2px', backgroundColor: '#cbd5e1', transform: 'translateX(-50%)' }}></div>
                                                    <NodeCard
                                                        title={emp.full_name}
                                                        subtitle="Employee"
                                                        color="#10b981"
                                                        onClick={() => setSelectedEmployee(emp)}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div style={{ height: '100%', width: '100%', overflow: 'hidden', position: 'relative', backgroundColor: '#f8fafc' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'auto', padding: '40px' }}>
                <div style={{ minWidth: 'max-content', paddingBottom: '40px', zoom: scale, transition: 'zoom 0.2s' }}>

                    {/* Breadcrumb / Header */}
                    <div style={{ marginBottom: '32px', position: 'sticky', left: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: '100%' }}>
                        <div>
                            {/* Back Button Logic */}
                            {viewMode !== 'overview' && (
                                <button
                                    onClick={() => {
                                        setViewMode('overview');
                                        setSelectedProject(null);
                                    }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '4px',
                                        border: 'none', background: 'none', cursor: 'pointer',
                                        fontWeight: 'bold', color: '#64748b', fontSize: '1rem', marginBottom: '8px'
                                    }}
                                >
                                    <ChevronRight style={{ transform: 'rotate(180deg)' }} /> Back to Overview
                                </button>
                            )}
                            <h2 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>
                                {viewMode === 'overview' ? 'Project Hierarchy' : viewMode === 'full-overview' ? 'Full Organization Overview' : 'Project Detail'}
                            </h2>
                        </div>

                        {/* Full Overview Toggle */}
                        {viewMode === 'overview' && (
                            <button
                                onClick={() => setViewMode('full-overview')}
                                style={{
                                    padding: '10px 20px',
                                    backgroundColor: '#7c3aed',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 6px rgba(124, 58, 237, 0.3)',
                                    display: 'flex', alignItems: 'center', gap: '8px'
                                }}
                            >
                                <Folder size={18} /> Full Overview
                            </button>
                        )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center', minWidth: '100%' }}>
                        {viewMode === 'overview' && <OverviewTree />}
                        {viewMode === 'project-detail' && <ProjectDetailTree />}
                        {viewMode === 'full-overview' && <FullOverviewTree />}
                    </div>
                </div>
            </div>

            {/* Employee/Node Details Modal */}
            <EmployeeModal employee={selectedEmployee} onClose={() => setSelectedEmployee(null)} />

            {/* Add Member Modal */}
            {showAddMemberModal && selectedProject && (
                <AddMemberModal
                    onClose={() => setShowAddMemberModal(false)}
                    onAdd={handleAddMember}
                    existingMembers={[
                        ...(selectedProject.manager ? [selectedProject.manager] : []),
                    ]}
                />
            )}

            {/* Controls */}
            <div style={{ position: 'absolute', bottom: '32px', right: '32px', display: 'flex', gap: '8px', backgroundColor: 'white', padding: '8px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                <button onClick={handleZoomOut} style={{ padding: '8px', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer' }}>-</button>
                <div style={{ padding: '8px', fontWeight: 'bold' }}>{Math.round(scale * 100)}%</div>
                <button onClick={handleZoomIn} style={{ padding: '8px', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer' }}>+</button>
                <button onClick={handleReset} style={{ padding: '8px', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer' }}>Reset</button>
            </div>
        </div>
    );
};

export default ProjectHierarchyDemo;
