import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

/**
 * Monday Weekly Report — sends push notification with week's stats.
 * Called by Vercel Cron every Monday morning (Australia/Brisbane).
 * Protect with CRON_SECRET to prevent unauthorized calls.
 */
export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get start of week (Monday 00:00 Brisbane)
    const now = new Date();
    const brisbaneNow = new Date(now.toLocaleString("en-US", { timeZone: "Australia/Brisbane" }));
    const dayOfWeek = brisbaneNow.getDay(); // 0=Sun, 1=Mon
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(brisbaneNow);
    monday.setDate(monday.getDate() - daysSinceMonday);
    monday.setHours(0, 0, 0, 0);

    // Query comment_queue for this week's activity
    const { data: posted } = await supabase
      .from("comment_queue")
      .select("id", { count: "exact" })
      .eq("status", "posted")
      .gte("posted_at", monday.toISOString());

    const { data: failed } = await supabase
      .from("comment_queue")
      .select("id", { count: "exact" })
      .eq("status", "failed")
      .gte("updated_at", monday.toISOString());

    const { data: pending } = await supabase
      .from("comment_queue")
      .select("id", { count: "exact" })
      .eq("status", "draft_ready");

    const postedCount = posted?.length ?? 0;
    const failedCount = failed?.length ?? 0;
    const pendingCount = pending?.length ?? 0;

    const title = "📊 Fiesta Fresh Weekly Report";
    const body = `This week: ${postedCount} posted ✅, ${failedCount} failed ❌, ${pendingCount} pending ⏳`;

    // Send via push API (internal call)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://fiesta-comments-dashboard.vercel.app";
    const pushRes = await fetch(`${baseUrl}/api/push/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        body,
        url: "/commented",
        tag: `weekly-report-${monday.toISOString().slice(0, 10)}`,
        incidentKey: `weekly-${monday.toISOString().slice(0, 10)}`, // Once per week
      }),
    });

    const result = await pushRes.json();
    return NextResponse.json({ ok: true, stats: { postedCount, failedCount, pendingCount }, push: result });
  } catch (e: any) {
    console.error("Weekly report error:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
