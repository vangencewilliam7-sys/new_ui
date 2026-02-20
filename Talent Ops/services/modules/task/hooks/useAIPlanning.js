import { useState, useCallback } from 'react';
import { supabase } from '../../../../lib/supabaseClient';

/**
 * useAIPlanning Hook (SRP: AI Planning Session Management)
 * 
 * Responsibilities:
 * - Manages AI planning session state (loading, result, error)
 * - Calls the Supabase Edge Function
 * - Does NOT manage task form state or phase state (those are in useTaskForm and useTaskPhases)
 * 
 * SOLID:
 * S - Only handles AI generation lifecycle
 * O - Can be extended with new AI features without modifying existing logic
 * D - Depends on supabase client abstraction, not direct fetch calls
 */
export const useAIPlanning = () => {
    const [aiPlan, setAiPlan] = useState(null);        // The AI response object
    const [aiLoading, setAiLoading] = useState(false);  // Loading state
    const [aiError, setAiError] = useState(null);       // Error message
    const [showOverlay, setShowOverlay] = useState(false); // Control overlay visibility
    const [aiMetadata, setAiMetadata] = useState(null); // Stored metadata after apply

    /**
     * Generate a task plan using the Supabase Edge Function.
     * 
     * @param {string} title - Task title (required)
     * @param {string} description - Task description (required)
     * @param {string[]} skills - Skill tags
     * @param {string} taskType - Task type (optional)
     */
    const generatePlan = useCallback(async (title, description, skills = [], taskType = 'General') => {
        if (!title || !description) {
            setAiError('Please enter a task title and description first.');
            return;
        }

        setAiLoading(true);
        setAiError(null);

        try {
            const { data, error } = await supabase.functions.invoke('generate-task-plan', {
                body: {
                    title,
                    description,
                    skills,
                    taskType
                }
            });

            if (error) throw error;

            if (data?.error) {
                throw new Error(data.error);
            }

            if (!data?.suggested_plan || data.suggested_plan.length === 0) {
                throw new Error('AI returned an empty plan. Please try again.');
            }

            setAiPlan(data);
            setShowOverlay(true);
        } catch (err) {
            console.error('AI Planning Error:', err);
            setAiError(err.message || 'Failed to generate AI plan. Please try again.');
        } finally {
            setAiLoading(false);
        }
    }, []);

    /**
     * Regenerate the plan (called from overlay)
     */
    const regeneratePlan = useCallback(async (title, description, skills, taskType) => {
        setAiLoading(true);
        await generatePlan(title, description, skills, taskType);
    }, [generatePlan]);

    /**
     * Apply the plan (called when user clicks "Continue & Apply")
     * Stores metadata and closes overlay.
     */
    const applyPlan = useCallback((flatSteps, metadata) => {
        setAiMetadata(metadata);
        setShowOverlay(false);
        // The actual step insertion into form state is handled by the parent via applyBatchPlan
        return flatSteps;
    }, []);

    /**
     * Dismiss the overlay without applying
     */
    const dismissPlan = useCallback(() => {
        setShowOverlay(false);
        // Don't clear aiPlan so user can re-open if needed
    }, []);

    /**
     * Full reset (used when modal closes)
     */
    const resetAI = useCallback(() => {
        setAiPlan(null);
        setAiLoading(false);
        setAiError(null);
        setShowOverlay(false);
        setAiMetadata(null);
    }, []);

    return {
        aiPlan,
        aiLoading,
        aiError,
        showOverlay,
        aiMetadata,
        generatePlan,
        regeneratePlan,
        applyPlan,
        dismissPlan,
        resetAI
    };
};
