import React from 'react';
import { AlertTriangle, Clock, CheckCircle } from 'lucide-react';

const RiskBadge = ({ riskLevel, delayHours, showLabel = true, size = 'md', onClick }) => {
    if (!riskLevel || riskLevel === 'low') return null;

    const isHigh = riskLevel === 'high';

    const config = {
        medium: {
            bg: 'rgba(255, 247, 237, 0.8)',
            text: '#c2410c',
            border: '#ffedd5',
            icon: AlertTriangle,
            label: 'At Risk',
            animate: false
        },
        high: {
            bg: 'rgba(254, 242, 242, 0.8)',
            text: '#b91c1c',
            border: '#fee2e2',
            icon: Clock,
            label: 'High Risk',
            animate: true
        }
    };

    const style = config[riskLevel] || config.medium;
    const Icon = style.icon;

    const padding = size === 'sm' ? '2px 6px' : '4px 10px';
    const fontSize = size === 'sm' ? '0.65rem' : '0.8rem';
    const iconSize = size === 'sm' ? 10 : 14;

    return (
        <div
            onClick={(e) => {
                if (onClick) {
                    e.stopPropagation();
                    onClick();
                }
            }}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: padding,
                borderRadius: '8px',
                backgroundColor: style.bg,
                backdropFilter: 'blur(4px)',
                border: `1px solid ${style.border}`,
                color: style.text,
                fontSize: fontSize,
                fontWeight: 700,
                cursor: onClick ? 'pointer' : 'default',
                width: 'fit-content',
                animation: style.animate ? 'riskPulse 2s infinite' : 'none',
                boxShadow: style.animate ? '0 0 10px rgba(239, 68, 68, 0.2)' : 'none',
                transition: 'all 0.3s ease'
            }}
            title={delayHours ? `Predicted Delay: ${delayHours} hours` : style.label}
        >
            <Icon size={iconSize} />
            {showLabel && (
                <span>
                    {style.label}
                    {delayHours > 0 && <span style={{ opacity: 0.8, marginLeft: '4px' }}>(+{delayHours}h)</span>}
                </span>
            )}

            <style>{`
                @keyframes riskPulse {
                    0% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.03); opacity: 0.9; }
                    100% { transform: scale(1); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default RiskBadge;
