import { supabase } from '../../../lib/supabaseClient';

export const riskService = {

    /**
     * 1. Compute Truth Metrics (Math Layer)
     * Calls the database RPC to calculate delays based on pure data.
     */
    computeRiskMetrics: async (taskId) => {
        try {
            const { data, error } = await supabase.rpc('rpc_compute_task_risk_metrics', { p_task_id: taskId });
            if (error) throw error;
            return data;
        } catch (err) {
            console.error('Error computing risk metrics:', err);
            return null;
        }
    },

    /**
     * 2. Trigger Full AI Analysis
     * - Gets metrics
     * - Calls Edge Function (AI)
     * - Saves Snapshot to DB
     */
    analyzeRisk: async (taskId, taskTitle, employeeContext = {}) => {
        try {
            // A. Get Metrics
            const metrics = await riskService.computeRiskMetrics(taskId);
            if (!metrics) throw new Error('Could not compute metrics');

            // B. Call OpenAI via Edge Function
            const { data: aiAnalysis, error: functionError } = await supabase.functions.invoke('analyze-task-risk', {
                body: { metrics, taskTitle, employeeContext }
            });

            if (functionError) throw functionError;

            // C. Save Snapshot
            const snapshotPayload = {
                p_org_id: metrics.org_id,
                p_task_id: taskId,
                p_elapsed_hours: metrics.elapsed_hours,
                p_steps_completed: metrics.steps_completed,
                p_total_steps: metrics.total_steps,
                p_progress_ratio: metrics.progress_ratio || 0, // ensure not null
                p_predicted_total_hours: metrics.predicted_total_hours,
                p_predicted_delay_hours: metrics.predicted_delay_hours,

                // AI Data
                p_risk_level: aiAnalysis.risk_level,
                p_confidence: aiAnalysis.confidence,
                p_reasons: aiAnalysis.reasons || [],
                p_actions: aiAnalysis.recommended_actions || [],
                p_model: 'gpt-4o-mini',
                p_raw_response: aiAnalysis
            };

            const { data: snapshotData, error: saveError } = await supabase.rpc('rpc_insert_task_risk_snapshot', snapshotPayload);

            if (saveError) {
                console.error('Failed to save snapshot:', saveError);
                // Don't throw, return the analysis at least so UI can show it
            }

            return {
                metrics,
                analysis: aiAnalysis,
                snapshotId: snapshotData?.snapshot_id
            };

        } catch (err) {
            console.error('Error in analyzeRisk:', err);
            throw err;
        }
    },

    /**
     * 3. Get Latest Snapshot
     * Used to display the badge and cached analysis.
     */
    getLatestSnapshot: async (taskId) => {
        const { data, error } = await supabase
            .from('task_risk_snapshots')
            .select('*')
            .eq('task_id', taskId)
            .order('computed_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows found"
            console.error('Error fetching snapshot:', error);
        }
        return data; // returns null if no rows
    },

    /**
     * 3b. Get Latest Snapshots for Multiple Tasks (Bulk)
     */
    getLatestSnapshotsForTasks: async (taskIds) => {
        if (!taskIds || taskIds.length === 0) return {};

        // Fetch all snapshots for these tasks
        // optimize: strictly we only need the latest, but SQL 'distinct on' via JS SDK is tricky
        // so we fetch, order by date desc, and dedupe in JS
        const { data, error } = await supabase
            .from('task_risk_snapshots')
            .select('*')
            .in('task_id', taskIds)
            .order('computed_at', { ascending: false });

        if (error) {
            console.error('Error fetching bulk snapshots:', error);
            return {};
        }

        const latestMap = {};
        (data || []).forEach(snap => {
            // Since it's ordered by desc, the first one we encounter for a task_id is the latest
            if (!latestMap[snap.task_id]) {
                latestMap[snap.task_id] = snap;
            }
        });

        return latestMap;
    },

    /**
     * 4. Toggle Active Status
     * Green Dot Indicator
     */
    toggleActiveStatus: async (taskId, isActive) => {
        const { data, error } = await supabase
            .from('tasks')
            .update({ is_active_now: isActive })
            .eq('id', taskId)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    /**
     * 5. Get Active Task for Employee
     * Check if employee is working on anything right now
     */
    getActiveTaskForUser: async (userId) => {
        const { data, error } = await supabase
            .from('tasks')
            .select('id, title')
            .eq('assigned_to', userId)
            .eq('is_active_now', true)
            .maybeSingle();
        return data;
    },

    /**
     * 6. Bulk Sync Baseline
     * Ensures every task has at least a mathematical baseline snapshot
     */
    syncDailyRisks: async (taskIds) => {
        if (!taskIds || taskIds.length === 0) return;
        const { data, error } = await supabase.rpc('rpc_sync_daily_task_risks', { p_task_ids: taskIds });
        if (error) console.error('Bulk sync failed:', error);
        return data;
    }
};
