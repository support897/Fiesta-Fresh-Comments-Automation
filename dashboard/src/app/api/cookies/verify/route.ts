import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ valid: false, error: "Email required" }, { status: 400 });
    }

    // Get cookies from Supabase
    const { data, error } = await supabase
      .from("sessions")
      .select("cookies")
      .eq("user_email", email)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data?.cookies || !Array.isArray(data.cookies) || data.cookies.length === 0) {
      return NextResponse.json({ valid: false, error: "No cookies found" });
    }

    // Build cookie header
    const cookieHeader = data.cookies
      .map((c: any) => `${c.name}=${c.value}`)
      .join("; ");
    const cUser = (data.cookies as any[]).find((c: any) => c.name === "c_user")?.value as string | undefined;

    // REAL session check: one lightweight request to Facebook, three evidence layers.
    // Layer 1 — Facebook kills the session server-side (Set-Cookie: c_user=deleted).
    // Layer 2 — Facebook bounces us to the login page (redirect or login HTML).
    // Layer 3 — a logged-in homepage always embeds the viewer's user ID in the HTML.
    // NOTE (root cause 2026-10-03): Facebook's edge returns a bare 400 Error page
    // unless the request carries full browser headers (Sec-Fetch-*, etc.). With
    // minimal headers even a LIVE session looks dead. Always send the full set.
    const res = await fetch("https://www.facebook.com/", {
      headers: {
        "Cookie": cookieHeader,
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
      },
      redirect: "manual",
    });

    const setCookies: string[] = [];
    const single = res.headers.get("set-cookie");
    if (single) setCookies.push(single);
    try {
      const multi = (res.headers as any).getSetCookie?.();
      if (Array.isArray(multi)) setCookies.push(...multi);
    } catch {}
    const killed = setCookies.some((sc) => /c_user=deleted/i.test(sc));

    const location = res.headers.get("location") || "";
    const bouncedToLogin = res.status >= 300 && res.status < 400 && /\/login/i.test(location);

    let body = "";
    try {
      body = await res.text();
    } catch {}
    const hasUserId = !!cUser && body.includes(cUser);
    const looksLoggedOut = /login_form|id="loginform"|name="login"/i.test(body) && !hasUserId;

    // Verdict: live only on positive evidence (our user ID in Facebook's own HTML).
    // Dead on any kill/bounce/logged-out signal. Anything else = inconclusive (never guessed).
    let valid: boolean | null = null;
    let reason = "";
    const isErrorPage = res.status === 400 && /<title>Error<\/title>/i.test(body);
    if (killed) { valid = false; reason = "facebook_deleted_session"; }
    else if (bouncedToLogin) { valid = false; reason = "redirected_to_login"; }
    else if (hasUserId) { valid = true; reason = "user_id_in_homepage"; }
    else if (looksLoggedOut) { valid = false; reason = "login_page_served"; }
    else if (isErrorPage) { valid = null; reason = "request_blocked"; }
    else { valid = null; reason = "inconclusive"; }

    // Store the real verdict (columns exist via migration 20261003_sessions_verified).
    // Inconclusive (null) is stored as-is — the UI shows "unknown", never a guessed green/red.
    const { error: updateError } = await supabase.from("sessions").update({
      verified: valid,
      verified_at: new Date().toISOString(),
    }).eq("user_email", email);
    if (updateError) {
      return NextResponse.json(
        { valid: false, error: `Check ran (${reason}) but saving the status failed: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ valid, reason });
  } catch (e: any) {
    return NextResponse.json({ valid: false, error: e.message }, { status: 500 });
  }
}
