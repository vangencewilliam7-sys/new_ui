/**
 * AILeaveAdvisor - Intelligent Leave Analysis Service
 * 
 * Provides AI-powered suggestions and risk assessments for leave requests
 * without blocking human decision-making authority.
 */

import { supabase } from '../lib/supabaseClient';

/**
 * Main analysis function - aggregates all risk factors
 */
export async function analyzeLeaveRequest(employeeId, startDate, endDate, orgId) {
    try {
        const [
            deadlineImpact,
            coverageRisk,
            roleCriticality,
            overlappingLeaves
        ] = await Promise.all([
            checkProjectDeadlines(employeeId, startDate, endDate, orgId),
            calculateTeamCoverage(employeeId, startDate, endDate, orgId),
            assessRoleCriticality(employeeId, orgId),
            detectOverlappingLeaves(employeeId, startDate, endDate, orgId)
        ]);

        // Calculate overall risk level
        const riskScores = {
            low: 0,
            medium: 1,
            high: 2
        };

        const scores = [
            deadlineImpact.hasConflict ? (deadlineImpact.severity === 'critical' ? 2 : 1) : 0,
            riskScores[coverageRisk.riskLevel] || 0,
            // Cap role criticality at Medium (1) instead of High (2) to avoid "High Impact" 
            // when coverage and deadlines are fine. Syncs better with the UI.
            (riskScores[roleCriticality.level] || 0) > 1 ? 1 : (riskScores[roleCriticality.level] || 0),
            overlappingLeaves.length > 2 ? 2 : overlappingLeaves.length > 0 ? 1 : 0
        ];

        const maxScore = Math.max(...scores);
        const overallRiskLevel = maxScore >= 2 ? 'high' : maxScore >= 1 ? 'medium' : 'low';

        // Generate suggested alternate dates
        const suggestedDates = await suggestAlternateDates(employeeId, startDate, endDate, orgId, {
            deadlineImpact,
            coverageRisk,
            overlappingLeaves
        });

        // Build recommendations
        const recommendations = generateRecommendations({
            deadlineImpact,
            coverageRisk,
            roleCriticality,
            overlappingLeaves,
            suggestedDates
        });

        return {
            overallRiskLevel,
            deadlineImpact,
            coverageRisk,
            roleCriticality,
            overlappingLeaves,
            suggestedDates,
            recommendations,
            analyzedAt: new Date().toISOString()
        };
    } catch (error) {
        console.error('AI Leave Analysis Error:', error);
        return {
            overallRiskLevel: 'low',
            deadlineImpact: { hasConflict: false, message: 'Unable to analyze deadlines' },
            coverageRisk: { coveragePercent: 100, riskLevel: 'low', message: 'Unable to calculate coverage' },
            roleCriticality: { level: 'low', reason: 'Unable to assess criticality' },
            overlappingLeaves: [],
            suggestedDates: [],
            recommendations: [],
            error: error.message
        };
    }
}

/**
 * Check if leave overlaps with project deadlines
 */
export async function checkProjectDeadlines(employeeId, startDate, endDate, orgId) {
    try {
        // Get employee's assigned tasks with due dates in the leave period
        const { data: tasks, error: taskError } = await supabase
            .from('tasks')
            .select('id, title, due_date, priority, status, project_id')
            .eq('assigned_to', employeeId)
            .eq('org_id', orgId)
            .not('status', 'in', '("completed","closed")')
            .gte('due_date', startDate)
            .lte('due_date', endDate);

        if (taskError) throw taskError;

        if (!tasks || tasks.length === 0) {
            return {
                hasConflict: false,
                affectedTasks: [],
                affectedProjects: [],
                severity: null,
                message: 'No task deadlines during this period.'
            };
        }

        // Get project details for affected tasks
        const projectIds = [...new Set(tasks.filter(t => t.project_id).map(t => t.project_id))];
        let projectNames = {};

        if (projectIds.length > 0) {
            const { data: projects } = await supabase
                .from('projects')
                .select('id, name')
                .in('id', projectIds);

            if (projects) {
                projects.forEach(p => projectNames[p.id] = p.name);
            }
        }

        // Assess severity based on task priorities
        const highPriorityTasks = tasks.filter(t =>
            t.priority === 'high' || t.priority === 'critical' || t.priority === 'urgent'
        );
        const severity = highPriorityTasks.length > 0 ? 'critical' : 'moderate';

        const affectedProjects = [...new Set(tasks.map(t => projectNames[t.project_id] || 'Unknown Project'))];

        return {
            hasConflict: true,
            affectedTasks: tasks.map(t => ({
                id: t.id,
                title: t.title,
                dueDate: t.due_date,
                priority: t.priority,
                project: projectNames[t.project_id] || 'Unknown'
            })),
            affectedProjects,
            severity,
            message: severity === 'critical'
                ? `${highPriorityTasks.length} high-priority task(s) due during this period. Consider rescheduling or delegating.`
                : `${tasks.length} task(s) due during this period. Ensure handover is planned.`
        };
    } catch (error) {
        console.error('Deadline check error:', error);
        return {
            hasConflict: false,
            affectedTasks: [],
            affectedProjects: [],
            severity: null,
            message: 'Unable to check deadlines.',
            error: error.message
        };
    }
}

/**
 * Calculate team coverage during leave period
 */
export async function calculateTeamCoverage(employeeId, startDate, endDate, orgId) {
    try {
        // Get employee's team/project info
        const { data: employee } = await supabase
            .from('profiles')
            .select('team_id, department, role, job_title')
            .eq('id', employeeId)
            .eq('org_id', orgId)
            .single();

        if (!employee) {
            return {
                coveragePercent: 100,
                riskLevel: 'low',
                message: 'Unable to determine team.',
                teamSize: 0,
                availableMembers: 0
            };
        }

        // Get project memberships for the employee
        const { data: memberships } = await supabase
            .from('project_members')
            .select('project_id')
            .eq('user_id', employeeId)
            .eq('org_id', orgId);

        const projectIds = memberships?.map(m => m.project_id) || [];

        // Get all team members in the same projects
        let teamMemberIds = new Set();

        if (projectIds.length > 0) {
            const { data: projectMembers } = await supabase
                .from('project_members')
                .select('user_id')
                .in('project_id', projectIds)
                .eq('org_id', orgId);

            projectMembers?.forEach(pm => teamMemberIds.add(pm.user_id));
        }

        // Fallback to department if no project assignments
        if (teamMemberIds.size === 0 && employee.team_id) {
            const { data: deptMembers } = await supabase
                .from('profiles')
                .select('id')
                .eq('team_id', employee.team_id)
                .eq('org_id', orgId);

            deptMembers?.forEach(m => teamMemberIds.add(m.id));
        }

        const teamSize = teamMemberIds.size;
        if (teamSize <= 1) {
            return {
                coveragePercent: 0,
                riskLevel: 'high',
                message: 'You are the only member in your team/project. No coverage during leave.',
                teamSize: 1,
                availableMembers: 0
            };
        }

        // Check approved leaves during the same period
        const { data: approvedLeaves } = await supabase
            .from('leaves')
            .select('employee_id')
            .eq('org_id', orgId)
            .eq('status', 'approved')
            .in('employee_id', Array.from(teamMemberIds))
            .or(`from_date.lte.${endDate},to_date.gte.${startDate}`);

        const onLeaveIds = new Set(approvedLeaves?.map(l => l.employee_id) || []);
        onLeaveIds.add(employeeId); // Include the requesting employee

        const availableMembers = teamSize - onLeaveIds.size;
        const coveragePercent = Math.round((availableMembers / teamSize) * 100);

        let riskLevel = 'low';
        let message = `Team coverage: ${coveragePercent}% (${availableMembers}/${teamSize} available)`;

        if (coveragePercent < 30) {
            riskLevel = 'high';
            message = `Low team coverage: Only ${coveragePercent}% available. Consider alternate dates.`;
        } else if (coveragePercent < 60) {
            riskLevel = 'medium';
            message = `Moderate team coverage: ${coveragePercent}% available during this period.`;
        }

        return {
            coveragePercent,
            riskLevel,
            message,
            teamSize,
            availableMembers,
            onLeaveCount: onLeaveIds.size - 1 // Exclude the requesting employee
        };
    } catch (error) {
        console.error('Coverage calculation error:', error);
        return {
            coveragePercent: 100,
            riskLevel: 'low',
            message: 'Unable to calculate coverage.',
            error: error.message
        };
    }
}

/**
 * Assess role criticality of the employee
 */
export async function assessRoleCriticality(employeeId, orgId) {
    try {
        const { data: profile } = await supabase
            .from('profiles')
            .select('role, job_title, department')
            .eq('id', employeeId)
            .eq('org_id', orgId)
            .single();

        if (!profile) {
            return { level: 'low', reason: 'Unable to assess role.' };
        }

        // Check for critical roles
        const criticalRoles = ['manager', 'team_lead', 'executive', 'admin'];
        const criticalTitles = ['lead', 'senior', 'principal', 'architect', 'manager', 'head', 'director'];

        const role = (profile.role || '').toLowerCase();
        const title = (profile.job_title || '').toLowerCase();

        const isRoleCritical = criticalRoles.some(r => role.includes(r));
        const isTitleCritical = criticalTitles.some(t => title.includes(t));

        // Check current task ownership (high-priority tasks)
        const { data: criticalTasks } = await supabase
            .from('tasks')
            .select('id')
            .eq('assigned_to', employeeId)
            .eq('org_id', orgId)
            .in('priority', ['high', 'critical', 'urgent'])
            .not('status', 'in', '("completed","closed")')
            .limit(5);

        const hasCriticalTasks = criticalTasks && criticalTasks.length > 0;

        if (isRoleCritical || hasCriticalTasks) {
            return {
                level: 'high',
                reason: isRoleCritical
                    ? `${profile.role} role is critical for team operations.`
                    : `Currently owns ${criticalTasks.length} high-priority task(s).`
            };
        }

        if (isTitleCritical) {
            return {
                level: 'medium',
                reason: `${profile.job_title} position may require handover coordination.`
            };
        }

        return {
            level: 'low',
            reason: 'Standard role with manageable handover requirements.'
        };
    } catch (error) {
        console.error('Role criticality error:', error);
        return { level: 'low', reason: 'Unable to assess role criticality.' };
    }
}

/**
 * Detect overlapping leaves within the team
 */
export async function detectOverlappingLeaves(employeeId, startDate, endDate, orgId) {
    try {
        // Get employee's team/project memberships
        const { data: memberships } = await supabase
            .from('project_members')
            .select('project_id')
            .eq('user_id', employeeId)
            .eq('org_id', orgId);

        const projectIds = memberships?.map(m => m.project_id) || [];

        if (projectIds.length === 0) {
            // Fallback to team_id based lookup
            const { data: profile } = await supabase
                .from('profiles')
                .select('team_id')
                .eq('id', employeeId)
                .eq('org_id', orgId)
                .single();

            if (!profile?.team_id) {
                return [];
            }

            // Get team members
            const { data: teamMembers } = await supabase
                .from('profiles')
                .select('id, full_name, role, job_title')
                .eq('team_id', profile.team_id)
                .eq('org_id', orgId)
                .neq('id', employeeId);

            if (!teamMembers || teamMembers.length === 0) return [];

            const teamMemberIds = teamMembers.map(m => m.id);

            // Get overlapping leaves
            const { data: overlappingLeaves } = await supabase
                .from('leaves')
                .select('employee_id, from_date, to_date, status')
                .eq('org_id', orgId)
                .in('employee_id', teamMemberIds)
                .in('status', ['approved', 'pending'])
                .or(`from_date.lte.${endDate},to_date.gte.${startDate}`);

            if (!overlappingLeaves) return [];

            return overlappingLeaves.map(leave => {
                const member = teamMembers.find(m => m.id === leave.employee_id);
                return {
                    employeeId: leave.employee_id,
                    employeeName: member?.full_name || 'Unknown',
                    role: member?.role || member?.job_title || 'N/A',
                    fromDate: leave.from_date,
                    toDate: leave.to_date,
                    status: leave.status
                };
            });
        }

        // Get project team members
        const { data: projectMembers } = await supabase
            .from('project_members')
            .select('user_id')
            .in('project_id', projectIds)
            .eq('org_id', orgId)
            .neq('user_id', employeeId);

        const memberIds = [...new Set(projectMembers?.map(pm => pm.user_id) || [])];
        if (memberIds.length === 0) return [];

        // Get member profiles
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, role, job_title')
            .in('id', memberIds);

        const profileMap = {};
        profiles?.forEach(p => profileMap[p.id] = p);

        // Get overlapping leaves
        const { data: overlappingLeaves } = await supabase
            .from('leaves')
            .select('employee_id, from_date, to_date, status')
            .eq('org_id', orgId)
            .in('employee_id', memberIds)
            .in('status', ['approved', 'pending'])
            .or(`from_date.lte.${endDate},to_date.gte.${startDate}`);

        if (!overlappingLeaves) return [];

        return overlappingLeaves.map(leave => ({
            employeeId: leave.employee_id,
            employeeName: profileMap[leave.employee_id]?.full_name || 'Unknown',
            role: profileMap[leave.employee_id]?.role || profileMap[leave.employee_id]?.job_title || 'N/A',
            fromDate: leave.from_date,
            toDate: leave.to_date,
            status: leave.status
        }));
    } catch (error) {
        console.error('Overlap detection error:', error);
        return [];
    }
}

/**
 * Suggest alternate dates with lower risk
 */
export async function suggestAlternateDates(employeeId, startDate, endDate, orgId, currentAnalysis) {
    try {
        // Only suggest if there are conflicts
        if (!currentAnalysis.deadlineImpact?.hasConflict &&
            currentAnalysis.coverageRisk?.riskLevel === 'low' &&
            currentAnalysis.overlappingLeaves?.length === 0) {
            return [];
        }

        const requestedStart = new Date(startDate);
        const requestedEnd = new Date(endDate);
        const durationDays = Math.ceil((requestedEnd - requestedStart) / (1000 * 60 * 60 * 24)) + 1;

        const suggestions = [];

        // Try next week
        const nextWeekStart = new Date(requestedStart);
        nextWeekStart.setDate(nextWeekStart.getDate() + 7);

        // Skip weekends for start date
        while (nextWeekStart.getDay() === 0 || nextWeekStart.getDay() === 6) {
            nextWeekStart.setDate(nextWeekStart.getDate() + 1);
        }

        const nextWeekEnd = new Date(nextWeekStart);
        nextWeekEnd.setDate(nextWeekEnd.getDate() + durationDays - 1);

        suggestions.push({
            startDate: nextWeekStart.toISOString().split('T')[0],
            endDate: nextWeekEnd.toISOString().split('T')[0],
            reason: 'One week later - may avoid current deadline conflicts'
        });

        // Try two weeks later
        const twoWeeksStart = new Date(requestedStart);
        twoWeeksStart.setDate(twoWeeksStart.getDate() + 14);

        while (twoWeeksStart.getDay() === 0 || twoWeeksStart.getDay() === 6) {
            twoWeeksStart.setDate(twoWeeksStart.getDate() + 1);
        }

        const twoWeeksEnd = new Date(twoWeeksStart);
        twoWeeksEnd.setDate(twoWeeksEnd.getDate() + durationDays - 1);

        suggestions.push({
            startDate: twoWeeksStart.toISOString().split('T')[0],
            endDate: twoWeeksEnd.toISOString().split('T')[0],
            reason: 'Two weeks later - improved team coverage expected'
        });

        // Try one week earlier (if in future)
        const oneWeekEarlier = new Date(requestedStart);
        oneWeekEarlier.setDate(oneWeekEarlier.getDate() - 7);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (oneWeekEarlier > today) {
            while (oneWeekEarlier.getDay() === 0 || oneWeekEarlier.getDay() === 6) {
                oneWeekEarlier.setDate(oneWeekEarlier.getDate() + 1);
            }

            const earlierEnd = new Date(oneWeekEarlier);
            earlierEnd.setDate(earlierEnd.getDate() + durationDays - 1);

            suggestions.push({
                startDate: oneWeekEarlier.toISOString().split('T')[0],
                endDate: earlierEnd.toISOString().split('T')[0],
                reason: 'One week earlier - before project deadline'
            });
        }

        return suggestions.slice(0, 3); // Return max 3 suggestions
    } catch (error) {
        console.error('Date suggestion error:', error);
        return [];
    }
}

/**
 * Generate actionable recommendations based on analysis
 */
function generateRecommendations(analysis) {
    const recommendations = [];

    // Deadline-related recommendations
    if (analysis.deadlineImpact?.hasConflict) {
        if (analysis.deadlineImpact.severity === 'critical') {
            recommendations.push({
                priority: 'high',
                action: 'Delegate critical tasks',
                details: 'Consider delegating high-priority tasks before leave or adjusting dates.'
            });
        } else {
            recommendations.push({
                priority: 'medium',
                action: 'Plan task handover',
                details: 'Ensure all pending tasks are documented and assigned to a colleague.'
            });
        }
    }

    // Coverage-related recommendations
    if (analysis.coverageRisk?.riskLevel === 'high') {
        recommendations.push({
            priority: 'high',
            action: 'Consider alternate dates',
            details: analysis.suggestedDates?.length > 0
                ? `Suggested window: ${analysis.suggestedDates[0].startDate} to ${analysis.suggestedDates[0].endDate}`
                : 'Team coverage is low. Consider staggering leave with team members.'
        });
    } else if (analysis.coverageRisk?.riskLevel === 'medium') {
        recommendations.push({
            priority: 'medium',
            action: 'Coordinate with team',
            details: 'Notify team members early to ensure smooth coverage.'
        });
    }

    // Role criticality recommendations
    if (analysis.roleCriticality?.level === 'high') {
        recommendations.push({
            priority: 'high',
            action: 'Arrange temporary coverage',
            details: 'Critical role requires a designated backup during absence.'
        });
    }

    // Overlapping leave recommendations
    if (analysis.overlappingLeaves?.length > 2) {
        recommendations.push({
            priority: 'high',
            action: 'Review team availability',
            details: `${analysis.overlappingLeaves.length} team members already on/requesting leave during this period.`
        });
    } else if (analysis.overlappingLeaves?.length > 0) {
        recommendations.push({
            priority: 'low',
            action: 'Note overlapping leaves',
            details: `${analysis.overlappingLeaves.length} colleague(s) also on leave during this period.`
        });
    }

    // If no issues, add positive confirmation
    if (recommendations.length === 0) {
        recommendations.push({
            priority: 'low',
            action: 'Good to proceed',
            details: 'No significant conflicts detected. Standard handover procedures apply.'
        });
    }

    return recommendations.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
}

export default {
    analyzeLeaveRequest,
    checkProjectDeadlines,
    calculateTeamCoverage,
    assessRoleCriticality,
    detectOverlappingLeaves,
    suggestAlternateDates
};
