import React, { useState, useEffect } from 'react';
import { Bot, X } from 'lucide-react';

const AIAssistantPopup = ({ data, onClose }) => {
    if (!data) return null;

    const {
        taskTitle,
        message,
        reasons = [],
        actions = [], // For manager alerts
        recommended_actions = [], // For employee coaching
        type = 'info'
    } = data;

    const finalActions = actions.length > 0 ? actions : recommended_actions;

    return (
        <div style={{
            position: 'fixed',
            bottom: '32px',
            right: '32px',
            width: '380px',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(12px)',
            borderRadius: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            zIndex: 9999,
            overflow: 'hidden',
            animation: 'popupSlideIn 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
            fontFamily: "'Inter', sans-serif"
        }}>
            {/* Header */}
            <div style={{
                background: type === 'alert' ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)' : 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: 'white'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                        padding: '8px',
                        borderRadius: '12px',
                        display: 'flex'
                    }}>
                        <Bot size={20} color="white" />
                    </div>
                    <div>
                        <span style={{ fontWeight: 700, fontSize: '0.95rem', display: 'block' }}>TalentOps AI</span>
                        <span style={{ fontSize: '0.7rem', opacity: 0.9, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {type === 'alert' ? 'Critical Risk Alert' : 'Active Productivity Coach'}
                        </span>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    style={{ background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', color: 'white', padding: '6px', borderRadius: '50%', display: 'flex' }}
                >
                    <X size={18} />
                </button>
            </div>

            <div style={{ padding: '24px' }}>
                {taskTitle && (
                    <div style={{ marginBottom: '12px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Task</span>
                        <h4 style={{ margin: '4px 0 0 0', color: '#1e293b', fontSize: '1rem', fontWeight: 700 }}>{taskTitle}</h4>
                    </div>
                )}

                <p style={{ fontSize: '0.95rem', color: '#475569', lineHeight: '1.6', marginBottom: '20px' }}>
                    {message || (type === 'coach' ? "I've noticed some risks with your current progress pace." : "This task requires immediate attention.")}
                </p>

                {/* Reasons / Insights */}
                {reasons.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>AI Insights</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {reasons.map((reason, idx) => (
                                <div key={idx} style={{
                                    fontSize: '0.85rem',
                                    color: '#334155',
                                    backgroundColor: '#f8fafc',
                                    padding: '8px 12px',
                                    borderRadius: '10px',
                                    borderLeft: '3px solid #6366f1'
                                }}>
                                    {reason}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Actions */}
                {finalActions.length > 0 && (
                    <div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>Recommended Actions</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {finalActions.map((action, idx) => (
                                <div key={idx} style={{
                                    fontSize: '0.85rem',
                                    color: '#065f46',
                                    backgroundColor: '#f0fdf4',
                                    padding: '10px 14px',
                                    borderRadius: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontWeight: 500
                                }}>
                                    <div style={{ width: '6px', height: '6px', backgroundColor: '#10b981', borderRadius: '50%' }}></div>
                                    {typeof action === 'string' ? action : action.label}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes popupSlideIn {
                    from { transform: translateY(100%) scale(0.9); opacity: 0; }
                    to { transform: translateY(0) scale(1); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default AIAssistantPopup;
