import { NextResponse } from 'next/server';
import { approveLead, rejectLead } from '@/lib/sqliteClient';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { id, action, reason } = body;

        if (!id || !action) {
            return NextResponse.json({ success: false, error: 'Missing id or action' }, { status: 400 });
        }

        if (action === 'approve') {
            await approveLead(id);
        } else if (action === 'reject') {
            await rejectLead(id, reason || '');
        } else {
            return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("❌ API Update Lead error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
