import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

const ActiveStatusDot = ({ taskId, isActive: propIsActive, isEditable = true, size = 12, onToggle }) => {
    const [isActive, setIsActive] = useState(propIsActive || false);
    const [loading, setLoading] = useState(false);

    // Sync state with props when they change externally (e.g. from realtime)
    React.useEffect(() => {
        setIsActive(propIsActive);
    }, [propIsActive]);

    const toggleStatus = async () => {
        if (!isEditable || loading) return;

        const newState = !isActive;
        setIsActive(newState); // Optimistic update
        setLoading(true);

        try {
            const { error } = await supabase
                .from('tasks')
                .update({ is_active_now: newState })
                .eq('id', taskId);

            if (error) {
                console.error('Error updating active status:', error);
                setIsActive(!newState); // Revert
            } else if (onToggle) {
                onToggle(newState);
            }
        } catch (error) {
            console.error('Error toggling status:', error);
            setIsActive(!newState);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            onClick={(e) => {
                e.stopPropagation();
                toggleStatus();
            }}
            title={!isEditable
                ? (isActive ? "User is working on this" : "Not active")
                : (isActive ? "Click to set active" : "Click to set idle")}
            style={{
                width: `${size}px`,
                height: `${size}px`,
                borderRadius: '50%',
                backgroundColor: isActive ? '#22c55e' : '#e2e8f0', // Green or Slate-200
                border: isActive ? '2px solid #bbf7d0' : '1px solid #cbd5e1',
                cursor: !isEditable ? 'default' : 'pointer',
                boxShadow: isActive ? `0 0 ${size / 2}px #22c55e` : 'none',
                opacity: loading ? 0.7 : 1,
                transition: 'all 0.3s ease',
                flexShrink: 0
            }}
        />
    );
};

export default ActiveStatusDot;
