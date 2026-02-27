import { useState } from 'react';

/**
 * Task Phases Management Hook (SRP: Separated Phase Logic)
 */
export const useTaskPhases = (initialPhases = []) => {
    const [phaseFiles, setPhaseFiles] = useState({});
    const [phaseDescriptions, setPhaseDescriptions] = useState({});
    const [taskStepsToAdd, setTaskStepsToAdd] = useState({});
    const [activeStepPhase, setActiveStepPhase] = useState(initialPhases[0] || 'requirement_refiner');
    const [newStepInput, setNewStepInput] = useState('');
    const [newStepHours, setNewStepHours] = useState(2);

    const addStep = (phaseKey, stepTitle, stepHours = 2) => {
        if (!stepTitle.trim()) return;

        const newStep = {
            title: stepTitle.trim(),
            hours: parseFloat(stepHours)
        };

        setTaskStepsToAdd(prev => ({
            ...prev,
            [phaseKey]: [...(prev[phaseKey] || []), newStep]
        }));
        setNewStepInput('');
        setNewStepHours(2);
    };

    const removeStep = (phaseKey, stepindex) => {
        const steps = [...(taskStepsToAdd[phaseKey] || [])];
        steps.splice(stepindex, 1);

        setTaskStepsToAdd(prev => ({
            ...prev,
            [phaseKey]: steps
        }));
    };

    const resetPhases = () => {
        setPhaseFiles({});
        setPhaseDescriptions({});
        setTaskStepsToAdd({});
        setNewStepInput('');
        setNewStepHours(2);
        setActiveStepPhase('requirement_refiner');
    };

    const applyBatchPlan = (suggestedSteps) => {
        // suggestedSteps: Array of { phase: '...', title: '...', hours: 2 }
        const newStepsMap = {};

        suggestedSteps.forEach(step => {
            if (!newStepsMap[step.phase]) {
                newStepsMap[step.phase] = [];
            }
            newStepsMap[step.phase].push({
                title: step.title,
                hours: parseFloat(step.hours) || 2
            });
        });

        // Merge with existing steps or Replace? 
        // Decision: Replace phases that have AI suggestions, keep others intact.
        setTaskStepsToAdd(prev => ({
            ...prev,
            ...newStepsMap
        }));
    };

    return {
        phaseFiles,
        setPhaseFiles,
        phaseDescriptions,
        setPhaseDescriptions,
        taskStepsToAdd,
        setTaskStepsToAdd, // Exposed if needed, but methods preferred
        activeStepPhase,
        setActiveStepPhase,
        newStepInput,
        setNewStepInput,
        newStepHours,
        setNewStepHours,
        addStep,
        removeStep,
        resetPhases,
        applyBatchPlan
    };
};
