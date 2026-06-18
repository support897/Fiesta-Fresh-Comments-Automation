import { NextResponse } from 'next/server';
import { getDb } from '@/lib/sqliteClient';

export async function GET() {
    try {
        const db = await getDb();

        // 1. Get stats
        const totalLeads = await db.get('SELECT COUNT(*) as count FROM leads');
        const pendingLeads = await db.get('SELECT COUNT(*) as count FROM leads WHERE status = ?', ['pending']);
        const approvedLeads = await db.get('SELECT COUNT(*) as count FROM leads WHERE status = ?', ['approved']);
        const postedLeads = await db.get('SELECT COUNT(*) as count FROM leads WHERE status = ?', ['posted']);
        const activeGroups = await db.get('SELECT COUNT(*) as count FROM groups WHERE is_active = 1');

        // 2. Get active template
        const template = await db.get('SELECT content FROM templates WHERE is_active = 1 LIMIT 1');

        // 3. Get config
        const config = await db.get('SELECT bot_status FROM config LIMIT 1');

        // 4. Get recent activity log (last 5 posted leads)
        const recentActivity = await db.all('SELECT group_url, post_text, updated_at FROM leads WHERE status = ? ORDER BY updated_at DESC LIMIT 5', ['posted']);

        return NextResponse.json({
            success: true,
            stats: {
                total: totalLeads?.count || 0,
                pending: pendingLeads?.count || 0,
                approved: approvedLeads?.count || 0,
                posted: postedLeads?.count || 0,
                groups: activeGroups?.count || 0
            },
            template: template?.content || '',
            botActive: config ? !!config.bot_status : false,
            recentActivity
        });
    } catch (e: any) {
        console.error("❌ Stats API failed:", e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const db = await getDb();
        const body = await request.json();
        const { botStatus, template } = body;

        // Toggle bot status
        if (botStatus !== undefined) {
            const statusInt = botStatus ? 1 : 0;
            await db.run('UPDATE config SET bot_status = ?, updated_at = CURRENT_TIMESTAMP', [statusInt]);
            console.log(`🤖 Config updated: Bot status set to ${botStatus}`);
        }

        // Save active template
        if (template !== undefined) {
            await db.run('UPDATE templates SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE is_active = 1', [template]);
            console.log("📝 Active template content updated.");
        }

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error("❌ Update Stats API failed:", e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
