import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

// Lazy-load web-push to avoid bundling issues
async function getWebPush() {
  const webpush = (await import("web-push")).default;
  webpush.setVapidDetails(
    "mailto:ilse@fiestafreshcleaning.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  return webpush;
}

export async function POST(req: NextRequest) {
  try {
    const { title, body, url, tag, incidentKey, requireInteraction } = await req.json();

    if (!title) {
      return NextResponse.json({ error: "Title required" }, { status: 400 });
    }

    // Once-per-incident guard: if incidentKey provided, skip if already sent
    if (incidentKey) {
      const { data: existing } = await supabase
        .from("notification_log")
        .select("id")
        .eq("incident_key", incidentKey)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({ ok: true, skipped: true, reason: "already_sent" });
      }
    }

    // Get all subscriptions
    const { data: subs, error } = await supabase.from("push_subscriptions").select("*");
    if (error || !subs?.length) {
      return NextResponse.json({ ok: true, sent: 0, reason: "no_subscriptions" });
    }

    const webpush = await getWebPush();
    const payload = JSON.stringify({
      title,
      body: body || "",
      url: url || "/",
      tag: tag || `fiesta-${Date.now()}`,
      requireInteraction: !!requireInteraction,
    });

    let sent = 0;
    let failed = 0;

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } } as any,
          payload
        );
        sent++;
        // Update last_used
        await supabase.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).eq("id", sub.id);
      } catch (e: any) {
        failed++;
        // Remove dead subscriptions (410 Gone)
        if (e.statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    }

    // Log incident to prevent duplicates
    if (incidentKey) {
      await supabase.from("notification_log").upsert(
        { incident_key: incidentKey, title, body: body || "" },
        { onConflict: "incident_key" }
      );
    }

    return NextResponse.json({ ok: true, sent, failed });
  } catch (e: any) {
    console.error("Push send error:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
