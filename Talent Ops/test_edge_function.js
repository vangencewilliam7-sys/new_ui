import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testAnalysis() {
    console.log('Testing Edge Function directly...');

    // 1. Get a task ID
    const { data: tasks } = await supabase.from('tasks').select('id, title, org_id').limit(1);
    if (!tasks || tasks.length === 0) {
        console.log('No tasks found to test with.');
        return;
    }
    const task = tasks[0];
    console.log(`Using task: ${task.title} (${task.id})`);

    // 2. Mock Metrics
    const metrics = {
        task_id: task.id,
        org_id: task.org_id,
        allocated_hours: 1,
        elapsed_hours: 0.5,
        progress_ratio: 0.2,
        predicted_total_hours: 2.5,
        predicted_delay_hours: 1.5,
        base_risk_level: 'medium'
    };

    // 3. Invoke Function
    console.log('Invoking analyze-task-risk...');
    const startTime = Date.now();
    const { data, error } = await supabase.functions.invoke('analyze-task-risk', {
        body: {
            metrics,
            taskTitle: task.title,
            employeeContext: { full_name: 'Test Bot', role: 'admin', is_micro_task: false }
        }
    });

    if (error) {
        console.error('Edge Function Error:', error);
        return;
    }

    console.log(`Success! Time: ${Date.now() - startTime}ms`);
    console.log('AI Response:', JSON.stringify(data, null, 2));

    // 4. Try to save it via RPC
    console.log('Testing RPC directly...');
    const { data: rpcData, error: rpcError } = await supabase.rpc('rpc_insert_task_risk_snapshot', {
        p_org_id: task.org_id,
        p_task_id: task.id,
        p_elapsed_hours: metrics.elapsed_hours,
        p_steps_completed: 1,
        p_total_steps: 5,
        p_progress_ratio: metrics.progress_ratio,
        p_predicted_total_hours: metrics.predicted_total_hours,
        p_predicted_delay_hours: metrics.predicted_delay_hours,
        p_risk_level: data.risk_level,
        p_confidence: data.confidence,
        p_reasons: data.reasons,
        p_actions: data.recommended_actions,
        p_model: 'gpt-4o-mini',
        p_raw_response: data
    });

    if (rpcError) {
        console.error('RPC Error:', rpcError);
    } else {
        console.log('RPC Success!', rpcData);
    }
}

testAnalysis();
