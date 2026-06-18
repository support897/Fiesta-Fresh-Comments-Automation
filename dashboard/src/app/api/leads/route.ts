import { NextResponse } from 'next/server';
import { getPendingLeads } from '@/lib/sqliteClient';

export async function GET() {
    try {
        const leads = await getPendingLeads();
        return NextResponse.json({ success: true, data: leads });
    } catch (error: any) {
        console.error("❌ API Fetch Leads error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
