/**
 * Employee Matching Logic (Strategy Pattern - Simplistic)
 * Responsible for sorting and filtering employees based on task requirements.
 * Follows SRP: Only handles employee matching logic.
 */
export const getSkillScore = (employee, skillName) => {
    if (!employee || !employee.technical_scores || !skillName) return 0;

    // Check various casing possibilities
    return employee.technical_scores[skillName] ||
        employee.technical_scores[skillName.toLowerCase()] ||
        employee.technical_scores[skillName.toUpperCase()] ||
        0;
};

/**
 * Sorts employees based on primary skill score.
 * @param {Array} employees 
 * @param {Array} taskSkills 
 * @returns {Array} Sorted employees (High score first)
 */
export const sortEmployeesBySkill = (employees, taskSkills) => {
    if (!Array.isArray(employees)) return [];

    const primarySkill = taskSkills?.[0];
    if (!primarySkill) return employees; // Return original order if no skill specificed

    return [...employees].sort((a, b) => {
        const scoreA = getSkillScore(a, primarySkill);
        const scoreB = getSkillScore(b, primarySkill);

        // Sorting Logic: Higher score comes FIRST (Descending)
        return scoreB - scoreA;
    });
};
