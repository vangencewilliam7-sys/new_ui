import React, { useState, useEffect } from 'react';
import { MessageCircle, Users, Building2, Search, Paperclip, Send, X, Plus, User, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import {
    getConversationsByCategory,
    getConversationMessages,
    sendMessage,
    subscribeToConversation,
    unsubscribeFromConversation,
    getUserDetails,
    getOrgUsers,
    createDMConversation,
    createTeamConversation,
    getOrCreateOrgConversation
} from '../../services/messageService';
import { sendNotification } from '../../services/notificationService';
import { useMessages } from './context/MessageContext';
import './MessagingHub.css';

const MessagingHub = () => {
    const [activeCategory, setActiveCategory] = useState('myself');
    const [conversations, setConversations] = useState([]);
    const [conversationCache, setConversationCache] = useState({}); // Cache conversations by category
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [messageInput, setMessageInput] = useState('');
    const [attachments, setAttachments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [currentUserId, setCurrentUserId] = useState(null);
    const [currentUserRole, setCurrentUserRole] = useState(null);
    const [currentUserOrgId, setCurrentUserOrgId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showNewDMModal, setShowNewDMModal] = useState(false);
    const [orgUsers, setOrgUsers] = useState([]);
    const [userSearchQuery, setUserSearchQuery] = useState('');
    const [errorMessage, setErrorMessage] = useState(null);
    const [selectedUser, setSelectedUser] = useState(null);
    const [showTeamModal, setShowTeamModal] = useState(false);
    const [selectedTeamMembers, setSelectedTeamMembers] = useState([]);
    const [teamName, setTeamName] = useState('');
    const [authLoading, setAuthLoading] = useState(true);
    const { markAsRead, lastReadTimes } = useMessages();
    const [showMembersModal, setShowMembersModal] = useState(false);
    const [currentMembers, setCurrentMembers] = useState([]);
    const [hoveredMessageId, setHoveredMessageId] = useState(null);

    const getSenderName = (senderId) => {
        const user = orgUsers.find(u => u.id === senderId);
        return user?.full_name || user?.email || 'Unknown';
    };

    const fetchConversationMembers = async () => {
        if (!selectedConversation) return;

        if (selectedConversation.type === 'everyone') {
            setCurrentMembers(orgUsers);
            setShowMembersModal(true);
            return;
        }

        try {
            const { data } = await supabase
                .from('conversation_members')
                .select('user_id')
                .eq('conversation_id', selectedConversation.id);

            if (data) {
                const memberIds = data.map(m => m.user_id);
                const members = orgUsers.filter(u => memberIds.includes(u.id));
                setCurrentMembers(members);
                setShowMembersModal(true);
            }
        } catch (err) {
            console.error('Error fetching members:', err);
        }
    };

    const formatDividerDate = (dateString) => {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return 'Today';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
                year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
            });
        }
    };

    // Get current user from Supabase auth
    useEffect(() => {
        const fetchCurrentUser = async () => {
            setAuthLoading(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();

                if (user) {
                    setCurrentUserId(user.id);

                    // Fetch user profile to get org_id and role
                    const { data: profile, error } = await supabase
                        .from('profiles')
                        .select('org_id, role')
                        .eq('id', user.id)
                        .single();

                    if (!error && profile) {
                        setCurrentUserOrgId(profile.org_id);
                        setCurrentUserRole(profile.role?.toLowerCase());
                        // Always load org users - the function handles null org_id
                        loadOrgUsers(profile.org_id, profile.role?.toLowerCase(), user.id);
                    } else {
                        // Even if no profile, try to load users for executive
                        console.log('No profile found, attempting to load all users');
                        loadOrgUsers(null, 'executive', user.id);
                    }
                }
            } catch (err) {
                console.error('Error fetching current user:', err);
            } finally {
                setAuthLoading(false);
            }
        };

        fetchCurrentUser();

        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
                fetchCurrentUser();
            } else if (event === 'SIGNED_OUT') {
                setCurrentUserId(null);
                setCurrentUserRole(null);
                setCurrentUserOrgId(null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // Load all users for messaging (Everyone can see everyone)
    const loadOrgUsers = async (orgId, userRole, userId) => {
        try {
            console.log('Loading all users for messaging...');

            const { data, error } = await supabase
                .from('profiles')
                .select('id, email, full_name, avatar_url, role')
                .order('full_name', { ascending: true, nullsFirst: false });

            if (error) {
                console.error('Error fetching users:', error);
            } else {
                console.log('Found users:', data?.length);
                setOrgUsers(data || []);
            }
        } catch (error) {
            console.error('Error loading users:', error);
        }
    };

    // Load conversations when category changes
    useEffect(() => {
        if (currentUserId) {
            loadConversations();
        }
    }, [activeCategory, currentUserId]);

    // Subscribe to real-time updates for selected conversation
    useEffect(() => {
        let subscription = null;

        if (selectedConversation) {
            subscription = subscribeToConversation(selectedConversation.id, (newMessage) => {
                // Prevent duplicate messages by checking if message already exists
                setMessages(prev => {
                    const messageExists = prev.some(msg => msg.id === newMessage.id);
                    if (messageExists) {
                        return prev; // Don't add duplicate
                    }
                    return [...prev, newMessage];
                });

                // Mark as read immediately since we are viewing it
                markAsRead(selectedConversation.id);
            });
        }

        return () => {
            if (subscription) {
                unsubscribeFromConversation(subscription);
            }
        };
    }, [selectedConversation]);

    const loadConversations = async () => {
        if (!currentUserId) {
            console.warn('Cannot load conversations: No user ID');
            return;
        }

        // Check if we have cached conversations for this category
        if (conversationCache[activeCategory]) {
            console.log('Using cached conversations for', activeCategory);
            setConversations(conversationCache[activeCategory]);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const convs = await getConversationsByCategory(currentUserId, activeCategory, currentUserOrgId);

            // For DM conversations, fetch the other user's name
            let finalConvs = convs;
            if (activeCategory === 'myself') {
                const convsWithNames = await Promise.all(convs.map(async (conv) => {
                    if (conv.type === 'dm' && !conv.name) {
                        // Get conversation members
                        const { data: members } = await supabase
                            .from('conversation_members')
                            .select('user_id')
                            .eq('conversation_id', conv.id);

                        // Find the other user (not current user)
                        const otherUserId = members?.find(m => m.user_id !== currentUserId)?.user_id;

                        if (otherUserId) {
                            // Get other user's profile
                            const { data: profile } = await supabase
                                .from('profiles')
                                .select('full_name, email')
                                .eq('id', otherUserId)
                                .single();

                            return {
                                ...conv,
                                name: profile?.full_name || profile?.email || 'User',
                                otherUserId: otherUserId
                            };
                        }
                    }
                    return conv;
                }));
                finalConvs = convsWithNames;
            }

            setConversations(finalConvs);
            // Cache the conversations for this category
            setConversationCache(prev => ({
                ...prev,
                [activeCategory]: finalConvs
            }));
        } catch (error) {
            console.error('Error loading conversations:', error);
            // Don't crash the app, just show empty state
            setConversations([]);
        } finally {
            setLoading(false);
        }
    };

    const loadMessages = async (conversation) => {
        setSelectedConversation(conversation);
        setLoading(true);

        // Mark conversation as read globally
        markAsRead(conversation.id);

        try {
            const msgs = await getConversationMessages(conversation.id);
            setMessages(msgs);
        } catch (error) {
            console.error('Error loading messages:', error);
            // Show empty messages instead of crashing
            setMessages([]);
        } finally {
            setLoading(false);
        }
    };

    // Delete Functions
    const deleteMessageForEveryone = async (messageId) => {
        const msg = messages.find(m => m.id === messageId);
        if (msg) {
            const timeDiff = (new Date() - new Date(msg.created_at)) / (1000 * 60);
            if (timeDiff > 5) {
                alert('Messages can only be deleted within 5 minutes of sending.');
                return;
            }
        }
        if (!confirm('Are you sure you want to delete this message for everyone?')) return;
        try {
            const { error } = await supabase
                .from('messages')
                .update({
                    content: 'This message was deleted',
                    is_deleted: true
                })
                .eq('id', messageId);

            if (error) throw error;

            setMessages(prev => prev.map(m =>
                m.id === messageId
                    ? { ...m, content: 'This message was deleted', is_deleted: true, attachments: [] }
                    : m
            ));
        } catch (err) {
            console.error('Error deleting message for everyone:', err);
            alert(`Failed to delete message: ${err.message || 'Unknown error'}`);
        }
    };

    const deleteMessageForMe = async (messageId) => {
        const msg = messages.find(m => m.id === messageId);
        if (msg) {
            const timeDiff = (new Date() - new Date(msg.created_at)) / (1000 * 60);
            if (timeDiff > 5) {
                alert('Messages can only be deleted within 5 minutes of sending.');
                return;
            }
        }
        try {
            const { data: currentMsg } = await supabase
                .from('messages')
                .select('deleted_for')
                .eq('id', messageId)
                .single();

            const currentDeletedFor = currentMsg?.deleted_for || [];
            if (!currentDeletedFor.includes(currentUserId)) {
                const { error } = await supabase
                    .from('messages')
                    .update({
                        deleted_for: [...currentDeletedFor, currentUserId]
                    })
                    .eq('id', messageId);

                if (error) throw error;

                setMessages(prev => prev.filter(m => m.id !== messageId));
            }
        } catch (err) {
            console.error('Error deleting message for me:', err);
            alert(`Failed to delete message: ${err.message || 'Unknown error'}`);
        }
    };

    const handleSendMessage = async () => {
        if (!messageInput.trim() && attachments.length === 0) return;
        if (!selectedConversation) return;

        try {
            let conversationId = selectedConversation.id;

            // If this is a temporary conversation, create a real one first
            if (selectedConversation.temp && selectedConversation.otherUser) {
                console.log('Creating real conversation for temp chat...');
                const realConversation = await createDMConversation(
                    currentUserId,
                    selectedConversation.otherUser.id,
                    currentUserOrgId
                );
                conversationId = realConversation.id;

                // Update the selected conversation to the real one
                setSelectedConversation({
                    ...realConversation,
                    name: selectedConversation.otherUser.full_name || selectedConversation.otherUser.email
                });
            }

            const newMessage = await sendMessage(
                conversationId,
                currentUserId,
                messageInput,
                attachments
            );

            // Optimistically add message to state to fix "No messages yet" glitch
            setMessages(prev => {
                const exists = prev.some(m => m.id === newMessage.id);
                if (exists) return prev;
                return [...prev, newMessage];
            });

            setMessageInput('');
            setAttachments([]);
            setErrorMessage(null);

            // Send notifications to other conversation members
            try {
                // Get current user's name
                const { data: senderProfile } = await supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('id', currentUserId)
                    .single();

                const senderName = senderProfile?.full_name || 'Someone';

                // Get all members of the conversation except current user
                const { data: members } = await supabase
                    .from('conversation_members')
                    .select('user_id')
                    .eq('conversation_id', conversationId)
                    .neq('user_id', currentUserId);

                // Send notification to each member
                if (members && members.length > 0) {
                    for (const member of members) {
                        await sendNotification(
                            member.user_id,
                            currentUserId,
                            senderName,
                            messageInput || 'Sent an attachment', // Send actual content
                            'message'
                        );
                    }
                }
            } catch (notifError) {
                console.error('Error sending message notifications:', notifError);
                // Don't fail the whole message send if notifications fail
            }

            // Invalidate cache and reload conversations to show the new message
            setConversationCache(prev => {
                const newCache = { ...prev };
                delete newCache[activeCategory];
                return newCache;
            });
            loadConversations();
        } catch (error) {
            console.error('Error sending message:', error);
            // Check for specific errors
            if (error.code === '42P01' || error.message?.includes('does not exist')) {
                setErrorMessage('Messaging tables not set up. Please run the SQL setup script in Supabase.');
            } else if (error.code === '22P02') {
                setErrorMessage('Invalid conversation. Please try starting a new chat.');
            } else {
                setErrorMessage(`Failed to send message: ${error.message || 'Unknown error'}`);
            }
        }
    };

    const handleFileAttachment = (e) => {
        const files = Array.from(e.target.files);
        setAttachments(prev => [...prev, ...files]);
    };

    const removeAttachment = (index) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handlePaste = (e) => {
        if (e.clipboardData && e.clipboardData.items) {
            const items = e.clipboardData.items;
            const files = [];

            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const file = items[i].getAsFile();
                    if (file) {
                        files.push(file);
                    }
                }
            }

            if (files.length > 0) {
                e.preventDefault(); // Prevent pasting the image binary string into text input
                setAttachments(prev => [...prev, ...files]);
            }
        }
    };

    const startNewDM = async (userId) => {
        try {
            console.log('Starting DM with user:', userId);
            setLoading(true);

            // Find the selected user info for display
            const user = orgUsers.find(u => u.id === userId);
            setSelectedUser(user);

            const conversation = await createDMConversation(currentUserId, userId, currentUserOrgId);
            setShowNewDMModal(false);
            setUserSearchQuery('');
            setErrorMessage(null);
            // Invalidate cache for 'myself' category
            setConversationCache(prev => {
                const newCache = { ...prev };
                delete newCache['myself'];
                return newCache;
            });
            loadConversations();
            loadMessages(conversation);
        } catch (error) {
            console.error('Error creating DM:', error);
            // Check if error is due to missing table
            if (error.message?.includes('does not exist') || error.code === '42P01') {
                setErrorMessage('Messaging database is not set up. Please run the setup_messaging_database.sql script in Supabase.');
            } else {
                setErrorMessage(`Failed to start conversation: ${error.message || 'Unknown error'}`);
            }
            // Keep the modal open so user can see the error
        } finally {
            setLoading(false);
        }
    };

    // Start a chat directly with a user (for quick action)
    const startChatWithUser = async (user) => {
        setSelectedUser(user);
        setShowNewDMModal(false);
        setUserSearchQuery('');
        // For now, just show the user is selected even if conversation can't be created
        setSelectedConversation({
            id: `temp_${user.id}`,
            type: 'dm',
            name: user.full_name || user.email,
            temp: true,
            otherUser: user
        });
        setMessages([]);
    };

    // Create a new team chat with selected members
    const createNewTeamChat = async () => {
        if (!teamName.trim() || selectedTeamMembers.length === 0) {
            setErrorMessage('Please enter a team name and select at least one member');
            return;
        }

        try {
            setLoading(true);
            const conversation = await createTeamConversation(
                currentUserId,
                selectedTeamMembers,
                teamName,
                currentUserOrgId
            );
            setShowTeamModal(false);
            setTeamName('');
            setSelectedTeamMembers([]);
            setErrorMessage(null);
            // Invalidate cache for 'team' category
            setConversationCache(prev => {
                const newCache = { ...prev };
                delete newCache['team'];
                return newCache;
            });
            loadConversations();
            loadMessages(conversation);
        } catch (error) {
            console.error('Error creating team chat:', error);
            setErrorMessage(`Failed to create team chat: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Join or create organization-wide chat
    const joinOrganizationChat = async () => {
        try {
            setLoading(true);
            const conversation = await getOrCreateOrgConversation(currentUserId, currentUserOrgId);
            setErrorMessage(null);
            // Invalidate cache for 'organization' category
            setConversationCache(prev => {
                const newCache = { ...prev };
                delete newCache['organization'];
                return newCache;
            });
            loadConversations();
            loadMessages(conversation);
        } catch (error) {
            console.error('Error joining org chat:', error);
            setErrorMessage(`Failed to join organization chat: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Toggle member selection for team chat
    const toggleTeamMember = (userId) => {
        setSelectedTeamMembers(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

    const filteredConversations = conversations.filter(conv => {
        if (!searchQuery) return true;
        const lastMsg = conv.conversation_indexes?.[0]?.last_message || '';
        return lastMsg.toLowerCase().includes(searchQuery.toLowerCase());
    });

    const categories = [
        { id: 'myself', label: 'Myself', icon: MessageCircle, description: 'Direct messages' },
        { id: 'team', label: 'Team', icon: Users, description: 'Team conversations' },
        { id: 'organization', label: 'Organization', icon: Building2, description: 'Company-wide chat' }
    ];

    return (
        <div className="messaging-hub" style={{ margin: 0, padding: 0, display: 'grid' }}>
            {authLoading ? (
                <div className="loading-auth" style={{ padding: '2rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                    <div className="spinner" style={{ width: '40px', height: '40px', border: '3px solid #f3f3f3', borderTop: '3px solid var(--accent, #6366f1)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                </div>
            ) : !currentUserId ? (
                <div className="login-prompt" style={{ padding: '2rem', textAlign: 'center' }}>
                    <p>Please log in to view your messages.</p>
                    <button onClick={() => {
                        window.location.href = '/login';
                    }} style={{ padding: '0.5rem 1rem', backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                        Go to Login
                    </button>
                </div>
            ) : (
                // Category Selector
                <div className="category-sidebar">
                    <div className="category-header">
                        <h2>Messages</h2>
                    </div>
                    <div className="category-list">
                        {categories.map(category => {
                            const Icon = category.icon;
                            return (
                                <button
                                    key={category.id}
                                    className={`category-item ${activeCategory === category.id ? 'active' : ''}`}
                                    onClick={() => setActiveCategory(category.id)}
                                >
                                    <Icon size={20} />
                                    <div className="category-info">
                                        <span className="category-label">{category.label}</span>
                                        <span className="category-description">{category.description}</span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Conversation List */}
            <div className="conversation-sidebar">
                <div className="conversation-header">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a', margin: 0, letterSpacing: '-0.025em' }}>Communications</h2>
                        {activeCategory === 'myself' && (
                            <button
                                className="new-dm-button"
                                onClick={() => setShowNewDMModal(true)}
                                title="New conversation"
                            >
                                <Plus size={20} />
                            </button>
                        )}
                        {activeCategory === 'team' && (
                            <button
                                className="new-dm-button"
                                onClick={() => setShowTeamModal(true)}
                                title="Create team chat"
                            >
                                <Plus size={20} />
                            </button>
                        )}
                    </div>
                    <div className="search-box">
                        <Search size={18} />
                        <input
                            type="text"
                            placeholder="Search conversations..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="conversation-list">
                    {loading && !selectedConversation ? (
                        <div className="loading-state">Loading conversations...</div>
                    ) : filteredConversations.length === 0 ? (
                        <div className="empty-state">
                            <MessageCircle size={48} />
                            <p>No conversations yet</p>
                            {activeCategory === 'myself' && (
                                <button
                                    onClick={() => setShowNewDMModal(true)}
                                    className="empty-state-action-btn"
                                    style={{
                                        background: 'white',
                                        color: '#64748b',
                                        border: '1px solid #e2e8f0',
                                        padding: '8px 16px',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        margin: '0 auto',
                                        fontSize: '13px',
                                        fontWeight: '500',
                                        transition: 'all 0.2s ease',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.borderColor = '#cbd5e1';
                                        e.currentTarget.style.color = '#0f172a';
                                        e.currentTarget.style.transform = 'translateY(-1px)';
                                        e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.borderColor = '#e2e8f0';
                                        e.currentTarget.style.color = '#64748b';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
                                    }}
                                >
                                    <Plus size={16} /> Start a conversation
                                </button>
                            )}
                            {activeCategory === 'team' && (
                                <div style={{ textAlign: 'center' }}>
                                    <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '1rem' }}>
                                        Create a team chat to collaborate with your colleagues
                                    </p>
                                    <button
                                        onClick={() => setShowTeamModal(true)}
                                        className="empty-state-action-btn"
                                        style={{
                                            background: 'white',
                                            color: '#64748b',
                                            border: '1px solid #e2e8f0',
                                            padding: '8px 16px',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            margin: '0 auto',
                                            fontSize: '13px',
                                            fontWeight: '500',
                                            transition: 'all 0.2s ease',
                                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.borderColor = '#cbd5e1';
                                            e.currentTarget.style.color = '#0f172a';
                                            e.currentTarget.style.transform = 'translateY(-1px)';
                                            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.borderColor = '#e2e8f0';
                                            e.currentTarget.style.color = '#64748b';
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
                                        }}
                                    >
                                        <Plus size={16} />
                                        Create Team Chat
                                    </button>
                                </div>
                            )}
                            {activeCategory === 'organization' && (
                                <div style={{ textAlign: 'center' }}>
                                    <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '1rem' }}>
                                        Join the company-wide chat to connect with everyone
                                    </p>
                                    <button
                                        onClick={joinOrganizationChat}
                                        className="empty-state-action-btn"
                                        style={{
                                            background: 'white',
                                            color: '#64748b',
                                            border: '1px solid #e2e8f0',
                                            padding: '8px 16px',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            margin: '0 auto',
                                            fontSize: '13px',
                                            fontWeight: '500',
                                            transition: 'all 0.2s ease',
                                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (!loading) {
                                                e.currentTarget.style.borderColor = '#cbd5e1';
                                                e.currentTarget.style.color = '#0f172a';
                                                e.currentTarget.style.transform = 'translateY(-1px)';
                                                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!loading) {
                                                e.currentTarget.style.borderColor = '#e2e8f0';
                                                e.currentTarget.style.color = '#64748b';
                                                e.currentTarget.style.transform = 'translateY(0)';
                                                e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
                                            }
                                        }}
                                        disabled={loading}
                                    >
                                        <Building2 size={16} />
                                        {loading ? 'Joining...' : 'Join Company Chat'}
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        filteredConversations.map(conv => {
                            const lastMsgTime = conv.conversation_indexes?.[0]?.last_message_at ? new Date(conv.conversation_indexes[0].last_message_at).getTime() : 0;
                            const lastReadTime = lastReadTimes[conv.id] || 0;
                            const isUnread = lastMsgTime > lastReadTime;

                            return (
                                <div
                                    key={conv.id}
                                    className={`conversation-item ${selectedConversation?.id === conv.id ? 'active' : ''} ${isUnread ? 'unread' : ''}`}
                                    onClick={() => loadMessages(conv)}
                                >
                                    <div className="conversation-avatar">
                                        {conv.type === 'dm' ? <User size={20} /> : conv.type === 'team' ? <Users size={20} /> : <Building2 size={20} />}
                                    </div>
                                    <div className="conversation-info">
                                        <div className="conversation-name">
                                            {conv.name || 'Conversation'}
                                        </div>
                                        <div className="conversation-preview">
                                            {conv.conversation_indexes?.[0]?.last_message
                                                || (conv.conversation_indexes?.[0]?.last_message_at ? '📎 Attachment' : 'No messages yet')}
                                        </div>
                                    </div>
                                    <div className="conversation-time">
                                        {conv.conversation_indexes?.[0]?.last_message_at ? (
                                            new Date(conv.conversation_indexes[0].last_message_at).toLocaleTimeString([], {
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })
                                        ) : ''}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Message Thread */}
            <div className="message-thread">
                {selectedConversation ? (
                    <>
                        <div className="thread-header">
                            <div className="thread-info">
                                <h3>{selectedConversation.name || selectedConversation.otherUser?.full_name || 'Conversation'}</h3>
                                <span className="thread-type">
                                    {selectedConversation.type === 'dm' ? 'Direct Message' :
                                        selectedConversation.type === 'team' ? 'Team Chat' : 'Organization'}
                                </span>
                            </div>
                            {(selectedConversation.type === 'team' || selectedConversation.type === 'everyone') && (
                                <button
                                    onClick={fetchConversationMembers}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '6px 12px',
                                        borderRadius: '6px',
                                        border: '1px solid #e5e7eb',
                                        background: 'white',
                                        cursor: 'pointer',
                                        fontSize: '12px',
                                        color: '#374151',
                                        fontWeight: 500
                                    }}
                                >
                                    <Users size={14} />
                                    View Members
                                </button>
                            )}
                        </div>

                        <div className="messages-container">
                            {selectedConversation.temp ? (
                                <div className="empty-messages" style={{ textAlign: 'center', padding: '2rem' }}>
                                    <MessageCircle size={48} style={{ marginBottom: '1rem', opacity: 0.5, color: '#6366f1' }} />
                                    <h4 style={{ marginBottom: '0.5rem', color: '#1f2937' }}>
                                        Chat with {selectedConversation.otherUser?.full_name || 'User'}
                                    </h4>
                                    <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
                                        Send a message to start the conversation!
                                    </p>

                                </div>
                            ) : messages.length === 0 ? (
                                <div className="empty-messages">
                                    <p>No messages yet. Start the conversation!</p>
                                </div>
                            ) : (
                                messages.map((msg, index) => {
                                    const prevMsg = messages[index - 1];
                                    const prevDate = prevMsg ? new Date(prevMsg.created_at).toDateString() : null;
                                    const currDate = new Date(msg.created_at).toDateString();
                                    const isNewDay = currDate !== prevDate;

                                    return (
                                        <React.Fragment key={msg.id}>
                                            {isNewDay && (
                                                <div className="date-divider" style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    margin: '24px 0 12px 0',
                                                    position: 'relative'
                                                }}>
                                                    <div style={{ height: '1px', background: '#e5e7eb', width: '100%', position: 'absolute' }}></div>
                                                    <span style={{
                                                        background: '#f9fafb',
                                                        padding: '0 16px',
                                                        fontSize: '11px',
                                                        color: '#6b7280',
                                                        fontWeight: 600,
                                                        zIndex: 1,
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.05em'
                                                    }}>
                                                        {formatDividerDate(msg.created_at)}
                                                    </span>
                                                </div>
                                            )}
                                            <div
                                                className={`message ${msg.sender_user_id === currentUserId ? 'sent' : 'received'}`}
                                                style={{ position: 'relative', group: 'message-group' }}
                                                onMouseEnter={() => setHoveredMessageId(msg.id)}
                                                onMouseLeave={() => setHoveredMessageId(null)}
                                            >
                                                <div className="message-bubble">
                                                    {/* Sender Name for Group Chats */}
                                                    {(selectedConversation.type === 'team' || selectedConversation.type === 'everyone') && msg.sender_user_id !== currentUserId && (
                                                        <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px', marginLeft: '2px', fontWeight: 600 }}>
                                                            {getSenderName(msg.sender_user_id)}
                                                        </div>
                                                    )}
                                                    {/* Delete Actions (Only for Sender, within 5 minutes) */}
                                                    {msg.sender_user_id === currentUserId && !msg.is_deleted && (new Date() - new Date(msg.created_at)) < 5 * 60 * 1000 && hoveredMessageId === msg.id && (
                                                        <div
                                                            style={{
                                                                position: 'absolute',
                                                                top: '-35px',
                                                                right: '0',
                                                                background: 'white',
                                                                borderRadius: '8px',
                                                                padding: '4px',
                                                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                                                display: 'flex',
                                                                gap: '4px',
                                                                zIndex: 10,
                                                                border: '1px solid #e2e8f0',
                                                                animation: 'fadeIn 0.2s ease'
                                                            }}
                                                        >
                                                            <button
                                                                onClick={() => deleteMessageForMe(msg.id)}
                                                                title="Delete for me"
                                                                style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '4px', cursor: 'pointer', color: '#64748b' }}
                                                            >
                                                                <Trash2 size={12} /> Me
                                                            </button>
                                                            <button
                                                                onClick={() => deleteMessageForEveryone(msg.id)}
                                                                title="Delete for everyone"
                                                                style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '4px', cursor: 'pointer', color: '#ef4444' }}
                                                            >
                                                                <Trash2 size={12} /> All
                                                            </button>
                                                        </div>
                                                    )}

                                                    <div className="message-content" style={{ fontStyle: msg.is_deleted ? 'italic' : 'normal', color: msg.is_deleted ? '#94a3b8' : 'inherit' }}>
                                                        {msg.is_deleted && <Trash2 size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />}
                                                        {msg.content}
                                                    </div>
                                                    {msg.attachments && msg.attachments.length > 0 && (
                                                        <div className="message-attachments">
                                                            {msg.attachments.map(att => (
                                                                <a
                                                                    key={att.id}
                                                                    href={att.url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="attachment-link"
                                                                >
                                                                    📎 {att.file_name}
                                                                </a>
                                                            ))}
                                                        </div>
                                                    )}
                                                    <div className="message-time">
                                                        {new Date(msg.created_at).toLocaleTimeString([], {
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </div>

                        <div className="message-input-container">
                            {/* Error Banner */}
                            {errorMessage && (
                                <div style={{
                                    padding: '0.75rem 1rem',
                                    marginBottom: '0.5rem',
                                    background: '#fee2e2',
                                    border: '1px solid #fca5a5',
                                    borderRadius: '8px',
                                    color: '#b91c1c',
                                    fontSize: '13px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <span>{errorMessage}</span>
                                    <button
                                        onClick={() => setErrorMessage(null)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            )}

                            {attachments.length > 0 && (
                                <div className="attachments-preview">
                                    {attachments.map((file, index) => (
                                        <div key={index} className="attachment-chip">
                                            <span>{file.name}</span>
                                            <button onClick={() => removeAttachment(index)}>
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="message-input-box">
                                <label className="attachment-button">
                                    <Paperclip size={20} />
                                    <input
                                        type="file"
                                        multiple
                                        onChange={handleFileAttachment}
                                        style={{ display: 'none' }}
                                    />
                                </label>
                                <input
                                    type="text"
                                    placeholder="Type a message... (Paste images directly)"
                                    value={messageInput}
                                    onChange={(e) => setMessageInput(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    onPaste={handlePaste}
                                />
                                <button
                                    className="send-button"
                                    onClick={handleSendMessage}
                                    disabled={!messageInput.trim() && attachments.length === 0}
                                >
                                    <Send size={20} />
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="no-conversation-selected">
                        <MessageCircle size={64} />
                        <h3>Select a conversation</h3>
                        <p>Choose a conversation from the list to start messaging</p>
                    </div>
                )}
            </div>

            {/* New DM Modal */}
            {
                showNewDMModal && (
                    <div className="modal-overlay" onClick={() => { setShowNewDMModal(false); setUserSearchQuery(''); setErrorMessage(null); }}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ minWidth: '400px' }}>
                            <div className="modal-header">
                                <h3>Start a new conversation</h3>
                                <button onClick={() => { setShowNewDMModal(false); setUserSearchQuery(''); setErrorMessage(null); }}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="modal-body">
                                {/* Error Message Display */}
                                {errorMessage && (
                                    <div style={{
                                        padding: '0.75rem 1rem',
                                        marginBottom: '1rem',
                                        background: '#fee2e2',
                                        border: '1px solid #fca5a5',
                                        borderRadius: '8px',
                                        color: '#b91c1c',
                                        fontSize: '14px',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}>
                                        <span>{errorMessage}</span>
                                        <button
                                            onClick={() => setErrorMessage(null)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                )}

                                <div className="user-search" style={{ marginBottom: '1rem' }}>
                                    <div className="search-box" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: '#f5f5f5', borderRadius: '8px' }}>
                                        <Search size={18} style={{ color: '#888' }} />
                                        <input
                                            type="text"
                                            placeholder="Search employees by name or role..."
                                            value={userSearchQuery}
                                            onChange={(e) => setUserSearchQuery(e.target.value)}
                                            style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '14px' }}
                                            autoFocus
                                        />
                                        {userSearchQuery && (
                                            <button
                                                onClick={() => setUserSearchQuery('')}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                                            >
                                                <X size={16} style={{ color: '#888' }} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {loading && (
                                    <div style={{ textAlign: 'center', padding: '1rem', color: '#888' }}>
                                        <div className="spinner" style={{
                                            width: '24px',
                                            height: '24px',
                                            border: '3px solid #f3f3f3',
                                            borderTop: '3px solid var(--accent, #6366f1)',
                                            borderRadius: '50%',
                                            animation: 'spin 1s linear infinite',
                                            margin: '0 auto 0.5rem'
                                        }} />
                                        <p>Starting conversation...</p>
                                    </div>
                                )}

                                <div className="user-list" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                    {orgUsers.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>
                                            <Users size={48} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                                            <p>No employees found</p>
                                        </div>
                                    ) : (
                                        orgUsers
                                            .filter(user => user.id !== currentUserId)
                                            .filter(user => {
                                                if (!userSearchQuery) return true;
                                                const query = userSearchQuery.toLowerCase();
                                                return (
                                                    (user.full_name?.toLowerCase() || '').includes(query) ||
                                                    (user.email?.toLowerCase() || '').includes(query) ||
                                                    (user.role?.toLowerCase() || '').includes(query)
                                                );
                                            })
                                            .map(user => (
                                                <div
                                                    key={user.id}
                                                    className="user-item"
                                                    onClick={() => startChatWithUser(user)}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '12px',
                                                        padding: '12px',
                                                        cursor: 'pointer',
                                                        borderRadius: '8px',
                                                        transition: 'background 0.2s'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                >
                                                    <div className="user-avatar" style={{
                                                        width: '40px',
                                                        height: '40px',
                                                        borderRadius: '50%',
                                                        background: '#e5e7eb',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '16px',
                                                        fontWeight: 'bold',
                                                        color: '#6366f1'
                                                    }}>
                                                        {user.avatar_url ? (
                                                            <img src={user.avatar_url} alt={user.full_name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                                        ) : (
                                                            (user.full_name?.[0] || user.email?.[0] || '?').toUpperCase()
                                                        )}
                                                    </div>
                                                    <div className="user-info" style={{ flex: 1 }}>
                                                        <div className="user-name" style={{ fontWeight: '500', color: '#1f2937' }}>
                                                            {user.full_name || user.email}
                                                        </div>
                                                        <div className="user-role" style={{ fontSize: '12px', color: '#6b7280', textTransform: 'capitalize' }}>
                                                            {user.role}
                                                        </div>
                                                    </div>
                                                    <MessageCircle size={18} style={{ color: '#9ca3af' }} />
                                                </div>
                                            ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Team Chat Modal */}
            {
                showTeamModal && (
                    <div className="modal-overlay" onClick={() => { setShowTeamModal(false); setTeamName(''); setSelectedTeamMembers([]); setErrorMessage(null); }}>
                        <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', width: '90%', maxHeight: '80vh', background: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
                            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Create Team Chat</h2>
                                <button onClick={() => { setShowTeamModal(false); setTeamName(''); setSelectedTeamMembers([]); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Error Message */}
                            {errorMessage && (
                                <div style={{ padding: '0.75rem', marginBottom: '1rem', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#b91c1c', fontSize: '14px' }}>
                                    {errorMessage}
                                </div>
                            )}

                            {/* Team Name Input */}
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>Team Name</label>
                                <input
                                    type="text"
                                    placeholder="Enter team name..."
                                    value={teamName}
                                    onChange={(e) => setTeamName(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '8px',
                                        fontSize: '14px'
                                    }}
                                />
                            </div>

                            {/* Member Selection */}
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
                                    Select Members ({selectedTeamMembers.length} selected)
                                </label>
                                <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                                    {orgUsers.filter(u => u.id !== currentUserId).length === 0 ? (
                                        <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                                            No team members available
                                        </div>
                                    ) : (
                                        orgUsers
                                            .filter(u => u.id !== currentUserId)
                                            .map(user => (
                                                <div
                                                    key={user.id}
                                                    onClick={() => toggleTeamMember(user.id)}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '12px',
                                                        padding: '12px',
                                                        cursor: 'pointer',
                                                        borderBottom: '1px solid #f3f4f6',
                                                        background: selectedTeamMembers.includes(user.id) ? '#eef2ff' : 'transparent'
                                                    }}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedTeamMembers.includes(user.id)}
                                                        onChange={() => { }}
                                                        style={{ width: '18px', height: '18px', accentColor: '#6366f1' }}
                                                    />
                                                    <div style={{
                                                        width: '36px',
                                                        height: '36px',
                                                        borderRadius: '50%',
                                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: 'white',
                                                        fontWeight: '600',
                                                        fontSize: '14px'
                                                    }}>
                                                        {(user.full_name || user.email || '?').charAt(0).toUpperCase()}
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontWeight: '500', color: '#1f2937' }}>
                                                            {user.full_name || user.email}
                                                        </div>
                                                        <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'capitalize' }}>
                                                            {user.role}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                    )}
                                </div>
                            </div>

                            {/* Create Button */}
                            <button
                                onClick={createNewTeamChat}
                                disabled={loading || !teamName.trim() || selectedTeamMembers.length === 0}
                                style={{
                                    width: '100%',
                                    padding: '0.875rem',
                                    background: loading || !teamName.trim() || selectedTeamMembers.length === 0 ? '#d1d5db' : 'var(--accent, #6366f1)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: loading || !teamName.trim() || selectedTeamMembers.length === 0 ? 'not-allowed' : 'pointer',
                                    fontWeight: '600',
                                    fontSize: '15px'
                                }}
                            >
                                {loading ? 'Creating...' : 'Create Team Chat'}
                            </button>
                        </div>
                    </div>
                )
            }

            {/* View Members Modal */}
            {
                showMembersModal && (
                    <div className="modal-overlay" onClick={() => setShowMembersModal(false)}>
                        <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', width: '90%', maxHeight: '80vh', background: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
                            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Group Members</h2>
                                <button onClick={() => setShowMembersModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="user-list" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                {currentMembers.map(user => (
                                    <div
                                        key={user.id}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            padding: '12px',
                                            borderBottom: '1px solid #f3f4f6'
                                        }}
                                    >
                                        <div className="user-avatar" style={{
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: '50%',
                                            background: '#e5e7eb',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '16px',
                                            fontWeight: 'bold',
                                            color: '#6366f1'
                                        }}>
                                            {user.avatar_url ? (
                                                <img src={user.avatar_url} alt={user.full_name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                            ) : (
                                                (user.full_name?.[0] || user.email?.[0] || '?').toUpperCase()
                                            )}
                                        </div>
                                        <div className="user-info" style={{ flex: 1 }}>
                                            <div className="user-name" style={{ fontWeight: '500', color: '#1f2937' }}>
                                                {user.full_name || user.email} {user.id === currentUserId && '(You)'}
                                            </div>
                                            <div className="user-role" style={{ fontSize: '12px', color: '#6b7280', textTransform: 'capitalize' }}>
                                                {user.role}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
        </div>
    );
};

export default MessagingHub;
