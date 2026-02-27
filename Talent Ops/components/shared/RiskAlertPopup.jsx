import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, ArrowRight, ShieldAlert } from 'lucide-react';

const RiskAlertPopup = ({ isOpen, onClose, alertData }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
        } else {
            const timer = setTimeout(() => setIsVisible(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    if (!isVisible && !isOpen) return null;

    if (!alertData) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: isOpen ? 'rgba(0, 0, 0, 0.6)' : 'transparent',
            backdropFilter: isOpen ? 'blur(4px)' : 'none',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease-in-out',
            pointerEvents: isOpen ? 'auto' : 'none'
        }}>
            <div style={{
                backgroundColor: 'white',
                borderRadius: '24px',
                width: '100%',
                maxWidth: '480px',
                margin: '20px',
                boxShadow: '0 25px 50px -12px rgba(220, 38, 38, 0.25)',
                border: '1px solid #fee2e2',
                overflow: 'hidden',
                transform: isOpen ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(20px)',
                opacity: isOpen ? 1 : 0,
                transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}>
                {/* Header */}
                <div style={{
                    background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
                    padding: '24px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', gap: '16px' }}>
                        <div style={{
                            backgroundColor: 'white',
                            padding: '12px',
                            borderRadius: '16px',
                            boxShadow: '0 4px 6px -1px rgba(220, 38, 38, 0.1)'
                        }}>
                            <ShieldAlert size={32} color="#dc2626" />
                        </div>
                        <div>
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                backgroundColor: 'rgba(220, 38, 38, 0.1)',
                                padding: '4px 10px',
                                borderRadius: '20px',
                                marginBottom: '8px'
                            }}>
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#dc2626' }} />
                                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    AI Risk Detection
                                </span>
                            </div>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: '#7f1d1d', lineHeight: 1.2 }}>
                                Risk Alert
                            </h2>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'rgba(255, 255, 255, 0.5)',
                            border: 'none',
                            borderRadius: '50%',
                            width: '32px',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: '#7f1d1d',
                            transition: 'all 0.2s'
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div style={{ padding: '24px' }}>
                    <div style={{
                        backgroundColor: '#fff1f2',
                        borderLeft: '4px solid #e11d48',
                        padding: '16px',
                        borderRadius: '8px',
                        marginBottom: '24px'
                    }}>
                        <p style={{ margin: 0, color: '#be123c', fontSize: '1rem', lineHeight: 1.6, fontWeight: 500 }}>
                            {alertData.message || 'Potential risk detected in your assigned tasks.'}
                        </p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#64748b', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
                            <span>Detected at:</span>
                            <span style={{ fontWeight: 600, color: '#334155' }}>
                                {new Date(alertData.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                        {alertData.sender_name && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#64748b' }}>
                                <span>Source:</span>
                                <span style={{ fontWeight: 600, color: '#334155' }}>
                                    {alertData.sender_name}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div style={{
                    padding: '24px',
                    backgroundColor: '#f8fafc',
                    borderTop: '1px solid #f1f5f9',
                    display: 'flex',
                    gap: '12px'
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            flex: 1,
                            padding: '12px',
                            borderRadius: '12px',
                            border: '1px solid #e2e8f0',
                            backgroundColor: 'white',
                            color: '#64748b',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontSize: '0.95rem'
                        }}
                    >
                        Dismiss
                    </button>
                    <button
                        onClick={onClose} // Typically would navigate to task
                        style={{
                            flex: 1,
                            padding: '12px',
                            borderRadius: '12px',
                            border: 'none',
                            background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                            color: 'white',
                            fontWeight: 700,
                            cursor: 'pointer',
                            fontSize: '0.95rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)'
                        }}
                    >
                        Review Now <ArrowRight size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RiskAlertPopup;
