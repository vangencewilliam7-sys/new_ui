import { useState, useEffect } from 'react';
import { useBusinessHours } from './useBusinessHours';
import { calculateDueDateTime } from '../../../../lib/businessHoursUtils';

export const useTaskForm = (initialState) => {
    const [anchorMode, setAnchorMode] = useState('date'); // 'date' | 'hours'

    // Default Task State
    const defaultState = {
        title: '',
        description: '',
        assignType: 'individual',
        assignedTo: '',
        selectedAssignees: [],
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        startTime: '09:00',
        dueTime: '17:00',
        priority: 'Medium',
        skills: [],
        allocatedHours: 10,
        pointsPerHour: 100,
        requiredPhases: ['requirement_refiner', 'design_guidance', 'build_guidance', 'acceptance_criteria', 'deployment'],
        stepDuration: '2h', // Default
        ...initialState
    };

    const [newTask, setNewTask] = useState(defaultState);

    // Business Hours Calculation (SRP: Separated Logic)
    const { allocatedHours: calculatedHours, calculateEndDateFromHours } = useBusinessHours(
        newTask.startDate,
        newTask.startTime,
        newTask.endDate,
        newTask.dueTime
    );

    // Sync calculated hours to task state (Forward Sync: Dates -> Hours)
    useEffect(() => {
        if (calculatedHours && calculatedHours !== newTask.allocatedHours) {
            setNewTask(prev => ({ ...prev, allocatedHours: calculatedHours }));
        }
    }, [calculatedHours]);

    // Handle manual hours change (Backward Sync: Hours -> Dates)
    const handleHoursChange = (e) => {
        const newHours = e.target.value;
        setNewTask(prev => ({ ...prev, allocatedHours: newHours }));
        setAnchorMode('hours');

        // Calculate and update end date/time
        if (newHours && parseFloat(newHours) > 0) {
            const result = calculateEndDateFromHours(newHours);
            if (result) {
                setNewTask(prev => ({
                    ...prev,
                    allocatedHours: newHours,
                    endDate: result.dueDate,
                    dueTime: result.dueTime.slice(0, 5) // Format HH:MM
                }));
            }
        }
    };

    const handleStartDateChange = (field, value) => {
        const updates = { [field]: value };

        // If anchored to hours, shift the end date to preserve duration
        if (anchorMode === 'hours' && newTask.allocatedHours && parseFloat(newTask.allocatedHours) > 0) {
            const tempStart = field === 'startDate' ? value : newTask.startDate;
            const tempTime = field === 'startTime' ? value : newTask.startTime;

            if (tempStart && tempTime) {
                const startDateTime = new Date(`${tempStart}T${tempTime}`);
                const result = calculateDueDateTime(startDateTime, parseFloat(newTask.allocatedHours));
                updates.endDate = result.dueDate;
                updates.dueTime = result.dueTime.slice(0, 5);
            }
        }

        setNewTask(prev => ({ ...prev, ...updates }));
    };

    const handleEndDateChange = (field, value) => {
        setAnchorMode('date');
        setNewTask(prev => ({ ...prev, [field]: value }));
    };

    const validateForm = () => {
        const errors = [];
        if (!newTask.title) errors.push('Title is required');
        if (!newTask.startTime || !newTask.dueTime) errors.push('Start/Due times are required');
        // Add more validations as needed (OCP: easy to extend)

        return {
            isValid: errors.length === 0,
            errors
        };
    };

    const resetForm = () => {
        setNewTask(defaultState);
        setAnchorMode('date');
    };

    return {
        newTask,
        setNewTask,
        handleHoursChange,
        handleStartDateChange,
        handleEndDateChange,
        validateForm,
        resetForm,
        anchorMode
    };
};
