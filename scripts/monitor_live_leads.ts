import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../bot/.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xmxywlyqdqrfrojwggkt.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhteHl3bHlxZHFyZnJvandnZ2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxOTU3MjMsImV4cCI6MjA4Nzc3MTcyM30.4qF_c-V0LwR1ZqV0Xz7yD4pZc-V0LwR1ZqV0Xz7yD4p';

const supabase = createClient(supabaseUrl, supabaseKey);

async function monitor() {
    console.log('📡 Fetching latest 15 discovered leads from Supabase...\n');
    const { data: leads, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(15);

    if (error) {
        console.error('❌ Supabase error:', error.message);
        return;
    }

    if (!leads || leads.length === 0) {
        console.log('No leads recorded yet.');
        return;
    }

    console.log(`Found ${leads.length} recent leads:\n`);
    for (const [idx, lead] of leads.entries()) {
        console.log(`──────────────────────────────────────────────`);
        console.log(`[#${idx + 1}] Post ID: ${lead.post_id}`);
        console.log(`Status: ${lead.status === 'approved' ? '✅ APPROVED' : '❌ ' + lead.status}`);
        console.log(`Group: ${lead.group_url}`);
        console.log(`Created: ${new Date(lead.created_at).toLocaleString()}`);
        console.log(`Post Body:\n${lead.post_text}`);
        console.log(`──────────────────────────────────────────────\n`);
    }

    const { data: replies } = await supabase
        .from('replies_log')
        .select('*')
        .order('replied_at', { ascending: false })
        .limit(5);

    console.log(`\n💬 Latest 5 Posted Replies:`);
    for (const r of replies || []) {
        console.log(`• Post: ${r.post_id} | Account: ${r.user_profile_id} | Time: ${new Date(r.replied_at).toLocaleString()}`);
    }
}

monitor().catch(console.error);
