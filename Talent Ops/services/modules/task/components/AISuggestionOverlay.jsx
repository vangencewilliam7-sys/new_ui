import React, { useState, useMemo } from 'react';
import { X, Sparkles, AlertTriangle, Info, RefreshCw, Check, Trash2 } from 'lucide-react';

/**
 * AISuggestionOverlay.jsx
 * 
 * SOLID Implementation:
 * S - SRP: Only responsible for displaying/editing/approving the AI proposal.
 * O - OCP: Can accept any AI plan shape without modification.
 * D - DIP: Receives `aiPlan` prop, doesn't fetch data itself.
 * 
 * Props:
 * - aiPlan: The raw AI response { suggested_plan: [...], ai_metadata: {...} }
 * - onClose: Close overlay without applying
 * - onApply: Apply the edited steps (flatSteps, aiMetadata)
 * - onRegenerate: Re-call the AI for a fresh plan
 * - isRegenerating: Boolean for loading state during regeneration
 */

const PHASE_LABELS = {
    'requirement_refiner': 'Requirements',
    'design_guidance': 'Design',
    'build_guidance': 'Build',
    'acceptance_criteria': 'Acceptance',
    'deployment': 'Deployment'
};

const AISuggestionOverlay = ({ aiPlan, onClose, onApply, onRegenerate, isRegenerating }) => {
    // Group the flat suggested_plan into phase-based groups for display
    const initialGrouped = useMemo(() => {
        const plan = aiPlan?.suggested_plan || [];
        const grouped = {};
        plan.forEach(step => {
            const phase = step.phase || 'build_guidance';
            if (!grouped[phase]) grouped[phase] = [];
            grouped[phase].push({
                title: step.title || '',
                duration: [2, 4].includes(Number(step.duration)) ? Number(step.duration) : 4,
                risk: step.risk || 'low',
                note: step.note || ''
            });
        });
        return grouped;
    }, [aiPlan]);

    const [editableGroups, setEditableGroups] = useState(initialGrouped);

    // Handle editing a specific step field
    const handleStepChange = (phaseKey, stepIndex, field, value) => {
        setEditableGroups(prev => {
            const updated = { ...prev };
            const steps = [...(updated[phaseKey] || [])];
            steps[stepIndex] = { ...steps[stepIndex], [field]: value };
            updated[phaseKey] = steps;
            return updated;
        });
    };

    // Handle removing a step
    const handleRemoveStep = (phaseKey, stepIndex) => {
        setEditableGroups(prev => {
            const updated = { ...prev };
            const steps = [...(updated[phaseKey] || [])];
            steps.splice(stepIndex, 1);
            if (steps.length === 0) {
                delete updated[phaseKey];
            } else {
                updated[phaseKey] = steps;
            }
            return updated;
        });
    };

    // Calculate total hours
    const totalHours = useMemo(() => {
        return Object.values(editableGroups)
            .flat()
            .reduce((sum, step) => sum + (step.duration || 0), 0);
    }, [editableGroups]);

    const totalSteps = useMemo(() => {
        return Object.values(editableGroups).flat().length;
    }, [editableGroups]);

    // Convert grouped state back to flat list for the parent
    const handleApply = () => {
        const flatSteps = [];
        Object.entries(editableGroups).forEach(([phaseKey, steps]) => {
            steps.forEach(step => {
                flatSteps.push({
                    phase: phaseKey,
                    title: step.title,
                    hours: step.duration
                });
            });
        });
        onApply(flatSteps, aiPlan?.ai_metadata || {});
    };

    const phases = Object.keys(editableGroups);

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.65)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 2000,
            backdropFilter: 'blur(6px)',
            animation: 'fadeIn 0.2s ease-out'
        }}>
            <div style={{
                backgroundColor: 'white',
                width: '640px',
                maxWidth: '95%',
                maxHeight: '85vh',
                borderRadius: '16px',
                boxShadow: '0 25px 60px -12px rgba(0,0,0,0.35)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                animation: 'slideUp 0.25s ease-out'
            }}>

                {/* Header */}
                <div style={{
                    padding: '20px 24px',
                    borderBottom: '1px solid #e2e8f0',
                    background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5, #f0f9ff)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Sparkles size={20} style={{ color: '#10b981' }} />
                            AI Suggested Plan
                        </h3>
                        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.8rem' }}>
                            Review and edit the steps before importing into your task.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '6px', borderRadius: '8px' }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

                    {/* Risks & Assumptions */}
                    {(aiPlan?.ai_metadata?.overall_risks?.length > 0 || aiPlan?.ai_metadata?.assumptions?.length > 0) && (
                        <div style={{
                            padding: '12px 16px',
                            backgroundColor: '#fffbeb',
                            borderRadius: '10px',
                            border: '1px solid #fde68a',
                            marginBottom: '20px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px'
                        }}>
                            {aiPlan.ai_metadata?.overall_risks?.map((risk, i) => (
                                <div key={`risk-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#92400e' }}>
                                    <AlertTriangle size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />
                                    {risk}
                                </div>
                            ))}
                            {aiPlan.ai_metadata?.assumptions?.map((asm, i) => (
                                <div key={`asm-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#1e40af' }}>
                                    <Info size={14} style={{ color: '#3b82f6', flexShrink: 0 }} />
                                    {asm}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Summary Badge */}
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#059669', backgroundColor: '#ecfdf5', padding: '4px 10px', borderRadius: '12px', border: '1px solid #a7f3d0' }}>
                            {totalSteps} Steps
                        </span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#0369a1', backgroundColor: '#f0f9ff', padding: '4px 10px', borderRadius: '12px', border: '1px solid #bae6fd' }}>
                            {totalHours}h Total
                        </span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#7c3aed', backgroundColor: '#f5f3ff', padding: '4px 10px', borderRadius: '12px', border: '1px solid #ddd6fe' }}>
                            {totalHours * 10} Points
                        </span>
                    </div>

                    {/* Phase-grouped Steps */}
                    {phases.length > 0 ? phases.map(phaseKey => (
                        <div key={phaseKey} style={{ marginBottom: '20px' }}>
                            <h4 style={{
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                color: '#10b981',
                                textTransform: 'uppercase',
                                letterSpacing: '0.08em',
                                marginBottom: '10px'
                            }}>
                                {PHASE_LABELS[phaseKey] || phaseKey}
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {(editableGroups[phaseKey] || []).map((step, sIndex) => (
                                    <div key={sIndex} style={{
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        padding: '10px 12px',
                                        backgroundColor: '#f8fafc',
                                        borderRadius: '8px',
                                        border: '1px solid #e2e8f0',
                                        transition: 'border-color 0.2s'
                                    }}
                                        onMouseEnter={e => e.currentTarget.style.borderColor = '#94a3b8'}
                                        onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                                    >
                                        {/* Step Title (Editable) */}
                                        <input
                                            value={step.title}
                                            onChange={(e) => handleStepChange(phaseKey, sIndex, 'title', e.target.value)}
                                            style={{
                                                flex: 1,
                                                border: 'none',
                                                background: 'transparent',
                                                fontSize: '0.85rem',
                                                color: '#1e293b',
                                                outline: 'none',
                                                fontFamily: 'inherit'
                                            }}
                                        />

                                        {/* Risk Badge */}
                                        <span style={{
                                            fontSize: '0.65rem',
                                            fontWeight: 600,
                                            padding: '2px 8px',
                                            borderRadius: '10px',
                                            backgroundColor: step.risk === 'high' ? '#fef2f2' : step.risk === 'medium' ? '#fffbeb' : '#f0fdf4',
                                            color: step.risk === 'high' ? '#dc2626' : step.risk === 'medium' ? '#d97706' : '#16a34a',
                                            border: `1px solid ${step.risk === 'high' ? '#fecaca' : step.risk === 'medium' ? '#fde68a' : '#bbf7d0'}`,
                                            textTransform: 'uppercase'
                                        }}>
                                            {step.risk}
                                        </span>

                                        {/* Duration Dropdown */}
                                        <select
                                            value={step.duration}
                                            onChange={(e) => handleStepChange(phaseKey, sIndex, 'duration', parseInt(e.target.value))}
                                            style={{
                                                border: '1px solid #e2e8f0',
                                                borderRadius: '6px',
                                                padding: '4px 8px',
                                                fontSize: '0.8rem',
                                                color: '#475569',
                                                backgroundColor: 'white',
                                                cursor: 'pointer',
                                                outline: 'none'
                                            }}
                                        >
                                            <option value={2}>2h</option>
                                            <option value={4}>4h</option>
                                        </select>

                                        {/* Remove Button */}
                                        <button
                                            onClick={() => handleRemoveStep(phaseKey, sIndex)}
                                            style={{
                                                border: 'none', background: 'none',
                                                color: '#cbd5e1', cursor: 'pointer', padding: '4px',
                                                borderRadius: '4px', transition: 'color 0.2s'
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                            onMouseLeave={e => e.currentTarget.style.color = '#cbd5e1'}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )) : (
                        <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem', padding: '20px 0' }}>
                            No steps generated. Try regenerating.
                        </p>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '16px 24px',
                    borderTop: '1px solid #e2e8f0',
                    backgroundColor: '#f8fafc',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <button
                        onClick={onRegenerate}
                        disabled={isRegenerating}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '8px 16px',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            backgroundColor: 'white',
                            color: '#64748b',
                            fontSize: '0.85rem',
                            fontWeight: 500,
                            cursor: isRegenerating ? 'not-allowed' : 'pointer',
                            opacity: isRegenerating ? 0.6 : 1,
                            transition: 'all 0.2s'
                        }}
                    >
                        <RefreshCw size={14} style={{ animation: isRegenerating ? 'spin 1s linear infinite' : 'none' }} />
                        {isRegenerating ? 'Regenerating...' : 'Regenerate'}
                    </button>

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            onClick={onClose}
                            style={{
                                padding: '8px 18px',
                                borderRadius: '8px',
                                border: '1px solid #e2e8f0',
                                backgroundColor: 'white',
                                color: '#64748b',
                                fontWeight: 600,
                                fontSize: '0.85rem',
                                cursor: 'pointer'
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleApply}
                            disabled={totalSteps === 0}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '8px 22px',
                                borderRadius: '8px',
                                border: 'none',
                                background: totalSteps > 0 ? 'linear-gradient(135deg, #10b981, #059669)' : '#e2e8f0',
                                color: totalSteps > 0 ? 'white' : '#94a3b8',
                                fontWeight: 600,
                                fontSize: '0.85rem',
                                cursor: totalSteps > 0 ? 'pointer' : 'default',
                                boxShadow: totalSteps > 0 ? '0 4px 12px rgba(16,185,129,0.3)' : 'none',
                                transition: 'all 0.2s'
                            }}
                        >
                            <Check size={16} />
                            Continue & Apply
                        </button>
                    </div>
                </div>
            </div>

            {/* Keyframe Animations */}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default AISuggestionOverlay;
