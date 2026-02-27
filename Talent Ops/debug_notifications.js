import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkNotifications() {
    console.log('Checking for AI Risk Alerts...');
    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('type', 'ai_risk_alert')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error fetching notifications:', error);
        return;
    }

    if (data.length === 0) {
        console.log('No AI Risk Alerts found in notifications table.');
    } else {
        console.log('Found Notifications:', JSON.stringify(data, null, 2));
    }

    console.log('\nChecking for Task Risk Snapshots...');
    const { data: snapshots, error: snapError } = await supabase
        .from('task_risk_snapshots')
        .select('*')
        .order('computed_at', { ascending: false })
        .limit(5);

    if (snapError) {
        console.error('Error fetching snapshots:', snapError);
        return;
    }

    if (snapshots.length === 0) {
        console.log('No Risk Snapshots found.');
    } else {
        console.log('Found Snapshots:', JSON.stringify(snapshots, null, 2));
    }
}

checkNotifications();
