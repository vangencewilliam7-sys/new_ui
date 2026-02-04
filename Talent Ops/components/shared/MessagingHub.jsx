import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Users, Building2, Search, Paperclip, Send, X, Plus, User, Trash2, Settings, UserPlus, Edit2, Shield, UserMinus, Reply, Smile, BarChart2, CheckCircle2, Info } from 'lucide-react';
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
    getOrCreateOrgConversation,
    isConversationAdmin,
    getConversationMembers,
    addMemberToConversation,
    removeMemberFromConversation,
    promoteMemberToAdmin,
    demoteMemberFromAdmin,
    renameConversation,
    deleteConversation,
    leaveConversation,
    sendMessageWithReply,
    toggleReaction,
    getReactionSummary,
    uploadAttachment,
    sendPoll,
    voteInPoll,
    getPollVotes
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
    const { markAsRead, lastReadTimes, lastIncomingMessage } = useMessages();
    const [showMembersModal, setShowMembersModal] = useState(false);
    const [currentMembers, setCurrentMembers] = useState([]);
    const [hoveredMessageId, setHoveredMessageId] = useState(null);
    const textareaRef = useRef(null);
    const [isCurrentUserAdmin, setIsCurrentUserAdmin] = useState(false); // Admin functions
    const [showGroupSettings, setShowGroupSettings] = useState(false);
    const [showAddMemberModal, setShowAddMemberModal] = useState(false);
    const [showRenameModal, setShowRenameModal] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [messageSearchQuery, setMessageSearchQuery] = useState('');

    // Reply & Reaction state
    const [replyingTo, setReplyingTo] = useState(null);
    const [showReactionPicker, setShowReactionPicker] = useState(null);
    const [viewingReactionsFor, setViewingReactionsFor] = useState(null);
    const [messageReactions, setMessageReactions] = useState({});


    // Poll state
    const [showPollModal, setShowPollModal] = useState(false);
    const [pollQuestion, setPollQuestion] = useState('');
    const [pollOptions, setPollOptions] = useState(['', '']);
    const [allowMultiplePoll, setAllowMultiplePoll] = useState(false);
    const [allPollVotes, setAllPollVotes] = useState({}); // { messageId: [votes] }
    const [showVoteDetails, setShowVoteDetails] = useState(null); // messageId
    const isReacting = useRef(false);

    // Helper Component for Poll Messages
    const PollContent = ({ msg, votes, onVote, currentUserId, onViewVotes }) => {
        const totalVotes = votes.length;
        const optionVotes = msg.poll_options.map((option, idx) => {
            const votesForOption = votes.filter(v => v.option_index === idx);
            return {
                text: option,
                count: votesForOption.length,
                percentage: totalVotes > 0 ? (votesForOption.length / totalVotes) * 100 : 0,
                voters: votesForOption.map(v => ({
                    id: v.user_id,
                    name: v.profiles?.full_name || v.profiles?.email || 'Unknown',
                    avatar: v.profiles?.avatar_url
                })),
                isVoted: votesForOption.some(v => v.user_id === currentUserId)
            };
        });

        return (
            <div className="poll-container">
                <div className="poll-question">{msg.poll_question}</div>
                <div className="poll-info">
                    <BarChart2 size={14} />
                    {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'} • {msg.allow_multiple_answers ? 'Multiple answers' : 'Select one'}
                </div>
                <div className="poll-options-list">
                    {optionVotes.map((opt, idx) => (
                        <div
                            key={idx}
                            className="poll-option-item"
                            onClick={() => onVote(idx)}
                        >
                            <div className="poll-option-header">
                                <div className="poll-option-text">
                                    {opt.isVoted ? <CheckCircle2 size={16} color="#3b82f6" /> : <div style={{ width: 16, height: 16, border: '1px solid #94a3b8', borderRadius: '50%' }} />}
                                    {opt.text}
                                </div>
                                <div className="poll-option-stats">
                                    <div className="voter-avatars">
                                        {opt.voters.slice(0, 3).map((voter, i) => (
                                            <div key={i} className="voter-avatar-mini" title={voter.name}>
                                                {voter.avatar ? <img src={voter.avatar} alt={voter.name} /> : (voter.name[0] || '?').toUpperCase()}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="vote-count-badge">{opt.count}</div>
                                </div>
                            </div>
                            <div className="poll-progress-container">
                                <div
                                    className="poll-progress-fill"
                                    style={{ width: `${opt.percentage}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
                <button className="poll-view-votes-btn" onClick={onViewVotes}>
                    View votes
                </button>
            </div>
        );
    };

    // Auto-resize textarea as user types
    const handleTextareaChange = (e) => {
        setMessageInput(e.target.value);
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
        }
    };

    // Helper to render message content with clickable links and newlines
    const renderMessageContent = (content) => {
        if (!content) return null;

        // URL regex pattern
        const urlPattern = /(https?:\/\/[^\s]+)/g;

        // Split content by newlines first
        const lines = content.split('\n');

        return lines.map((line, lineIndex) => (
            <React.Fragment key={lineIndex}>
                {line.split(urlPattern).map((part, i) => {
                    if (part.match(urlPattern)) {
                        return (
                            <a
                                key={i}
                                href={part}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="message-link"
                                style={{
                                    color: '#3b82f6', // Clear blue color as requested
                                    textDecoration: 'underline',
                                    fontWeight: '500',
                                    wordBreak: 'break-all'
                                }}
                            >
                                {part}
                            </a>
                        );
                    }
                    return part;
                })}
                {lineIndex < lines.length - 1 && <br />}
            </React.Fragment>
        ));
    };

    const getSenderName = (senderId) => {
        const user = orgUsers.find(u => u.id === senderId);
        return user?.full_name || user?.email || 'Unknown';
    };

    const fetchConversationMembers = async () => {
        if (!selectedConversation) return;

        if (selectedConversation.type === 'everyone') {
            setCurrentMembers(orgUsers.map(u => ({ ...u, is_admin: false })));
            setShowMembersModal(true);
            return;
        }

        try {
            console.log('Fetching members for conversation:', selectedConversation.id);
            const members = await getConversationMembers(selectedConversation.id);
            console.log('Fetched members:', members);
            setCurrentMembers(members);
            setShowMembersModal(true);
        } catch (err) {
            console.error('Error fetching members:', err);
            alert('Error loading members: ' + err.message);
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

    // Reload conversations when a new message arrives globally (to update sorting)
    useEffect(() => {
        if (lastIncomingMessage && currentUserId) {
            console.log('New message received globally, refreshing conversation list...');
            // Invalidate cache for current category to force refresh
            setConversationCache(prev => {
                const newCache = { ...prev };
                delete newCache[activeCategory];
                return newCache;
            });
            loadConversations();
        }
    }, [lastIncomingMessage]);

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

            let query = supabase
                .from('profiles')
                .select('id, email, full_name, avatar_url, role')
                .order('full_name', { ascending: true, nullsFirst: false });

            if (orgId) {
                query = query.eq('org_id', orgId);
            }

            const { data, error } = await query;

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
            subscription = subscribeToConversation(selectedConversation.id, {
                onMessage: async (newMessage) => {
                    // Fetch full message details including relationships
                    try {
                        const { data: fullMsg, error } = await supabase
                            .from('messages')
                            .select(`
                                *,
                                replied_to:messages!reply_to (
                                    id,
                                    content,
                                    sender_id:sender_user_id
                                ),
                                attachments(*),
                                message_reactions (
                                    id,
                                    reaction,
                                    user_id
                                )
                            `)
                            .eq('id', newMessage.id)
                            .single();

                        if (fullMsg && !error) {
                            setMessages(prev => {
                                const messageExists = prev.some(msg => msg.id === fullMsg.id);
                                if (messageExists) return prev;
                                return [...prev, fullMsg];
                            });

                            // Update sidebar conversation preview
                            setConversations(prevConvs => {
                                const updated = prevConvs.map(c => {
                                    if (c.id === selectedConversation.id) {
                                        return {
                                            ...c,
                                            conversation_indexes: [{
                                                last_message: fullMsg.content || '📎 Attachment',
                                                last_message_at: fullMsg.created_at
                                            }]
                                        };
                                    }
                                    return c;
                                });

                                // Sort by latest message
                                return updated.sort((a, b) => {
                                    const tAStr = a.conversation_indexes?.[0]?.last_message_at;
                                    const tBStr = b.conversation_indexes?.[0]?.last_message_at;

                                    if (!tAStr && !tBStr) return 0;
                                    if (!tAStr) return 1;
                                    if (!tBStr) return -1;

                                    return new Date(tBStr).getTime() - new Date(tAStr).getTime();
                                });
                            });

                            markAsRead(selectedConversation.id);
                        }
                    } catch (err) {
                        console.error('Error handling realtime message:', err);
                    }
                },
                onReaction: async (payload) => {
                    // console.log('Received reaction payload:', payload);
                    const msgId = payload?.message_id;
                    const userId = payload?.user_id;

                    // Ignore if this is OUR reaction and we are currently performing the local action
                    if (userId === currentUserId && isReacting.current) {
                        console.log('Ignoring self-reaction echo (lock active)');
                        return;
                    }

                    if (msgId) {
                        try {
                            // Fetch immediately without delay for faster updates
                            // The DB event means it's committed, so we should be able to read it.
                            const summary = await getReactionSummary(msgId);

                            setMessageReactions(prev => ({
                                ...prev,
                                [msgId]: summary
                            }));
                        } catch (err) {
                            console.error('Error handling realtime reaction:', err);
                        }
                    } else {
                        // Fallback for deletions if REPLICA IDENTITY FULL isn't on
                        if (selectedConversation?.id) {
                            // We could try to reload, but let's be less aggressive if we can't identify the message
                            // loadMessages(selectedConversation);
                            console.warn('Received reaction event without message_id');
                        }
                    }
                },
                onPollUpdate: async (payload) => {
                    const msgId = payload.message_id;
                    if (msgId) {
                        fetchPollVotes(msgId);
                    }
                }
            });
        }

        return () => {
            if (subscription) {
                unsubscribeFromConversation(subscription);
            }
        };
    }, [selectedConversation, currentUserId]);

    // Auto-scroll to bottom
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, selectedConversation]);

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
                                .select('full_name, email, avatar_url')
                                .eq('id', otherUserId)
                                .single();

                            return {
                                ...conv,
                                name: profile?.full_name || profile?.email || 'User',
                                avatar_url: profile?.avatar_url,
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

            // Fetch votes for all poll messages
            msgs.filter(m => m.is_poll).forEach(m => fetchPollVotes(m.id));

            // Process initial reactions
            const reactionsMap = {};
            msgs.forEach(msg => {
                if (msg.message_reactions && msg.message_reactions.length > 0) {
                    const summary = {};
                    msg.message_reactions.forEach(r => {
                        if (!summary[r.reaction]) {
                            summary[r.reaction] = { count: 0, users: [] };
                        }
                        summary[r.reaction].count++;

                        // Look up user name from local state instead of potentially failing backend join
                        const user = orgUsers.find(u => u.id === r.user_id);
                        const name = user?.full_name || user?.email || 'Unknown User';

                        summary[r.reaction].users.push({ user_id: r.user_id, name });
                    });
                    reactionsMap[msg.id] = summary;
                }
            });
            setMessageReactions(reactionsMap);

            // Check if current user is admin for team conversations
            if (conversation.type === 'team' && currentUserId) {
                const adminStatus = await isConversationAdmin(conversation.id, currentUserId);
                setIsCurrentUserAdmin(adminStatus);
            } else {
                setIsCurrentUserAdmin(false);
            }
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

    const fetchPollVotes = async (messageId) => {
        try {
            const votes = await getPollVotes(messageId);
            setAllPollVotes(prev => ({
                ...prev,
                [messageId]: votes
            }));
        } catch (error) {
            console.error('Error fetching poll votes:', error);
        }
    };

    const handleSendPoll = async () => {
        if (!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2) {
            alert('Please enter a question and at least two options');
            return;
        }

        try {
            setLoading(true);
            const validOptions = pollOptions.filter(o => o.trim());
            const newMessage = await sendPoll(
                selectedConversation.id,
                currentUserId,
                pollQuestion.trim(),
                validOptions,
                allowMultiplePoll
            );

            setShowPollModal(false);
            setPollQuestion('');
            setPollOptions(['', '']);
            setAllowMultiplePoll(false);

            // Optimistic update
            setMessages(prev => [...prev, newMessage]);

            // Trigger Sidebar update
            loadConversations();
        } catch (error) {
            console.error('Error sending poll:', error);
            alert('Failed to send poll: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleVote = async (messageId, optionIndex, allowMultiple) => {
        try {
            await voteInPoll(messageId, currentUserId, optionIndex, allowMultiple);
            // Realtime subscription will fetch updated votes, but let's do it manually too for speed
            fetchPollVotes(messageId);
        } catch (error) {
            console.error('Error voting:', error);
        }
    };

    const handleSendMessage = async () => {
        if (!messageInput.trim() && attachments.length === 0) return;
        if (!selectedConversation || !currentUserId) return;

        try {
            let targetConversationId = selectedConversation.id;

            // Handle temporary conversation (new DM)
            if (selectedConversation.temp) {
                try {
                    console.log('Creating new conversation for temporary DM...');
                    const newConv = await createDMConversation(
                        currentUserId,
                        selectedConversation.otherUser.id,
                        currentUserOrgId
                    );
                    targetConversationId = newConv.id;

                    // Update selected conversation to be real and not temp
                    // We need to fetch the other user details again or preserve them because createDMConversation just returns the row
                    // We used selectedConversation.otherUser for the name/avatar so let's keep it
                    setSelectedConversation({
                        ...newConv,
                        name: selectedConversation.name,
                        avatar_url: selectedConversation.avatar_url,
                        otherUser: selectedConversation.otherUser,
                        type: 'dm',
                        temp: false
                    });

                } catch (err) {
                    console.error('Error creating conversation:', err);
                    setErrorMessage('Failed to create conversation. Please try again.');
                    return;
                }
            }

            // Send with optional reply (Snapshot storage approach)
            const newMessage = await sendMessageWithReply(
                targetConversationId,
                messageInput.trim(),
                currentUserId,
                replyingTo?.id || null,
                replyingTo?.content || null,
                replyingTo?.sender_name || null
            );

            // Handle attachments (Upload and save metadata)
            if (attachments.length > 0) {
                try {
                    const uploadPromises = attachments.map(file =>
                        uploadAttachment(file, targetConversationId, newMessage.id)
                    );
                    await Promise.all(uploadPromises);
                    console.log('Successfully uploaded all attachments');
                } catch (attachmentError) {
                    console.error('Error uploading attachments:', attachmentError);
                    // We don't block the message if attachments fail, but log it
                }
            }

            // Send notification to other members
            try {
                if (currentMembers.length > 0) {
                    const currentProfile = orgUsers.find(u => u.id === currentUserId);
                    const senderName = currentProfile?.full_name || 'Someone';

                    const recipients = currentMembers
                        .filter(m => (m.id || m.user_id) !== currentUserId)
                        .map(m => m.id || m.user_id);

                    if (recipients.length > 0) {
                        sendNotification(
                            recipients,
                            `New message in ${selectedConversation.name || 'chat'}`,
                            `${senderName}: ${messageInput.substring(0, 50)}${messageInput.length > 50 ? '...' : ''}`,
                            '/messages',
                            { conversationId: targetConversationId }
                        );
                    }
                }
            } catch (notifError) {
                console.error('Error sending notifications:', notifError);
            }

            setMessageInput('');
            setAttachments([]);
            setReplyingTo(null);

            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }

            // Optimistically update UI
            setMessages(prev => [...prev, newMessage]);

            // Invalidate cache only (don't reload messages to avoid flicker)
            setConversationCache(prev => {
                const newCache = { ...prev };
                delete newCache[activeCategory];
                return newCache;
            });
            // We used to call loadConversations() here, but since we might have just created a new conversation
            // loadConversations will actually help put it in the list.
            await loadConversations();

        } catch (error) {
            console.error('Error sending message:', error);
            setErrorMessage(`Failed to send message: ${error.message || 'Unknown error'}`);
        }
    };

    const handleReaction = async (messageId, reaction) => {
        if (!currentUserId) return;

        // Close picker immediately
        setShowReactionPicker(null);

        // Set lock to ignore incoming realtime events for this action
        isReacting.current = true;

        // 1. Optimistic Update
        setMessageReactions(prev => {
            const currentSummary = prev[messageId] || {};

            // Find if user already reacted with ANY emoji
            let oldReactionEmoji = null;
            Object.entries(currentSummary).forEach(([emoji, data]) => {
                if (data.users.some(u => u.user_id === currentUserId)) {
                    oldReactionEmoji = emoji;
                }
            });

            // Create deep copy of summary for mutation
            const newSummary = JSON.parse(JSON.stringify(currentSummary));

            // If user had a reaction, remove it first
            if (oldReactionEmoji) {
                if (newSummary[oldReactionEmoji]) {
                    newSummary[oldReactionEmoji].users = newSummary[oldReactionEmoji].users.filter(u => u.user_id !== currentUserId);
                    newSummary[oldReactionEmoji].count = Math.max(0, newSummary[oldReactionEmoji].count - 1);
                    if (newSummary[oldReactionEmoji].count === 0) {
                        delete newSummary[oldReactionEmoji];
                    }
                }
            }

            // If the new reaction is DIFFERENT from the old one, OR if there was no old one, ADD it.
            if (oldReactionEmoji !== reaction) {
                if (!newSummary[reaction]) {
                    newSummary[reaction] = { count: 0, users: [] };
                }
                newSummary[reaction].users.push({
                    user_id: currentUserId,
                    name: 'You'
                });
                newSummary[reaction].count += 1;
            }

            return {
                ...prev,
                [messageId]: newSummary
            };
        });

        try {
            // 2. Perform actual server action
            await toggleReaction(messageId, currentUserId, reaction);

            // We rely on the optimistic update and the anti-flicker lock in onReaction.
            // No need to re-fetch authoritative state immediately as it can cause flicker.

        } catch (error) {
            console.error('Error toggling reaction:', error);
            // Revert on error would go here, maybe reload messages/summary
            const summary = await getReactionSummary(messageId);
            setMessageReactions(prev => ({
                ...prev,
                [messageId]: summary
            }));
        } finally {
            // Release lock after a short delay to ensure all realtime echoes are cleared
            setTimeout(() => {
                isReacting.current = false;
            }, 1000);
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

    // ============================================
    // ADMIN ACTION HANDLERS
    // ============================================

    const handleAddMember = async (userId) => {
        try {
            await addMemberToConversation(selectedConversation.id, userId, currentUserId);
            setShowAddMemberModal(false);
            setErrorMessage(null);
            // Refresh members list
            await fetchConversationMembers();
            alert('Member added successfully!');
        } catch (error) {
            setErrorMessage(error.message || 'Failed to add member');
        }
    };

    const handleRemoveMember = async (userId, userName) => {
        if (!confirm(`Remove ${userName} from this group?`)) return;

        try {
            await removeMemberFromConversation(selectedConversation.id, userId, currentUserId);
            setErrorMessage(null);
            // Refresh members list
            await fetchConversationMembers();
            alert('Member removed successfully!');
        } catch (error) {
            setErrorMessage(error.message || 'Failed to remove member');
        }
    };

    const handlePromoteToAdmin = async (userId, userName) => {
        if (!confirm(`Make ${userName} an admin of this group?`)) return;

        try {
            await promoteMemberToAdmin(selectedConversation.id, userId, currentUserId);
            setErrorMessage(null);
            // Refresh members list
            await fetchConversationMembers();
            alert(`${userName} is now an admin!`);
        } catch (error) {
            setErrorMessage(error.message || 'Failed to promote member');
        }
    };

    const handleDemoteFromAdmin = async (userId, userName) => {
        if (!confirm(`Remove admin privileges from ${userName}?`)) return;

        try {
            await demoteMemberFromAdmin(selectedConversation.id, userId, currentUserId);
            setErrorMessage(null);
            // Refresh members list
            await fetchConversationMembers();
            alert(`${userName} is no longer an admin`);
        } catch (error) {
            setErrorMessage(error.message || 'Failed to demote admin');
        }
    };

    const handleRenameGroup = async () => {
        if (!newGroupName.trim()) {
            setErrorMessage('Group name cannot be empty');
            return;
        }

        try {
            await renameConversation(selectedConversation.id, newGroupName, currentUserId);
            setShowRenameModal(false);
            setNewGroupName('');
            setErrorMessage(null);

            // Update local state
            setSelectedConversation(prev => ({ ...prev, name: newGroupName }));

            // Refresh conversations list
            setConversationCache(prev => {
                const newCache = { ...prev };
                delete newCache[activeCategory];
                return newCache;
            });
            loadConversations();

            alert('Group renamed successfully!');
        } catch (error) {
            setErrorMessage(error.message || 'Failed to rename group');
        }
    };

    const handleDeleteGroup = async () => {
        if (!confirm('Are you sure you want to delete this group? This action cannot be undone and all messages will be lost.')) return;

        try {
            await deleteConversation(selectedConversation.id, currentUserId);
            setSelectedConversation(null);
            setMessages([]);
            setErrorMessage(null);

            // Refresh conversations list
            setConversationCache(prev => {
                const newCache = { ...prev };
                delete newCache[activeCategory];
                return newCache;
            });
            loadConversations();

            alert('Group deleted successfully');
        } catch (error) {
            setErrorMessage(error.message || 'Failed to delete group');
        }
    };

    const handleLeaveGroup = async () => {
        if (!confirm('Are you sure you want to leave this group?')) return;

        try {
            await leaveConversation(selectedConversation.id, currentUserId);
            setSelectedConversation(null);
            setMessages([]);
            setErrorMessage(null);

            // Refresh conversations list
            setConversationCache(prev => {
                const newCache = { ...prev };
                delete newCache[activeCategory];
                return newCache;
            });
            loadConversations();

            alert('You have left the group');
        } catch (error) {
            setErrorMessage(error.message || 'Failed to leave group');
        }
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
                                        {conv.type === 'dm' ? (
                                            conv.avatar_url ? (
                                                <img
                                                    src={conv.avatar_url}
                                                    alt={conv.name}
                                                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                                                />
                                            ) : (
                                                <div className="avatar-placeholder">
                                                    {(conv.name?.[0] || '?').toUpperCase()}
                                                </div>
                                            )
                                        ) : conv.type === 'team' ? (
                                            <Users size={20} />
                                        ) : (
                                            <Building2 size={20} />
                                        )}
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
                                    {isCurrentUserAdmin && selectedConversation.type === 'team' && (
                                        <span style={{ marginLeft: '8px', color: '#3b82f6', fontSize: '11px' }}>
                                            • Admin
                                        </span>
                                    )}
                                </span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <button
                                    onClick={() => {
                                        setShowSearch(!showSearch);
                                        if (showSearch) setMessageSearchQuery('');
                                    }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '6px 12px',
                                        borderRadius: '6px',
                                        border: '1px solid #e5e7eb',
                                        background: showSearch ? '#f3f4f6' : 'white',
                                        cursor: 'pointer',
                                        fontSize: '12px',
                                        color: '#374151',
                                        fontWeight: 500,
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <Search size={14} />
                                    {showSearch ? 'Close Search' : 'Search'}
                                </button>
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
                                        Members
                                    </button>
                                )}
                                {isCurrentUserAdmin && selectedConversation.type === 'team' && (
                                    <button
                                        onClick={() => setShowGroupSettings(!showGroupSettings)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '6px 12px',
                                            borderRadius: '6px',
                                            border: '1px solid #3b82f6',
                                            background: showGroupSettings ? '#eff6ff' : 'white',
                                            cursor: 'pointer',
                                            fontSize: '12px',
                                            color: '#3b82f6',
                                            fontWeight: 600
                                        }}
                                    >
                                        <Settings size={14} />
                                        Settings
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Message Search Bar */}
                        {showSearch && (
                            <div style={{
                                padding: '12px 20px',
                                background: '#f9fafb',
                                borderBottom: '1px solid #e5e7eb',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px'
                            }}>
                                <div style={{
                                    flex: 1,
                                    position: 'relative',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}>
                                    <Search size={16} style={{ position: 'absolute', left: '12px', color: '#9ca3af' }} />
                                    <input
                                        type="text"
                                        placeholder="Search in this conversation..."
                                        value={messageSearchQuery}
                                        onChange={(e) => setMessageSearchQuery(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '8px 12px 8px 36px',
                                            borderRadius: '8px',
                                            border: '1px solid #d1d5db',
                                            fontSize: '14px',
                                            outline: 'none',
                                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                        }}
                                        autoFocus
                                    />
                                    {messageSearchQuery && (
                                        <button
                                            onClick={() => setMessageSearchQuery('')}
                                            style={{
                                                position: 'absolute',
                                                right: '8px',
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                color: '#9ca3af'
                                            }}
                                        >
                                            <X size={16} />
                                        </button>
                                    )}
                                </div>
                                <div style={{ fontSize: '13px', color: '#6b7280' }}>
                                    {messages.filter(m =>
                                        m.content?.toLowerCase().includes(messageSearchQuery.toLowerCase()) ||
                                        m.poll_question?.toLowerCase().includes(messageSearchQuery.toLowerCase())
                                    ).length} results
                                </div>
                            </div>
                        )}

                        {/* Group Settings Panel (Admin Only) */}
                        {showGroupSettings && isCurrentUserAdmin && selectedConversation.type === 'team' && (
                            <div style={{
                                padding: '16px 20px',
                                background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                                borderBottom: '1px solid #3b82f6',
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '8px'
                            }}>
                                <button
                                    onClick={() => setShowAddMemberModal(true)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '8px 14px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: 'white',
                                        cursor: 'pointer',
                                        fontSize: '13px',
                                        color: '#059669',
                                        fontWeight: 600,
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                    }}
                                >
                                    <UserPlus size={16} />
                                    Add Member
                                </button>
                                <button
                                    onClick={() => {
                                        setNewGroupName(selectedConversation.name);
                                        setShowRenameModal(true);
                                    }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '8px 14px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: 'white',
                                        cursor: 'pointer',
                                        fontSize: '13px',
                                        color: '#3b82f6',
                                        fontWeight: 600,
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                    }}
                                >
                                    <Edit2 size={16} />
                                    Rename Group
                                </button>
                                <button
                                    onClick={handleDeleteGroup}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '8px 14px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: 'white',
                                        cursor: 'pointer',
                                        fontSize: '13px',
                                        color: '#dc2626',
                                        fontWeight: 600,
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                    }}
                                >
                                    <Trash2 size={16} />
                                    Delete Group
                                </button>
                            </div>
                        )}

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
                                (() => {
                                    const filtered = messages.filter(msg => {
                                        if (!messageSearchQuery) return true;
                                        const query = messageSearchQuery.toLowerCase();
                                        const content = (msg.content || '').toLowerCase();
                                        const pollQuestion = (msg.poll_question || '').toLowerCase();
                                        const pollOptions = (msg.poll_options || []).join(' ').toLowerCase();
                                        return content.includes(query) || pollQuestion.includes(query) || pollOptions.includes(query);
                                    });

                                    if (filtered.length === 0 && messageSearchQuery) {
                                        return (
                                            <div style={{ textAlign: 'center', padding: '3rem 2rem', color: '#6b7280' }}>
                                                <Search size={48} style={{ marginBottom: '1rem', opacity: 0.2 }} />
                                                <p style={{ fontSize: '15px' }}>No messages found matching "<strong>{messageSearchQuery}</strong>"</p>
                                                <button
                                                    onClick={() => setMessageSearchQuery('')}
                                                    style={{
                                                        marginTop: '1rem',
                                                        background: 'none',
                                                        border: '1px solid #d1d5db',
                                                        padding: '6px 16px',
                                                        borderRadius: '20px',
                                                        cursor: 'pointer',
                                                        fontSize: '13px'
                                                    }}
                                                >
                                                    Clear Search
                                                </button>
                                            </div>
                                        );
                                    }

                                    return filtered.map((msg, index, filteredArray) => {
                                        const prevMsg = filteredArray[index - 1];
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
                                                    style={{ position: 'relative', marginBottom: '8px' }}
                                                    onMouseEnter={() => setHoveredMessageId(msg.id)}
                                                    onMouseLeave={() => setHoveredMessageId(null)}
                                                >
                                                    <div className="message-bubble" style={{ position: 'relative' }}>
                                                        {/* Sender Name for Group Chats */}
                                                        {(selectedConversation.type === 'team' || selectedConversation.type === 'everyone') && msg.sender_user_id !== currentUserId && (
                                                            <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px', marginLeft: '2px', fontWeight: 600 }}>
                                                                {getSenderName(msg.sender_user_id)}
                                                            </div>
                                                        )}

                                                        {/* Replied Message Context (Snapshot Approach) */}
                                                        {msg.replied_message_content && (
                                                            <div style={{
                                                                padding: '6px 10px',
                                                                background: 'rgba(0,0,0,0.04)',
                                                                borderLeft: '3px solid #cbd5e1',
                                                                marginBottom: '6px',
                                                                borderRadius: '4px',
                                                                fontSize: '12px'
                                                            }}>
                                                                <div style={{ color: '#64748b', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
                                                                    <Reply size={10} />
                                                                    {msg.replied_message_sender_name || 'User'}
                                                                </div>
                                                                <div style={{ color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                                                                    {msg.replied_message_content}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Message Actions Hover (Unified Action Bar) */}
                                                        {hoveredMessageId === msg.id && !msg.is_deleted && (
                                                            <div style={{
                                                                position: 'absolute',
                                                                top: '-32px',
                                                                right: msg.sender_user_id === currentUserId ? '4px' : 'auto',
                                                                left: msg.sender_user_id !== currentUserId ? '4px' : 'auto',
                                                                background: 'white',
                                                                borderRadius: '24px',
                                                                padding: '4px 8px',
                                                                boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '2px',
                                                                zIndex: 100,
                                                                border: '1px solid #e5e7eb'
                                                            }}>
                                                                <button
                                                                    onClick={() => setReplyingTo({
                                                                        id: msg.id,
                                                                        content: msg.content,
                                                                        sender_name: msg.sender_user_id === currentUserId ? 'You' : (getSenderName(msg.sender_user_id) || 'User')
                                                                    })}
                                                                    title="Reply"
                                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: '#64748b', display: 'flex', borderRadius: '50%', transition: 'all 0.2s' }}
                                                                    onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#3b82f6'; }}
                                                                    onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#64748b'; }}
                                                                >
                                                                    <Reply size={16} />
                                                                </button>
                                                                <button
                                                                    onClick={() => setShowReactionPicker(showReactionPicker === msg.id ? null : msg.id)}
                                                                    title="React"
                                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: '#64748b', display: 'flex', borderRadius: '50%', transition: 'all 0.2s' }}
                                                                    onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#eab308'; }}
                                                                    onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#64748b'; }}
                                                                >
                                                                    <Smile size={16} />
                                                                </button>
                                                                {messageReactions[msg.id] && Object.keys(messageReactions[msg.id]).length > 0 && (
                                                                    <button
                                                                        onClick={() => setViewingReactionsFor(msg.id)}
                                                                        title="View Reactions"
                                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: '#64748b', display: 'flex', borderRadius: '50%', transition: 'all 0.2s' }}
                                                                        onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#3b82f6'; }}
                                                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#64748b'; }}
                                                                    >
                                                                        <Info size={16} />
                                                                    </button>
                                                                )}

                                                                {/* Delete Actions (Sender only, within 5 mins) */}
                                                                {msg.sender_user_id === currentUserId && (new Date() - new Date(msg.created_at)) < 5 * 60 * 1000 && (
                                                                    <>
                                                                        <div style={{ width: '1px', height: '18px', background: '#e2e8f0', margin: '0 6px' }} />
                                                                        <button
                                                                            onClick={() => deleteMessageForMe(msg.id)}
                                                                            title="Delete for me"
                                                                            style={{ background: 'none', border: 'none', padding: '4px 8px', cursor: 'pointer', color: '#64748b', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '12px', transition: 'all 0.2s' }}
                                                                            onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#1e293b'; }}
                                                                            onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#64748b'; }}
                                                                        >
                                                                            <Trash2 size={13} /> Me
                                                                        </button>
                                                                        <button
                                                                            onClick={() => deleteMessageForEveryone(msg.id)}
                                                                            title="Delete for everyone"
                                                                            style={{ background: 'none', border: 'none', padding: '4px 8px', cursor: 'pointer', color: '#ef4444', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '12px', transition: 'all 0.2s' }}
                                                                            onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#b91c1c'; }}
                                                                            onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#ef4444'; }}
                                                                        >
                                                                            <Trash2 size={13} /> All
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Reaction Picker Popup */}
                                                        {showReactionPicker === msg.id && (
                                                            <div style={{
                                                                position: 'absolute',
                                                                bottom: '100%',
                                                                right: msg.sender_user_id === currentUserId ? '0' : 'auto',
                                                                left: msg.sender_user_id !== currentUserId ? '0' : 'auto',
                                                                background: 'white',
                                                                border: '1px solid #e5e7eb',
                                                                borderRadius: '12px',
                                                                padding: '8px',
                                                                display: 'flex',
                                                                gap: '4px',
                                                                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                                                                zIndex: 100,
                                                                marginBottom: '8px'
                                                            }}>
                                                                {['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '👏'].map(emoji => (
                                                                    <button
                                                                        key={emoji}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleReaction(msg.id, emoji);
                                                                        }}
                                                                        style={{
                                                                            padding: '8px',
                                                                            background: 'none',
                                                                            border: 'none',
                                                                            fontSize: '20px',
                                                                            cursor: 'pointer',
                                                                            borderRadius: '8px',
                                                                            transition: 'transform 0.1s'
                                                                        }}
                                                                        onMouseEnter={(e) => e.target.style.transform = 'scale(1.2)'}
                                                                        onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                                                                    >
                                                                        {emoji}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}

                                                        <div className="message-content" style={{ fontStyle: msg.is_deleted ? 'italic' : 'normal', color: msg.is_deleted ? '#94a3b8' : 'inherit' }}>
                                                            {msg.is_deleted && <Trash2 size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />}
                                                            {msg.is_deleted ? msg.content : (
                                                                msg.is_poll ? (
                                                                    <PollContent
                                                                        msg={msg}
                                                                        votes={allPollVotes[msg.id] || []}
                                                                        onVote={(idx) => handleVote(msg.id, idx, msg.allow_multiple_answers)}
                                                                        currentUserId={currentUserId}
                                                                        onViewVotes={() => setShowVoteDetails(msg.id)}
                                                                    />
                                                                ) : renderMessageContent(msg.content)
                                                            )}
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

                                                        {/* Reactions Display */}
                                                        {!msg.is_deleted && messageReactions[msg.id] && Object.keys(messageReactions[msg.id]).length > 0 && (
                                                            <div style={{
                                                                display: 'flex',
                                                                gap: '6px',
                                                                marginTop: '6px',
                                                                flexWrap: 'wrap',
                                                                justifyContent: msg.sender_user_id === currentUserId ? 'flex-end' : 'flex-start',
                                                                padding: '0 4px'
                                                            }}>
                                                                {Object.entries(messageReactions[msg.id]).map(([emoji, data]) => {
                                                                    const isSelf = data.users.some(u => u.user_id === currentUserId);
                                                                    return (
                                                                        <div
                                                                            key={emoji}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleReaction(msg.id, emoji);
                                                                            }}
                                                                            title={data.users.map(u => u.name).join(', ')}
                                                                            style={{
                                                                                display: 'inline-flex',
                                                                                alignItems: 'center',
                                                                                padding: data.count > 1 ? '3px 10px' : '3px 8px',
                                                                                background: isSelf ? 'rgba(59, 130, 246, 0.12)' : 'rgba(255, 255, 255, 0.8)',
                                                                                backdropFilter: 'blur(4px)',
                                                                                border: isSelf ? '1.5px solid #3b82f6' : '1px solid #e2e8f0',
                                                                                borderRadius: '20px',
                                                                                fontSize: '14px',
                                                                                cursor: 'pointer',
                                                                                boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
                                                                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                                                                transform: 'translateY(0)',
                                                                            }}
                                                                            onMouseEnter={(e) => {
                                                                                e.currentTarget.style.transform = 'translateY(-1px)';
                                                                                e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.06)';
                                                                            }}
                                                                            onMouseLeave={(e) => {
                                                                                e.currentTarget.style.transform = 'translateY(0)';
                                                                                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.04)';
                                                                            }}
                                                                        >
                                                                            <span style={{ transform: 'scale(1.1)', display: 'inline-block' }}>{emoji}</span>
                                                                            {data.count > 1 && (
                                                                                <span style={{
                                                                                    fontSize: '11px',
                                                                                    color: isSelf ? '#1d4ed8' : '#64748b',
                                                                                    fontWeight: 700,
                                                                                    marginLeft: '4px'
                                                                                }}>
                                                                                    {data.count}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
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
                                })()
                            )}
                            <div ref={messagesEndRef} />
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

                            {replyingTo && (
                                <div style={{
                                    padding: '0.75rem 1rem',
                                    background: '#f3f4f6',
                                    borderLeft: '3px solid #3b82f6',
                                    margin: '0.5rem 0',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <div>
                                        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                                            Replying to {replyingTo.sender_name}
                                        </div>
                                        <div style={{ fontSize: '14px', color: '#1f2937' }}>
                                            {replyingTo.content.substring(0, 50)}{replyingTo.content.length > 50 ? '...' : ''}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setReplyingTo(null)}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: '#6b7280',
                                            padding: '4px'
                                        }}
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
                                <button
                                    className="attachment-button"
                                    onClick={() => setShowPollModal(true)}
                                    title="Create Poll"
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                    <BarChart2 size={20} />
                                </button>
                                <textarea
                                    ref={textareaRef}
                                    placeholder="Type a message..."
                                    value={messageInput}
                                    onChange={handleTextareaChange}
                                    onKeyDown={handleKeyPress}
                                    onPaste={handlePaste}
                                    rows={1}
                                    style={{
                                        resize: 'none',
                                        minHeight: '40px',
                                        maxHeight: '120px',
                                        overflowY: 'auto'
                                    }}
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
                            <div style={{ marginBottom: '1rem', position: 'relative' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>Team Name</label>
                                <input
                                    type="text"
                                    placeholder="Enter team name..."
                                    value={teamName}
                                    onChange={(e) => { setTeamName(e.target.value); setErrorMessage(null); }}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        border: selectedTeamMembers.length > 0 && !teamName.trim()
                                            ? '2px solid #fbbf24'
                                            : '1px solid #d1d5db',
                                        borderRadius: '8px',
                                        fontSize: '14px',
                                        outline: 'none',
                                        transition: 'all 0.3s ease',
                                        boxShadow: selectedTeamMembers.length > 0 && !teamName.trim()
                                            ? '0 0 0 3px rgba(251, 191, 36, 0.1)'
                                            : 'none'
                                    }}
                                    autoFocus
                                />
                                {/* Animated indicator when members selected but no name */}
                                {selectedTeamMembers.length > 0 && !teamName.trim() && (
                                    <div style={{
                                        marginTop: '8px',
                                        padding: '10px 14px',
                                        background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                                        border: '1px solid #fbbf24',
                                        borderRadius: '8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        animation: 'pulseGlow 2s ease-in-out infinite',
                                        boxShadow: '0 4px 12px rgba(251, 191, 36, 0.2)'
                                    }}>
                                        <div style={{
                                            fontSize: '18px',
                                            animation: 'bounce 1s ease-in-out infinite'
                                        }}>
                                            ✏️
                                        </div>
                                        <div style={{
                                            flex: 1,
                                            fontSize: '13px',
                                            fontWeight: 600,
                                            color: '#92400e'
                                        }}>
                                            Don't forget to give your team a name!
                                        </div>
                                    </div>
                                )}
                                <style>{`
                                    @keyframes pulseGlow {
                                        0%, 100% {
                                            transform: scale(1);
                                            opacity: 1;
                                        }
                                        50% {
                                            transform: scale(1.02);
                                            opacity: 0.95;
                                        }
                                    }
                                    @keyframes bounce {
                                        0%, 100% {
                                            transform: translateY(0);
                                        }
                                        50% {
                                            transform: translateY(-3px);
                                        }
                                    }
                                `}</style>
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
                                <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Group Members ({currentMembers.length})</h2>
                                <button onClick={() => setShowMembersModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="user-list" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                {currentMembers.map(user => (
                                    <div
                                        key={user.id || user.user_id}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            padding: '12px',
                                            borderBottom: '1px solid #f3f4f6',
                                            background: user.is_admin ? '#eff6ff' : 'transparent'
                                        }}
                                    >
                                        <div className="user-avatar" style={{
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: '50%',
                                            background: user.is_admin ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : '#e5e7eb',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '16px',
                                            fontWeight: 'bold',
                                            color: user.is_admin ? 'white' : '#6366f1'
                                        }}>
                                            {user.avatar_url ? (
                                                <img src={user.avatar_url} alt={user.full_name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                            ) : (
                                                (user.full_name?.[0] || user.email?.[0] || '?').toUpperCase()
                                            )}
                                        </div>
                                        <div className="user-info" style={{ flex: 1 }}>
                                            <div className="user-name" style={{ fontWeight: '500', color: '#1f2937', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span>{user.full_name || user.email}</span>
                                                {(user.id === currentUserId || user.user_id === currentUserId) && <span style={{ fontSize: '11px', color: '#6b7280' }}>(You)</span>}
                                                {user.is_admin && (
                                                    <span style={{
                                                        fontSize: '10px',
                                                        padding: '2px 6px',
                                                        background: '#3b82f6',
                                                        color: 'white',
                                                        borderRadius: '4px',
                                                        fontWeight: '600',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}>
                                                        <Shield size={10} /> ADMIN
                                                    </span>
                                                )}
                                            </div>
                                            <div className="user-role" style={{ fontSize: '12px', color: '#6b7280', textTransform: 'capitalize' }}>
                                                {user.role}
                                            </div>
                                        </div>

                                        {/* Admin Controls */}
                                        {isCurrentUserAdmin && selectedConversation?.type === 'team' && (user.id !== currentUserId && user.user_id !== currentUserId) && (
                                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                {user.is_admin ? (
                                                    <button
                                                        onClick={() => handleDemoteFromAdmin(user.id || user.user_id, user.full_name || user.email)}
                                                        title="Remove admin"
                                                        style={{
                                                            padding: '6px 10px',
                                                            borderRadius: '6px',
                                                            border: '1px solid #f59e0b',
                                                            background: 'white',
                                                            cursor: 'pointer',
                                                            fontSize: '11px',
                                                            color: '#f59e0b',
                                                            fontWeight: '600',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '4px'
                                                        }}
                                                    >
                                                        <UserMinus size={12} /> Demote
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handlePromoteToAdmin(user.id || user.user_id, user.full_name || user.email)}
                                                        title="Make admin"
                                                        style={{
                                                            padding: '6px 10px',
                                                            borderRadius: '6px',
                                                            border: '1px solid #3b82f6',
                                                            background: 'white',
                                                            cursor: 'pointer',
                                                            fontSize: '11px',
                                                            color: '#3b82f6',
                                                            fontWeight: '600',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '4px'
                                                        }}
                                                    >
                                                        <Shield size={12} /> Admin
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleRemoveMember(user.id || user.user_id, user.full_name || user.email)}
                                                    title="Remove from group"
                                                    style={{
                                                        padding: '6px 10px',
                                                        borderRadius: '6px',
                                                        border: '1px solid #dc2626',
                                                        background: 'white',
                                                        cursor: 'pointer',
                                                        fontSize: '11px',
                                                        color: '#dc2626',
                                                        fontWeight: '600',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}
                                                >
                                                    <UserMinus size={12} /> Remove
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Leave Group Button */}
                            {selectedConversation?.type === 'team' && !isCurrentUserAdmin && (
                                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
                                    <button
                                        onClick={handleLeaveGroup}
                                        style={{
                                            width: '100%',
                                            padding: '10px',
                                            borderRadius: '8px',
                                            border: '1px solid #dc2626',
                                            background: 'white',
                                            cursor: 'pointer',
                                            fontSize: '14px',
                                            color: '#dc2626',
                                            fontWeight: '600'
                                        }}
                                    >
                                        Leave Group
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )
            }

            {/* Add Member Modal */}
            {
                showAddMemberModal && (
                    <div className="modal-overlay" onClick={() => setShowAddMemberModal(false)}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ minWidth: '400px', maxWidth: '500px' }}>
                            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#1f2937' }}>Add Member to Group</h3>
                                <button
                                    onClick={() => setShowAddMemberModal(false)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                                >
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="modal-body">
                                {errorMessage && (
                                    <div style={{
                                        padding: '0.75rem 1rem',
                                        marginBottom: '1rem',
                                        background: '#fee2e2',
                                        border: '1px solid #fca5a5',
                                        borderRadius: '8px',
                                        color: '#b91c1c',
                                        fontSize: '14px'
                                    }}>
                                        {errorMessage}
                                    </div>
                                )}
                                <p style={{ marginBottom: '1rem', color: '#6b7280', fontSize: '14px' }}>
                                    Select a user to add to this group
                                </p>
                                <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                                    {orgUsers
                                        .filter(u => !currentMembers.some(m => (m.id || m.user_id) === u.id))
                                        .length === 0 ? (
                                        <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                                            All organization members are already in this group
                                        </div>
                                    ) : (
                                        orgUsers
                                            .filter(u => !currentMembers.some(m => (m.id || m.user_id) === u.id))
                                            .map(user => (
                                                <div
                                                    key={user.id}
                                                    onClick={() => handleAddMember(user.id)}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '12px',
                                                        padding: '12px',
                                                        cursor: 'pointer',
                                                        borderBottom: '1px solid #f3f4f6',
                                                        transition: 'background 0.2s',
                                                        background: 'white'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                                                    onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                                                >
                                                    <div style={{
                                                        width: '40px',
                                                        height: '40px',
                                                        borderRadius: '50%',
                                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: 'white',
                                                        fontWeight: '600',
                                                        fontSize: '16px'
                                                    }}>
                                                        {(user.full_name?.[0] || user.email?.[0] || '?').toUpperCase()}
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontWeight: '500', color: '#1f2937' }}>
                                                            {user.full_name || user.email}
                                                        </div>
                                                        <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'capitalize' }}>
                                                            {user.role}
                                                        </div>
                                                    </div>
                                                    <UserPlus size={18} style={{ color: '#3b82f6' }} />
                                                </div>
                                            ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Rename Group Modal */}
            {
                showRenameModal && (
                    <div className="modal-overlay" onClick={() => setShowRenameModal(false)}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ minWidth: '400px', maxWidth: '500px' }}>
                            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#1f2937' }}>Rename Group</h3>
                                <button
                                    onClick={() => {
                                        setShowRenameModal(false);
                                        setErrorMessage(null);
                                    }}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                                >
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="modal-body">
                                {errorMessage && (
                                    <div style={{
                                        padding: '0.75rem 1rem',
                                        marginBottom: '1rem',
                                        background: '#fee2e2',
                                        border: '1px solid #fca5a5',
                                        borderRadius: '8px',
                                        color: '#b91c1c',
                                        fontSize: '14px'
                                    }}>
                                        {errorMessage}
                                    </div>
                                )}
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label style={{
                                        display: 'block',
                                        marginBottom: '0.5rem',
                                        fontWeight: '500',
                                        color: '#374151',
                                        fontSize: '14px'
                                    }}>
                                        Group Name
                                    </label>
                                    <input
                                        type="text"
                                        value={newGroupName}
                                        onChange={(e) => setNewGroupName(e.target.value)}
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter' && newGroupName.trim()) {
                                                handleRenameGroup();
                                            }
                                        }}
                                        placeholder="Enter new group name"
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '8px',
                                            fontSize: '14px',
                                            outline: 'none',
                                            transition: 'border-color 0.2s'
                                        }}
                                        onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                                        onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                                        autoFocus
                                    />
                                    <p style={{
                                        marginTop: '0.5rem',
                                        fontSize: '12px',
                                        color: '#6b7280'
                                    }}>
                                        Press Enter to save
                                    </p>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        onClick={() => {
                                            setShowRenameModal(false);
                                            setErrorMessage(null);
                                        }}
                                        style={{
                                            flex: 1,
                                            padding: '0.75rem',
                                            background: 'white',
                                            color: '#6b7280',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            fontWeight: '600',
                                            fontSize: '14px'
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleRenameGroup}
                                        disabled={!newGroupName.trim()}
                                        style={{
                                            flex: 1,
                                            padding: '0.75rem',
                                            background: !newGroupName.trim() ? '#d1d5db' : '#3b82f6',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '8px',
                                            cursor: !newGroupName.trim() ? 'not-allowed' : 'pointer',
                                            fontWeight: '600',
                                            fontSize: '14px'
                                        }}
                                    >
                                        Rename Group
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Create Poll Modal */}
            {showPollModal && (
                <div className="modal-overlay" onClick={() => setShowPollModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
                        <div className="modal-header">
                            <h3>Create Poll</h3>
                            <button onClick={() => setShowPollModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#1e293b' }}>Question</label>
                                <textarea
                                    className="poll-option-input"
                                    placeholder="Ask a question..."
                                    value={pollQuestion}
                                    onChange={(e) => setPollQuestion(e.target.value)}
                                    style={{ minHeight: '80px', width: '100%', resize: 'none' }}
                                />
                            </div>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#1e293b' }}>Options</label>
                                <div className="poll-modal-options">
                                    {pollOptions.map((opt, idx) => (
                                        <div key={idx} className="poll-option-input-container">
                                            <input
                                                className="poll-option-input"
                                                placeholder={`Option ${idx + 1}`}
                                                value={opt}
                                                onChange={(e) => {
                                                    const newOpts = [...pollOptions];
                                                    newOpts[idx] = e.target.value;
                                                    setPollOptions(newOpts);
                                                }}
                                            />
                                            {pollOptions.length > 2 && (
                                                <button
                                                    onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== idx))}
                                                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <button
                                    className="add-option-btn"
                                    onClick={() => setPollOptions([...pollOptions, ''])}
                                >
                                    <Plus size={16} /> Add option
                                </button>
                            </div>
                            <div className="poll-toggle-container">
                                <span className="poll-toggle-label">Allow multiple answers</span>
                                <label className="switch">
                                    <input
                                        type="checkbox"
                                        checked={allowMultiplePoll}
                                        onChange={(e) => setAllowMultiplePoll(e.target.checked)}
                                    />
                                    <span className="slider round"></span>
                                </label>
                            </div>
                        </div>
                        <div style={{ padding: '20px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '12px' }}>
                            <button
                                style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', fontWeight: '600', cursor: 'pointer' }}
                                onClick={() => setShowPollModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: '#3b82f6', color: 'white', fontWeight: '700', cursor: 'pointer' }}
                                onClick={handleSendPoll}
                                disabled={!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2}
                            >
                                Create Poll
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reaction Details Modal */}
            {viewingReactionsFor && (
                <ReactionDetailsModal
                    messageId={viewingReactionsFor}
                    reactions={messageReactions[viewingReactionsFor]}
                    onClose={() => setViewingReactionsFor(null)}
                    currentUserId={currentUserId}
                />
            )}

            {/* Vote Details Modal */}
            {showVoteDetails && (
                <div className="modal-overlay" onClick={() => setShowVoteDetails(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <h3>Poll Details</h3>
                            <button onClick={() => setShowVoteDetails(null)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body" style={{ maxHeight: '60vh' }}>
                            {(() => {
                                const msg = messages.find(m => m.id === showVoteDetails);
                                if (!msg) return null;
                                const votes = allPollVotes[showVoteDetails] || [];

                                return msg.poll_options.map((option, idx) => {
                                    const optionVoters = votes.filter(v => v.option_index === idx);
                                    return (
                                        <div key={idx} style={{ marginBottom: '20px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                                <div style={{ fontWeight: '700', fontSize: '15px' }}>{option}</div>
                                                <div style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: '600' }}>
                                                    {optionVoters.length} {optionVoters.length === 1 ? 'vote' : 'votes'}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {optionVoters.length === 0 ? (
                                                    <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>No votes yet</div>
                                                ) : (
                                                    optionVoters.map(voter => (
                                                        <div key={voter.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                            <div className="user-avatar" style={{ width: '28px', height: '28px' }}>
                                                                {voter.profiles?.avatar_url ? (
                                                                    <img src={voter.profiles.avatar_url} alt="" />
                                                                ) : (
                                                                    <div className="avatar-placeholder" style={{ fontSize: '10px' }}>
                                                                        {(voter.profiles?.full_name?.[0] || voter.profiles?.email?.[0] || '?').toUpperCase()}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div style={{ fontSize: '14px', fontWeight: '500' }}>
                                                                {voter.profiles?.full_name || voter.profiles?.email}
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </div>

    );
};

// Reaction Details Modal Component
const ReactionDetailsModal = ({ messageId, reactions, onClose, currentUserId }) => {
    const [activeTab, setActiveTab] = useState('All');

    if (!reactions || Object.keys(reactions).length === 0) return null;

    const allReactions = Object.entries(reactions).flatMap(([emoji, data]) =>
        data.users.map(u => ({ ...u, emoji }))
    );

    const tabs = ['All', ...Object.keys(reactions)];

    const displayedUsers = activeTab === 'All'
        ? allReactions
        : reactions[activeTab]?.users.map(u => ({ ...u, emoji: activeTab })) || [];

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 10000
        }} onClick={onClose}>
            <div style={{
                background: 'white',
                borderRadius: '12px',
                width: '400px',
                maxWidth: '90%',
                maxHeight: '80vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
            }} onClick={e => e.stopPropagation()}>
                <div style={{
                    padding: '16px',
                    borderBottom: '1px solid #e5e7eb',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Message Reactions</h3>
                    <button
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                    >
                        <X size={20} />
                    </button>
                </div>

                <div style={{
                    display: 'flex',
                    gap: '8px',
                    padding: '12px 16px',
                    borderBottom: '1px solid #e5e7eb',
                    overflowX: 'auto'
                }}>
                    {tabs.map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '16px',
                                border: 'none',
                                background: activeTab === tab ? '#eff6ff' : 'transparent',
                                color: activeTab === tab ? '#2563eb' : '#64748b',
                                fontWeight: 500,
                                fontSize: '13px',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {tab === 'All' ? `All ${allReactions.length}` : `${tab} ${reactions[tab].count}`}
                        </button>
                    ))}
                </div>

                <div style={{
                    padding: '16px',
                    overflowY: 'auto',
                    flex: 1
                }}>
                    {displayedUsers.map((user, idx) => (
                        <div key={`${user.user_id}-${idx}`} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '8px 0',
                            borderBottom: idx < displayedUsers.length - 1 ? '1px solid #f1f5f9' : 'none'
                        }}>
                            <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: '#e2e8f0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '12px',
                                fontWeight: 600,
                                color: '#64748b',
                                overflow: 'hidden'
                            }}>
                                {user.avatar_url ? (
                                    <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    (user.name || 'U').charAt(0).toUpperCase()
                                )}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '14px', fontWeight: 500, color: '#1e293b' }}>
                                    {user.user_id === currentUserId ? 'You' : user.name}
                                </div>
                            </div>
                            <div style={{ fontSize: '20px' }}>
                                {user.emoji}
                            </div>
                        </div>
                    ))}
                    {displayedUsers.length === 0 && (
                        <div style={{ textAlign: 'center', color: '#64748b', padding: '20px' }}>
                            No reactions yet.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MessagingHub;
