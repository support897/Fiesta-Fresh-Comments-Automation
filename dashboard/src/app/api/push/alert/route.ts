import { NextRequest, NextResponse } from "next/server";

/**
 * Urgent Alert — sends a ONCE-PER-INCIDENT push notification.
 * The incidentKey ensures the user only gets ONE alert per incident,
 * never repeated. Call this when:
 * - Cookies expire/die
 * - Bot goes offline
 * - Critical failures need user attention
 */
export async function POST(req: NextRequest) {
  try {
    const { incidentKey, title, body, url } = await req.json();

    if (!incidentKey || !title) {
      return NextResponse.json({ error: "incidentKey and title required" }, { status: 400 });
    }

    // Forward to push/send which handles the once-per-incident deduplication
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://fiesta-comments-dashboard.vercel.app";
    const pushRes = await fetch(`${baseUrl}/api/push/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `🚨 ${title}`,
        body: body || "Needs your attention",
        url: url || "/",
        tag: `urgent-${incidentKey}`,
        incidentKey: `urgent-${incidentKey}`,
        requireInteraction: true, // Stays on screen until dismissed
      }),
    });

    const result = await pushRes.json();
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
