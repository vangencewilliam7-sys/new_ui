/**
 * AILeaveInsight - Display component for AI leave analysis
 * 
 * A reusable component that shows AI-generated insights, warnings,
 * and suggestions for leave requests across all dashboards.
 */

import React, { useState } from 'react';
import {
    AlertTriangle,
    CheckCircle,
    AlertCircle,
    Users,
    Calendar,
    Briefcase,
    ChevronDown,
    ChevronUp,
    Lightbulb,
    Clock,
    Info
} from 'lucide-react';

const styles = {
    container: {
        backgroundColor: '#f8fafc',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        marginTop: '16px'
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        backgroundColor: '#f1f5f9',
        cursor: 'pointer',
        userSelect: 'none'
    },
    headerTitle: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontWeight: '600',
        fontSize: '0.9rem'
    },
    content: {
        padding: '16px'
    },
    section: {
        marginBottom: '16px',
        padding: '12px',
        backgroundColor: 'white',
        borderRadius: '8px',
        border: '1px solid #e2e8f0'
    },
    sectionHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '8px',
        fontWeight: '600',
        fontSize: '0.85rem'
    },
    message: {
        fontSize: '0.85rem',
        color: '#475569',
        lineHeight: '1.5'
    },
    badge: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 10px',
        borderRadius: '12px',
        fontSize: '0.75rem',
        fontWeight: '600'
    },
    recommendation: {
        display: 'flex',
        gap: '12px',
        padding: '10px 12px',
        backgroundColor: '#f8fafc',
        borderRadius: '8px',
        marginBottom: '8px',
        border: '1px solid #e2e8f0'
    },
    recommendationIcon: {
        flexShrink: 0,
        marginTop: '2px'
    },
    recommendationContent: {
        flex: 1
    },
    suggestedDate: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 12px',
        backgroundColor: '#eff6ff',
        borderRadius: '8px',
        marginBottom: '8px',
        border: '1px solid #bfdbfe',
        cursor: 'pointer',
        transition: 'all 0.2s'
    },
    suggestedDateHover: {
        backgroundColor: '#dbeafe'
    },
    overlappingLeave: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        backgroundColor: '#fefce8',
        borderRadius: '6px',
        marginBottom: '6px',
        border: '1px solid #fef08a',
        fontSize: '0.8rem'
    },
    loading: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        color: '#64748b'
    }
};

const riskColors = {
    low: { bg: '#dcfce7', text: '#166534', border: '#86efac' },
    medium: { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
    high: { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' }
};

const priorityIcons = {
    high: <AlertTriangle size={14} color="#dc2626" />,
    medium: <AlertCircle size={14} color="#d97706" />,
    low: <Info size={14} color="#2563eb" />
};

export default function AILeaveInsight({
    analysis,
    isLoading = false,
    variant = 'employee', // 'employee' | 'manager' | 'teamlead' | 'pm'
    onSuggestedDateClick,
    compact = false
}) {
    const [isExpanded, setIsExpanded] = useState(!compact);
    const [hoveredDate, setHoveredDate] = useState(null);

    if (isLoading) {
        return (
            <div style={styles.container}>
                <div style={styles.loading}>
                    <Clock size={16} style={{ marginRight: '8px', animation: 'spin 1s linear infinite' }} />
                    Analyzing leave request...
                </div>
            </div>
        );
    }

    if (!analysis) return null;

    const {
        overallRiskLevel = 'low',
        deadlineImpact,
        coverageRisk,
        roleCriticality,
        overlappingLeaves = [],
        suggestedDates = [],
        recommendations = []
    } = analysis;

    const riskStyle = riskColors[overallRiskLevel] || riskColors.low;

    const getRiskIcon = () => {
        switch (overallRiskLevel) {
            case 'high': return <AlertTriangle size={16} color={riskStyle.text} />;
            case 'medium': return <AlertCircle size={16} color={riskStyle.text} />;
            default: return <CheckCircle size={16} color={riskStyle.text} />;
        }
    };

    const getRiskLabel = () => {
        switch (overallRiskLevel) {
            case 'high': return 'HIGH';
            case 'medium': return 'MEDIUM';
            default: return 'LOW';
        }
    };

    return (
        <div style={styles.container}>
            {/* Header */}
            <div
                style={{
                    ...styles.header,
                    backgroundColor: riskStyle.bg,
                    borderBottom: `1px solid ${riskStyle.border}`
                }}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div style={styles.headerTitle}>
                    <span style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: riskStyle.text,
                        fontWeight: '700',
                        fontSize: '0.9rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                    }}>
                        {getRiskIcon()}
                        {getRiskLabel()}
                    </span>
                </div>
                {isExpanded ? <ChevronUp size={18} color="#64748b" /> : <ChevronDown size={18} color="#64748b" />}
            </div>

            {/* Content */}
            {isExpanded && (
                <div style={styles.content}>

                    {/* Deadline Impact */}
                    {deadlineImpact && (
                        <div style={styles.section}>
                            <div style={styles.sectionHeader}>
                                <Briefcase size={14} color="#6366f1" />
                                <span>Deadline Impact</span>
                                {deadlineImpact.hasConflict && (
                                    <span style={{
                                        ...styles.badge,
                                        backgroundColor: deadlineImpact.severity === 'critical' ? '#fee2e2' : '#fef3c7',
                                        color: deadlineImpact.severity === 'critical' ? '#991b1b' : '#92400e'
                                    }}>
                                        {deadlineImpact.severity === 'critical' ? 'Critical' : 'Moderate'}
                                    </span>
                                )}
                            </div>
                            <p style={styles.message}>{deadlineImpact.message}</p>

                            {/* Show affected tasks for managers */}
                            {(variant === 'manager' || variant === 'pm') &&
                                deadlineImpact.affectedTasks?.length > 0 && (
                                    <div style={{ marginTop: '12px' }}>
                                        <p style={{ fontSize: '0.8rem', fontWeight: '500', marginBottom: '6px', color: '#64748b' }}>
                                            Affected Tasks:
                                        </p>
                                        {deadlineImpact.affectedTasks.slice(0, 3).map((task, idx) => (
                                            <div key={idx} style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                padding: '6px 8px',
                                                backgroundColor: '#f8fafc',
                                                borderRadius: '4px',
                                                marginBottom: '4px',
                                                fontSize: '0.8rem'
                                            }}>
                                                <span style={{ flex: 1 }}>{task.title}</span>
                                                <span style={{ color: '#64748b' }}>Due: {task.dueDate}</span>
                                                {task.priority && (
                                                    <span style={{
                                                        padding: '2px 6px',
                                                        borderRadius: '4px',
                                                        backgroundColor: task.priority === 'high' ? '#fee2e2' : '#f1f5f9',
                                                        color: task.priority === 'high' ? '#991b1b' : '#64748b',
                                                        fontSize: '0.7rem',
                                                        fontWeight: '500'
                                                    }}>
                                                        {task.priority}
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                        </div>
                    )}

                    {/* Team Coverage */}
                    {coverageRisk && (
                        <div style={styles.section}>
                            <div style={styles.sectionHeader}>
                                <Users size={14} color="#6366f1" />
                                <span>Team Coverage</span>
                                <span style={{
                                    ...styles.badge,
                                    ...(riskColors[coverageRisk.riskLevel] || riskColors.low),
                                    backgroundColor: (riskColors[coverageRisk.riskLevel] || riskColors.low).bg,
                                    color: (riskColors[coverageRisk.riskLevel] || riskColors.low).text
                                }}>
                                    {coverageRisk.coveragePercent}%
                                </span>
                            </div>
                            <p style={styles.message}>{coverageRisk.message}</p>

                            {/* Coverage bar for visual representation */}
                            {coverageRisk.coveragePercent !== undefined && (
                                <div style={{
                                    marginTop: '12px',
                                    height: '8px',
                                    backgroundColor: '#e2e8f0',
                                    borderRadius: '4px',
                                    overflow: 'hidden'
                                }}>
                                    <div style={{
                                        width: `${coverageRisk.coveragePercent}%`,
                                        height: '100%',
                                        backgroundColor: coverageRisk.riskLevel === 'high' ? '#ef4444'
                                            : coverageRisk.riskLevel === 'medium' ? '#f59e0b' : '#22c55e',
                                        borderRadius: '4px',
                                        transition: 'width 0.3s ease'
                                    }} />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Overlapping Leaves (for team leads) */}
                    {(variant === 'teamlead' || variant === 'manager') && overlappingLeaves.length > 0 && (
                        <div style={styles.section}>
                            <div style={styles.sectionHeader}>
                                <Calendar size={14} color="#6366f1" />
                                <span>Overlapping Leaves</span>
                                <span style={{
                                    ...styles.badge,
                                    backgroundColor: '#fef3c7',
                                    color: '#92400e'
                                }}>
                                    {overlappingLeaves.length} overlap(s)
                                </span>
                            </div>
                            {overlappingLeaves.slice(0, 3).map((leave, idx) => (
                                <div key={idx} style={styles.overlappingLeave}>
                                    <div>
                                        <span style={{ fontWeight: '500' }}>{leave.employeeName}</span>
                                        <span style={{ color: '#64748b', marginLeft: '8px' }}>({leave.role})</span>
                                    </div>
                                    <div style={{ color: '#64748b' }}>
                                        {leave.fromDate} - {leave.toDate}
                                        <span style={{
                                            marginLeft: '8px',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            backgroundColor: leave.status === 'approved' ? '#dcfce7' : '#f1f5f9',
                                            color: leave.status === 'approved' ? '#166534' : '#64748b',
                                            fontSize: '0.7rem',
                                            fontWeight: '500'
                                        }}>
                                            {leave.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                            {overlappingLeaves.length > 3 && (
                                <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                                    +{overlappingLeaves.length - 3} more...
                                </p>
                            )}
                        </div>
                    )}

                    {/* Suggested Alternate Dates */}
                    {suggestedDates.length > 0 && (
                        <div style={styles.section}>
                            <div style={styles.sectionHeader}>
                                <Calendar size={14} color="#6366f1" />
                                <span>Suggested Alternate Dates</span>
                            </div>
                            {suggestedDates.map((suggestion, idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        ...styles.suggestedDate,
                                        ...(hoveredDate === idx ? styles.suggestedDateHover : {})
                                    }}
                                    onMouseEnter={() => setHoveredDate(idx)}
                                    onMouseLeave={() => setHoveredDate(null)}
                                    onClick={() => onSuggestedDateClick?.(suggestion.startDate, suggestion.endDate)}
                                >
                                    <div>
                                        <div style={{ fontWeight: '500', color: '#1e40af' }}>
                                            {suggestion.startDate} → {suggestion.endDate}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                                            {suggestion.reason}
                                        </div>
                                    </div>
                                    <span style={{
                                        fontSize: '0.75rem',
                                        color: '#2563eb',
                                        fontWeight: '500'
                                    }}>
                                        Select →
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Recommendations */}
                    {recommendations.length > 0 && (
                        <div style={styles.section}>
                            <div style={styles.sectionHeader}>
                                <Lightbulb size={14} color="#6366f1" />
                                <span>Recommendations</span>
                            </div>
                            {recommendations.map((rec, idx) => (
                                <div key={idx} style={styles.recommendation}>
                                    <div style={styles.recommendationIcon}>
                                        {priorityIcons[rec.priority]}
                                    </div>
                                    <div style={styles.recommendationContent}>
                                        <div style={{ fontWeight: '500', fontSize: '0.85rem', marginBottom: '2px' }}>
                                            {rec.action}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                            {rec.details}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Disclaimer */}
                    <p style={{
                        fontSize: '0.75rem',
                        color: '#94a3b8',
                        textAlign: 'center',
                        marginTop: '8px',
                        fontStyle: 'italic'
                    }}>
                        AI suggestions are advisory only. Final decisions rest with you.
                    </p>
                </div>
            )}
        </div>
    );
}
