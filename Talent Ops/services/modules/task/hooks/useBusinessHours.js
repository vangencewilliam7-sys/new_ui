import { useState, useEffect, useRef } from 'react';
import { calculateElapsedBusinessHours, calculateDueDateTime } from '../../../../lib/businessHoursUtils';

/**
 * Custom hook to encapsulate business hours calculation logic.
 * Adheres to Single Responsibility Principle (SRP).
 * Supports bidirectional calculation:
 * 1. Dates -> Hours
 * 2. Hours -> Dates
 */
export const useBusinessHours = (startDate, startTime, endDate, dueTime, initialHours = 10) => {
    const [allocatedHours, setAllocatedHours] = useState(initialHours);
    const isInternalUpdate = useRef(false);

    useEffect(() => {
        // If this update was triggered by our own Hours->Date calculation, ignore it to prevent loop
        if (isInternalUpdate.current) {
            isInternalUpdate.current = false;
            return;
        }

        // Only trigger if we have all date components
        if (startDate && startTime && endDate && dueTime) {
            const startDateTime = new Date(`${startDate}T${startTime}`);
            const endDateTime = new Date(`${endDate}T${dueTime}`);

            if (endDateTime > startDateTime) {
                const businessHours = calculateElapsedBusinessHours(startDateTime, endDateTime);
                // Round to 2 decimal places (allow < 1 hour)
                const roundedHours = Math.round(businessHours * 100) / 100;

                // Only update if value is different
                if (allocatedHours !== roundedHours) {
                    setAllocatedHours(roundedHours);
                }
            }
        }
    }, [startDate, startTime, endDate, dueTime]); // Dependencies: Only dates

    /**
     * Calculate new End Date and Due Time based on allocated hours.
     * Returns the new { endDate, dueTime } object.
     */
    const calculateEndDateFromHours = (hours) => {
        if (!startDate || !startTime || !hours || hours <= 0) return null;

        const startDateTime = new Date(`${startDate}T${startTime}`);
        const result = calculateDueDateTime(startDateTime, parseFloat(hours));

        // Mark next date update as internal to prevent loop
        isInternalUpdate.current = true;

        return result;
    };

    return { allocatedHours, setAllocatedHours, calculateEndDateFromHours };
};
