import { supabase } from '../lib/supabaseClient';

/**
 * Message Service
 * Handles all messaging-related operations with Supabase
 */

/**
 * Get conversations for a user filtered by category
 * @param {string} userId - Current user's ID
 * @param {string} category - 'myself' (DMs), 'team', or 'organization'
 * @returns {Promise<Array>} List of conversations
 */
export const getConversationsByCategory = async (userId, category, orgId) => {
    try {
        // Check if user is authenticated
        if (!userId) {
            console.warn('No user ID provided for getConversationsByCategory');
            return [];
        }

        // Step 1: Get user's conversation memberships first
        const { data: memberships, error: memberError } = await supabase
            .from('conversation_members')
            .select('conversation_id')
            .eq('user_id', userId);

        if (memberError) {
            console.error('Error fetching conversation memberships:', memberError);
            return [];
        }

        if (!memberships || memberships.length === 0) {
            console.log('No conversations found for user');
            return [];
        }

        const conversationIds = memberships.map(m => m.conversation_id);

        // Step 2: Get conversations the user is a member of
        let query = supabase
            .from('conversations')
            .select('*')
            .in('id', conversationIds);

        // Filter by org_id, but also include conversations with NULL org_id (legacy conversations)
        if (orgId) {
            query = query.or(`org_id.eq.${orgId},org_id.is.null`);
        }

        // Filter by conversation type based on category
        if (category === 'myself') {
            query = query.eq('type', 'dm');
        } else if (category === 'team') {
            query = query.eq('type', 'team');
        } else if (category === 'organization') {
            query = query.eq('type', 'everyone');
        }

        const { data: conversations, error } = await query.order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching conversations:', error);
            return [];
        }

        if (!conversations || conversations.length === 0) {
            return [];
        }

        // Step 3: Fetch conversation indexes for these conversations
        const { data: indexes, error: indexError } = await supabase
            .from('conversation_indexes')
            .select('*')
            .in('conversation_id', conversations.map(c => c.id));

        if (indexError) {
            console.error('Error fetching conversation indexes:', indexError);
            // Return conversations without indexes rather than failing completely
            return conversations;
        }

        // Step 4: Merge indexes into conversations
        const conversationsWithIndexes = conversations.map(conv => {
            const index = indexes?.find(idx => idx.conversation_id === conv.id);
            return {
                ...conv,
                conversation_indexes: index ? [index] : []
            };
        });

        // Step 4.5: Sort by last_message_at (most recent first)
        conversationsWithIndexes.sort((a, b) => {
            const aTime = a.conversation_indexes?.[0]?.last_message_at;
            const bTime = b.conversation_indexes?.[0]?.last_message_at;

            if (!aTime && !bTime) return 0;
            if (!aTime) return 1;  // No message goes to bottom
            if (!bTime) return -1;

            return new Date(bTime) - new Date(aTime); // Newest first
        });

        // Step 5: Self-healing for missing message previews
        // If we have a timestamp but no message content, fetch it
        const brokenConversations = conversationsWithIndexes.filter(c => {
            const idx = c.conversation_indexes?.[0];
            return idx && idx.last_message_at && !idx.last_message;
        });

        if (brokenConversations.length > 0) {
            await Promise.all(brokenConversations.map(async (conv) => {
                const { data: msgs } = await supabase
                    .from('messages')
                    .select('content')
                    .eq('conversation_id', conv.id)
                    .order('created_at', { ascending: false })
                    .limit(1);

                if (msgs && msgs.length > 0) {
                    const content = msgs[0].content;
                    // Update local object immediately so UI shows it
                    if (conv.conversation_indexes[0]) {
                        conv.conversation_indexes[0].last_message = content;
                    }

                    // Background repair: Persist this fix to the DB index
                    updateConversationIndex(conv.id, content).catch(err =>
                        console.error('Failed to auto-repair conversation index:', err)
                    );
                }
            }));
        }

        return conversationsWithIndexes;
    } catch (error) {
        console.error('Error in getConversationsByCategory:', error);
        return [];
    }
};

/**
 * Get all messages for a specific conversation
 * @param {string} conversationId - ID of the conversation
 * @returns {Promise<Array>} List of messages
 */
export const getConversationMessages = async (conversationId) => {
    try {
        const { data, error } = await supabase
            .from('messages')
            .select(`
                *,
                attachments(*)
            `)
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching messages:', error);
        throw error;
    }
};

/**
 * Send a new message
 * @param {string} conversationId - ID of the conversation
 * @param {string} userId - ID of the sender
 * @param {string} content - Message content
 * @param {Array} files - Optional array of files to attach
 * @returns {Promise<Object>} Created message
 */
export const sendMessage = async (conversationId, userId, content, files = []) => {
    try {
        // Insert the message
        const { data: message, error: messageError } = await supabase
            .from('messages')
            .insert({
                conversation_id: conversationId,
                sender_user_id: userId,
                sender_type: 'human',
                message_type: 'chat',
                content: content,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (messageError) throw messageError;

        // Upload attachments if any
        if (files && files.length > 0) {
            for (const file of files) {
                await uploadAttachment(file, conversationId, message.id);
            }
        }

        // Update conversation index
        // Use '[Attachment]' if no text but files were sent
        const indexMessage = content || (files && files.length > 0 ? '📎 Attachment' : '');
        await updateConversationIndex(conversationId, indexMessage);

        return message;
    } catch (error) {
        console.error('Error sending message:', error);
        throw error;
    }
};

/**
 * Upload a file attachment to Supabase Storage
 * @param {File} file - File to upload
 * @param {string} conversationId - ID of the conversation
 * @param {string} messageId - ID of the message
 * @returns {Promise<Object>} Attachment metadata
 */
export const uploadAttachment = async (file, conversationId, messageId) => {
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${conversationId}/${fileName}`;

        // Upload file to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('message-attachments')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('message-attachments')
            .getPublicUrl(filePath);

        // Insert attachment metadata
        const { data: attachment, error: attachmentError } = await supabase
            .from('attachments')
            .insert({
                message_id: messageId,
                file_name: file.name,
                file_type: file.type,
                file_size: file.size,
                storage_path: filePath,
                url: publicUrl
            })
            .select()
            .single();

        if (attachmentError) throw attachmentError;

        return attachment;
    } catch (error) {
        console.error('Error uploading attachment:', error);
        throw error;
    }
};

/**
 * Update conversation index with last message
 * @param {string} conversationId - ID of the conversation
 * @param {string} lastMessage - Last message content
 */
export const updateConversationIndex = async (conversationId, lastMessage) => {
    try {
        const { error } = await supabase
            .from('conversation_indexes')
            .upsert(
                {
                    conversation_id: conversationId,
                    last_message: lastMessage,
                    last_message_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                },
                {
                    onConflict: 'conversation_id',
                    ignoreDuplicates: false
                }
            );

        if (error) throw error;
    } catch (error) {
        console.error('Error updating conversation index:', error);
        throw error;
    }
};

/**
 * Create a new DM conversation
 * @param {string} userId1 - First user ID
 * @param {string} userId2 - Second user ID
 * @param {string} orgId - Organization ID
 * @returns {Promise<Object>} Created conversation
 */
export const createDMConversation = async (userId1, userId2, orgId) => {
    try {
        // Strategy: Find existing DM between these two users regardless of org_id or context

        // 1. Get all conversation IDs for User 1
        const { data: user1Convs } = await supabase
            .from('conversation_members')
            .select('conversation_id')
            .eq('user_id', userId1);

        const candidateIds = user1Convs?.map(c => c.conversation_id) || [];

        if (candidateIds.length > 0) {
            // 2. Search for a DM conversation in these candidates that ALSO includes User 2
            const { data: existingDM } = await supabase
                .from('conversations')
                .select(`
                    *,
                    conversation_members!inner(user_id)
                `)
                .in('id', candidateIds) // Must be one of User 1's conversations
                .eq('type', 'dm')       // Must be a DM
                .eq('conversation_members.user_id', userId2) // Must include User 2 (inner join filters for this)
                .maybeSingle();

            if (existingDM) {
                console.log('Found existing DM:', existingDM.id);
                return existingDM;
            }
        }

        console.log('Creating new DM conversation...');

        // Create new DM conversation
        const { data: conversation, error: convError } = await supabase
            .from('conversations')
            .insert({
                org_id: orgId,
                type: 'dm',
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (convError) throw convError;

        // Add both users as members
        const { error: membersError } = await supabase
            .from('conversation_members')
            .insert([
                { conversation_id: conversation.id, user_id: userId1 },
                { conversation_id: conversation.id, user_id: userId2 }
            ]);

        if (membersError) throw membersError;

        return conversation;
    } catch (error) {
        console.error('Error creating DM conversation:', error);
        throw error;
    }
};

/**
 * Create a Team conversation
 * @param {string} creatorId - User creating the team chat
 * @param {Array} memberIds - Array of user IDs to add to team
 * @param {string} teamName - Name of the team chat
 * @param {string} orgId - Organization ID
 * @returns {Promise<Object>} Created conversation
 */
export const createTeamConversation = async (creatorId, memberIds, teamName, orgId) => {
    try {
        // Create team conversation
        const { data: conversation, error: convError } = await supabase
            .from('conversations')
            .insert({
                org_id: orgId,
                type: 'team',
                name: teamName,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (convError) throw convError;

        // Add all members including creator
        const allMembers = [...new Set([creatorId, ...memberIds])];
        const memberInserts = allMembers.map(userId => ({
            conversation_id: conversation.id,
            user_id: userId
        }));

        const { error: membersError } = await supabase
            .from('conversation_members')
            .insert(memberInserts);

        if (membersError) throw membersError;

        return conversation;
    } catch (error) {
        console.error('Error creating team conversation:', error);
        throw error;
    }
};

/**
 * Get or create organization-wide conversation
 * @param {string} userId - Current user's ID
 * @param {string} orgId - Organization ID
 * @returns {Promise<Object>} Organization conversation
 */
export const getOrCreateOrgConversation = async (userId, orgId) => {
    try {
        // Check if org conversation exists
        const { data: existing } = await supabase
            .from('conversations')
            .select('*')
            .eq('type', 'everyone')
            .eq('org_id', orgId)
            .maybeSingle();

        if (existing) {
            // Make sure user is a member
            const { data: membership } = await supabase
                .from('conversation_members')
                .select('id')
                .eq('conversation_id', existing.id)
                .eq('user_id', userId)
                .maybeSingle();

            if (!membership) {
                await supabase
                    .from('conversation_members')
                    .insert({ conversation_id: existing.id, user_id: userId });
            }

            return existing;
        }

        // Create new org-wide conversation
        const { data: conversation, error: convError } = await supabase
            .from('conversations')
            .insert({
                org_id: orgId,
                type: 'everyone',
                name: 'Company Chat',
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (convError) throw convError;

        // Add creator as first member
        await supabase
            .from('conversation_members')
            .insert({ conversation_id: conversation.id, user_id: userId });

        return conversation;
    } catch (error) {
        console.error('Error getting/creating org conversation:', error);
        throw error;
    }
};

/**
 * Subscribe to real-time updates for a conversation
 * @param {string} conversationId - ID of the conversation
 * @param {Function} callback - Callback function for new messages
 * @returns {Object} Subscription object
 */
export const subscribeToConversation = (conversationId, callback) => {
    const subscription = supabase
        .channel(`conversation:${conversationId}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `conversation_id=eq.${conversationId}`
            },
            (payload) => {
                callback(payload.new);
            }
        )
        .subscribe();

    return subscription;
};

/**
 * Unsubscribe from real-time updates
 * @param {Object} subscription - Subscription object to unsubscribe
 */
export const unsubscribeFromConversation = async (subscription) => {
    if (subscription) {
        await supabase.removeChannel(subscription);
    }
};

/**
 * Get user details for conversation display
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User details
 */
export const getUserDetails = async (userId) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('id, email, full_name, avatar_url')
            .eq('id', userId)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error fetching user details:', error);
        return null;
    }
};

/**
 * Get all users in the organization for starting new DMs
 * @param {string} orgId - Organization ID
 * @returns {Promise<Array>} List of users
 */
export const getOrgUsers = async (orgId) => {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, email, full_name, avatar_url, role')
            .eq('org_id', orgId)
            .order('full_name');

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching org users:', error);
        return [];
    }
};
